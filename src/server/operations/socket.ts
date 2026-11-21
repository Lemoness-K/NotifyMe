import { chmodSync, lstatSync, rmSync, statfsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { join } from 'node:path';
import type { WorkService } from '../work-service.js';
import { atomicRecord, isMissing, readProtected } from './files.js';
import type { operationsSettings } from './settings.js';

type Settings = NonNullable<ReturnType<typeof operationsSettings>>;

export function lastBackup(state: string) {
  try { return JSON.parse(readProtected(join(state, 'last-backup.json'))); }
  catch (error) { if (!isMissing(error)) throw error; return null; }
}

export async function listenOperations(settings: Settings, database: string, work: WorkService,
  log: (event: Record<string, unknown>) => void) {
  try {
    if (!lstatSync(settings.socket).isSocket()) throw new Error('OPERATIONS_SOCKET_INVALID');
    rmSync(settings.socket);
  } catch (error) { if (!isMissing(error)) throw error; }
  let backingUp = false;
  async function backup() {
    const started = new Date();
    if (backingUp) throw new Error('BACKUP_IN_PROGRESS');
    backingUp = true;
    const path = join(settings.state, 'last-backup.json');
    try {
      atomicRecord(path, { state: 'RUNNING', startedAt: started.toISOString() });
      const item = await settings.archives.capture(database, work, started);
      const outcome = { state: 'SUCCEEDED', id: item.id, startedAt: started.toISOString(), at: new Date().toISOString() };
      atomicRecord(path, outcome);
      log({ event: 'BACKUP_FINISHED', ...outcome });
      return outcome;
    } catch (error) {
      const name = error instanceof Error && /^[A-Z][A-Z_]{2,50}$/.test(error.message) ? error.message : 'BACKUP_FAILED';
      const outcome = { state: 'FAILED', code: name, startedAt: started.toISOString(), at: new Date().toISOString() };
      atomicRecord(path, outcome);
      log({ event: 'BACKUP_FINISHED', ...outcome });
      throw error;
    } finally { backingUp = false; }
  }
  const server = createServer(async (incoming, response) => {
    incoming.resume();
    response.setHeader('Content-Type', 'application/json');
    try {
      if (incoming.method === 'GET' && incoming.url === '/status') {
        let state = 'READY';
        try { await work.db.$queryRaw`SELECT 1`; }
        catch { state = 'UNAVAILABLE'; }
        const { bsize, bavail } = statfsSync(settings.state);
        response.end(JSON.stringify({ state, rss: process.memoryUsage().rss, freeBytes: bsize * bavail,
          backup: lastBackup(settings.state) }));
      } else if (incoming.method === 'POST' && incoming.url === '/backup') {
        response.end(JSON.stringify(await backup()));
      } else {
        response.statusCode = 404;
        response.end('{"code":"OPERATIONS_NOT_FOUND"}');
      }
    } catch {
      response.statusCode = 503;
      response.end('{"code":"OPERATIONS_UNAVAILABLE"}');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.socket, resolve);
  });
  try { chmodSync(settings.socket, 0o600); }
  catch (error) { server.close(); throw error; }
  return () => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      try { rmSync(settings.socket, { force: true }); }
      catch (failure) { reject(failure); return; }
      if (error) reject(error); else resolve();
    });
  });
}

export function localRequest(socketPath: string, path: '/status' | '/backup') {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const client = request({ socketPath, path, method: path === '/backup' ? 'POST' : 'GET' }, (response) => {
      let content = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        content += chunk;
        if (content.length > 16_384) client.destroy(new Error('OPERATIONS_RESPONSE_INVALID'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('OPERATIONS_CHECK_FAILED');
          resolve(JSON.parse(content));
        } catch (error) { reject(error); }
      });
    });
    client.setTimeout(path === '/status' ? 5000 : 300_000, () => client.destroy(new Error('OPERATIONS_CHECK_FAILED')));
    client.on('error', reject);
    client.end();
  });
}
