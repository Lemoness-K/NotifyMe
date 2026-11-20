import { createHash, createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JournalEntry } from '../delete-journal.js';
import type { WorkService } from '../work-service.js';
import { openArchive, sealArchive } from './archive.js';
import { requireJournalPoint, samePoint, type JournalPoint } from './authority.js';
import { atomicRecord, hashFile, readProtected, syncDirectory } from './files.js';

const RETENTION_MS = 30 * 86_400_000;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;

export type BackupMetadata = {
  version: 1;
  id: string;
  createdAt: string;
  lineage: string;
  cutoff: JournalPoint;
  schema: string;
  digest: string;
};
type Entry = { backup: BackupMetadata; expired: boolean };

function metadata(item: BackupMetadata) {
  const { version, id, createdAt, lineage, cutoff, schema, digest } = item;
  return JSON.stringify([version, id, createdAt, lineage, cutoff.position, cutoff.digest, schema, digest]);
}

export function inspectSnapshot(path: string, commits: readonly JournalEntry[] = []) {
  const snapshot = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = snapshot.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' ||
        snapshot.prepare('PRAGMA foreign_key_check').get()) throw new Error('BACKUP_DATABASE_INVALID');
    const saved = snapshot.prepare('SELECT householdId, reminderId, revision, inputDigest FROM DeletionCommit WHERE requestId = ?');
    const reminder = snapshot.prepare('SELECT id FROM Reminder WHERE id = ?');
    for (const row of commits) {
      if (row.state !== 'COMMITTED') continue;
      const proof = saved.get(row.requestId);
      if (reminder.get(row.reminderId) || !proof || proof.householdId !== row.householdId ||
          proof.reminderId !== row.reminderId || proof.revision !== row.revision ||
          (proof.inputDigest !== null && proof.inputDigest !== row.digest)) throw new Error('BACKUP_COMMIT_MISMATCH');
    }
    const schema = snapshot.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
    return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  } finally { snapshot.close(); }
}

export class Backups {
  private readonly cataloguePath: string;
  private readonly catalogueKey: Buffer;
  private busy = false;

  constructor(private readonly archives: string, private readonly state: string, private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('OPERATIONS_KEY_INVALID');
    this.cataloguePath = join(archives, 'catalogue.json');
    this.catalogueKey = Buffer.from(hkdfSync('sha256', key, '', 'notify-backup-catalogue-v1', 32));
  }

  path(id: string) {
    if (!uuid.test(id)) throw new Error('BACKUP_ID_INVALID');
    return join(this.archives, id + '.notify-backup');
  }

  private signature(items: Entry[]) {
    return createHmac('sha256', this.catalogueKey).update(JSON.stringify(items)).digest('hex');
  }

  private publish(items: Entry[], replace = true) {
    atomicRecord(this.cataloguePath, { items, signature: this.signature(items) }, replace);
  }

  initialize() { this.publish([], false); }

