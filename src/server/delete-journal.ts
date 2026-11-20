import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';
import { JournalAuthority, samePoint, type JournalHead, type JournalPoint } from './operations/authority.js';

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
  private authority?: JournalAuthority;

  private constructor(private readonly file: DatabaseSync, readonly lineage: string) {}

  static async open(db: PrismaClient, path: string, authority?: JournalAuthority) {
    const expected = await db.recoveryJournalIdentity.findUnique({ where: { id: 1 } });
    const existing = existsSync(path);
    if (!!expected !== existing || (authority && !expected)) throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE');
    let file: DatabaseSync | undefined;
    try {
      if (!existing) closeSync(openSync(path, 'wx', 0o600));
      if (!lstatSync(path).isFile()) throw new Error('Journal is not a file');
      file = new DatabaseSync(path);
      file.exec('PRAGMA synchronous = FULL; PRAGMA journal_mode = DELETE;');
      const token = expected?.token ?? randomUUID();
      if (!expected) {
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
      const journal = new DeleteJournal(file, token);
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
      if (authority) {
        journal.authority = authority;
        journal.refreshAuthority();
      }
      return journal;
    } catch {
      file?.close();
      throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE');
    }
  }

  static openRecovery(path: string, authority: JournalAuthority) {
    if (!lstatSync(path).isFile()) throw new AppError(503, 'RECOVERY_JOURNAL_UNAVAILABLE');
    const file = new DatabaseSync(path, { readOnly: true });
    try {
      const lineage = file.prepare('SELECT token FROM identity').get()?.token;
      if (typeof lineage !== 'string' || !lineage) throw new AppError(503, 'RECOVERY_JOURNAL_UNAVAILABLE');
      const journal = new DeleteJournal(file, lineage);
      journal.authority = authority;
      journal.history();
      return journal;
    } catch (error) { file.close(); throw error; }
  }

  private lastPosition() {
    return Number(this.file.prepare("SELECT coalesce((SELECT seq FROM sqlite_sequence WHERE name = 'entries'),0) AS position")
      .get()?.position);
  }

  initializeAuthority(authority: JournalAuthority) {
    if (this.unsettled(new Date()).count) throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
    this.file.exec('CREATE TABLE IF NOT EXISTS authority_append (position INTEGER PRIMARY KEY, digest TEXT NOT NULL)');
    authority.baseline(this.lineage, this.lastPosition());
    this.authority = authority;
  }

  get authoritative() { return this.authority !== undefined; }

  private verifyPrefix(allowSignedAppend: boolean) {
    const authority = this.authority;
    if (!authority) throw new AppError(503, 'RECOVERY_AUTHORITY_UNAVAILABLE');
    const head = authority.read();
    if (head.lineage !== this.lineage || this.proofFloor() > head.floor.position) {
      throw new AppError(503, 'RECOVERY_JOURNAL_MISMATCH');
    }
    const rows = this.file.prepare('SELECT * FROM entries WHERE position > ? ORDER BY position')
      .all(head.floor.position) as unknown as JournalEntry[];
    let tip = head.floor;
    const points = new Map<number, JournalPoint>([[tip.position, tip]]);
    for (const row of rows) {
      tip = authority.extendsPoint(this.lineage, tip, row);
      points.set(row.position, tip);
      if (row.position > head.tip.position && (!allowSignedAppend ||
          this.file.prepare('SELECT digest FROM authority_append WHERE position = ?').get(row.position)?.digest !== tip.digest)) {
        throw new AppError(503, 'RECOVERY_JOURNAL_MISMATCH');
      }
    }
    const anchored = points.get(head.tip.position);
    if (!anchored || tip.position !== this.lastPosition()) throw new AppError(503, 'RECOVERY_JOURNAL_GAP');
    if (!samePoint(anchored, head.tip)) throw new AppError(503, 'RECOVERY_JOURNAL_MISMATCH');
    return { authority, head, tip, points, rows };
  }

  history() {
    const { head, points, rows } = this.verifyPrefix(false);
    return { head, points, rows };
  }

  refreshAuthority(): JournalHead | undefined {
    if (!this.authority) return;
    const { authority, head, tip } = this.verifyPrefix(true);
    return samePoint(head.tip, tip) ? head : authority.advance(head, { ...head, tip });
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

  private insert(request: DeleteRequest, state: JournalEntry['state'], revision: number | null, head?: JournalHead): JournalEntry {
    const at = request.at.toISOString();
    const { requestId, householdId, reminderId, digest } = request;
    const write = () => {
      const entry = this.file.prepare('INSERT INTO entries (requestId, householdId, reminderId, digest, at, state, revision) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(requestId, householdId, reminderId, digest, at, state, revision);
      return { requestId, householdId, reminderId, digest, at, state, revision, position: Number(entry.lastInsertRowid) };
    };
    if (!head || !this.authority) return write();
    let entry: JournalEntry;
    let tip: JournalPoint;
    this.file.exec('BEGIN IMMEDIATE');
    try {
      entry = write();
      tip = this.authority.extendsPoint(this.lineage, head.tip, entry);
      this.file.prepare('INSERT INTO authority_append (position,digest) VALUES (?,?)').run(tip.position, tip.digest);
      this.file.exec('COMMIT');
    } catch (error) {
      this.file.exec('ROLLBACK');
      throw error;
    }
    this.authority.advance(head, { ...head, tip });
    return entry;
  }

  request(request: DeleteRequest) {
    const head = this.refreshAuthority();
    const existing = this.find(request.requestId);
    if (existing) {
      if (existing.digest !== request.digest || existing.householdId !== request.householdId ||
          existing.reminderId !== request.reminderId) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
      return existing;
    }
    if (this.activeHold) throw new AppError(503, 'BACKUP_IN_PROGRESS', undefined, 2);
    return this.insert(request, 'REQUESTED', null, head);
  }

  finish(request: DeleteRequest, state: Terminal, revision: number | null) {
    const head = this.refreshAuthority();
    const existing = this.find(request.requestId);
    if (!existing || existing.digest !== request.digest || existing.householdId !== request.householdId ||
        existing.reminderId !== request.reminderId || (state === 'COMMITTED') !== (revision !== null)) {
      throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
    }
    if (existing.state === 'REQUESTED') return this.insert(request, state, revision, head);
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
        const position = this.lastPosition();
        if (snapshotPosition !== position) throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
        return position;
      },
    };
  }

  proofFloor() {
    return Number(this.file.prepare('SELECT position FROM pruning').get()?.position);
  }

  prune(now: Date) {
    if (this.activeHold || this.authoritative) return { count: 0, through: this.proofFloor() };
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

  pruneWithAuthority(now: Date, protectedThrough: number) {
    if (!this.activeHold || !this.authority) throw new AppError(503, 'BACKUP_HOLD_EXPIRED');
    const { head, points, rows } = this.history();
    const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    let position = head.floor.position;
    if (protectedThrough < position) throw new AppError(503, 'RECOVERY_FLOOR_MISMATCH');
    const unresolved = new Set<string>();
    for (const row of rows) {
      if (row.position > protectedThrough || row.at > cutoff) break;
      if (row.state === 'REQUESTED') unresolved.add(row.requestId);
      else unresolved.delete(row.requestId);
      if (!unresolved.size) position = row.position;
    }
    if (position !== head.floor.position) this.authority.advance(head, { ...head, floor: points.get(position)! });
    // Older legacy rows at or below the initial authority floor still use their expiry.
    this.file.exec('BEGIN IMMEDIATE');
    try {
      const removed = this.file.prepare([
        'DELETE FROM entries WHERE requestId IN (SELECT requestId FROM entries',
        "WHERE state <> 'REQUESTED' AND position <= ? AND at <= ?)",
      ].join(' ')).run(position, cutoff);
      this.file.prepare('DELETE FROM authority_append WHERE position <= ?').run(position);
      this.file.prepare('UPDATE pruning SET position = max(position, ?)').run(position);
      this.file.exec('COMMIT');
      return Number(removed.changes);
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
