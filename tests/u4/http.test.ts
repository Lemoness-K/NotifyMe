import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/http.js';
import { recoverToken } from '../../src/server/installations.js';
import { clock, deviceFixture, seedReminders, tokenKey } from './fixture.js';

const origin = 'https://notify.invalid';
const scope = (id: string) => '/households/home/installations/' + id;
const secret = (user: string) => user.padEnd(43, 'x');
let fixture: Awaited<ReturnType<typeof deviceFixture>>;
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;

function send(path: string, method = 'GET', body?: unknown, user = 'member', key = 'one', extra?: Record<string, string>) {
  return fetch(base + path, { method, headers: { Connection: 'close', Origin: origin, 'Content-Type': 'application/json',
    Authorization: `Bearer ${user}`, Cookie: `__Host-notify-session=${secret(user)}`, 'Idempotency-Key': key, ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

function register(id: string, token?: string, key = 'register', user = 'member') {
  return send('/installations', 'PUT', { installationId: id, platform: 'ANDROID', appVersion: '1.0', pushToken: token }, user, key);
}

beforeEach(async () => {
  fixture = await deviceFixture();
  for (const user of ['member', 'other']) {
    await fixture.db.authIdentity.create({ data: { issuer: 'test-issuer', subject: user, userId: user } });
    await fixture.db.session.create({ data: { digest: createHash('sha256').update(secret(user)).digest('hex'), userId: user,
      issuer: 'test-issuer', subject: user, authTime: 1, expiresAt: new Date('2032-01-03T00:00:00Z') } });
  }
  app = await createApp({ db: fixture.db, origin, clock, installationTokenKey: tokenKey, installationGeneration: 'test',
    provider: {
      verifyFirebase: async (token) => ({ issuer: 'test-issuer', subject: token.split(':')[0], googleSubject: 'google',
        authTime: token.endsWith(':proof') ? clock().getTime() / 1000 + 1 : 1 }),
      verifyGoogle: async (nonce) => ({ subject: 'google', nonce, expiresAt: new Date('2032-01-02T00:00:00Z') }),
    } });
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
});

afterEach(async () => { await app?.close(); await fixture?.close(); });

describe('installation HTTP contract', () => {
  it('qualifies snapshots and cursors by scope, authorizes ownership, and locks logout', async () => {
    await seedReminders(fixture.db, 2);
    expect((await register('device-a')).status).toBe(200);
    expect((await register('device-b')).status).toBe(200);
    expect(await (await send(scope('device-a') + '/sync', 'GET', undefined, 'other')).json()).toMatchObject({ code: 'INSTALLATION_ACCESS_DENIED' });
    const first = await (await send(scope('device-a') + '/sync')).json();
    expect(first).toMatchObject({ mode: 'FULL', plans: [{ planId: 'location-000-occ' }, { planId: 'location-001-occ' }] });
    expect(await (await send(scope('device-a') + `/sync?afterEpoch=${first.epoch}&afterRevision=${first.revision}`)).json())
      .toMatchObject({ mode: 'DELTA', plans: [] });
    expect(await (await send(scope('device-b') + `/sync?afterEpoch=${first.epoch}&afterRevision=${first.revision}`)).json())
      .toMatchObject({ mode: 'FULL' });
    const list = await (await send(scope('device-a') + '/location-exclusions?limit=1')).json();
    expect(list.items).toEqual([{ reminderId: 'location-000', title: 'location-000', slots: 1, excluded: false }]);
    expect((await send(scope('device-b') + '/location-exclusions?cursor=' + list.nextCursor)).status).toBe(422);
    const exclusion = { epoch: list.epoch, revision: list.revision, excluded: true };
    expect((await send(scope('device-a') + '/location-exclusions/location-000', 'PUT', exclusion)).status).toBe(204);
    expect(await (await send(scope('device-a') + `/sync?afterEpoch=${first.epoch}&afterRevision=${first.revision}`)).json())
      .toMatchObject({ removedPlanIds: ['location-000-occ'] });
    expect((await send('/sessions/current', 'DELETE')).status).toBe(204);
    expect(await fixture.db.installation.count({ where: { active: true } })).toBe(0);
  });

  it('keeps rotated push credentials opaque, validates/expires events, and revokes household installations', async () => {
    await seedReminders(fixture.db, 1);
    expect((await register('device', 'synthetic-token-1')).status).toBe(200);
    const rotate = await register('device', 'synthetic-token-2', 'rotate');
    expect(await rotate.json()).toEqual({ installationId: 'device', revision: 2 });
    const row = await fixture.db.installation.findUniqueOrThrow({ where: { id: 'device' } });
    expect(row.tokenCiphertext).not.toContain('synthetic');
    expect(recoverToken(tokenKey, 'device', row.tokenCiphertext!)).toBe('synthetic-token-2');
    const plan = (await (await send(scope('device') + '/sync')).json()).plans[0];
    const event = { eventId: 'location-event', occurrenceId: plan.occurrenceId, triggerVersion: plan.version, condition: 'ENTER' };
    expect(await (await send(scope('device') + '/events', 'POST', { ...event, detectedAt: '2031-01-01T00:00:00Z' })).json())
      .toMatchObject({ code: 'LOCATION_EVENT_EXPIRED' });
    expect((await send(scope('device') + '/events', 'POST', { ...event, detectedAt: clock().toISOString() })).status).toBe(204);
    expect((await register('other-device', undefined, 'register', 'other')).status).toBe(200);
    expect((await send('/households/home/members/other', 'DELETE', undefined, 'member', 'remove', { 'If-Match': '0' })).status).toBe(204);
    expect(await (await send(scope('other-device') + '/sync', 'GET', undefined, 'other')).json()).toMatchObject({ code: 'HOUSEHOLD_ACCESS_REVOKED' });
    expect(await fixture.db.deviceSignal.count({ where: { type: 'household.access_revoked', scope: { installationId: 'other-device' } } })).toBe(1);
  });

  it('retains the same protected web/native challenge exchange and rejects external origins and missed nonces', async () => {
    expect((await send('/sessions/challenges', 'POST', undefined, 'member', 'one', { Origin: 'https://outside.invalid' })).status).toBe(403);
    const challenge = await send('/sessions/challenges', 'POST');
    expect(challenge.status).toBe(201);
    const cookie = challenge.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    const { nonce } = await challenge.json();
    const headers = { Cookie: cookie.split(';')[0], Authorization: 'Bearer member:proof' };
    expect((await send('/sessions', 'POST', { googleToken: 'other-nonce' }, 'member', 'one', headers)).status).toBe(401);
    const valid = await send('/sessions', 'POST', { googleToken: nonce }, 'member', 'one', headers);
    expect(valid.status).toBe(201);
    expect(valid.headers.getSetCookie().some((value) => value.startsWith('__Host-notify-session=') && value.includes('SameSite=Strict'))).toBe(true);
    expect((await send('/sessions', 'POST', { googleToken: nonce }, 'member', 'one', headers)).status).toBe(401);
  });
});
