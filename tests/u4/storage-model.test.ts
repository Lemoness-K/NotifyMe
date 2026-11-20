import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openStore } from '../../src/server/storage.js';

let directory: string;
let path: string;
const now = new Date('2032-01-01T00:00:00Z');

beforeEach(() => {
  directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
  path = join(directory, 'legacy.db');
  const legacy = new DatabaseSync(path);
  try {
    for (const migration of ['202611180001_u1', '202611190001_u2', '202611190002_u3', '202611190003_u3_delete_replay']) {
      legacy.exec(readFileSync('prisma/migrations/' + migration + '/migration.sql', 'utf8'));
    }
    legacy.exec(`
      INSERT INTO "User" (id) VALUES ('admin');
      INSERT INTO "Household" (id) VALUES ('home');
      INSERT INTO "HouseholdSettings" ("householdId") VALUES ('home');
      INSERT INTO "Membership" ("householdId", "userId", role) VALUES ('home', 'admin', 'ADMIN');
      INSERT INTO "Reminder" (id, "householdId", title, "createdBy", "requesterId") VALUES ('task', 'home', 'U3 원문', 'admin', 'admin');
      INSERT INTO "Occurrence" (id, "reminderId", "scheduledAt", revision) VALUES ('first', 'task', '2032-01-01T00:00:00Z', 2);
    `);
  } finally { legacy.close(); }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

it('migrates a U3 database without altering existing reminder or occurrence identities', async () => {
  const db = await openStore(path, { migrate: true });
  try {
    expect(await db.reminder.findUnique({ where: { id: 'task' } })).toMatchObject({ title: 'U3 원문', householdId: 'home' });
    expect(await db.occurrence.findUnique({ where: { id: 'first' } })).toMatchObject({ revision: 2 });
    expect(await db.installation.count()).toBe(0);
    expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
  } finally { await db.$disconnect(); }
});

it('enforces installation scope, plan, exclusion, signal and event identity constraints', async () => {
  const db = await openStore(path, { migrate: true });
  try {
    await db.installation.create({ data: { id: 'device', userId: 'admin', appVersion: '1', createdAt: now } });
    const scope = { id: 'scope', installationId: 'device', householdId: 'home', epoch: 'epoch' };
    await db.installationScope.create({ data: scope });
    await expect(db.installationScope.create({ data: { ...scope, id: 'other' } })).rejects.toMatchObject({ code: 'P2002' });
    const plan = { scopeId: scope.id, id: 'first', reminderId: 'task', kind: 'TIME', version: 2, revision: 1, payload: '{}' };
    await db.devicePlan.create({ data: plan });
    await expect(db.devicePlan.create({ data: plan })).rejects.toMatchObject({ code: 'P2002' });
    const exclusion = { scopeId: scope.id, reminderId: 'task' };
    await db.locationExclusion.create({ data: exclusion });
    await expect(db.locationExclusion.create({ data: exclusion })).rejects.toMatchObject({ code: 'P2002' });
    const signal = { id: 'signal', scopeId: scope.id, type: 'reminder.changed', revision: 1,
      createdAt: now, readyAt: now, expiresAt: new Date(now.getTime() + 86_400_000) };
    await db.deviceSignal.create({ data: signal });
    await expect(db.deviceSignal.create({ data: signal })).rejects.toMatchObject({ code: 'P2002' });
    const event = { scopeId: scope.id, id: 'event', occurrenceId: 'first', detectedAt: now, version: 2, condition: 'ENTER', digest: 'same' };
    await db.locationEvent.create({ data: event });
    await expect(db.locationEvent.create({ data: event })).rejects.toMatchObject({ code: 'P2002' });
  } finally { await db.$disconnect(); }
});
