import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clock, deviceFixture, seedReminders, tokenKey } from './fixture.js';
import { InstallationRepository } from '../../src/server/installations.js';
import { runSignalBatch, type SignalSender } from '../../src/server/notification-outbox.js';

let fixture: Awaited<ReturnType<typeof deviceFixture>>;
let origin: Date;
let sender: SignalSender;

beforeEach(async () => {
  fixture = await deviceFixture();
  origin = clock();
  sender = { send: vi.fn(async () => 'SENT' as const) };
  const repo = new InstallationRepository(fixture.db, () => origin, tokenKey);
  const ids = await seedReminders(fixture.db, 1);
  await repo.register('member', undefined, 'register', { installationId: 'device', appVersion: '1', pushToken: 'synthetic-token' });
  const before = await repo.sync('home', 'device', 'member');
  await repo.setExclusion('home', 'device', 'member', ids[0], 'exclude', before.epoch, before.revision, true);
});
afterEach(async () => { await fixture.close(); });

it('sends only data-only fields and uses the remaining lifetime', async () => {
  const now = new Date(origin.getTime() + 3_600_000);
  await runSignalBatch(fixture.db, sender, tokenKey, '', () => now);
  expect(sender.send).toHaveBeenCalledOnce();
  expect(sender.send).toHaveBeenCalledWith('synthetic-token', {
    schemaVersion: '1', eventId: expect.any(String), eventType: 'reminder.changed', scopeRef: expect.any(String),
    householdRevision: '2', expiresAt: new Date(origin.getTime() + 86_400_000).toISOString(),
  }, 82_800_000);
  expect(await fixture.db.deviceSignal.findFirst()).toMatchObject({ state: 'SENT' });
  await runSignalBatch(fixture.db, sender, tokenKey, '', () => now);
  expect(sender.send).toHaveBeenCalledOnce();
});

it('retries transient delivery and never sends at or after expiry', async () => {
  const send = vi.fn(async () => 'TRANSIENT' as const);
  await runSignalBatch(fixture.db, { send }, tokenKey, '', () => origin);
  const row = await fixture.db.deviceSignal.findFirstOrThrow();
  expect(row.state).toBe('PENDING');
  expect(row.readyAt > origin).toBe(true);
  await runSignalBatch(fixture.db, { send }, tokenKey, '', () => new Date(origin.getTime() + 86_400_000));
  expect(send).toHaveBeenCalledOnce();
  expect(await fixture.db.deviceSignal.findFirst()).toMatchObject({ state: 'EXPIRED' });
});

it('recovers an abandoned lease and clears only the matching rejected provider token', async () => {
  await fixture.db.deviceSignal.updateMany({ data: { state: 'LEASED', leaseUntil: new Date(origin.getTime() - 1), leaseToken: 'lost' } });
  const send = vi.fn(async () => 'INVALID_TOKEN' as const);
  await runSignalBatch(fixture.db, { send }, tokenKey, '', () => origin);
  expect(send).toHaveBeenCalledOnce();
  expect(await fixture.db.deviceSignal.findFirst()).toMatchObject({ state: 'FAILED' });
  expect(await fixture.db.installation.findFirst()).toMatchObject({ active: true, tokenCiphertext: null });
});

it('rotates the wire scope after restart from a restored generation even with identical database revisions', async () => {
  const old = new InstallationRepository(fixture.db, () => origin, tokenKey);
  const restored = new InstallationRepository(fixture.db, () => origin, tokenKey, 'restored');
  const first = await old.sync('home', 'device', 'member');
  const next = await restored.sync('home', 'device', 'member', first.epoch, first.revision);
  expect(next.revision).toBe(first.revision);
  expect(next.epoch).not.toBe(first.epoch);
  expect(next.scopeRef).not.toBe(first.scopeRef);
  expect(next.mode).toBe('FULL');
});
