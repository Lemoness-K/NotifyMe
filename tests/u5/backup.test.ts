import { readFileSync, unlinkSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { SessionService, type IdentityProvider } from '../../src/server/auth.js';
import { DeleteJournal } from '../../src/server/delete-journal.js';
import { InstallationRepository } from '../../src/server/installations.js';
import { Activation, bindGeneration } from '../../src/server/operations/activation.js';
import { JournalAuthority } from '../../src/server/operations/authority.js';
import { Backups } from '../../src/server/operations/backup.js';
import { restoreBackup } from '../../src/server/operations/restore.js';
import { startManagedRuntime, type ServingGate } from '../../src/server/operations/runtime.js';
import { openStore } from '../../src/server/storage.js';
import { createWorkInput } from '../../src/server/work-input.js';
import { WorkService } from '../../src/server/work-service.js';
import { seedHousehold } from '../u1/fixtures.js';
import { mediaToken, operationsFixture, testKey } from './fixture.js';

let fixture: ReturnType<typeof operationsFixture>;
let db: Awaited<ReturnType<typeof openStore>>;
let journal: DeleteJournal;
let authority: JournalAuthority;
let backups: Backups;
let work: WorkService;
let activation: Activation;
const at = new Date('2032-01-01T00:00:00Z');
const restoreAt = new Date(at.getTime() + 1000);
const key = Buffer.alloc(testKey.byteLength, 23);
let journalPath: string;

beforeEach(async () => {
  fixture = operationsFixture();
  db = await openStore(fixture.database, { migrate: true });
  await seedHousehold(db);
  bindGeneration(fixture.database, 'generation-one');
  activation = new Activation(fixture.state);
  activation.initialize(fixture.database, 'generation-one');
  journalPath = join(fixture.state, 'journal.sqlite');
  journal = await DeleteJournal.open(db, journalPath);
  authority = new JournalAuthority({ root: fixture.volume, volumeId: mediaToken, key: testKey, mounted: () => true });
  await journal.initializeAuthority(authority, db);
  work = new WorkService(db, () => at, undefined, journal);
  backups = new Backups(fixture.archives, fixture.state, key);
  backups.initialize();
});

afterEach(async () => { journal?.close(); await db?.$disconnect(); fixture?.close(); });

async function create(key: string) {
  return work.add('home', 'member', key, createWorkInput({ title: 'Synthetic secret ' + key,
    trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'UTC' } }, 'member'));
}

function restore(id: string, useJournal = journalPath, clock = () => restoreAt) {
  return restoreBackup({ activation, archives: backups, authority, journalPath: useJournal, state: fixture.state, id, clock });
}

