import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/server/storage.js';
import { createTimeReminder, listReminders, readReminder } from '../../src/server/repository.js';
import { seedHousehold, testDatabase } from './fixtures.js';

const input = {
  title: '리마인더', description: ' 원문 ', requesterId: 'member', assigneeIds: ['member'],
  scheduledAt: new Date('2027-01-01T12:00:00.000Z'), timeZone: 'Asia/Seoul',
};
let fixture: Awaited<ReturnType<typeof testDatabase>>;

beforeEach(async () => {
  fixture = await testDatabase();
  await seedHousehold(fixture.db);
});
afterEach(async () => { await fixture.close(); });

describe('the SQLite reminder repository', () => {
  it('commits a reminder and one occurrence and keeps it after reopening SQLite', async () => {
    const result = await createTimeReminder(fixture.db, 'home', 'member', 'key', input);
    await fixture.db.$disconnect();
    const reopened = await openStore(fixture.path);
    try {
      expect(await readReminder(reopened, 'home', 'member', result.reminderId)).toEqual(result);
      expect(result.currentOccurrence).toMatchObject({ state: 'PENDING' });
      expect(result.description).toBe(' 원문 ');
    } finally { await reopened.$disconnect(); }
  });

  it('coalesces same-key racing requests and rejects keys reused for other inputs', async () => {
    const results = await Promise.all([
      createTimeReminder(fixture.db, 'home', 'member', 'same', input),
      createTimeReminder(fixture.db, 'home', 'member', 'same', input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await fixture.db.occurrence.count()).toBe(1);
    await expect(createTimeReminder(fixture.db, 'home', 'member', 'same', {
      ...input, title: '다른 입력',
    })).rejects.toMatchObject({ status: 409 });
  });

  it('returns nothing across the household boundary or to a nonmember', async () => {
    const result = await createTimeReminder(fixture.db, 'home', 'member', 'key', input);
    await expect(readReminder(fixture.db, 'other', 'member', result.reminderId)).rejects.toMatchObject({ status: 403 });
    await expect(listReminders(fixture.db, 'home', 'outsider', {})).rejects.toMatchObject({ status: 403 });
    await expect(readReminder(fixture.db, 'home', 'member', 'unknown')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a requester or assignee without active membership', async () => {
    await expect(createTimeReminder(fixture.db, 'home', 'member', 'a', {
      ...input, requesterId: 'outsider',
    })).rejects.toMatchObject({ status: 422 });
    await expect(createTimeReminder(fixture.db, 'home', 'member', 'b', {
      ...input, assigneeIds: ['outsider'],
    })).rejects.toMatchObject({ status: 422 });
    expect(await fixture.db.reminder.count()).toBe(0);
  });

  it('returns consistent pages scoped to their view', async () => {
    await createTimeReminder(fixture.db, 'home', 'member', 'k1', input);
    await createTimeReminder(fixture.db, 'home', 'member', 'k2', input);
    const first = await listReminders(fixture.db, 'home', 'member', { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = await listReminders(fixture.db, 'home', 'member', { limit: 1, cursor: first.nextCursor });
    expect(second.items[0].reminderId).not.toBe(first.items[0].reminderId);
    await expect(listReminders(fixture.db, 'home', 'member', {
      view: 'REQUESTED', cursor: first.nextCursor,
    })).rejects.toMatchObject({ status: 422 });
  });
});
