import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/server/storage.js';

let directory: string;
let path: string;
const oldMigration = 'prisma/migrations/202611180001_u1/migration.sql';

function createU1Database() {
  const file = new DatabaseSync(path);
  try {
    file.exec(readFileSync(oldMigration, 'utf8'));
    file.exec(`
      INSERT INTO "User" (id, "displayName") VALUES ('admin', 'Admin'), ('member', 'Member');
      INSERT INTO "Household" (id) VALUES ('home');
      INSERT INTO "Membership" ("householdId", "userId", role) VALUES ('home', 'admin', 'ADMIN'), ('home', 'member', 'MEMBER');
      INSERT INTO "Reminder" (id, "householdId", title, "createdBy", "requesterId") VALUES ('task', 'home', 'Task', 'admin', 'admin');
      INSERT INTO "Assignment" ("householdId", "reminderId", "userId") VALUES ('home', 'task', 'member');
    `);
  } finally {
    file.close();
  }
}

beforeEach(() => {
  directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
  path = join(directory, 'legacy.db');
  createU1Database();
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('U2 storage migration', () => {
  it('preserves legacy members and assignments and establishes safe defaults', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      expect(await db.user.findUnique({ where: { id: 'admin' } })).toMatchObject({ settingsRevision: 0, timeZone: null });
      expect(await db.household.findUnique({ where: { id: 'home' } })).toMatchObject({ settingsRevision: 0, defaultTimeZone: 'Asia/Seoul' });
      expect(await db.membership.findUnique({ where: { householdId_userId: { householdId: 'home', userId: 'admin' } } })).toMatchObject({
        role: 'ADMIN', active: true, revision: 0, leftAt: null,
      });
      expect(await db.assignment.findFirst()).toMatchObject({ reminderId: 'task', userId: 'member', endedAt: null });
      expect(await db.invitation.count()).toBe(0);
      expect(await db.householdSettings.count()).toBe(0);
      expect(await db.userSettings.count()).toBe(0);
    } finally {
      await db.$disconnect();
    }
    const reopened = await openStore(path, { migrate: true });
    try {
      expect(await reopened.reminder.count()).toBe(1);
    } finally {
      await reopened.$disconnect();
    }
  });

  it('stores a unique invite digest and only retains email while an invite can be accepted', async () => {
    const db = await openStore(path, { migrate: true });
    const now = new Date('2032-01-01T00:00:00Z');
    const expiresAt = new Date('2032-01-02T00:00:00Z');
    const value = { householdId: 'home', createdByUserId: 'admin', targetEmail: 'member@example.test',
      tokenHash: '1'.repeat(64), createdAt: now, expiresAt };
    try {
      const issued = await db.invitation.create({ data: value });
      await expect(db.invitation.create({ data: value })).rejects.toMatchObject({ code: 'P2002' });
      await expect(db.invitation.update({ where: { id: issued.id }, data: { revokedAt: now } })).rejects.toThrow();
      await db.invitation.update({ where: { id: issued.id }, data: { revokedAt: now, targetEmail: null } });
      const revoked = await db.invitation.findUniqueOrThrow({ where: { id: issued.id } });
      expect(revoked).toMatchObject({ targetEmail: null, revokedAt: now });
      expect(revoked).not.toHaveProperty('code');
      const expired = await db.invitation.create({ data: { ...value, tokenHash: '2'.repeat(64), targetEmail: null } });
      expect(expired.targetEmail).toBeNull();
    } finally {
      await db.$disconnect();
    }
  });

  it('rolls back a membership and its assignments together when a later write fails', async () => {
    const db = await openStore(path, { migrate: true });
    try {
      await expect(db.$transaction(async (tx) => {
        await tx.membership.updateMany({ where: { householdId: 'home', userId: 'member' }, data: { active: false, revision: 1 } });
        await tx.assignment.updateMany({ where: { householdId: 'home', userId: 'member' }, data: { endedAt: new Date() } });
        throw new Error('storage-fixture-failure');
      })).rejects.toThrow('storage-fixture-failure');
      expect(await db.membership.findFirst({ where: { userId: 'member' } })).toMatchObject({ active: true, revision: 0 });
      expect(await db.assignment.findFirst()).toMatchObject({ endedAt: null });
    } finally {
      await db.$disconnect();
    }
  });
});
