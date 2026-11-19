import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { createApp } from '../../src/server/http.js';
import { AppError } from '../../src/server/errors.js';
import { seedHousehold, testDatabase } from '../u1/fixtures.js';

const origin = 'https://notify.invalid';
const householdPath = '/households/home';
const invitePath = householdPath + '/invitations';
const start = new Date('2032-01-01T00:00:00Z');
let clock: Date;
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let logs: unknown[];

const provider = {
  async verifyFirebase(token: string) {
    if (token === 'down') throw new AppError(503, 'AUTH_PROVIDER_UNAVAILABLE');
    const [account, authTime] = token.split(':');
    if (!['admin', 'guest', 'wrong', 'unverified'].includes(account)) throw new AppError(401, 'UNAUTHENTICATED');
    return {
      issuer: 'test-issuer', subject: account === 'admin' ? 'member-firebase' : account,
      googleSubject: account, authTime: Number(authTime), displayName: account,
      email: account === 'wrong' ? 'wrong@example.test' : 'guest@example.test',
      emailVerified: account !== 'unverified',
    };
  },
  async verifyGoogle(token: string) {
    const [subject, nonce] = token.split(':');
    return { subject, nonce, expiresAt: new Date(clock.getTime() + 120_000) };
  },
};

function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Connection', 'close');
  return fetch(base + path, { ...options, headers });
}
const common = { 'Content-Type': 'application/json', Origin: origin };

async function login(account = 'admin') {
  const challenge = await request('/sessions/challenges', { method: 'POST', headers: common });
  const { nonce } = await challenge.json();
  const cookie = challenge.headers.getSetCookie().find((s) => s.startsWith('__Host-notify-login='))?.split(';')[0];
  clock = new Date(clock.getTime() + 2_000);
  const headers = { ...common, Authorization: 'Bearer ' + account + ':' + Math.floor(clock.getTime() / 1000) };
  const response = await request('/sessions', {
    method: 'POST', headers: { ...headers, Cookie: cookie ?? '' }, body: JSON.stringify({ googleToken: account + ':' + nonce }),
  });
  expect(response.status).toBe(201);
  const session = response.headers.getSetCookie().find((s) => s.startsWith('__Host-notify-session='))?.split(';')[0];
  return { ...headers, Cookie: session ?? '' };
}

async function issue(headers: Record<string, string>, key = 'issue', email = 'guest@example.test') {
  const response = await request(invitePath, {
    method: 'POST', headers: { ...headers, 'Idempotency-Key': key }, body: JSON.stringify({ email }),
  });
  expect(response.status).toBe(201);
  const body = await response.json();
  return { ...body, code: new URL(body.inviteUrl).hash.slice(1) };
}

function accept(code: string, bearer = 'guest:1', key = 'join') {
  return request('/invitations/accept', {
    method: 'POST', headers: { ...common, 'Idempotency-Key': key, Authorization: 'Bearer ' + bearer },
    body: JSON.stringify({ code }),
  });
}

beforeEach(async () => {
  fixture = await testDatabase();
  await seedHousehold(fixture.db);
  clock = start;
  logs = [];
  app = await createApp({ db: fixture.db, provider, origin, clock: () => clock, log: (record) => logs.push(record),
    trustedProxy: true,
    householdConfig: { inviteIpPerMinute: 3, inviteIdentityPerMinute: 10, administrationPerMinute: 20, cleanupIntervalMs: 300_000 },
  });
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
});
afterEach(async () => {
  await app?.close();
  await fixture?.close();
});

