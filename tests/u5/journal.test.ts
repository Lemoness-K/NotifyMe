import { createHash } from 'node:crypto';
import { copyFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeleteJournal } from '../../src/server/delete-journal.js';
import { AppError } from '../../src/server/errors.js';
import { startWorkMaintenance } from '../../src/server/household-runtime.js';
import { JournalAuthority } from '../../src/server/operations/authority.js';
import { createWorkInput } from '../../src/server/work-input.js';
import { WorkService } from '../../src/server/work-service.js';
import { seedHousehold, testDatabase } from '../u1/fixtures.js';
import { mediaToken, operationsFixture, testKey } from './fixture.js';

let fixture: ReturnType<typeof operationsFixture>;
let database: Awaited<ReturnType<typeof testDatabase>>;
let journal: DeleteJournal;
const at = new Date('2032-01-01T00:00:00Z');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

beforeEach(async () => {
  fixture = operationsFixture();
  database = await testDatabase();
  await seedHousehold(database.db);
  journal = await DeleteJournal.open(database.db, join(fixture.state, 'journal.sqlite'));
});
afterEach(async () => { journal?.close(); await database?.close(); fixture?.close(); });

function trust() { return new JournalAuthority({ root: fixture.volume, volumeId: mediaToken, key: testKey, mounted: () => true }); }

async function reminder() {
  const service = new WorkService(database.db, () => at, undefined, journal);
  const item = await service.add('home', 'member', 'create', createWorkInput({ title: 'Synthetic report test',
    trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' } }, 'member'));
  const requestId = digest(['DELETE_REMINDER', 'home', 'member', 'delete']);
  const request = { requestId, householdId: 'home', reminderId: item.reminderId, digest: digest([item.reminderId, item.revision]), at };
  return { service, item, request };
}

it.each([false, true])('handles membership revocation during the deletion transaction, existing request %s', async (prior) => {
  const { service, item, request } = await reminder();
  if (prior) journal.request(request);
  const transaction = service.transact.bind(service);
  vi.spyOn(service, 'transact').mockImplementationOnce(async (fn) => {
    await database.db.membership.updateMany({ where: { userId: 'member' }, data: { active: false } });
    return transaction(fn);
  });
  await expect(service.delete('home', 'member', item.reminderId, 'delete', item.revision))
    .rejects.toMatchObject({ code: 'HOUSEHOLD_ACCESS_DENIED' });
  expect(await database.db.reminder.count()).toBe(1);
  expect(journal.find(request.requestId)?.state).toBe(prior ? 'REQUESTED' : 'ABORTED');
});

it('does not suppress journal reconciliation when installation retention fails', async () => {
  const log = vi.fn();
  const work = new WorkService(database.db, () => at, undefined, journal, log);
  const reconcile = vi.spyOn(work, 'reconcileCommittedDeletes');
  let done!: () => void;
  const finished = new Promise<void>((resolve) => { done = resolve; });
  log.mockImplementation(({ event }) => { if (String(event).startsWith('WORK_MAINTENANCE')) done(); });
  const stop = startWorkMaintenance(work, 60_000, async () => { throw new Error('fixture'); });
  try { await finished; expect(reconcile).toHaveBeenCalledOnce(); }
  finally { await stop(); }
});

it('blocks the operating delete before its database transaction when the configured authority is missing', async () => {
  const { item, service } = await reminder();
  await journal.initializeAuthority(trust(), database.db);
  renameSync(fixture.volume, fixture.volume + '-missing');
  await expect(service.delete('home', 'member', item.reminderId, 'delete', item.revision)).rejects.toMatchObject({ status: 503 });
  expect(await database.db.reminder.count()).toBe(1);
  expect(await database.db.deletionCommit.count()).toBe(0);
});

it('detects truncation of an authentic same-lineage journal without the operating database', async () => {
  const { item, service } = await reminder();
  const authority = trust();
  await journal.initializeAuthority(authority, database.db);
  const old = join(fixture.state, 'old.sqlite');
  copyFileSync(join(fixture.state, 'journal.sqlite'), old);
  await service.delete('home', 'member', item.reminderId, 'delete', item.revision);
  expect(authority.read().tip.position).toBe(2);
  expect(() => DeleteJournal.openRecovery(old, authority)).toThrow('RECOVERY_JOURNAL_GAP');
});

it('does not adopt a legacy journal whose committed deletion is missing from the database', async () => {
  const { item, request } = await reminder();
  journal.request(request);
  journal.finish(request, 'COMMITTED', item.revision + 1);
  const authority = trust();
  await expect(journal.initializeAuthority(authority, database.db)).rejects.toThrow('RECOVERY_DATABASE_PROOF_MISMATCH');
  expect(() => authority.read()).toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
});

it('does not report a delete successful before terminal evidence reaches the authority and can retry a signed append', async () => {
  const { item, service } = await reminder();
  const authority = trust();
  await journal.initializeAuthority(authority, database.db);
  const publish = authority.advance.bind(authority);
  const fault = vi.spyOn(authority, 'advance').mockImplementation((previous, next) => {
    if (next.tip.position === 2) throw new AppError(503, 'RECOVERY_AUTHORITY_UNAVAILABLE');
    return publish(previous, next);
  });
  await expect(service.delete('home', 'member', item.reminderId, 'delete', item.revision))
    .rejects.toMatchObject({ code: 'RECOVERY_AUTHORITY_UNAVAILABLE' });
  expect(await database.db.reminder.count()).toBe(0);
  expect(authority.read().tip.position).toBe(1);
  expect(() => DeleteJournal.openRecovery(join(fixture.state, 'journal.sqlite'), authority)).toThrow('RECOVERY_JOURNAL_MISMATCH');
  fault.mockRestore();
  await expect(service.delete('home', 'member', item.reminderId, 'delete', item.revision)).resolves.toBeUndefined();
  expect(authority.read().tip.position).toBe(2);
});
