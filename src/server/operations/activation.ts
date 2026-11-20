import { constants, closeSync, openSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { atomicRecord, hashFile, readProtected, syncFile } from './files.js';

type LiveActivation = { phase: 'ACTIVE' | 'VERIFIED'; epoch: string; database: string; cutoff: number; digest?: string };
const generationPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function acquireOwnership(stateDirectory: string, kind: 'operations' | 'observer' = 'operations') {
  const path = join(stateDirectory, kind + '-lock.sqlite');
  closeSync(openSync(path, constants.O_CREAT | constants.O_NOFOLLOW | constants.O_RDWR, 0o600));
  const file = new DatabaseSync(path);
  try { file.exec('PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE'); }
  catch { file.close(); throw new Error('OPERATIONS_BUSY'); }
  return () => file.close();
}

export function databaseGeneration(database: string) {
  const info = lstatSync(database);
  if (!info.isFile()) throw new Error('RECOVERY_GENERATION_MISMATCH');
  const file = new DatabaseSync(database, { readOnly: true });
  try {
    const table = file.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'OperationsGeneration'").get();
    return table ? file.prepare('SELECT epoch FROM OperationsGeneration WHERE id = 1').get()?.epoch : undefined;
  } finally { file.close(); }
}

export function bindGeneration(database: string, epoch: string) {
  if (!generationPattern.test(epoch) || !lstatSync(database).isFile()) throw new Error('RECOVERY_GENERATION_MISMATCH');
  const file = new DatabaseSync(database);
  try {
    file.exec('PRAGMA synchronous=FULL; BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS OperationsGeneration (id INTEGER PRIMARY KEY CHECK (id = 1), epoch TEXT NOT NULL);');
    file.prepare('INSERT INTO OperationsGeneration (id, epoch) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET epoch = excluded.epoch').run(epoch);
    file.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE)');
  } finally { file.close(); }
  syncFile(database);
}

export class Activation {
  private readonly path: string;
  constructor(private readonly directory: string) {
    this.directory = resolve(directory);
    this.path = join(this.directory, 'serving.json');
  }

  private inside(database: string) {
    return typeof database === 'string' && dirname(database) === this.directory && database === resolve(database);
  }

  active(): LiveActivation {
    let record;
    try { record = JSON.parse(readProtected(this.path)); }
    catch { throw new Error('RECOVERY_NOT_ACTIVE'); }
    if (!['ACTIVE', 'VERIFIED'].includes(record?.phase) || !generationPattern.test(record.epoch) ||
        !this.inside(record.database) || !Number.isSafeInteger(record.cutoff) || record.cutoff < 0) {
      throw new Error('RECOVERY_NOT_ACTIVE');
    }
    return record;
  }

  async start() {
    const record = this.active();
    if (record.phase === 'VERIFIED' && await hashFile(record.database) !== record.digest) {
      throw new Error('RECOVERY_FINGERPRINT_MISMATCH');
    }
    if (databaseGeneration(record.database) !== record.epoch) throw new Error('RECOVERY_GENERATION_MISMATCH');
    if (record.phase === 'VERIFIED') {
      const { database, epoch, cutoff } = record;
      atomicRecord(this.path, { phase: 'ACTIVE', database, epoch, cutoff });
    }
    return record;
  }

  initialize(database: string, epoch: string) {
    if (!this.inside(database) || databaseGeneration(database) !== epoch) throw new Error('RECOVERY_GENERATION_MISMATCH');
    atomicRecord(this.path, { phase: 'ACTIVE', database, epoch, cutoff: 0 }, false);
  }

  block() { atomicRecord(this.path, { phase: 'BLOCKED' }); }

  verify(database: string, epoch: string, cutoff: number, digest: string) {
    if (JSON.parse(readProtected(this.path)).phase !== 'BLOCKED') throw new Error('RECOVERY_NOT_BLOCKED');
    if (!this.inside(database) || databaseGeneration(database) !== epoch || !Number.isSafeInteger(cutoff) || cutoff < 0 ||
        !/^[0-9a-f]{64}$/.test(digest)) throw new Error('RECOVERY_GENERATION_MISMATCH');
    atomicRecord(this.path, { phase: 'VERIFIED', database, epoch, cutoff, digest });
  }
}
