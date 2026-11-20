import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const testKey = Buffer.alloc(32, 19);
export const mediaToken = 'test-authority-volume';

export function operationsFixture() {
  const directory = mkdtempSync(join(process.cwd(), '.u1-db-u5-'));
  const volume = join(directory, 'volume');
  mkdirSync(volume, { mode: 0o700 });
  writeFileSync(join(volume, 'notify-me-volume'), mediaToken, { mode: 0o600 });
  const state = join(directory, 'state');
  const archives = join(directory, 'archives');
  mkdirSync(state, { mode: 0o700 });
  mkdirSync(archives, { mode: 0o700 });
  const database = join(state, 'notify.sqlite');
  return { directory, volume, state, archives, database, close: () => rmSync(directory, { recursive: true, force: true }) };
}

export function basicDatabase(path: string) {
  new DatabaseSync(path).close();
  chmodSync(path, 0o600);
}