  private read(): Entry[] {
    const { items, signature } = JSON.parse(readProtected(this.cataloguePath));
    if (!Array.isArray(items) || typeof signature !== 'string' || !sha.test(signature) ||
        !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.signature(items), 'hex'))) {
      throw new Error('BACKUP_CATALOGUE_INVALID');
    }
    const ids = new Set<string>();
    for (const { backup, expired } of items as Entry[]) {
      if (backup.version !== 1 || !uuid.test(backup.id) || !Number.isFinite(Date.parse(backup.createdAt)) ||
          typeof backup.lineage !== 'string' || !sha.test(backup.schema) || !sha.test(backup.digest) ||
          typeof expired !== 'boolean' || ids.has(backup.id)) throw new Error('BACKUP_CATALOGUE_INVALID');
      requireJournalPoint(backup.cutoff);
      ids.add(backup.id);
    }
    return items;
  }

  private valid(entry: Entry, now: Date) {
    return !entry.expired && now.getTime() - Date.parse(entry.backup.createdAt) < RETENTION_MS;
  }

  select(id: string, now: Date) {
    const entry = this.read().find((item) => item.backup.id === id && this.valid(item, now));
    if (!entry) throw new Error('BACKUP_NOT_SELECTABLE');
    return entry.backup;
  }

  decrypt(item: BackupMetadata, output: string) { return openArchive(this.path(item.id), output, this.key, metadata(item)); }

  private collect(now: Date, keep: string) {
    const entries = this.read().map((item) => ({ ...item, expired: !this.valid(item, now) }));
    this.publish(entries);
    const ready = entries.filter(({ expired }) => !expired);
    const files = new Set(ready.map(({ backup }) => backup.id + '.notify-backup'));
    for (const name of readdirSync(this.archives)) {
      const path = join(this.archives, name);
      if ((name.endsWith('.notify-backup') && uuid.test(name.slice(0, -'.notify-backup'.length)) && !files.has(name)) ||
          (path !== keep && name.startsWith('.notify-archive-') && uuid.test(name.slice('.notify-archive-'.length)))) {
        rmSync(path, { force: true });
      }
    }
    syncDirectory(this.archives);
    this.publish(ready);
    return ready;
  }

  async capture(database: string, work: WorkService, now: Date) {
    if (this.busy) throw new Error('BACKUP_IN_PROGRESS');
    const journal = work.journal;
    if (!journal?.authoritative) throw new Error('RECOVERY_AUTHORITY_UNAVAILABLE');
    this.busy = true;
    const id = randomUUID();
    const partial = join(this.archives, '.notify-archive-' + id);
    let directory: string | undefined;
    try {
      const retention = journal.hold();
      try {
        const head = journal.refreshAuthority()!;
        const entries = this.collect(now, partial);
        if (entries.length) journal.pruneWithAuthority(now, Math.min(...entries.map(({ backup }) => backup.cutoff.position)));
        else if (head.floor.position !== head.tip.position && !journal.unsettled(now).count) {
          // Without a selectable backup, a settled cutoff can become the earliest future recovery point.
          journal.pruneWithAuthority(now, head.tip.position);
        }
      } finally { retention.release(); }
      for (const name of readdirSync(this.state)) {
        if (/^\.backup-job-[A-Za-z0-9]{6}$/.test(name)) rmSync(join(this.state, name), { recursive: true, force: true });
      }
      directory = mkdtempSync(join(this.state, '.backup-job-'));
      const image = join(directory, 'snapshot.sqlite');
      let cutoff!: JournalPoint;
      let schema!: string;
      await work.reconcileCommittedDeletes();
      const hold = journal.hold(AbortSignal.timeout(60_000));
      try {
        journal.refreshAuthority();
        cutoff = journal.history().head.tip;
        hold.checkpoint(cutoff.position);
        const [{ file }] = await work.db.$queryRaw<{ file: string }[]>`PRAGMA database_list`;
        if (resolve(file) !== resolve(database)) throw new Error('BACKUP_DATABASE_MISMATCH');
        // The live adapter owns the WAL view. VACUUM INTO makes a consistent SQLite snapshot.
        await work.db.$executeRaw`VACUUM INTO ${image}`;
        chmodSync(image, 0o600);
        hold.checkpoint(cutoff.position);
        schema = inspectSnapshot(image, journal.entries());
      } finally { hold.release(); }
      const item: BackupMetadata = { version: 1, id, createdAt: now.toISOString(), lineage: journal.lineage, cutoff,
        schema, digest: await hashFile(image) };
      await sealArchive(image, partial, this.key, metadata(item));
      const publish = journal.hold();
      try {
        const history = journal.history();
        const boundary = history.points.get(cutoff.position);
        if (!boundary || !samePoint(cutoff, boundary)) throw new Error('BACKUP_PROOF_EXPIRED');
        const entries = this.collect(now, partial);
        renameSync(partial, this.path(id));
        syncDirectory(this.archives);
        this.publish([...entries, { backup: item, expired: false }]);
        journal.pruneWithAuthority(now, Math.min(cutoff.position, ...entries.map(({ backup }) => backup.cutoff.position)));
      } finally { publish.release(); }
      return item;
    } finally {
      this.busy = false;
      rmSync(partial, { force: true });
      if (directory) rmSync(directory, { force: true, recursive: true });
    }
  }
}
