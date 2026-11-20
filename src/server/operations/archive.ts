import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { appendFileSync, constants, createReadStream, createWriteStream } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { syncFile } from './files.js';

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export async function sealArchive(input: string, output: string, key: Buffer, metadata: string) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(metadata));
  const handle = await open(output, 'wx', 0o600);
  try { await handle.writeFile(nonce); }
  finally { await handle.close(); }
  await pipeline(createReadStream(input), cipher, createWriteStream(output, { flags: 'a' }));
  appendFileSync(output, cipher.getAuthTag());
  syncFile(output);
}

export async function openArchive(input: string, output: string, key: Buffer, metadata: string) {
  const handle = await open(input, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size <= NONCE_BYTES + TAG_BYTES) throw new Error('BACKUP_ARCHIVE_INVALID');
    const nonce = Buffer.alloc(NONCE_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    const end = info.size - TAG_BYTES;
    if ((await handle.read(nonce, 0, nonce.length, 0)).bytesRead !== nonce.length ||
        (await handle.read(tag, 0, tag.length, end)).bytesRead !== tag.length) throw new Error('BACKUP_ARCHIVE_INVALID');
    const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(metadata));
    decipher.setAuthTag(tag);
    const target = await open(output, 'wx', 0o600);
    await target.close();
    try {
      await pipeline(createReadStream(input, { fd: handle.fd, start: NONCE_BYTES, end: end - 1, autoClose: false }),
        decipher, createWriteStream(output, { flags: 'r+' }));
      syncFile(output);
    } catch { await rm(output, { force: true }); throw new Error('BACKUP_AUTHENTICATION_FAILED'); }
  } finally { await handle.close(); }
}
