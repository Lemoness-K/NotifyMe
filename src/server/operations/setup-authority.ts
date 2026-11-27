import { randomUUID } from 'node:crypto';
import { closeSync, constants, lstatSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Prisma, PrismaClient } from '../generated/client.js';
import { openStore } from '../storage.js';
import { Activation, acquireOwnership, bindGeneration, databaseGeneration } from './activation.js';
import { atomicRecord, isMissing, readProtected } from './files.js';

type SetupTarget = {
  version: 1;
  setupCycle: string;
  databaseIdentity: string;
  database: string;
  activationEpoch: string;
  fileIdentity: string;
};
export type OpenSetupGrant = SetupTarget & { phase: 'OPEN' };
type CommittingSetupGrant = SetupTarget & { phase: 'COMMITTING'; confirmingCandidate: string };
export type BoundSetupGrant = OpenSetupGrant | CommittingSetupGrant | (SetupTarget & { phase: 'SEALED' });
type Db = PrismaClient | Prisma.TransactionClient;
const identifier = /^[A-Za-z0-9_-]{1,128}$/;
const unavailable = () => new Error('SETUP_TARGET_UNAVAILABLE');
const grantPath = (state: string) => join(state, 'installation-setup.json');

function fileIdentity(path: string) {
  const entry = lstatSync(path, { bigint: true });
  if (!entry.isFile()) throw unavailable();
  return String(entry.dev) + ':' + String(entry.ino);
}

function readGrant(state: string): BoundSetupGrant | undefined {
  try {
    const record = JSON.parse(readProtected(grantPath(state)));
    if (record?.version === 1 && record.phase === 'SEALED' && record.setupCycle === undefined) return;
    if (record?.version !== 1 || !['OPEN', 'COMMITTING', 'SEALED'].includes(record.phase) ||
        ![record.setupCycle, record.databaseIdentity, record.activationEpoch].every(
          (value) => typeof value === 'string' && identifier.test(value)) ||
        typeof record.database !== 'string' ||
        typeof record.fileIdentity !== 'string' || !/^\d+:\d+$/.test(record.fileIdentity) ||
        (record.phase === 'COMMITTING' &&
          (typeof record.confirmingCandidate !== 'string' || !identifier.test(record.confirmingCandidate)))) {
      throw unavailable();
    }
    return record;
  } catch (error) {
    if (isMissing(error)) return;
    throw unavailable();
  }
}

function requireAbsent(path: string) {
  try { lstatSync(path); }
  catch (error) { if (isMissing(error)) return; throw error; }
  throw new Error('SETUP_PREPARATION_REFUSED');
}

export async function prepareNewInstallation(
  state: string, database: string, initializeOperations: (db: PrismaClient) => Promise<void>,
  migrateDatabase?: (database: string) => Promise<void>,
) {
  if (dirname(database) !== state || resolve(database) !== database || !database.endsWith('.sqlite')) {
    throw new Error('SETUP_PREPARATION_REFUSED');
  }
  const release = acquireOwnership(state);
  try {
    requireAbsent(join(state, 'serving.json'));
    requireAbsent(grantPath(state));
    for (const suffix of ['-wal', '-shm', '-journal']) requireAbsent(database + suffix);
    closeSync(openSync(database, constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_RDWR, 0o600));
    await migrateDatabase?.(database);
    const db = await openStore(database, { migrate: !migrateDatabase });
    const { setupCycle, databaseIdentity, activationEpoch } = {
      setupCycle: randomUUID(), databaseIdentity: randomUUID(), activationEpoch: randomUUID(),
    };
    try {
      await db.installationSetup.create({ data: { setupCycle, databaseIdentity } });
      await initializeOperations(db);
    } finally { await db.$disconnect(); }
    bindGeneration(database, activationEpoch);
    const grant: OpenSetupGrant = {
      version: 1, phase: 'OPEN', setupCycle, databaseIdentity, database, activationEpoch,
      fileIdentity: fileIdentity(database),
    };
    atomicRecord(grantPath(state), grant, false);
    new Activation(state).initialize(database, activationEpoch);
    return grant;
  } finally { release(); }
}

export class SetupAuthority {
  private pending = Promise.resolve();

  constructor(private readonly state: string, private readonly database: string, private readonly epoch: string) {}

  // Managed serving keeps the operations lock for its whole lifetime. Queue
  // candidate and confirmation writes within that owner as well.
  serial<T>(operation: () => Promise<T>) {
    const result = this.pending.then(operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  async current(db: Db): Promise<BoundSetupGrant | undefined> {
    const record = readGrant(this.state);
    if (!record || record.database !== this.database || record.activationEpoch !== this.epoch) return;
    const verifyTarget = () => {
      const active = new Activation(this.state).active();
      return active.phase === 'ACTIVE' && active.database === this.database && active.epoch === this.epoch &&
        fileIdentity(this.database) === record.fileIdentity && databaseGeneration(this.database) === this.epoch;
    };
    if (!verifyTarget()) return;
    const databases = await db.$queryRaw<{ name: string; file: string }[]>`PRAGMA database_list`;
    if (!databases.some(({ name, file }) => name === 'main' && file === this.database)) return;
    const binding = await db.installationSetup.findUnique({ where: { id: 1 } });
    if (binding?.setupCycle === record.setupCycle && binding.databaseIdentity === record.databaseIdentity && verifyTarget()) {
      return record;
    }
  }

  beginConfirmation(grant: OpenSetupGrant, candidateId: string) {
    const committing: CommittingSetupGrant = { ...grant, phase: 'COMMITTING', confirmingCandidate: candidateId };
    atomicRecord(grantPath(this.state), committing);
    return committing;
  }

  finishConfirmation(grant: BoundSetupGrant) {
    const sealed: BoundSetupGrant = { ...grant, phase: 'SEALED' };
    atomicRecord(grantPath(this.state), sealed);
  }

  reopenAfterRollback(grant: OpenSetupGrant) {
    atomicRecord(grantPath(this.state), grant);
  }

  async recover(db: Db) {
    const record = await this.current(db);
    if (record?.phase !== 'COMMITTING') return;
    const completion = await db.setupCompletion.findUnique({ where: { setupCycle: record.setupCycle } });
    if (completion?.candidateId === record.confirmingCandidate) this.finishConfirmation(record);
  }

  static closeForRestore(state: string) {
    atomicRecord(grantPath(state), { version: 1, phase: 'SEALED' });
  }
}