it('blocks the same epoch with an older database and a complete anchored journal', async () => {
  const gone = await create('stale');
  const stale = join(fixture.state, 'old.sqlite');
  await db.$executeRaw`VACUUM INTO ${stale}`;
  await work.delete('home', 'member', gone.reminderId, 'delete-stale', gone.revision);
  await db.$disconnect();
  unlinkSync(fixture.database);
  copyFileSync(stale, fixture.database);
  const bindAndStartWorker = vi.fn();
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath }))
    .rejects.toThrow('RECOVERY_DATABASE_PROOF_MISMATCH');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('blocks the same epoch after its missing deletion has been compacted to the authority floor', async () => {
  const gone = await create('compacted');
  const stale = join(fixture.state, 'old.sqlite');
  await db.$executeRaw`VACUUM INTO ${stale}`;
  await work.delete('home', 'member', gone.reminderId, 'delete-compacted', gone.revision);
  await backups.capture(fixture.database, work, new Date(at.getTime() + 31 * 86_400_000));
  expect(authority.read().floor.position).toBe(2);
  await db.$disconnect();
  unlinkSync(fixture.database);
  copyFileSync(stale, fixture.database);
  const bindAndStartWorker = vi.fn();
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath }))
    .rejects.toThrow('RECOVERY_DATABASE_PROOF_MISMATCH');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('requires an exact anchored commit even when its deleted target is already absent', async () => {
  const gone = await create('wrong-proof');
  await work.delete('home', 'member', gone.reminderId, 'delete-wrong-proof', gone.revision);
  await db.deletionCommit.updateMany({ data: { inputDigest: null } });
  await db.$disconnect();
  const bindAndStartWorker = vi.fn();
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath }))
    .rejects.toThrow('RECOVERY_DATABASE_PROOF_MISMATCH');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('does not open the listener or Worker if authority advances after the candidate was verified', async () => {
  const gone = await create('advance');
  const snapshot = await backups.capture(fixture.database, work, at);
  await restore(snapshot.id);
  await work.delete('home', 'member', gone.reminderId, 'delete-advance', gone.revision);
  const bindAndStartWorker = vi.fn();
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath }))
    .rejects.toThrow('RECOVERY_BOUNDARY_CHANGED');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('blocks first startup when the verified archive reaches 30 days of age', async () => {
  const snapshot = await backups.capture(fixture.database, work, at);
  await restore(snapshot.id);
  const bindAndStartWorker = vi.fn();
  const clock = () => new Date(at.getTime() + 30 * 86_400_000);
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath, clock }))
    .rejects.toThrow('BACKUP_NOT_SELECTABLE');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('does not keep an ACTIVE marker if the first publication was interrupted', async () => {
  const snapshot = await backups.capture(fixture.database, work, at);
  await restore(snapshot.id);
  await expect(startManagedRuntime(fixture.state, async () => { throw new Error('fixture port unavailable'); },
    { authority, journalPath, clock: () => restoreAt })).rejects.toThrow('fixture port unavailable');
  expect(activation.active().phase).toBe('VERIFIED');
  const bindAndStartWorker = vi.fn();
  const clock = () => new Date(at.getTime() + 30 * 86_400_000);
  await expect(startManagedRuntime(fixture.state, bindAndStartWorker, { authority, journalPath, clock }))
    .rejects.toThrow('BACKUP_NOT_SELECTABLE');
  expect(bindAndStartWorker).not.toHaveBeenCalled();
});

it('discards a candidate that expires during recovery', async () => {
  const snapshot = await backups.capture(fixture.database, work, at);
  const clock = vi.fn(() => new Date(at.getTime() + 30 * 86_400_000)).mockReturnValueOnce(restoreAt);
  await expect(restore(snapshot.id, journalPath, clock)).rejects.toThrow('BACKUP_NOT_SELECTABLE');
  expect(() => activation.active()).toThrow('RECOVERY_NOT_ACTIVE');
});

it('requires reauthentication after restoring an image from before an app session logged out', async () => {
  const authTime = Math.floor(at.getTime() / 1000);
  const identity = { issuer: 'fixture-issuer', subject: 'fixture-subject', authTime };
  const provider: IdentityProvider = {
    verifyFirebase: async () => ({ ...identity, googleSubject: 'fixture-google' }),
    verifyGoogle: async () => { throw new Error('unused'); },
  };
  const secret = 'fixture-session';
  const digest = createHash('sha256').update(secret).digest('hex');
  await db.session.create({ data: { ...identity, digest, userId: 'member', expiresAt: new Date(at.getTime() + 60_000) } });
  await db.installation.create({ data: { id: 'session-installation', userId: 'member', appVersion: 'fixture',
    sessionDigest: digest, tokenCiphertext: 'synthetic-token' } });
  const saved = await backups.capture(fixture.database, work, at);
  const live = new SessionService(db, provider, () => restoreAt);
  await expect(live.principal('fixture-token', secret)).resolves.toMatchObject({ userId: 'member' });
  await live.end('fixture-token', secret);
  const restored = await restore(saved.id);
  const candidate = await openStore(restored.database);
  try {
    const auth = new SessionService(candidate, provider, () => restoreAt);
    await expect(auth.principal('fixture-token', secret)).rejects.toMatchObject({ status: 401 });
    expect(await candidate.installation.findUnique({ where: { id: 'session-installation' } }))
      .toMatchObject({ active: false, tokenCiphertext: null });
    expect(await candidate.membership.findMany({ where: { userId: 'member', active: true } })).toHaveLength(1);
  } finally { await candidate.$disconnect(); }
});

