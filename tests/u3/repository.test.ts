import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedHousehold, testDatabase } from '../u1/fixtures.js';
import { createTimeReminder, listReminders } from '../../src/server/repository.js';
import { appendChange, updateOccurrence } from '../../src/server/work-storage.js';

let fixture: Awaited<ReturnType<typeof testDatabase>>;
let reminderId: string;
let occurrenceId: string;
const now = new Date('2030-07-01T12:00:00Z');

beforeEach(async () => {
  fixture = await testDatabase();
  await seedHousehold(fixture.db);
  const work = await createTimeReminder(fixture.db, 'home', 'member', 'work', {
    title: 'Original', requesterId: 'member', assigneeIds: ['member'], scheduledAt: now, timeZone: 'UTC',
  });
  reminderId = work.reminderId;
  occurrenceId = work.currentOccurrence!.occurrenceId;
});

afterEach(async () => { await fixture?.close(); });

describe('work persistence', () => {
  it('rolls feed revision and conditional occurrence writes back together', async () => {
    await expect(fixture.db.$transaction(async (tx) => {
      await updateOccurrence(tx, occurrenceId, 1, { state: 'COMPLETED', stateAt: now });
      await appendChange(tx, 'home', reminderId, 'UPSERT', now);
      throw new Error('reject candidate');
    })).rejects.toThrow('reject candidate');
    expect(await fixture.db.reminderFeedEntry.count()).toBe(0);
    expect(await fixture.db.occurrence.findUnique({ where: { id: occurrenceId } })).toMatchObject({ state: 'PENDING', revision: 1 });
    await expect(fixture.db.$transaction((tx) => updateOccurrence(tx, occurrenceId, 2, { state: 'COMPLETED' })))
      .rejects.toMatchObject({ status: 409 });
  });

  it('rejects a query cursor transferred to a different view', async () => {
    await createTimeReminder(fixture.db, 'home', 'member', 'work-two', {
      title: 'Second', requesterId: 'member', assigneeIds: ['member'], scheduledAt: now, timeZone: 'UTC',
    });
    const first = await listReminders(fixture.db, 'home', 'member', { limit: 1, view: 'MINE' });
    expect(first.nextCursor).toBeTruthy();
    await expect(listReminders(fixture.db, 'home', 'member', { view: 'REQUESTED', cursor: first.nextCursor }))
      .rejects.toMatchObject({ status: 422 });
  });
});
