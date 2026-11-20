import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, linkSync, openSync, readFileSync,
  renameSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function readProtected(path: string) {
  const file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(file);
    if (!info.isFile() || (info.mode & 0o077) || info.size > 1_048_576) throw new Error('OPERATIONS_FILE_INVALID');
    return readFileSync(file, 'utf8');
  } finally { closeSync(file); }
}

export function syncFile(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); }
  finally { closeSync(fd); }
}

export function syncDirectory(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY);
  try { fsyncSync(fd); }
  finally { closeSync(fd); }
}

export function atomicRecord(path: string, value: unknown, replace = true) {
  const directory = dirname(path);
  const partial = join(directory, '.notify-record-' + randomUUID());
  try {
    writeFileSync(partial, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' });
    syncFile(partial);
    if (replace) renameSync(partial, path);
    else linkSync(partial, path);
    syncDirectory(directory);
  } finally { rmSync(partial, { force: true }); }
}

export async function hashFile(path: string) {
  const hash = createHash('sha256');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk);
    return hash.digest('hex');
  } finally {
    await file.close();
  }
}

export function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export function readKey(path: string) {
  const encoded = readProtected(path).trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error('OPERATIONS_KEY_INVALID');
  const key = Buffer.from(encoded, 'base64url');
  if (key.toString('base64url') !== encoded) throw new Error('OPERATIONS_KEY_INVALID');
  return key;
}
