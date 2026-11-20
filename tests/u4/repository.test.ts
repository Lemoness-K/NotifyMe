import { afterEach, beforeEach, expect, it } from 'vitest';
import { clock, deviceFixture, seedReminders, tokenKey } from './fixture.js';
import { InstallationRepository } from '../../src/server/installations.js';
import { WorkService } from '../../src/server/work-service.js';

let fixture: Awaited<ReturnType<typeof deviceFixture>>;
let repository: InstallationRepository;
const registration = (installationId = 'device') => ({ installationId, appVersion: '1' });

beforeEach(async () => {
  fixture = await deviceFixture();
  repository = new InstallationRepository(fixture.db, clock, tokenKey);
});
afterEach(async () => { await fixture.close(); });

it('registers 101 locations in a pending state while retaining time plans and another installation', async () => {
  const ids = await seedReminders(fixture.db, 101);
  await seedReminders(fixture.db, 1, 'TIME');
  await repository.register('member', undefined, 'reg-one', registration());
  await repository.register('member', undefined, 'reg-two', registration('second'));
  const first = await repository.sync('home', 'device', 'member');
  expect(first.locationCapacity).toEqual({ state: 'CAPACITY_PENDING', requiredSlots: 101, limit: 100 });
  expect(first.plans.map((plan) => plan.trigger.kind)).toEqual(['TIME']);
  const page = await repository.exclusions('home', 'device', 'member', { limit: 1 });
  expect(page.items).toEqual([{ reminderId: ids[0], title: ids[0], excluded: false, slots: 1 }]);
  expect((await repository.exclusions('home', 'device', 'member', { cursor: page.nextCursor })).items[0].reminderId).toBe(ids[1]);
  await repository.setExclusion('home', 'device', 'member', ids[0], 'exclude', first.epoch, first.revision, true);
  const updated = await repository.sync('home', 'device', 'member', first.epoch, first.revision);
  expect(updated.mode).toBe('DELTA');
  expect(updated.locationCapacity).toEqual({ state: 'ACTIVE', requiredSlots: 100, limit: 100 });
  expect(updated.plans).toHaveLength(100);
  expect((await repository.sync('home', 'second', 'member')).locationCapacity.state).toBe('CAPACITY_PENDING');
  await expect(repository.setExclusion('home', 'device', 'member', ids[0], 'restore', updated.epoch, updated.revision, false))
    .rejects.toMatchObject({ code: 'GEOFENCE_CAPACITY_EXCEEDED' });
  expect(await fixture.db.locationExclusion.count()).toBe(1);
});

it('atomically rejects the 101st location on an active installation during concurrent saves', async () => {
  await seedReminders(fixture.db, 99);
  await repository.register('member', undefined, 'register', registration());
  expect((await repository.sync('home', 'device', 'member')).locationCapacity).toMatchObject({ requiredSlots: 99, state: 'ACTIVE' });
  const service = new WorkService(fixture.db, clock, repository);
  const add = (title: string) => service.add('home', 'member', title, {
    title, requesterId: 'member', assigneeIds: ['member'],
    trigger: { kind: 'LOCATION', radiusM: 100, latitude: 10, longitude: 20, event: 'ENTER' },
  });
  const operations = await Promise.allSettled([add('one'), add('two')]);
  expect(operations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(operations.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'GEOFENCE_CAPACITY_EXCEEDED' } });
  expect(await fixture.db.reminder.count()).toBe(100);
  expect((await repository.sync('home', 'device', 'member')).plans).toHaveLength(100);
});