describe('U2 HTTPS contract', () => {
  it('returns the code once and returns only recovery metadata to an authorized retry', async () => {
    const headers = await login();
    const invite = await issue(headers);
    const response = await request(invitePath, {
      method: 'POST', headers: { ...headers, 'Idempotency-Key': 'issue' }, body: '{"email":"guest@example.test"}',
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const result = await response.json();
    expect(result).toMatchObject({ code: 'INVITATION_ALREADY_ISSUED', details: { invitationId: invite.invitationId, expiresAt: invite.expiresAt } });
    expect(JSON.stringify(result)).not.toContain(invite.code);
    expect(JSON.stringify(logs)).not.toMatch(/guest@example\.test|#|Bearer/);
    expect(await fixture.db.invitation.count()).toBe(1);
  });

  it('lists only safe invite metadata and never consumes it on a read', async () => {
    const headers = await login();
    const invite = await issue(headers);
    const response = await request(invitePath + '?limit=1', { headers });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.items).toEqual([expect.objectContaining({ invitationId: invite.invitationId, status: 'ACTIVE' })]);
    expect(JSON.stringify(result)).not.toContain(invite.code);
    expect(JSON.stringify(result)).not.toContain('guest@example.test');
    expect(await fixture.db.membership.count()).toBe(1);
    expect(await fixture.db.invitation.findFirst()).toMatchObject({ consumedAt: null });
    expect((await request(invitePath)).status).toBe(401);
  });

  it('accepts a verified invited identity without a session and then permits normal login', async () => {
    const invite = await issue(await login());
    expect((await request('/me', { headers: { Authorization: 'Bearer guest:1' } })).status).toBe(401);
    expect((await accept(invite.code, 'wrong:1')).status).toBe(422);
    expect((await accept(invite.code, 'unverified:1')).status).toBe(422);
    expect((await accept(invite.code)).status).toBe(200);
    const guest = await login('guest');
    expect(await (await request('/me', { headers: guest })).json()).toMatchObject({ householdId: 'home', householdRole: 'MEMBER' });
    expect((await request(invitePath, { headers: guest })).status).toBe(403);
  });

  it('keeps supplier failures distinct and limits invalid invite requests with Retry-After', async () => {
    const invite = await issue(await login());
    const providerError = await accept(invite.code, 'down');
    expect(providerError.status).toBe(503);
    expect(providerError.headers.get('Retry-After')).toBe('2');
    expect((await accept(invite.code, 'wrong:1')).status).toBe(422);
    expect((await accept(invite.code, 'wrong:1')).status).toBe(422);
    const limited = await accept(invite.code);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(await fixture.db.invitation.findFirst()).toMatchObject({ consumedAt: null });
    clock = new Date(clock.getTime() + 60_000);
    expect((await accept(invite.code)).status).toBe(200);
  });

  it('requires an exact request origin for invite acceptance', async () => {
    const invite = await issue(await login());
    const response = await request('/invitations/accept', {
      method: 'POST', headers: { ...common, Origin: 'https://other.invalid', Authorization: 'Bearer guest:1', 'Idempotency-Key': 'join' },
      body: JSON.stringify({ code: invite.code }),
    });
    expect(response.status).toBe(403);
    expect(await fixture.db.membership.count()).toBe(1);
  });

  it('applies successor handoff and removes current access while retaining account settings', async () => {
    const admin = await login();
    const invite = await issue(admin);
    const joined = await accept(invite.code);
    expect(joined.status).toBe(200);
    const { userId } = await joined.json();
    const guest = await login('guest');
    const body = JSON.stringify({
      title: 'Retained reminder', requesterId: 'member', assigneeIds: ['member'],
      trigger: { kind: 'TIME', scheduledAt: '2032-02-01T09:00:00Z', timeZone: 'UTC' },
    });
    const reminder = await request(householdPath + '/reminders', {
      method: 'POST', headers: { ...admin, 'Idempotency-Key': 'task' }, body,
    });
    expect(reminder.status).toBe(201);
    const removed = await request(householdPath + '/members/member?' + new URLSearchParams({ successorAdminId: userId }), {
      method: 'DELETE', headers: { ...admin, 'If-Match': '"0"', 'Idempotency-Key': 'drop' },
    });
    expect(removed.status).toBe(204);
    expect((await request(householdPath + '/settings', { headers: admin })).status).toBe(403);
    expect((await request('/me/settings', { headers: admin })).status).toBe(200);
    expect(await (await request(householdPath + '/members', { headers: guest })).json()).toEqual([
      expect.objectContaining({ userId, role: 'ADMIN', revision: 1 }),
    ]);
    expect((await (await request(householdPath + '/reminders', { headers: guest })).json()).items[0]).toMatchObject({
      title: 'Retained reminder', assigneeIds: [], currentOccurrence: { state: 'PENDING' },
    });
  });

  it('checks account revision and preserves settings across clients', async () => {
    const first = await login();
    const sent = await request('/me/settings', {
      method: 'PATCH', headers: { ...first, 'Idempotency-Key': 'settings' }, body: '{"revision":0,"locale":"en-US","timeZone":"UTC"}',
    });
    expect(sent.status).toBe(200);
    const settings = { revision: 1, locale: 'en-US', timeZone: 'UTC' };
    expect(await sent.json()).toEqual(settings);
    expect(await (await request('/me/settings', { headers: await login() })).json()).toEqual(settings);
    const stale = await request('/me/settings', {
      method: 'PATCH', headers: { ...first, 'Idempotency-Key': 'stale' }, body: '{"revision":0,"locale":"ko-KR"}',
    });
    expect(stale.status).toBe(409);
  });

  it('revokes an invitation without a client revision, clears the address, and reports it safely', async () => {
    const admin = await login();
    const invite = await issue(admin);
    const revoke = { method: 'DELETE', headers: { ...admin, 'Idempotency-Key': 'revoke' } };
    expect((await request(invitePath + '/' + invite.invitationId, revoke)).status).toBe(204);
    expect((await request(invitePath + '/' + invite.invitationId, revoke)).status).toBe(204);
    expect(await fixture.db.invitation.findFirst()).toMatchObject({ targetEmail: null, revokedAt: expect.any(Date) });
    expect(await (await request(invitePath, { headers: admin })).json()).toMatchObject({
      items: [{ invitationId: invite.invitationId, status: 'REVOKED' }],
    });
    expect((await accept(invite.code)).status).toBe(422);
  });

  it('serves the catalog and enforces active-household scope before settings writes', async () => {
    const admin = await login();
    const invite = await issue(admin);
    expect((await accept(invite.code)).status).toBe(200);
    const guest = await login('guest');
    expect((await request('/settings/catalog')).status).toBe(401);
    const catalog = await (await request('/settings/catalog', { headers: guest })).json();
    expect(catalog).toContainEqual(expect.objectContaining({ key: 'locale', scope: 'USER' }));
    expect((await request(householdPath + '/settings', { headers: guest })).status).toBe(200);
    const body = '{"revision":0,"defaultTimeZone":"UTC","maxLocationDurationMin":45}';
    expect((await request(householdPath + '/settings', {
      method: 'PATCH', headers: { ...guest, 'Idempotency-Key': 'settings' }, body,
    })).status).toBe(403);
    const updated = await request(householdPath + '/settings', {
      method: 'PATCH', headers: { ...admin, 'Idempotency-Key': 'settings' }, body,
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ revision: 1, defaultTimeZone: 'UTC', maxLocationDurationMin: 45 });
    expect(await (await request('/me', { headers: guest })).json()).toMatchObject({ defaultTimeZone: 'UTC' });
  });

  it('changes an active member role once and rejects a stale follow-up', async () => {
    const admin = await login();
    const invite = await issue(admin);
    const { userId } = await (await accept(invite.code)).json();
    const path = householdPath + '/members/' + userId;
    const role = { method: 'PATCH', headers: { ...admin, 'Idempotency-Key': 'role' }, body: '{"revision":0,"role":"ADMIN"}' };
    expect(await (await request(path, role)).json()).toMatchObject({ userId, role: 'ADMIN', revision: 1 });
    expect(await (await request(path, role)).json()).toMatchObject({ userId, role: 'ADMIN', revision: 1 });
    expect((await request(path, {
      ...role, headers: { ...admin, 'Idempotency-Key': 'stale' }, body: '{"revision":0,"role":"MEMBER"}',
    })).status).toBe(409);
  });

  it('uses Caddy ingress to overwrite the client address, block health, and preserve no-store', async () => {
    const headers = await login();
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const listener = reservation.address();
    if (!listener || typeof listener === 'string') throw new Error('Test listener has no port');
    const proxyPort = listener.port;
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

    const directory = mkdtempSync(join(process.cwd(), '.u1-db-'));
    const configPath = join(directory, 'Caddyfile');
    const example = readFileSync('deploy/u1/Caddyfile.example', 'utf8');
    const binary = process.env.NOTIFY_TEST_CADDY_BIN ??
      (existsSync('.local/caddy-check/usr/bin/caddy') ? '.local/caddy-check/usr/bin/caddy' : 'caddy');
    writeFileSync(configPath, '{\n admin off\n skip_install_trust\n auto_https disable_redirects\n}\n' + example
      .replace('https://notify.example.invalid', 'https://127.0.0.1:' + proxyPort)
      .replace('192.0.2.10', '127.0.0.1')
      .replace('127.0.0.1:3443', new URL(base).host));
    const child = spawn(binary, ['run', '--config', configPath, '--adapter', 'caddyfile'], {
      env: { ...process.env, XDG_DATA_HOME: directory, XDG_CONFIG_HOME: directory },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let diagnostic = '';
    child.stderr.on('data', (part: Buffer) => { diagnostic = (diagnostic + part.toString()).slice(-4_000); });
    child.on('error', (error) => { diagnostic = error.message; });

    const proxy = (path: string, method = 'GET', additional: Record<string, string> = {}, body?: string) =>
      new Promise<{ status?: number; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
        const request = httpsRequest({
          host: '127.0.0.1', port: proxyPort, path, method, headers: additional, rejectUnauthorized: false, timeout: 1_000,
        }, (response) => {
          response.resume();
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }));
        });
        request.on('timeout', () => request.destroy(new Error('Caddy test request timed out')));
        request.on('error', reject);
        request.end(body);
      });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        if (child.exitCode !== null || !child.pid) break;
        if (await proxy('/internal/health').then(() => true, () => false)) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!ready) throw new Error('Test Caddy instance failed to start. ' + diagnostic);
      expect((await proxy('/internal/health')).status).toBe(404);
      const invite = await proxy('/api/v1' + invitePath, 'POST',
        { ...headers, 'Idempotency-Key': 'proxy-issue' }, '{"email":"guest@example.test"}');
      expect(invite.status).toBe(201);
      expect(invite.headers['cache-control']).toBe('no-store');
      for (let attempt = 1; attempt <= 4; attempt++) {
        const response = await proxy('/api/v1/invitations/accept', 'POST', {
          ...common, 'Idempotency-Key': 'proxy-test', 'X-Notify-Client-IP': '192.0.2.' + attempt,
          Authorization: 'Bearer wrong:1',
        }, JSON.stringify({ code: 'a'.repeat(32) }));
        expect(response.status).toBe(attempt <= 3 ? 422 : 429);
        if (attempt === 4) expect(response.headers['retry-after']).toBe('60');
      }
    } finally {
      if (child.pid && child.exitCode === null) {
        child.kill('SIGTERM');
        await once(child, 'close');
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
