import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openStore } from '../../src/server/storage.js';
import type { PrismaClient } from '../../src/server/generated/client.js';

export const clock = () => new Date('2032-01-01T00:00:00Z');
export const tokenKey = Buffer.alloc(32, 17);

export async function deviceFixture() {
  const directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
  const db = await openStore(join(directory, 'test.db'), { migrate: true });
  await db.user.createMany({ data: [{ id: 'member' }, { id: 'other' }] });
  await db.household.create({ data: { id: 'home' } });
  await db.membership.createMany({ data: [
    { householdId: 'home', userId: 'member', role: 'ADMIN' },
    { householdId: 'home', userId: 'other', role: 'MEMBER' },
  ] });
  return { db, async close() { await db.$disconnect(); rmSync(directory, { recursive: true, force: true }); } };
}

export async function seedReminders(db: PrismaClient, count: number, kind: 'LOCATION' | 'TIME' = 'LOCATION') {
  const ids = Array.from({ length: count }, (_, i) => kind.toLowerCase() + '-' + String(i).padStart(3, '0'));
  const scheduledAt = kind === 'TIME' ? new Date('2032-01-02T00:00:00Z') : null;
  await db.$transaction(async (tx) => {
    await tx.reminder.createMany({ data: ids.map((id) => ({
      id, householdId: 'home', title: id, requesterId: 'member', createdBy: 'member',
    })) });
    await tx.assignment.createMany({ data: ids.map((reminderId) => ({ householdId: 'home', reminderId, userId: 'member' })) });
    await tx.trigger.createMany({ data: ids.map((reminderId) => kind === 'TIME' ? { reminderId, kind, scheduledAt, timeZone: 'UTC' } :
      { reminderId, kind, latitude: 10, longitude: 20, radiusM: 100, event: 'ENTER' }) });
    await tx.occurrence.createMany({ data: ids.map((reminderId) => ({ id: reminderId + '-occ', reminderId, scheduledAt })) });
  });
  return ids;
}