it('scopes sync and cursors, preserves idempotent registration, and rejects stale mutation generations', async () => {
  await seedReminders(fixture.db, 2);
  const input = { ...registration(), pushToken: 'synthetic-private-token' };
  const first = await repository.register('member', undefined, 'register', input);
  expect(await repository.register('member', undefined, 'register', input)).toEqual(first);
  expect((await fixture.db.installation.findUniqueOrThrow({ where: { id: 'device' } })).tokenCiphertext).not.toContain(input.pushToken);
  await expect(repository.register('other', undefined, 'other', input)).rejects.toMatchObject({ code: 'INSTALLATION_ACCESS_DENIED' });
  await expect(repository.sync('home', 'device', 'other')).rejects.toMatchObject({ code: 'INSTALLATION_ACCESS_DENIED' });
  const original = await repository.sync('home', 'device', 'member');
  expect((await repository.sync('home', 'device', 'member', 'stale', original.revision)).mode).toBe('FULL');
  await expect(repository.setExclusion('home', 'device', 'member', 'location-000', 'exclude', 'stale', original.revision, true))
    .rejects.toMatchObject({ code: 'STALE_REVISION' });
  const page = await repository.exclusions('home', 'device', 'member', { limit: 1 });
  await repository.register('member', undefined, 'reg-two', registration('second'));
  await expect(repository.exclusions('home', 'second', 'member', { cursor: page.nextCursor })).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
});

it('enqueues a scoped revocation even for an installation with no reminder plans', async () => {
  await repository.register('other', undefined, 'register', registration());
  const old = await repository.sync('home', 'device', 'other');
  expect(old.plans).toEqual([]);
  await fixture.db.$transaction(async (tx) => {
    await repository.revoke(tx, 'home', 'other', clock());
    await tx.membership.update({ where: { householdId_userId: { householdId: 'home', userId: 'other' } }, data: { active: false } });
  });
  expect(await fixture.db.deviceSignal.findFirst({ where: { type: 'household.access_revoked' } })).toMatchObject({ scopeId: old.scopeRef });
  await expect(repository.sync('home', 'device', 'other')).rejects.toMatchObject({ code: 'HOUSEHOLD_ACCESS_REVOKED' });
});

it('advances the retained cursor when an expired removal marker is pruned', async () => {
  await seedReminders(fixture.db, 1);
  await repository.register('member', undefined, 'register', registration());
  const initial = await repository.sync('home', 'device', 'member');
  const [plan] = initial.plans;
  await fixture.db.$transaction(async (tx) => repository.validateAndStore(tx, 'home', [{
    installationId: 'device', planId: plan.planId, version: plan.version + 1, action: 'REMOVE',
  }]));
  const next = await repository.sync('home', 'device', 'member', initial.epoch, initial.revision);
  expect(next).toMatchObject({ mode: 'DELTA', removedPlanIds: [plan.planId] });

  const later = new InstallationRepository(fixture.db, () => new Date('2032-02-01T00:00:00Z'), tokenKey);
  await later.prune();
  expect(await fixture.db.devicePlan.count()).toBe(0);
  expect(await later.sync('home', 'device', 'member', initial.epoch, initial.revision)).toMatchObject({ mode: 'FULL', plans: [] });
  expect(await later.sync('home', 'device', 'member', initial.epoch, next.revision)).toMatchObject({ mode: 'DELTA', plans: [] });
});

it('rejects previous epoch reports and accepts independent event and replay keys after recovery', async () => {
  await seedReminders(fixture.db, 1);
  await repository.register('member', undefined, 'register', registration());
  const before = await repository.sync('home', 'device', 'member');
  const [plan] = before.plans;
  const report = { epoch: before.epoch, eventId: 'same-client-id', occurrenceId: plan.occurrenceId,
    triggerVersion: plan.version, condition: 'ENTER', detectedAt: clock() };
  await repository.recordEvent('home', 'device', 'member', 'replay-key', report);
  const recovered = new InstallationRepository(fixture.db, clock, tokenKey, 'restored-generation');
  const after = await recovered.sync('home', 'device', 'member', before.epoch, before.revision);
  expect(after.plans[0].version).toBe(plan.version);
  await expect(recovered.recordEvent('home', 'device', 'member', 'replay-key', report)).rejects.toMatchObject({ code: 'STALE_REVISION' });
  const current = { ...report, epoch: after.epoch };
  await recovered.recordEvent('home', 'device', 'member', 'replay-key', current);
  await recovered.recordEvent('home', 'device', 'member', 'replay-key', current);
  expect(await fixture.db.locationEvent.count()).toBe(2);
});
