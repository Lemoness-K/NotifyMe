import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/http.js';
import { seedHousehold, testDatabase } from './fixtures.js';

const origin = 'https://test.notify.invalid';
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let logs: { requestId: string; route: string; code?: string }[];
const provider = {
  verifyFirebase: async (token: string) => {
    if (token === 'unavailable') throw Object.assign(new Error('Down'), { status: 503, code: 'AUTH_PROVIDER_UNAVAILABLE' });
    if (token === 'invalid') throw Object.assign(new Error('Invalid'), { status: 401, code: 'UNAUTHENTICATED' });
    return {
      issuer: 'test-issuer', subject: 'member-firebase', googleSubject: 'test-google',
      authTime: Number(token), displayName: 'Test',
    };
  },
  verifyGoogle: async (token: string) => ({
    subject: 'test-google', nonce: token, expiresAt: new Date(clock.getTime() + 120_000),
  }),
};
const now = new Date('2027-01-01T00:00:00Z');
let clock: Date;

async function send(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Connection', 'close');
  return fetch(base + path, { ...options, headers });
}
const common = { 'Content-Type': 'application/json', Origin: origin };

async function login() {
  const challenge = await send('/sessions/challenges', { method: 'POST', headers: common });
  expect(challenge.status).toBe(201);
  const cookie = challenge.headers.get('set-cookie');
  expect(cookie).toMatch(/Secure/i);
  const { nonce } = await challenge.json();
  clock = new Date(clock.getTime() + 2000);
  const token = String(Math.floor(clock.getTime() / 1000));
  const response = await send('/sessions', {
    method: 'POST', headers: { ...common, Cookie: cookie?.split(';')[0] ?? '', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ googleToken: nonce }),
  });
  expect(response.status).toBe(201);
  const session = response.headers.getSetCookie().find((s) => s.startsWith('__Host-notify-session='));
  expect(session).toMatch(/; Secure/i);
  expect(session).toMatch(/; HttpOnly/i);
  expect(session).toMatch(/; SameSite=Strict/i);
  return { ...common, Cookie: session?.split(';')[0] ?? '', Authorization: 'Bearer ' + token };
}

beforeEach(async () => {
  fixture = await testDatabase();
  await seedHousehold(fixture.db);
  clock = now;
  logs = [];
  app = await createApp({ db: fixture.db, provider, origin, clock: () => clock, log: (record) => logs.push(record) });
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
});
afterEach(async () => {
  await app?.close();
  await fixture?.close();
});

describe('U1 HTTP access and storage', () => {
  it('rejects cross-origin state change with a safe error', async () => {
    const r = await send('/sessions/challenges', { method: 'POST', headers: { Origin: 'https://other.invalid' } });
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: 'ORIGIN_DENIED', requestId: expect.any(String) });
    expect(logs).toContainEqual(expect.objectContaining({ code: 'ORIGIN_DENIED', requestId: r.headers.get('X-Request-Id') }));
    expect((await send('/internal/health')).status).toBe(404);
    expect((await fetch(base.replace('/api/v1', '') + '/internal/health', {
      headers: { Connection: 'close' },
    })).status).toBe(204);
  });

  it('requires a current session and denies another household', async () => {
    expect((await send('/me')).status).toBe(401);
    const headers = await login();
    expect(await (await send('/me', { headers })).json()).toMatchObject({ userId: 'member', householdId: 'home' });
    expect((await send('/households/other/reminders', { headers })).status).toBe(403);
  });

  it('maps provider invalid and provider unavailable to distinct status codes', async () => {
    const headers = await login();
    for (const [token, status] of [['invalid', 401], ['unavailable', 503]] as const) {
      const r = await send('/me', {headers: { ...headers, Authorization: 'Bearer ' + token }});
      expect(r.status).toBe(status);
      expect(await r.json()).not.toHaveProperty('userId');
    }
  });

  it('keeps one reminder for a repeated POST and reads it back', async () => {
    const headers = { ...await login(), 'Idempotency-Key': 'same-action' };
    const data = JSON.stringify({
      title: '돌보기', description: ' 원문 ',
      trigger: { kind: 'TIME', scheduledAt: '2027-02-01T12:00:00Z', timeZone: 'Asia/Seoul' },
    });
    const first = await send('/households/home/reminders', { method: 'POST', headers, body: data });
    expect(first.status).toBe(201);
    const item = await first.json();
    expect((await send('/households/home/reminders', { method: 'POST', headers, body: data })).status).toBe(201);
    expect((await (await send('/households/home/reminders', {headers})).json()).items).toEqual([item]);
    expect(await (await send('/households/home/reminders/' + item.reminderId, {headers})).json()).toEqual(item);
    expect(logs).toContainEqual(expect.objectContaining({ route: '/api/v1/households/:householdId/reminders/:reminderId' }));
    const serializedLogs = JSON.stringify(logs);
    for (const privateValue of ['돌보기', '원문', item.reminderId, headers.Cookie, headers.Authorization]) {
      expect(serializedLogs).not.toContain(privateValue);
    }
  });

  it('rejects invalid input without persisting and ends the current session', async () => {
    const headers = await login();
    const r = await send('/households/home/reminders', {
      method: 'POST', headers: { ...headers, 'Idempotency-Key': 'invalid-input' }, body: '{}',
    });
    expect(r.status).toBe(422);
    expect(await fixture.db.reminder.count()).toBe(0);
    const cross = await send('/sessions/current', {
      method: 'DELETE', headers: { ...headers, Origin: 'https://other.invalid', 'Idempotency-Key': 'logout' },
    });
    expect(cross.status).toBe(403);
    expect((await send('/me', { headers })).status).toBe(200);
    const out = await send('/sessions/current', { method: 'DELETE', headers: { ...headers, 'Idempotency-Key': 'logout' } });
    expect(out.status).toBe(204);
    expect((await send('/me', { headers })).status).toBe(401);
  });
});
