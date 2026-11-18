import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapAdmin, SessionService } from '../../src/server/auth.js';
import { seedHousehold, testDatabase } from './fixtures.js';

const base = new Date('2026-01-01T00:00:00Z');
const firstAuth = base.getTime() / 1000 + 1;
const provider = {
  verifyFirebase: async (token: string) => {
    if (token === 'unavailable') throw Object.assign(new Error('Unavailable'), { status: 503 });
    if (token === 'invalid') throw Object.assign(new Error('Invalid'), { status: 401 });
    const [googleSubject, value] = token.split(':');
    return { issuer: 'test-issuer', subject: 'member-firebase', googleSubject, authTime: Number(value), displayName: '테스트' };
  },
  verifyGoogle: async (token: string) => {
    const [subject, nonce] = token.split(':');
    return { subject, nonce, expiresAt: new Date(base.getTime() + 120_000) };
  },
};

let f: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => { f = await testDatabase(); });
afterEach(async () => { await f.close(); });

describe('initial household and browser sessions', () => {
  it('initializes only one household and rejects a second attempt', async () => {
    const result = await bootstrapAdmin(f.db, provider, 'google:' + firstAuth);
    expect(result.role).toBe('ADMIN');
    await expect(bootstrapAdmin(f.db, provider, 'google:' + firstAuth)).rejects.toMatchObject({ status: 409 });
    expect(await f.db.household.count()).toBe(1);
    expect(await f.db.membership.count()).toBe(1);
  });

  it('fails closed and creates nothing if identity validation fails', async () => {
    await expect(bootstrapAdmin(f.db, provider, 'invalid')).rejects.toMatchObject({ status: 401 });
    expect(await f.db.user.count()).toBe(0);
    expect(await f.db.household.count()).toBe(0);
  });

  it('rejects mismatched nonce, mismatched Google subject and old or invalid evidence', async () => {
    await seedHousehold(f.db);
    let now = base;
    const service = new SessionService(f.db, provider, () => now);
    const request = await service.start();
    now = new Date(base.getTime() + 2000);
    for (const [firebase, google] of [
      ['google:' + firstAuth, 'google:different'],
      ['google:' + firstAuth, 'other:' + request.nonce],
      ['google:' + (firstAuth - 1), 'google:' + request.nonce],
      ['invalid', 'google:' + request.nonce],
    ]) await expect(service.issue(request.secret, firebase, google)).rejects.toMatchObject({ status: 401 });
    expect(await f.db.session.count()).toBe(0);
  });

  it('rejects replay and revokes only the current session', async () => {
    await seedHousehold(f.db);
    let now = base;
    const service = new SessionService(f.db, provider, () => now);
    const startOne = await service.start();
    now = new Date(base.getTime() + 2000);
    const tokenOne = 'google:' + firstAuth;
    const one = await service.issue(startOne.secret, tokenOne, 'google:' + startOne.nonce);
    const startTwo = await service.start();
    now = new Date(base.getTime() + 4000);
    const tokenTwo = 'google:' + (firstAuth + 2);
    const two = await service.issue(startTwo.secret, tokenTwo, 'google:' + startTwo.nonce);
    await expect(service.issue(startTwo.secret, tokenTwo, 'google:' + startTwo.nonce)).rejects.toMatchObject({ status: 401 });
    await service.end(tokenOne, one.secret);
    await expect(service.principal(tokenOne, one.secret)).rejects.toMatchObject({ status: 401 });
    await expect(service.principal(tokenTwo, two.secret)).resolves.toMatchObject({ userId: 'member' });
    const startThree = await service.start();
    await expect(service.issue(startThree.secret, tokenOne, 'google:' + startThree.nonce)).rejects.toMatchObject({ status: 401 });
  });

  it('distinguishes provider unavailability from invalid credentials', async () => {
    await seedHousehold(f.db);
    const service = new SessionService(f.db, provider, () => base);
    const request = await service.start();
    await expect(service.issue(request.secret, 'unavailable', 'g:n')).rejects.toMatchObject({ status: 503 });
  });

  it('rejects an expired challenge', async () => {
    await seedHousehold(f.db);
    let now = base;
    const service = new SessionService(f.db, provider, () => now);
    const request = await service.start();
    now = new Date(base.getTime() + 10 * 60_000);
    await expect(service.issue(request.secret, 'google:' + firstAuth, 'google:' + request.nonce)).rejects.toMatchObject({ status: 401 });
  });
});
