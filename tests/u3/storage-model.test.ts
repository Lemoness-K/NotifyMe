import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/server/storage.js';

let directory: string;
let path: string;
const now = new Date('2032-01-01T00:00:00Z');

beforeEach(() => {
  directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
  path = join(directory, 'legacy.db');
  const legacy = new DatabaseSync(path);
  try {
    for (const migration of ['202611180001_u1', '202611190001_u2']) {
      legacy.exec(readFileSync('prisma/migrations/' + migration + '/migration.sql', 'utf8'));
    }
    legacy.exec(`
      INSERT INTO "User" (id) VALUES ('admin'), ('member');
      INSERT INTO "Household" (id) VALUES ('home');
      INSERT INTO "HouseholdSettings" ("householdId") VALUES ('home');
      INSERT INTO "Membership" ("householdId", "userId", role) VALUES ('home', 'admin', 'ADMIN'), ('home', 'member', 'MEMBER');
      INSERT INTO "Reminder" (id, "householdId", title, "createdBy", "requesterId") VALUES ('task', 'home', '원문', 'admin', 'admin');
      INSERT INTO "Assignment" ("householdId", "reminderId", "userId") VALUES ('home', 'task', 'member');
      INSERT INTO "Trigger" ("reminderId", "scheduledAt", "timeZone") VALUES ('task', '2032-01-01T00:00:00.000Z', 'Asia/Seoul');
      INSERT INTO "Occurrence" (id, "reminderId", "scheduledAt", revision) VALUES ('first', 'task', '2032-01-01T00:00:00.000Z', 2);
    `);
  } finally { legacy.close(); }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('U3 SQLite migration', () => {
  it('keeps legacy data and backfills a stable occurrence key', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      expect(await db.reminder.findUnique({ where: { id: 'task' } })).toMatchObject({
        title: '원문', householdId: 'home', verificationEnabled: false,
      });
      expect(await db.assignment.findFirst()).toMatchObject({ userId: 'member', endedAt: null });
      expect(await db.householdSettings.count()).toBe(1);
      expect(await db.occurrence.findUnique({ where: { id: 'first' } })).toMatchObject({ occurrenceKey: 'initial', revision: 2 });
    } finally { await db.$disconnect(); }
  });

  it('persists rule segments and enforces per-reminder occurrence and open request uniqueness', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      const rule = await db.recurrenceRule.create({ data: {
        reminderId: 'task', effectiveFrom: '2032-01-02T00:00:00Z', definition: '{}',
      } });
      const second = { reminderId: 'task', occurrenceKey: 'second', stateAt: now, scheduledAt: now, recurrenceRuleId: rule.id };
      await db.occurrence.create({ data: second });
      await expect(db.occurrence.create({ data: second })).rejects.toMatchObject({ code: 'P2002' });
      const open = { occurrenceId: 'first', state: 'OPEN', submittedBy: 'member', verifierUserId: 'admin', requestedAt: now };
      await db.completion.create({ data: open });
      await expect(db.completion.create({ data: open })).rejects.toMatchObject({ code: 'P2002' });
    } finally { await db.$disconnect(); }
  });

  it('atomically deletes the private content and keeps the scoped deletion proof', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      await db.reminderAudit.create({ data: {
        reminderId: 'task', householdId: 'home', action: 'CREATED', actorId: 'admin', stateAt: now, changes: '{}',
      } });
      await db.$transaction(async (tx) => {
        await tx.reminder.delete({ where: { id: 'task' } });
        await tx.deletionCommit.create({ data: { requestId: 'request', householdId: 'home', reminderId: 'task', revision: 9, committedAt: now } });
      });
      expect(await db.reminderAudit.count()).toBe(0);
      expect(await db.occurrence.count()).toBe(0);
      expect(await db.deletionCommit.findUnique({ where: { requestId: 'request' } })).toMatchObject({
        householdId: 'home', reminderId: 'task', revision: 9,
      });
    } finally { await db.$disconnect(); }
  });

  it('retains ended assignments when a later assignment becomes active', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      const data = { reminderId: 'task', householdId: 'home', userId: 'member', assignedAt: now };
      await expect(db.assignment.create({ data })).rejects.toMatchObject({ code: 'P2002' });
      await db.assignment.updateMany({ where: { reminderId: 'task', userId: 'member', endedAt: null }, data: { endedAt: now } });
      await db.assignment.create({ data });
      expect(await db.assignment.count({ where: { reminderId: 'task', userId: 'member', endedAt: now } })).toBe(1);
      expect(await db.assignment.count({ where: { reminderId: 'task', userId: 'member', endedAt: null } })).toBe(1);
    } finally { await db.$disconnect(); }
  });
});
