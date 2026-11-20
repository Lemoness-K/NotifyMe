import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { request } from 'node:https';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Activation, bindGeneration } from '../../src/server/operations/activation.js';
import { OperationsReporter } from '../../src/server/operations/reporting.js';
import { startManagedRuntime } from '../../src/server/operations/runtime.js';
import { operationsSettings } from '../../src/server/operations/settings.js';
import { listenOperations, localRequest } from '../../src/server/operations/socket.js';
import { WorkService } from '../../src/server/work-service.js';
import { openStore } from '../../src/server/storage.js';
import { basicDatabase, mediaToken, operationsFixture, testKey } from './fixture.js';

let fixture: ReturnType<typeof operationsFixture>;
beforeEach(() => { fixture = operationsFixture(); basicDatabase(fixture.database); });
afterEach(() => fixture.close());
const monday = new Date('2032-01-05T01:00:00Z');

function environment() {
  const key = join(fixture.directory, 'fixture-backup-key');
  const authorityKey = join(fixture.directory, 'fixture-authority-key');
  writeFileSync(key, testKey.toString('base64url'), { mode: 0o600 });
  writeFileSync(authorityKey, Buffer.alloc(32, 6).toString('base64url'), { mode: 0o600 });
  return { NOTIFY_OPS_STATE_DIRECTORY: fixture.state, NOTIFY_OPS_ARCHIVES: fixture.archives,
    NOTIFY_OPS_AUTHORITY_MOUNT: fixture.volume, NOTIFY_OPS_VOLUME_ID: mediaToken, NOTIFY_OPS_KEY_FILE: key,
    NOTIFY_OPS_AUTHORITY_KEY_FILE: authorityKey };
}

it('does not start API or Worker when restored state is blocked', async () => {
  const activation = new Activation(fixture.state);
  activation.block();
  const start = vi.fn();
  await expect(startManagedRuntime(fixture.state, start)).rejects.toThrow('RECOVERY_NOT_ACTIVE');
  expect(start).not.toHaveBeenCalled();
});

it('starts only with the database and epoch in the verified activation', async () => {
  const activation = new Activation(fixture.state);
  bindGeneration(fixture.database, 'trusted-generation');
  activation.initialize(fixture.database, 'trusted-generation');
  const stop = vi.fn(async () => undefined);
  const start = vi.fn(async (_active: { database: string; epoch: string }) => stop);
  const close = await startManagedRuntime(fixture.state, start);
  expect(start.mock.calls[0][0]).toMatchObject({ database: fixture.database, epoch: 'trusted-generation' });
  await close();
  expect(stop).toHaveBeenCalledOnce();
});

it('records weekly and incident transitions once across new processes, without external delivery', () => {
  const options = { state: fixture.state, timeZone: 'Asia/Seoul', weekly: true, incidents: true };
  const record = vi.fn();
  const observe = (delay: number, health: 'READY' | 'UNAVAILABLE' | 'CHECK_FAILED') =>
    new OperationsReporter(options, record).observe(new Date(monday.getTime() + delay), health);
  observe(0, 'UNAVAILABLE');
  observe(100, 'UNAVAILABLE');
  observe(200, 'CHECK_FAILED');
  observe(300, 'READY');
  observe(400, 'UNAVAILABLE');
  expect(record.mock.calls.map(([event]) => event.kind)).toEqual(['INCIDENT', 'WEEKLY', 'CHECK_FAILED', 'RECOVERED', 'INCIDENT']);
  const event = record.mock.calls[1][0];
  expect(event).toMatchObject({ health: 'UNAVAILABLE', incidents: 1 });
});

it('preserves disabled reporting and accepts independent switches', () => {
  const report = vi.fn();
  new OperationsReporter({ state: fixture.state, timeZone: 'UTC', weekly: true, incidents: false }, report)
    .observe(monday, 'UNAVAILABLE');
  expect(report.mock.calls.map(([event]) => event.kind)).toEqual(['WEEKLY']);
});

it('rejects a directory on the operating filesystem even with the configured media marker', () => {
  const operations = operationsSettings({ ...environment(), NOTIFY_MODE: 'target' })!;
  expect(() => operations.authority.baseline('synthetic-lineage', 0)).toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
});

it('serves status through a private Unix socket and persists a backup failure outcome', async () => {
  const config = operationsSettings({ ...environment(), NOTIFY_MODE: 'local', NOTIFY_SYNTHETIC_AUTH: '1' })!;
  const database = await openStore(fixture.database, { migrate: true });
  const log = vi.fn();
  const close = await listenOperations(config, fixture.database, new WorkService(database), log);
  try {
    expect(statSync(config.socket).mode & 0o777).toBe(0o600);
    expect(await localRequest(config.socket, '/status')).toMatchObject({ state: 'READY', backup: null });
    await expect(localRequest(config.socket, '/backup')).rejects.toThrow('OPERATIONS_CHECK_FAILED');
    expect(await localRequest(config.socket, '/status')).toMatchObject({ backup: { state: 'FAILED', code: 'RECOVERY_AUTHORITY_UNAVAILABLE' } });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'BACKUP_FINISHED', state: 'FAILED' }));
  } finally { await close(); await database.$disconnect(); }
});

async function reservePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test listener has no port');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

it('keeps the real Caddy ingress and direct public API closed after a blocked application restart', async () => {
  const startup = vi.fn();
  const activation = new Activation(fixture.state);
  activation.block();
  await expect(startManagedRuntime(fixture.state, startup)).rejects.toThrow('RECOVERY_NOT_ACTIVE');
  expect(startup).not.toHaveBeenCalled();
  const apiPort = await reservePort();
  const proxyPort = await reservePort();
  const path = '/api/v1/households/home/reminders';
  await expect(fetch('http://127.0.0.1:' + apiPort + path)).rejects.toThrow();
  const config = join(fixture.directory, 'Caddyfile');
  const binary = process.env.NOTIFY_TEST_CADDY_BIN ??
    (existsSync('.local/caddy-check/usr/bin/caddy') ? '.local/caddy-check/usr/bin/caddy' : 'caddy');
  const example = readFileSync('deploy/u1/Caddyfile.example', 'utf8');
  writeFileSync(config, '{\n admin off\n skip_install_trust\n auto_https disable_redirects\n}\n' + example
    .replace('https://notify.example.invalid', 'https://127.0.0.1:' + proxyPort)
    .replace('192.0.2.10', '127.0.0.1').replace('127.0.0.1:3443', '127.0.0.1:' + apiPort));
  const child = spawn(binary, ['run', '--config', config, '--adapter', 'caddyfile'], {
    env: { ...process.env, XDG_DATA_HOME: fixture.directory, XDG_CONFIG_HOME: fixture.directory },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  const closed = once(child, 'close');
  void closed.catch(() => undefined);
  const proxy = (path: string) => new Promise<number | undefined>((resolve, reject) => {
    const client = request({ host: '127.0.0.1', port: proxyPort, path, rejectUnauthorized: false },
      (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    client.setTimeout(1000, () => client.destroy(new Error('Proxy timed out')));
    client.on('error', reject);
    client.end();
  });
  try {
    let health: number | undefined;
    for (let attempt = 0; attempt < 40 && child.exitCode === null; attempt++) {
      health = await proxy('/internal/health').catch(() => undefined);
      if (health !== undefined) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(health).toBe(404);
    expect(await proxy(path)).toBe(502);
  } finally { child.kill(); await closed; }
});
