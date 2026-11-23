import { constants, closeSync, openSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { atomicRecord, hashFile, readProtected, syncFile } from './files.js';
import { requireJournalPoint, sameHead, type JournalAuthority, type JournalHead } from './authority.js';

type Candidate = { epoch: string; database: string };
type Verified = Candidate & { phase: 'VERIFIED'; head: JournalHead; expiresAt: number; digest: string };
type LiveActivation = (Candidate & { phase: 'ACTIVE' }) | Verified;
const generationPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function acquireOwnership(directory: string, kind: 'operations' | 'observer' | 'backups' = 'operations') {
  const path = join(directory, kind + '-lock.sqlite');
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
        !this.inside(record.database)) {
      throw new Error('RECOVERY_NOT_ACTIVE');
    }
    if (record.phase === 'VERIFIED') {
      const { head, expiresAt, digest } = record;
      if (typeof head?.lineage !== 'string' || !/^[0-9a-f]{64}$/.test(head.floorProof) ||
          !/^[0-9a-f]{64}$/.test(digest) || !Number.isSafeInteger(expiresAt)) throw new Error('RECOVERY_NOT_ACTIVE');
      if (requireJournalPoint(head.floor).position > requireJournalPoint(head.tip).position) {
        throw new Error('RECOVERY_NOT_ACTIVE');
      }
    }
    return record;
  }

  async prepare(authority: JournalAuthority, validate: (record: LiveActivation) => Promise<void>, clock = () => new Date()) {
    const record = this.active();
    if (record.phase === 'VERIFIED' && await hashFile(record.database) !== record.digest) {
      throw new Error('RECOVERY_FINGERPRINT_MISMATCH');
    }
    if (databaseGeneration(record.database) !== record.epoch) throw new Error('RECOVERY_GENERATION_MISMATCH');
    await validate(record);
    const check = () => {
      const head = authority.read();
      if (record.phase === 'VERIFIED') {
        if (!sameHead(head, record.head)) throw new Error('RECOVERY_BOUNDARY_CHANGED');
        if (!(clock().getTime() < record.expiresAt)) throw new Error('BACKUP_NOT_SELECTABLE');
      }
    };
    check();
    const publish = () => {
      check();
      if (record.phase === 'VERIFIED') {
        const { database, epoch } = record;
        atomicRecord(this.path, { phase: 'ACTIVE', database, epoch });
      }
    };
    return { record, check, publish };
  }

  initialize(database: string, epoch: string) {
    if (!this.inside(database) || databaseGeneration(database) !== epoch) throw new Error('RECOVERY_GENERATION_MISMATCH');
    atomicRecord(this.path, { phase: 'ACTIVE', database, epoch }, false);
  }

  block() { atomicRecord(this.path, { phase: 'BLOCKED' }); }

  verify(database: string, epoch: string, head: JournalHead, digest: string, expiresAt: number) {
    if (JSON.parse(readProtected(this.path)).phase !== 'BLOCKED') throw new Error('RECOVERY_NOT_BLOCKED');
    if (!this.inside(database) || databaseGeneration(database) !== epoch ||
        !/^[0-9a-f]{64}$/.test(digest) || !Number.isSafeInteger(expiresAt)) throw new Error('RECOVERY_GENERATION_MISMATCH');
    atomicRecord(this.path, { phase: 'VERIFIED', database, epoch, head, digest, expiresAt });
  }
}
