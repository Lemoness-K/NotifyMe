import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { setupIngressAllowed } from './config.js';
import { DeleteJournal } from './delete-journal.js';
import type { PrismaClient } from './generated/client.js';
import { Activation, acquireOwnership, bindGeneration, databaseGeneration } from './operations/activation.js';
import { OperationsReporter, type Health } from './operations/reporting.js';
import { restoreBackup } from './operations/restore.js';
import { isMissing } from './operations/files.js';
import { prepareNewInstallation } from './operations/setup-authority.js';
import { backupRetentionSettings, localOperationsSettings, operationsSettings } from './operations/settings.js';
import { lastBackup, localRequest } from './operations/socket.js';
import { openStore } from './storage.js';
import { WorkService } from './work-service.js';

const log = (record: unknown) => process.stdout.write(JSON.stringify(record) + '\n');
const execFileAsync = promisify(execFile);

async function initializeOperationalStores(db: PrismaClient, journalPath: string,
  operations: NonNullable<ReturnType<typeof operationsSettings>>) {
  const journal = await DeleteJournal.open(db, journalPath);
  try {
    await new WorkService(db, undefined, undefined, journal).reconcileCommittedDeletes();
    await journal.initializeAuthority(operations.authority, db);
    operations.archives.initialize();
  } finally { journal.close(); }
}

async function run(command: string | undefined, id: string | undefined) {
  if (command === 'prune-backups') {
    const expired = backupRetentionSettings().pruneExpired(new Date());
    log({ event: 'BACKUP_RETENTION_FINISHED', state: 'SUCCEEDED', expired });
    return;
  }
  const local = localOperationsSettings();
  const journalPath = resolve(process.env.NOTIFY_DELETE_JOURNAL_PATH ?? join(local.state, 'delete-journal.sqlite'));
  if (dirname(journalPath) !== local.state) throw new Error('OPERATIONS_JOURNAL_INVALID');
  const activation = new Activation(local.state);
  if (command === 'prepare-new-installation') {
    if (!setupIngressAllowed(process.env)) throw new Error('SETUP_INGRESS_REQUIRED');
    const operations = operationsSettings()!;
    const database = resolve(process.env.NOTIFY_DATABASE_PATH ?? '');
    if (database === journalPath || !process.env.NOTIFY_DATABASE_PATH) throw new Error('SETUP_PREPARATION_REFUSED');
    await prepareNewInstallation(operations.state, database, async (db) => {
      try {
        lstatSync(journalPath);
        throw new Error('SETUP_PREPARATION_REFUSED');
      } catch (error) { if (!isMissing(error)) throw error; }
      await initializeOperationalStores(db, journalPath, operations);
    }, async (path) => {
      await execFileAsync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        env: { ...process.env, DATABASE_URL: pathToFileURL(path).href },
      });
    });
    log({ state: 'SETUP_PREPARED' });
  } else if (command === 'initialize') {
    const operations = operationsSettings()!;
    const release = acquireOwnership(operations.state);
    try {
      const database = resolve(process.env.NOTIFY_DATABASE_PATH ?? '');
      if (dirname(database) !== operations.state || database === journalPath || databaseGeneration(database) !== undefined) {
        throw new Error('OPERATIONS_INITIALIZATION_REFUSED');
      }
      const db = await openStore(database);
      try {
        await initializeOperationalStores(db, journalPath, operations);
      } finally { await db.$disconnect(); }
      const epoch = randomUUID();
      bindGeneration(database, epoch);
      activation.initialize(database, epoch);
      log({ state: 'INITIALIZED' });
    } finally { release(); }
  } else if (command === 'restore' && id) {
    const operations = operationsSettings()!;
    await restoreBackup({ activation, archives: operations.archives, authority: operations.authority,
      journalPath, state: operations.state, id });
    log({ state: 'VERIFIED' });
  } else if (command === 'backup') {
    log(await localRequest(local.socket, '/backup'));
  } else if (command === 'status' || command === 'observe') {
    let health: Health = 'READY';
    let status: Record<string, unknown>;
    try {
      status = await localRequest(local.socket, '/status');
      if (status.state === 'UNAVAILABLE') health = 'UNAVAILABLE';
      else if (status.state !== 'READY') health = 'CHECK_FAILED';
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      health = code === 'ENOENT' || code === 'ECONNREFUSED' ? 'UNAVAILABLE' : 'CHECK_FAILED';
      status = { state: health, backup: lastBackup(local.state) };
    }
    if (command === 'status') log(status);
    else {
      const backup = status.backup as { state?: string } | undefined;
      const release = acquireOwnership(local.state, 'observer');
      try { new OperationsReporter(local, log).observe(new Date(), health, backup?.state); }
      finally { release(); }
    }
  } else {
    throw new Error('OPERATIONS_COMMAND_INVALID');
  }
}

const [command, id, extra] = process.argv.slice(2);
try {
  if (extra || (command !== 'restore' && id)) throw new Error('OPERATIONS_COMMAND_INVALID');
  await run(command, id);
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z_]{2,50}$/.test(error.message) ? error.message : 'OPERATIONS_FAILED';
  const event = command === 'prune-backups' ? 'BACKUP_RETENTION_FAILED' : undefined;
  process.stderr.write(JSON.stringify({ event, state: 'FAILED', code }) + '\n');
  process.exitCode = 1;
}