it('restores an encrypted WAL snapshot and reapplies actual deletes before switching the epoch', async () => {
  const gone = await create('gone');
  const saved = await create('saved');
  await db.installation.create({ data: { id: 'device', userId: 'member', appVersion: 'fixture' } });
  await db.installationScope.create({ data: { id: 'scope', installationId: 'device', householdId: 'home', epoch: 'prior' } });
  const old = await new InstallationRepository(db, () => at, undefined, 'generation-one').sync('home', 'device', 'member');
  const item = await backups.capture(fixture.database, work, at);
  expect(readFileSync(backups.path(item.id)).includes(Buffer.from('Synthetic secret'))).toBe(false);
  await work.delete('home', 'member', gone.reminderId, 'delete', gone.revision);
  const restored = await restore(item.id);
  expect(restored.epoch).not.toBe('generation-one');
  const start = vi.fn(async (_active: { database: string; epoch: string }, gate: ServingGate) => {
    gate.publish();
    return async () => undefined;
  });
  const stop = await startManagedRuntime(fixture.state, start, { authority, journalPath, clock: () => restoreAt });
  expect(start).toHaveBeenCalledWith(expect.objectContaining(restored), expect.any(Object));
  await stop();
  const candidate = await openStore(restored.database);
  try {
    expect(await candidate.reminder.findMany({ select: { id: true } })).toEqual([{ id: saved.reminderId }]);
    expect(await candidate.deletionCommit.count()).toBe(1);
    expect(await candidate.occurrence.count({ where: { reminderId: gone.reminderId } })).toBe(0);
    const synced = await new InstallationRepository(candidate, () => restoreAt, undefined, restored.epoch)
      .sync('home', 'device', 'member', old.epoch, old.revision);
    expect(synced.mode).toBe('FULL');
    expect(synced.epoch).not.toBe(old.epoch);
  } finally { await candidate.$disconnect(); }
});

it('stays blocked when a valid anchored deletion request has no verified terminal result', async () => {
  const snapshot = await backups.capture(fixture.database, work, at);
  journal.request({ requestId: 'synthetic-pending', householdId: 'home', reminderId: 'synthetic-reminder',
    digest: 'fixture-digest', at });
  await expect(restore(snapshot.id)).rejects.toThrow('DELETE_EVIDENCE_PENDING');
  expect(() => activation.active()).toThrow('RECOVERY_NOT_ACTIVE');
});

it('rejects an authenticated same-lineage journal copy with a deleted suffix', async () => {
  const gone = await create('gone');
  const snapshot = await backups.capture(fixture.database, work, at);
  const old = join(fixture.state, 'old.sqlite');
  copyFileSync(journalPath, old);
  await work.delete('home', 'member', gone.reminderId, 'delete', gone.revision);
  await expect(restore(snapshot.id, old)).rejects.toThrow('RECOVERY_JOURNAL_GAP');
  expect(() => activation.active()).toThrow('RECOVERY_NOT_ACTIVE');
});

it('does not activate a tampered ciphertext or a missing independent head', async () => {
  await create('source');
  const snapshot = await backups.capture(fixture.database, work, at);
  const archive = backups.path(snapshot.id);
  const bytes = readFileSync(archive);
  bytes[bytes.length - 17] ^= 1;
  writeFileSync(archive, bytes);
  await expect(restore(snapshot.id)).rejects.toThrow();
  expect(() => activation.active()).toThrow('RECOVERY_NOT_ACTIVE');
  unlinkSync(join(fixture.volume, 'delete-head.json'));
  await expect(restore(snapshot.id)).rejects.toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
});

it('keeps the evidence floor while a selectable archive needs it and removes expired archives', async () => {
  const gone = await create('gone');
  const first = await backups.capture(fixture.database, work, at);
  await work.delete('home', 'member', gone.reminderId, 'delete', gone.revision);
  expect(authority.read().floor.position).toBe(first.cutoff.position);
  const later = new Date(at.getTime() + 31 * 86_400_000);
  const second = await backups.capture(fixture.database, work, later);
  expect(() => readFileSync(backups.path(first.id))).toThrow();
  expect(authority.read().floor.position).toBe(second.cutoff.position);
});
