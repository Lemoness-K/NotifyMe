import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { FirstAdminOnboarding } from '../../src/server/admin-onboarding.js';
import { SessionService, type IdentityProvider } from '../../src/server/auth.js';
import { createApp } from '../../src/server/http.js';
import { prepareNewInstallation, SetupAuthority } from '../../src/server/operations/setup-authority.js';
import { openStore } from '../../src/server/storage.js';
import { testDatabase } from './fixtures.js';
import { operationsFixture } from '../u5/fixture.js';

const setupCycle = randomUUID();
const databaseIdentity = randomUUID();
const candidate = {
  candidateId: randomUUID(), setupCycle, verifiedIssuer: 'urn:notifyme:test',
  verifiedSubject: 'subject', verifiedGoogleSubject: 'google-subject',
  credentialDigest: 'e'.repeat(64),
  authenticationTime: 2000, expiresAt: new Date('2026-01-01T00:10:00Z'),
};
let fixture: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => { fixture = await testDatabase(); });
afterEach(async () => { await fixture.close(); });

describe('mobile onboarding storage', () => {
  it('starts a migrated blank database with no eligibility records', async () => {
    expect(await fixture.db.installationSetup.count()).toBe(0);
    expect(await fixture.db.setupCandidate.count()).toBe(0);
    expect(await fixture.db.setupCompletion.count()).toBe(0);
  });

  it('keeps existing roles and defaults to closed when migrating an old database', async () => {
    const path = fixture.path + '.old';
    const original = new DatabaseSync(path);
    try {
      original.exec(readFileSync('prisma/migrations/202611180001_u1/migration.sql', 'utf8'));
      original.exec(`INSERT INTO "User" (id) VALUES ('existing');
        INSERT INTO "Household" (id) VALUES ('home');
        INSERT INTO "Membership" ("householdId", "userId", role) VALUES ('home', 'existing', 'ADMIN');`);
    } finally { original.close(); }
    const db = await openStore(path, { migrate: true });
    try {
      expect(await db.installationSetup.count()).toBe(0);
      expect(await db.membership.findMany()).toMatchObject([{ householdId: 'home', userId: 'existing', role: 'ADMIN' }]);
    } finally { await db.$disconnect(); }
  });

  it('requires a bound installation and admits at most one candidate for its cycle', async () => {
    const db = fixture.db;
    await expect(db.setupCandidate.create({ data: candidate })).rejects.toMatchObject({ code: 'P2003' });
    await db.installationSetup.create({ data: { setupCycle, databaseIdentity } });
    await expect(db.installationSetup.create({ data: { id: 2, setupCycle: randomUUID(), databaseIdentity: randomUUID() } })).rejects.toThrow();
    await db.setupCandidate.create({ data: candidate });
    await expect(db.setupCandidate.create({ data: {
      ...candidate, candidateId: randomUUID(), credentialDigest: 'f'.repeat(64),
    } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('retains at most one completion after the original household no longer exists', async () => {
    const db = fixture.db;
    await db.installationSetup.create({ data: { setupCycle, databaseIdentity } });
    await db.household.create({ data: { id: 'home' } });
    const completion = { setupCycle, candidateId: candidate.candidateId, householdId: 'home', userId: 'owner',
      committedAt: new Date(), replayUntil: candidate.expiresAt };
    await db.setupCompletion.create({ data: completion });
    await expect(db.setupCompletion.create({ data: { ...completion, candidateId: randomUUID() } })).rejects.toMatchObject({ code: 'P2002' });
    await db.household.delete({ where: { id: 'home' } });
    expect(await db.setupCompletion.findUnique({ where: { setupCycle } })).toMatchObject({ householdId: 'home' });
  });

  it('rolls back the household and membership when completion cannot be recorded', async () => {
    const db = fixture.db;
    await db.installationSetup.create({ data: { setupCycle, databaseIdentity } });
    const completion = { setupCycle, candidateId: candidate.candidateId, householdId: 'home', userId: 'owner',
      committedAt: new Date(), replayUntil: candidate.expiresAt };
    await db.setupCompletion.create({ data: completion });
    await expect(db.$transaction(async (tx) => {
      await tx.user.create({ data: { id: 'owner' } });
      await tx.household.create({ data: { id: 'home' } });
      await tx.membership.create({ data: { householdId: 'home', userId: 'owner', role: 'ADMIN' } });
      await tx.setupCompletion.create({ data: completion });
    })).rejects.toMatchObject({ code: 'P2002' });
    expect(await db.household.count()).toBe(0);
    expect(await db.membership.count()).toBe(0);
  });
});

describe('first administrator onboarding', () => {
  let operations: ReturnType<typeof operationsFixture>;
  let db: Awaited<ReturnType<typeof openStore>>;
  let authority: SetupAuthority;
  let auth: SessionService;
  let setup: FirstAdminOnboarding;
  let now: number;
  const clock = () => new Date(now);
  const provider: IdentityProvider = {
    async verifyFirebase(token) {
      const [subject, time] = token.split(':');
      return { issuer: 'urn:test', subject, googleSubject: subject, authTime: Number(time),
        email: subject + '@example.test', emailVerified: true };
    },
    async verifyGoogle(token) {
      const [subject, nonce] = token.split(':');
      return { subject, nonce, expiresAt: new Date(now + 30 * 60_000) };
    },
  };
  beforeEach(async () => {
    now = new Date('2026-01-01T00:00:00Z').getTime();
    operations = operationsFixture();
    const grant = await prepareNewInstallation(operations.state, operations.database, async () => {});
    db = await openStore(operations.database);
    authority = new SetupAuthority(operations.state, operations.database, grant.activationEpoch);
    setup = new FirstAdminOnboarding(db, provider, authority, clock);
    auth = new SessionService(db, provider, clock, setup);
  });
  afterEach(async () => { await db.$disconnect(); operations.close(); });

  async function challenge(account: string) {
    const request = await auth.start();
    now += 1000;
    const token = account + ':' + Math.floor(now / 1000);
    const login = () => auth.issue(request.secret, token, account + ':' + request.nonce, true);
    return { token, login };
  }
  async function login(account: string) {
    const { token, login } = await challenge(account);
    return { token, ...await login() };
  }

  it('reserves only one candidate across two concurrent account attempts and consumes the winning proof', async () => {
    const a = await challenge('first');
    const b = await challenge('second');
    const attempts = await Promise.allSettled([a.login(), b.login()]);
    const winner = attempts.findIndex(({ status }) => status === 'fulfilled');
    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(attempts[1 - winner]).toMatchObject({ reason: { code: 'SETUP_RESERVED' } });
    await expect([a, b][winner].login()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await db.household.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
  });

  it('refreshes the same account without extending the reservation or accepting the stale credential', async () => {
    const first = await login('first');
    now += 30_000;
    const renewed = await login('first');
    expect(renewed.expiresAt).toEqual(first.expiresAt);
    await expect(setup.status(first.secret, first.token)).rejects.toMatchObject({ status: 401 });
    await expect(setup.status(renewed.secret, renewed.token)).resolves.toMatchObject({ displayAccount: 'first@example.test' });
    await expect(setup.status(renewed.secret, 'wrong:' + now / 1000)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects another account from canceling and permits replacement after genuine cancellation', async () => {
    const first = await login('first');
    await expect(setup.cancel(first.secret, 'wrong:' + now / 1000)).rejects.toMatchObject({ status: 401 });
    await setup.cancel(first.secret, first.token);
    const next = await login('second');
    await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ status: 401 });
    expect(next.setup).toMatchObject({ displayAccount: 'second@example.test' });
    expect(await db.household.count()).toBe(0);
  });

  it('expires a closed tab reservation at ten minutes and never confirms the old candidate', async () => {
    const first = await login('first');
    now = first.expiresAt.getTime();
    await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ code: 'SETUP_EXPIRED' });
    const replacement = await login('second');
    expect(replacement.setup).toMatchObject({ displayAccount: 'second@example.test' });
  });

  it('handles duplicate confirmation and a later same-account login without creating again', async () => {
    const first = await login('first');
    const [firstConfirm, duplicate] = await Promise.all([
      setup.confirm(first.secret, first.token),
      setup.confirm(first.secret, first.token),
      expect(setup.confirm(first.secret, 'second:' + now / 1000)).rejects.toMatchObject({ status: 401 }),
    ]);
    expect(firstConfirm.secret).toBe(duplicate.secret);
    expect(await db.household.count()).toBe(1);
    expect(await db.membership.findMany()).toMatchObject([{ role: 'ADMIN' }]);
    expect(await db.setupCandidate.count()).toBe(0);
    await expect(auth.principal(first.token, firstConfirm.secret)).resolves.toHaveProperty('userId');
    expect((await login('first')).setup).toBeUndefined();
    await expect(login('second')).rejects.toMatchObject({ status: 401 });
    now = first.expiresAt.getTime();
    await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ code: 'SETUP_EXPIRED' });
  });

  it('rolls back after completion write failure and resumes only the original valid candidate', async () => {
    const first = await login('first');
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_setup BEFORE INSERT ON "SetupCompletion"
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END`);
    await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ code: 'SETUP_UNAVAILABLE' });
    expect(await db.household.count()).toBe(0);
    expect(await db.membership.count()).toBe(0);
    expect(await authority.current(db)).toMatchObject({ phase: 'OPEN' });
    await db.$executeRawUnsafe('DROP TRIGGER fail_setup');
    await expect(setup.confirm(first.secret, first.token)).resolves.toHaveProperty('secret');
  });

  it('recovers a committed confirmation after sealing or responding was interrupted', async () => {
    const first = await login('first');
    vi.spyOn(authority, 'finishConfirmation').mockImplementationOnce(() => { throw new Error('interrupted before sealing'); });
    await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ code: 'SETUP_UNAVAILABLE' });
    expect(await db.household.count()).toBe(1);
    expect(await authority.current(db)).toMatchObject({ phase: 'COMMITTING' });
    const binding = await authority.current(db);
    const restarted = new SetupAuthority(operations.state, operations.database, binding!.activationEpoch);
    await restarted.recover(db);
    expect(await restarted.current(db)).toMatchObject({ phase: 'SEALED' });
    const recovered = new FirstAdminOnboarding(db, provider, restarted, clock);
    const session = await recovered.confirm(first.secret, first.token);
    await expect(auth.principal(first.token, session.secret)).resolves.toHaveProperty('userId');
    expect(await db.setupCompletion.count()).toBe(1);
  });

  it('does not claim a restored or closed installation and rejects a credential in another store', async () => {
    const first = await login('first');
    const other = await prepareNewInstallation(join(operations.directory, 'volume'), join(operations.volume, 'other.sqlite'), async () => {});
    const otherStore = await openStore(other.database);
    try {
      const otherSetup = new FirstAdminOnboarding(otherStore, provider,
        new SetupAuthority(operations.volume, other.database, other.activationEpoch), clock);
      await expect(otherSetup.confirm(first.secret, first.token)).rejects.toMatchObject({ status: 401 });
      SetupAuthority.closeForRestore(operations.state);
      await expect(setup.confirm(first.secret, first.token)).rejects.toMatchObject({ status: 401 });
      await expect(login('second')).rejects.toMatchObject({ status: 401 });
    } finally { await otherStore.$disconnect(); }
  });

  it('uses a separated setup cookie and only returns the verified account to its owner', async () => {
    const origin = 'https://notify.example.test';
    const app = await createApp({ db, provider, clock, origin, onboarding: setup });
    try {
      await app.listen(0, '127.0.0.1');
      const baseUrl = await app.getUrl() + '/api/v1';
      const request = (path: string, method = 'GET', token?: string, cookie?: string, body?: unknown) =>
        fetch(baseUrl + path, { method, headers: {
          Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
        }, body: body ? JSON.stringify(body) : undefined });
      const proof = await request('/sessions/challenges', 'POST');
      const challengeCookie = proof.headers.getSetCookie()[0].split(';')[0];
      const { nonce } = await proof.json();
      now += 1000;
      const token = 'first:' + now / 1000;
      const response = await request('/sessions', 'POST', token, challengeCookie, { googleToken: 'first:' + nonce, setup: true });
      expect(response.status).toBe(201);
      const setCookies = response.headers.getSetCookie();
      expect(setCookies.some((value) => value.startsWith('__Host-notify-session='))).toBe(false);
      const credential = setCookies.find((value) => value.startsWith('__Host-notify-setup='));
      expect(credential).toMatch(/HttpOnly; Secure; SameSite=Strict/i);
      expect(await response.json()).toMatchObject({ setup: { displayAccount: 'first@example.test' } });
      const cookie = credential!.split(';')[0];
      const outsider = 'second:' + now / 1000;
      for (const [path, method] of [
        ['/setup/candidate', 'GET'], ['/setup/confirm', 'POST'], ['/setup/candidate', 'DELETE'],
      ]) {
        const denied = await request(path, method, outsider, cookie);
        expect(denied.status).toBe(401);
        expect(await denied.text()).not.toContain('first@example.test');
      }
      expect((await request('/me', 'GET', token, cookie)).status).toBe(401);
      expect(await (await request('/setup/candidate', 'GET', token, cookie)).json()).toMatchObject({ displayAccount: 'first@example.test' });
      const confirmed = await request('/setup/confirm', 'POST', token, cookie);
      expect(confirmed.status).toBe(201);
      const appCookie = confirmed.headers.getSetCookie().find((value) => value.startsWith('__Host-notify-session='))?.split(';')[0];
      expect(await (await request('/me', 'GET', token, appCookie)).json()).toMatchObject({ householdRole: 'ADMIN' });
    } finally { await app.close(); }
  });

  it('requires an explicit web opt-in even when a setup grant is open', async () => {
    const request = await auth.start();
    now += 1000;
    await expect(auth.issue(request.secret, 'first:' + now / 1000, 'first:' + request.nonce))
      .rejects.toMatchObject({ status: 401 });
    expect(await db.setupCandidate.count()).toBe(0);
  });
});
