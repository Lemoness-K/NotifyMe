import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';

export interface DeleteRequest {
  requestId: string;
  householdId: string;
  reminderId: string;
  digest: string;
  at: Date;
}
type Terminal = 'ABORTED' | 'COMMITTED';
export type JournalEntry = Omit<DeleteRequest, 'at'> & {
  at: string;
  position: number;
  state: 'REQUESTED' | Terminal;
  revision: number | null;
};

export class DeleteJournal {
  private activeHold: symbol | undefined;

  private constructor(private readonly file: DatabaseSync) {}

  static async open(db: PrismaClient, path: string) {
    const expected = await db.recoveryJournalIdentity.findUnique({ where: { id: 1 } });
    const existing = existsSync(path);
    if (!!expected !== existing) throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE');
    let file: DatabaseSync | undefined;
    try {
      if (!existing) closeSync(openSync(path, 'wx', 0o600));
      file = new DatabaseSync(path);
      file.exec('PRAGMA synchronous = FULL; PRAGMA journal_mode = DELETE;');
      if (!expected) {
        const token = randomUUID();
        file.exec([
          'CREATE TABLE identity (token TEXT NOT NULL);',
          'CREATE TABLE pruning (position INTEGER NOT NULL); INSERT INTO pruning VALUES (0);',
          'CREATE TABLE entries (position INTEGER PRIMARY KEY AUTOINCREMENT, requestId TEXT NOT NULL,',
          ' householdId TEXT NOT NULL, reminderId TEXT NOT NULL, digest TEXT NOT NULL, at TEXT NOT NULL,',
          ' state TEXT NOT NULL, revision INTEGER);',
          "CREATE UNIQUE INDEX one_request ON entries (requestId) WHERE state = 'REQUESTED';",
          "CREATE UNIQUE INDEX one_terminal ON entries (requestId) WHERE state <> 'REQUESTED';",
        ].join(' '));
        file.prepare('INSERT INTO identity (token) VALUES (?)').run(token);
        await db.recoveryJournalIdentity.create({ data: { id: 1, token } });
      } else {
        const actual = file.prepare('SELECT token FROM identity').get();
        if (actual?.token !== expected.token) throw new Error('Wrong journal identity');
        file.prepare('SELECT position FROM entries LIMIT 1').get();
      }
      const journal = new DeleteJournal(file);
      // A stale copy can have the expected identity and still lack a recent deletion.
      const recent = await db.deletionCommit.findMany({ where: {
        committedAt: { gt: new Date(Date.now() - 30 * 86_400_000) },
      }, select: { requestId: true, householdId: true, reminderId: true, revision: true, inputDigest: true } });
      for (const proof of recent) {
        const row = journal.find(proof.requestId);
        if (!row || row.householdId !== proof.householdId || row.reminderId !== proof.reminderId ||
            (proof.inputDigest !== null && row.digest !== proof.inputDigest) ||
            row.state === 'ABORTED' || (row.state === 'COMMITTED' && row.revision !== proof.revision)) {
          throw new Error('Deletion evidence missing from journal');
        }
      }
      return journal;
    } catch {
      file?.close();
      throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE');
    }
  }

  entries() {
    return this.file.prepare('SELECT * FROM entries ORDER BY position').all() as unknown as JournalEntry[];
  }

  find(requestId: string) {
    return this.file.prepare('SELECT * FROM entries WHERE requestId = ? ORDER BY position DESC LIMIT 1')
      .get(requestId) as JournalEntry | undefined;
  }

  pending(after: number, limit: number) {
    return this.file.prepare([
      "SELECT r.* FROM entries r WHERE r.position > ? AND r.state = 'REQUESTED'",
      "AND NOT EXISTS (SELECT 1 FROM entries t WHERE t.requestId = r.requestId AND t.state <> 'REQUESTED')",
      'ORDER BY r.position LIMIT ?',
    ].join(' ')).all(after, limit) as unknown as JournalEntry[];
  }

