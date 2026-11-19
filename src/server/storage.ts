import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client.js';

export async function openStore(path: string, options: { migrate?: boolean } = {}) {
  const absolute = resolve(path);
  if (options.migrate) {
    // The same SQL used by Prisma Migrate initializes isolated test databases.
    const file = new DatabaseSync(absolute);
    try {
      file.exec('PRAGMA foreign_keys = ON; BEGIN');
      const hasTable = file.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
      for (const [sentinel, migration] of [['User', '202611180001_u1'], ['Invitation', '202611190001_u2']]) {
        if (!hasTable.get(sentinel)) {
          file.exec(readFileSync('prisma/migrations/' + migration + '/migration.sql', 'utf8'));
        }
      }
      file.exec('COMMIT');
    } finally {
      file.close();
    }
  }
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: absolute }) });
  try {
    await db.$queryRaw`PRAGMA journal_mode = WAL`;
    await db.$executeRaw`PRAGMA foreign_keys = ON`;
    return db;
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}
