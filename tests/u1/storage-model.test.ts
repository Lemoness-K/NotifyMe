import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/server/storage.js';

let directory: string;

beforeEach(() => { directory = mkdtempSync(join(process.cwd(), '.u1-db-')); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

describe('SQLite model migration', () => {
  it('creates the U1 tables and enables foreign keys', async () => {
    const db = await openStore(join(directory, 'test.db'), { migrate: true });
    try {
      const tables = await db.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_master WHERE type = 'table'`;
      expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining([
        'User', 'Household', 'Membership', 'AuthIdentity', 'LoginChallenge', 'Session',
        'Reminder', 'Assignment', 'Occurrence', 'RequestResult',
      ]));
      expect(await db.$queryRaw`PRAGMA foreign_keys`).toEqual([{ foreign_keys: 1n }]);
    } finally { await db.$disconnect(); }
  });

  it('only permits one household in the MVP migration', async () => {
    const db = await openStore(join(directory, 'test.db'), { migrate: true });
    try {
      await db.household.create({ data: { id: 'one' } });
      await expect(db.household.create({ data: { id: 'two' } })).rejects.toThrow();
      expect(await db.household.count()).toBe(1);
    } finally { await db.$disconnect(); }
  });

  it('rolls back a write when a household relationship fails', async () => {
    const db = await openStore(join(directory, 'test.db'), { migrate: true });
    try {
      await expect(db.$transaction(async (tx) => {
        await tx.household.create({ data: { id: 'one' } });
        await tx.membership.create({ data: { householdId: 'one', userId: 'unknown', role: 'ADMIN' } });
      })).rejects.toThrow();
      expect(await db.household.count()).toBe(0);
    } finally { await db.$disconnect(); }
  });
});
