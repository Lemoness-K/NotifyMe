import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openStore } from '../../src/server/storage.js';

export async function testDatabase() {
  const directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
  const path = join(directory, 'app.db');
  const db = await openStore(path, { migrate: true });
  return {
    db, path,
    close: async () => {
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export async function seedHousehold(db: Awaited<ReturnType<typeof openStore>>) {
  await db.user.create({ data: { id: 'member', displayName: '테스트 관리자' } });
  await db.user.create({ data: { id: 'outsider' } });
  await db.household.create({ data: { id: 'home' } });
  await db.membership.create({ data: { householdId: 'home', userId: 'member', role: 'ADMIN' } });
  await db.authIdentity.create({ data: { issuer: 'test-issuer', subject: 'member-firebase', userId: 'member' } });
}
