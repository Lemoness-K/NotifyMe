import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HouseholdRepository } from '../../src/server/households.js';
import { createTimeReminder, listReminders } from '../../src/server/repository.js';
import { seedHousehold, testDatabase } from '../u1/fixtures.js';

const start = new Date('2032-01-01T00:00:00Z');
const invited = { issuer: 'test-issuer', subject: 'new-subject', email: 'new@example.test', displayName: 'New' };
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let repo: HouseholdRepository;
let now: Date;

beforeEach(async () => {
  fixture = await testDatabase();
  now = start;
  repo = new HouseholdRepository(fixture.db, 'https://example.test', () => now);
  await seedHousehold(fixture.db);
});
afterEach(async () => fixture.close());

async function issue(key = 'issue1', email = invited.email) {
  const result = await repo.createInvitation('home', 'member', key, email);
  return { ...result, code: new URL(result.inviteUrl).hash.slice(1) };
}

describe('household transaction boundaries', () => {
  it('exposes a link only once and idempotently returns safe recovery metadata', async () => {
    const { invitationId, code, expiresAt } = await issue();
    expect(code.length).toBeGreaterThan(21);
    expect(expiresAt).toBe('2032-01-02T00:00:00.000Z');
    expect(await fixture.db.invitation.count()).toBe(1);
    const same = await repo.createInvitation('home', 'member', 'issue1', invited.email).catch((error) => error);
    expect(same).toMatchObject({ status: 409, code: 'INVITATION_ALREADY_ISSUED', details: { invitationId, expiresAt } });
    expect(JSON.stringify(same)).not.toContain(code);
    await expect(issue('issue1', 'different@example.test')).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const storedResults = JSON.stringify(await fixture.db.householdCommandResult.findMany());
    expect(storedResults).not.toContain(code);
    expect(storedResults).not.toContain(invited.email);
  });

  it('joins a new internal identity once and keeps a replay independent of erased email', async () => {
    const { code, invitationId } = await issue();
    const result = await repo.acceptInvitation('join', code, invited);
    expect(result).toMatchObject({ role: 'MEMBER', revision: 0 });
    expect(await fixture.db.authIdentity.findFirst({ where: { subject: invited.subject } })).toMatchObject({ userId: result.userId });
    expect(await fixture.db.invitation.findUnique({ where: { id: invitationId } })).toMatchObject({
      targetEmail: null, consumedByUserId: result.userId, consumedAt: start,
    });
    expect(await repo.acceptInvitation('join', code, invited)).toEqual(result);
    await expect(repo.acceptInvitation('different', code, invited)).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(await fixture.db.membership.count()).toBe(2);
  });

  it('preserves current roles when an existing member accepts another invite', async () => {
    const { code } = await issue();
    await expect(repo.acceptInvitation('join', code, {
      ...invited, issuer: 'test-issuer', subject: 'member-firebase',
    })).resolves.toMatchObject({ userId: 'member', role: 'ADMIN', revision: 0 });
    expect(await fixture.db.membership.count()).toBe(1);
  });

  it('does not consume an invite for a different email and deletes it at expiry only through cleanup', async () => {
    const { code, invitationId } = await issue();
    await expect(repo.acceptInvitation('join', code, { ...invited, email: 'wrong@example.test' })).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(await fixture.db.invitation.findUnique({ where: { id: invitationId } })).toMatchObject({ consumedAt: null, targetEmail: invited.email });
    now = new Date('2032-01-02T00:00:00Z');
    await expect(repo.acceptInvitation('join', code, invited)).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(await repo.cleanExpiredInvitations()).toMatchObject({ count: 1 });
    expect(await fixture.db.invitation.findUnique({ where: { id: invitationId } })).toMatchObject({ consumedAt: null, targetEmail: null });
  });

  it('revokes an active invitation without erasing authorization checks on replay', async () => {
    const { code, invitationId } = await issue();
    await repo.revokeInvitation('home', 'member', invitationId, 'revoke');
    await repo.revokeInvitation('home', 'member', invitationId, 'revoke');
    expect(await fixture.db.invitation.findUnique({ where: { id: invitationId } })).toMatchObject({ revokedAt: start, targetEmail: null });
    await expect(repo.acceptInvitation('join', code, invited)).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    await expect(repo.revokeInvitation('home', 'outsider', invitationId, 'revoke')).rejects.toMatchObject({ status: 403 });
  });

  it('lists invitation metadata by page without code or address', async () => {
    await issue('first');
    const second = await issue('second');
    const page = await repo.listInvitations('home', 'member', { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page).toHaveProperty('nextCursor');
    expect(JSON.stringify(page)).not.toContain(invited.email);
    expect(JSON.stringify(page)).not.toContain(second.code);
    const tail = await repo.listInvitations('home', 'member', { limit: 1, cursor: page.nextCursor });
    expect(tail.items).toHaveLength(1);
    expect(tail.items[0].invitationId).not.toBe(page.items[0].invitationId);
    await expect(repo.listInvitations('home', 'outsider', { limit: 1 })).rejects.toMatchObject({ status: 403 });
  });

  it('blocks final admin removal without an active distinct successor or a current revision', async () => {
    await expect(repo.removeMember('home', 'member', 'member', 'drop', 0)).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    await expect(repo.removeMember('home', 'member', 'member', 'drop', 0, 'outsider')).rejects.toMatchObject({ code: 'INVALID_SUCCESSOR' });
    await expect(repo.removeMember('home', 'member', 'member', 'drop', 1)).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(await fixture.db.householdAudit.count()).toBe(0);
  });

  it('atomically hands over admin authority and ends assignments without removing shared work', async () => {
    await fixture.db.membership.create({ data: { householdId: 'home', userId: 'outsider', role: 'MEMBER' } });
    const task = await createTimeReminder(fixture.db, 'home', 'member', 'task', {
      title: 'Shared task', requesterId: 'member', assigneeIds: ['member', 'outsider'],
      scheduledAt: new Date('2032-04-01T12:00:00Z'), timeZone: 'Asia/Seoul',
    });
    await repo.removeMember('home', 'member', 'member', 'drop', 0, 'outsider');
    const access = await repo.listMembers('home', 'outsider');
    expect(access).toEqual([expect.objectContaining({ userId: 'outsider', role: 'ADMIN', revision: 1 })]);
    expect(await fixture.db.assignment.findFirst({ where: { userId: 'member' } })).toMatchObject({ endedAt: start });
    const work = await listReminders(fixture.db, 'home', 'outsider', {});
    expect(work.items[0]).toMatchObject({
      reminderId: task.reminderId, assigneeIds: ['outsider'], currentOccurrence: { state: 'PENDING' },
    });
    expect(await fixture.db.householdAudit.count()).toBe(2);
    await expect(repo.listMembers('home', 'member')).rejects.toMatchObject({ status: 403 });
  });

  it('leaves settings, role and audit unchanged on storage failure', async () => {
    await fixture.db.$executeRawUnsafe('CREATE TRIGGER fixture_failure BEFORE INSERT ON "HouseholdAudit" BEGIN SELECT RAISE(ABORT, \'fixture abort\'); END');
    await expect(repo.updateHouseholdSettings('home', 'member', 'policy', {
      revision: 0, defaultTimeZone: 'UTC', radiusM: { min: 60, default: 100, max: 400 },
    })).rejects.toThrow();
    expect(await repo.getHouseholdSettings('home', 'member')).toMatchObject({ revision: 0, radiusM: { min: 50, default: 100, max: 500 } });
    expect(await fixture.db.householdCommandResult.count()).toBe(0);
  });

  it('preserves existing reminders when timezone changes and detects concurrent settings edits', async () => {
    const created = await createTimeReminder(fixture.db, 'home', 'member', 'task', {
      title: 'Scheduled task', requesterId: 'member', assigneeIds: ['member'],
      scheduledAt: new Date('2032-04-01T12:00:00Z'), timeZone: 'Asia/Seoul',
    });
    const first = await repo.updateHouseholdSettings('home', 'member', 'policy', { revision: 0, defaultTimeZone: 'UTC' });
    expect(first).toMatchObject({ revision: 1, defaultTimeZone: 'UTC' });
    await expect(repo.updateHouseholdSettings('home', 'member', 'stale', { revision: 0, defaultTimeZone: 'Asia/Seoul' }))
      .rejects.toMatchObject({ code: 'STALE_REVISION' });
    const work = await listReminders(fixture.db, 'home', 'member', {});
    expect(work.items[0]).toMatchObject({ reminderId: created.reminderId, trigger: created.trigger });
  });

  it('keeps personal settings separate from household settings and does not require membership', async () => {
    const one = await repo.updateUserSettings('outsider', 'language', { revision: 0, locale: 'en-US', timeZone: 'UTC' });
    expect(one).toEqual({ revision: 1, locale: 'en-US', timeZone: 'UTC' });
    expect(await repo.getUserSettings('outsider')).toEqual(one);
    expect(await repo.getUserSettings('member')).toEqual({ revision: 0 });
    expect(await fixture.db.householdSettings.count()).toBe(0);
  });
});
