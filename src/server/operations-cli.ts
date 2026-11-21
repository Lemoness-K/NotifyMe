import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { DeleteJournal } from './delete-journal.js';
import { Activation, acquireOwnership, bindGeneration, databaseGeneration } from './operations/activation.js';
import { OperationsReporter, type Health } from './operations/reporting.js';
import { restoreBackup } from './operations/restore.js';
import { localOperationsSettings, operationsSettings } from './operations/settings.js';
import { lastBackup, localRequest } from './operations/socket.js';
import { openStore } from './storage.js';
import { WorkService } from './work-service.js';

const log = (record: unknown) => process.stdout.write(JSON.stringify(record) + '\n');

try {
  const [command, id, extra] = process.argv.slice(2);
  if (extra || (command !== 'restore' && id)) throw new Error('OPERATIONS_COMMAND_INVALID');
  const local = localOperationsSettings();
  const journalPath = resolve(process.env.NOTIFY_DELETE_JOURNAL_PATH ?? join(local.state, 'delete-journal.sqlite'));
  if (dirname(journalPath) !== local.state) throw new Error('OPERATIONS_JOURNAL_INVALID');
  const activation = new Activation(local.state);
  if (command === 'initialize') {
    const operations = operationsSettings()!;
    const release = acquireOwnership(operations.state);
    try {
      const database = resolve(process.env.NOTIFY_DATABASE_PATH ?? '');
      if (dirname(database) !== operations.state || database === journalPath || databaseGeneration(database) !== undefined) {
        throw new Error('OPERATIONS_INITIALIZATION_REFUSED');
      }
      const db = await openStore(database);
      let journal: DeleteJournal | undefined;
      try {
        journal = await DeleteJournal.open(db, journalPath);
        await new WorkService(db, undefined, undefined, journal).reconcileCommittedDeletes();
        await journal.initializeAuthority(operations.authority, db);
        operations.archives.initialize();
      } finally { journal?.close(); await db.$disconnect(); }
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
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z_]{2,50}$/.test(error.message) ? error.message : 'OPERATIONS_FAILED';
  process.stderr.write(JSON.stringify({ state: 'FAILED', code }) + '\n');
  process.exitCode = 1;
}