  private insert(request: DeleteRequest, state: JournalEntry['state'], revision: number | null) {
    const at = request.at.toISOString();
    const { requestId, householdId, reminderId, digest } = request;
    const entry = this.file.prepare('INSERT INTO entries (requestId, householdId, reminderId, digest, at, state, revision) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(requestId, householdId, reminderId, digest, at, state, revision);
    return { requestId, householdId, reminderId, digest, at, state, revision, position: Number(entry.lastInsertRowid) };
  }

  request(request: DeleteRequest) {
    const existing = this.find(request.requestId);
    if (existing) {
      if (existing.digest !== request.digest || existing.householdId !== request.householdId ||
          existing.reminderId !== request.reminderId) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
      return existing;
    }
    if (this.activeHold) throw new AppError(503, 'BACKUP_IN_PROGRESS', undefined, 2);
    return this.insert(request, 'REQUESTED', null);
  }

  finish(request: DeleteRequest, state: Terminal, revision: number | null) {
    const existing = this.find(request.requestId);
    if (!existing || existing.digest !== request.digest || existing.householdId !== request.householdId ||
        existing.reminderId !== request.reminderId || (state === 'COMMITTED') !== (revision !== null)) {
      throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
    }
    if (existing.state === 'REQUESTED') return this.insert(request, state, revision);
    if (existing.state === state && existing.revision === revision) return existing;
    throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
  }

  unsettled(now: Date) {
    const row = this.file.prepare([
      "SELECT count(*) AS count, min(at) AS oldest FROM entries r WHERE r.state = 'REQUESTED'",
      "AND NOT EXISTS (SELECT 1 FROM entries t WHERE t.requestId = r.requestId AND t.state <> 'REQUESTED')",
    ].join(' ')).get();
    return {
      count: Number(row?.count),
      oldestMs: typeof row?.oldest === 'string' ? Math.max(0, now.getTime() - Date.parse(row.oldest)) : 0,
    };
  }

  hold(signal?: AbortSignal) {
    if (this.activeHold) throw new AppError(503, 'BACKUP_IN_PROGRESS', undefined, 2);
    signal?.throwIfAborted();
    const hold = Symbol();
    this.activeHold = hold;
    const release = () => {
      signal?.removeEventListener('abort', release);
      if (this.activeHold === hold) this.activeHold = undefined;
    };
    signal?.addEventListener('abort', release, { once: true });
    return {
      release,
      checkpoint: (snapshotPosition: number) => {
        if (this.activeHold !== hold) throw new AppError(503, 'BACKUP_HOLD_EXPIRED');
        if (this.unsettled(new Date()).count > 0) throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
        const position = Number(this.file.prepare("SELECT coalesce((SELECT seq FROM sqlite_sequence WHERE name = 'entries'),0) AS position")
          .get()?.position);
        if (snapshotPosition !== position) throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
        return position;
      },
    };
  }

  proofFloor() {
    return Number(this.file.prepare('SELECT position FROM pruning').get()?.position);
  }

  prune(now: Date) {
    if (this.activeHold) return { count: 0, through: this.proofFloor() };
    const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const terminal = this.file.prepare("SELECT coalesce(max(position),0) AS position FROM entries WHERE state <> 'REQUESTED' AND at <= ?");
    const expiring = Number(terminal.get(cutoff)?.position);
    if (!expiring) return { count: 0, through: this.proofFloor() };
    this.file.exec('BEGIN IMMEDIATE');
    try {
      const result = this.file.prepare([
        'DELETE FROM entries WHERE requestId IN (SELECT requestId FROM entries',
        "WHERE state <> 'REQUESTED' AND at <= ?)",
      ].join(' ')).run(cutoff);
      this.file.prepare('UPDATE pruning SET position = max(position, ?)').run(expiring);
      this.file.exec('COMMIT');
      return { count: Number(result.changes), through: this.proofFloor() };
    } catch (error) {
      this.file.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.activeHold = undefined;
    this.file.close();
  }
}
