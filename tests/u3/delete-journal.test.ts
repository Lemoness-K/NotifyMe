import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openStore } from '../../src/server/storage.js';
import { DeleteJournal } from '../../src/server/delete-journal.js';
import { WorkService } from '../../src/server/work-service.js';
import { createWorkInput } from '../../src/server/work-input.js';
import { seedHousehold } from '../u1/fixtures.js';
import { createTimeReminder } from '../../src/server/repository.js';

let directory: string;
const at = new Date('2032-01-01T00:00:00Z');
const request = { requestId: 'request', householdId: 'home', reminderId: 'item', digest: 'same', at };

beforeEach(() => { directory = mkdtempSync(join(process.cwd(), '.u1-db-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('independent delete journal', () => {
  it('keeps monotonic request and terminal rows across reopen with no title or coordinates', async () => {
    const path = join(directory, 'journal.db');
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    try {
      const one = await DeleteJournal.open(db, path);
      one.request(request);
      one.finish(request, 'COMMITTED', 4);
      one.close();
      const two = await DeleteJournal.open(db, path);
      try {
        expect(two.entries()).toMatchObject([
          { requestId: 'request', position: 1, state: 'REQUESTED' },
          { requestId: 'request', position: 2, state: 'COMMITTED', revision: 4 },
        ]);
        expect(two.entries().every((entry) => !('title' in entry || 'latitude' in entry))).toBe(true);
      } finally { two.close(); }
    } finally { await db.$disconnect(); }
  });

  it('admits only exact retries while held and invalidates finished or canceled holds', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      journal.request(request);
      const hold = journal.hold();
      expect(() => journal.hold()).toThrow('BACKUP_IN_PROGRESS');
      expect(() => journal.request({ ...request, requestId: 'new' })).toThrow('BACKUP_IN_PROGRESS');
      expect(() => journal.request({ ...request, digest: 'different' })).toThrow('IDEMPOTENCY_CONFLICT');
      expect(() => hold.checkpoint(2)).toThrow('DELETE_EVIDENCE_PENDING');
      journal.finish(request, 'ABORTED', null);
      expect(hold.checkpoint(2)).toBe(2);
      hold.release();
      expect(() => hold.checkpoint(2)).toThrow('BACKUP_HOLD_EXPIRED');
      expect(journal.request({ ...request, requestId: 'new' })).toMatchObject({ state: 'REQUESTED' });
    } finally { journal.close(); await db.$disconnect(); }
  });

  it('refuses a lost journal once the operating database recorded its identity', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const path = join(directory, 'journal.db');
    try {
      (await DeleteJournal.open(db, path)).close();
      rmSync(path);
      await expect(DeleteJournal.open(db, path)).rejects.toThrow('DELETE_JOURNAL_UNAVAILABLE');
    } finally { await db.$disconnect(); }
  });

  it('discards a backup checkpoint after its handle aborts and keeps pending work across retention', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      journal.request(request);
      journal.finish(request, 'ABORTED', null);
      journal.request({ ...request, requestId: 'pending' });
      const abort = new AbortController();
      const hold = journal.hold(abort.signal);
      const later = new Date('2032-03-01T00:00:00Z');
      expect(journal.prune(later)).toEqual({ count: 0, through: 0 });
      abort.abort();
      expect(() => hold.checkpoint(3)).toThrow('BACKUP_HOLD_EXPIRED');
      expect(journal.prune(later)).toEqual({ count: 2, through: 2 });
      expect(journal.entries()).toMatchObject([{ requestId: 'pending', position: 3 }]);
      expect(journal.unsettled(later).count).toBe(1);
    } finally { journal.close(); await db.$disconnect(); }
  });

  it('refuses a stale journal copy with the right identity but missing an operating commit', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const path = join(directory, 'journal.db');
    try {
      (await DeleteJournal.open(db, path)).close();
      const old = join(directory, 'old.db');
      copyFileSync(path, old);
      const journal = await DeleteJournal.open(db, path);
      journal.request(request);
      journal.finish(request, 'COMMITTED', 9);
      journal.close();
      await db.deletionCommit.create({ data: {
        requestId: request.requestId, householdId: request.householdId, reminderId: request.reminderId, revision: 9, committedAt: at,
      } });
      copyFileSync(old, path);
      await expect(DeleteJournal.open(db, path)).rejects.toThrow('DELETE_JOURNAL_UNAVAILABLE');
    } finally { await db.$disconnect(); }
  });

  it('does not acknowledge a failed terminal write and settles only the exact retry under backup hold', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      await seedHousehold(db);
      const repo = new WorkService(db, () => at, undefined, journal);
      const draft = createWorkInput({ title: 'No private data in journal',
        trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' } }, 'member');
      const item = await repo.add('home', 'member', 'create', draft);
      vi.spyOn(journal, 'finish').mockImplementationOnce(() => { throw new Error('device interruption'); });
      await expect(repo.delete('home', 'member', item.reminderId, 'delete', item.revision)).rejects.toThrow('DELETE_JOURNAL_UNAVAILABLE');
      expect(await db.deletionCommit.count()).toBe(1);
      expect(journal.entries()).toMatchObject([{ state: 'REQUESTED' }]);
      const hold = journal.hold();
      try {
        await expect(repo.delete('home', 'member', item.reminderId, 'delete', item.revision + 1)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
        await expect(repo.delete('home', 'member', item.reminderId, 'delete', item.revision)).resolves.toBeUndefined();
        expect(hold.checkpoint(2)).toBe(2);
      } finally { hold.release(); }
      expect(JSON.stringify(journal.entries())).not.toContain(draft.title);
    } finally { journal.close(); await db.$disconnect(); }
  });

  it('durably aborts the competing distinct key only with scoped commit proof, otherwise stays pending', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      await seedHousehold(db);
      const repo = new WorkService(db, () => at, undefined, journal);
      const input = createWorkInput({ title: 'One copy',
        trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' } }, 'member');
      const item = await repo.add('home', 'member', 'create', input);
      const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
      function recordRequest(key: string, reminderId: string, revision: number) {
        const intent = { requestId: checksum(['DELETE_REMINDER', 'home', 'member', key]), householdId: 'home',
          reminderId, digest: checksum([reminderId, revision]), at };
        journal.request(intent);
        return intent.requestId;
      }
      // Model both callers having crossed the durable request boundary before either DB transaction commits.
      recordRequest('first', item.reminderId, item.revision);
      recordRequest('second', item.reminderId, item.revision);
      const outcomes = await Promise.allSettled(['first', 'second'].map((key) =>
        repo.delete('home', 'member', item.reminderId, key, item.revision)));
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.find((outcome) => outcome.status === 'rejected')).toMatchObject({
        reason: { status: 409, code: 'DELETE_SUPERSEDED' },
      });
      expect(await db.deletionCommit.count()).toBe(1);
      const states = journal.entries().map((entry) => entry.state);
      expect(states.slice(0, 2)).toEqual(['REQUESTED', 'REQUESTED']);
      expect(states.slice(2).sort()).toEqual(['ABORTED', 'COMMITTED']);
      const missing = recordRequest('unproved', 'missing-reminder', 1);
      await expect(repo.delete('home', 'member', 'missing-reminder', 'unproved', 1)).rejects.toMatchObject({
        status: 503, code: 'DELETE_EVIDENCE_PENDING',
      });
      expect(journal.find(missing)?.state).toBe('REQUESTED');
      expect(journal.unsettled(at).count).toBe(1);
    } finally { journal.close(); await db.$disconnect(); }
  });

  it('settles committed evidence internally after the original caller loses membership', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      await seedHousehold(db);
      const repo = new WorkService(db, () => at, undefined, journal);
      const draft = createWorkInput({ title: 'Removed',
        trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' } }, 'member');
      const item = await repo.add('home', 'member', 'create', draft);
      vi.spyOn(journal, 'finish').mockImplementationOnce(() => { throw new Error('device interruption'); });
      await expect(repo.delete('home', 'member', item.reminderId, 'delete', item.revision)).rejects.toThrow('DELETE_JOURNAL_UNAVAILABLE');
      expect(journal.entries()).toMatchObject([{ state: 'REQUESTED' }]);
      await db.membership.updateMany({ where: { householdId: 'home', userId: 'member' }, data: { active: false } });
      await expect(repo.delete('home', 'member', item.reminderId, 'delete', item.revision)).rejects.toMatchObject({ status: 403 });
      const hold = journal.hold();
      try {
        expect(() => hold.checkpoint(1)).toThrow('DELETE_EVIDENCE_PENDING');
        expect(await repo.reconcileCommittedDeletes()).toBe(1);
        expect(hold.checkpoint(2)).toBe(2);
      } finally { hold.release(); }
      journal.request({ ...request, requestId: 'unmatched' });
      journal.request({ ...request, requestId: 'wrong-scope' });
      await db.deletionCommit.create({ data: { requestId: 'wrong-scope', householdId: 'other',
        reminderId: request.reminderId, revision: 400, committedAt: at, inputDigest: request.digest } });
      journal.request({ ...request, requestId: 'wrong-input' });
      await db.deletionCommit.create({ data: { requestId: 'wrong-input', householdId: request.householdId,
        reminderId: request.reminderId, revision: 401, committedAt: at, inputDigest: 'different-digest' } });
      expect(await repo.reconcileCommittedDeletes()).toBe(0);
      expect(journal.entries().map((entry) => [entry.requestId, entry.state])).toEqual([
        [expect.any(String), 'REQUESTED'], [expect.any(String), 'COMMITTED'], ['unmatched', 'REQUESTED'],
        ['wrong-scope', 'REQUESTED'], ['wrong-input', 'REQUESTED'],
      ]);
      expect(journal.unsettled(at).count).toBe(3);
      expect(await db.reminder.count()).toBe(0);
    } finally { journal.close(); await db.$disconnect(); }
  });

  it('blocks delayed create retries after delete for both current and legacy command records', async () => {
    const db = await openStore(join(directory, 'app.db'), { migrate: true });
    const journal = await DeleteJournal.open(db, join(directory, 'journal.db'));
    try {
      await seedHousehold(db);
      const repo = new WorkService(db, () => at, undefined, journal);
      const key = 'create';
      const legacyKey = 'legacy-create';
      const trigger = { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' };
      const draft = createWorkInput({ title: 'Original', description: 'Private U3 title body', trigger }, 'member');
      const item = await repo.add('home', 'member', key, draft);
      await repo.delete('home', 'member', item.reminderId, 'delete', item.revision);
      await expect(repo.add('home', 'member', key, draft)).rejects.toMatchObject({ status: 409, code: 'REMINDER_ALREADY_DELETED' });
      await expect(repo.add('home', 'member', key, { ...draft, title: 'Changed' })).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
      expect(await db.reminderCommandResult.count()).toBe(0);

      const legacy = { title: 'Legacy title', requesterId: 'member', assigneeIds: ['member'],
        scheduledAt: new Date(trigger.scheduledAt), timeZone: trigger.timeZone };
      const old = await createTimeReminder(db, 'home', 'member', legacyKey, legacy);
      const current = createWorkInput({ title: legacy.title, trigger }, 'member');
      expect(await repo.add('home', 'member', legacyKey, current)).toMatchObject({ reminderId: old.reminderId });
      await repo.delete('home', 'member', old.reminderId, 'delete-legacy', old.revision);
      await expect(createTimeReminder(db, 'home', 'member', legacyKey, legacy)).rejects.toMatchObject({ status: 409, code: 'REMINDER_ALREADY_DELETED' });
      await expect(repo.add('home', 'member', legacyKey, current)).rejects.toMatchObject({ status: 409, code: 'REMINDER_ALREADY_DELETED' });
      expect(await db.reminder.count()).toBe(0);
      expect(await db.requestResult.count()).toBe(0);
      const metadata = await db.deletedCreateKey.findMany({ orderBy: { format: 'asc' } });
      expect(metadata).toEqual(['LEGACY_TIME', 'WORK_V1'].map((format) => ({
        format, scopeDigest: expect.stringMatching(/^[a-f0-9]{64}$/), inputDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      })));
      for (const privateValue of [legacy.title, draft.description, key, legacyKey]) {
        expect(JSON.stringify(metadata)).not.toContain(privateValue);
      }
    } finally { journal.close(); await db.$disconnect(); }
  });
});
