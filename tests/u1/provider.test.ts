import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../src/server/auth.js';
import { realProvider } from '../../src/server/provider.js';
import { seedHousehold, testDatabase } from './fixtures.js';

const adapters = vi.hoisted(() => ({
  firebaseVerify: vi.fn(),
  googleVerify: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}), initializeApp: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: adapters.firebaseVerify }),
}));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class { verifyIdToken = adapters.googleVerify; },
}));

const provider = realProvider('local-test-project', 'local-test-client');
const firebaseProof = {
  iss: 'test-issuer', sub: 'member-firebase', name: 'Display name', auth_time: 1200,
  firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['google-subject'] } },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
beforeEach(() => vi.resetAllMocks());

describe('provider SDK boundary without network access', () => {
  it('bounds a stalled provider call and ignores a late success', async () => {
    vi.useFakeTimers();
    try {
      const sdkResult = deferred<typeof firebaseProof>();
      adapters.firebaseVerify.mockReturnValue(sdkResult.promise);
      const bounded = realProvider('local-test-project', 'local-test-client', { timeoutMs: 100, retries: 1 });
      const result = bounded.verifyFirebase('test-token').catch((failure: unknown) => failure);
      const finished = vi.fn();
      void result.then(finished);
      await vi.advanceTimersByTimeAsync(100);
      expect(finished).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
      sdkResult.resolve(firebaseProof);
      expect(await result).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
      expect(adapters.firebaseVerify).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('requires revocation checks and returns only the linked Google identity', async () => {
    adapters.firebaseVerify.mockResolvedValue({
      iss: 'test-issuer', sub: 'firebase-subject', name: 'Display name', auth_time: 1200,
      firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['google-subject'] } },
    });
    await expect(provider.verifyFirebase('test-token')).resolves.toEqual({
      issuer: 'test-issuer', subject: 'firebase-subject', googleSubject: 'google-subject', authTime: 1200,
      displayName: 'Display name',
    });
    expect(adapters.firebaseVerify).toHaveBeenCalledWith('test-token', true);
  });

  it('rejects Firebase proofs for other sign-in providers', async () => {
    adapters.firebaseVerify.mockResolvedValue({
      firebase: { sign_in_provider: 'password', identities: {} },
    });
    await expect(provider.verifyFirebase('test-token')).rejects.toMatchObject({ status: 401 });
  });

  it('separates Firebase credential failures from transport failures', async () => {
    adapters.firebaseVerify.mockRejectedValueOnce({ code: 'auth/id-token-revoked' })
      .mockRejectedValueOnce(new Error('unavailable'));
    await expect(provider.verifyFirebase('test-token')).rejects.toMatchObject({ status: 401 });
    expect(adapters.firebaseVerify).toHaveBeenCalledTimes(1);
    await expect(provider.verifyFirebase('test-token')).rejects.toMatchObject({ status: 503 });
    expect(adapters.firebaseVerify).toHaveBeenCalledTimes(2);
  });

  it('requires the configured Google audience and parses the nonce and expiration', async () => {
    adapters.googleVerify.mockResolvedValue({
      getPayload: () => ({ sub: 'google-subject', nonce: 'test-nonce', exp: 1200 }),
    });
    await expect(provider.verifyGoogle('test-token')).resolves.toEqual({
      subject: 'google-subject', nonce: 'test-nonce', expiresAt: new Date(1_200_000),
    });
    expect(adapters.googleVerify).toHaveBeenCalledWith({ idToken: 'test-token', audience: 'local-test-client' });
  });

  it('requires the Google nonce and distinguishes rejected proofs from SDK transport failures', async () => {
    adapters.googleVerify.mockResolvedValueOnce({ getPayload: () => ({ sub: 'google-subject' }) })
      .mockRejectedValueOnce(new Error('invalid credential'))
      .mockRejectedValue({ code: 'ETIMEDOUT' });
    await expect(provider.verifyGoogle('test-token')).rejects.toMatchObject({ status: 401 });
    await expect(provider.verifyGoogle('test-token')).rejects.toMatchObject({ status: 401 });
    await expect(provider.verifyGoogle('test-token')).rejects.toMatchObject({ status: 503 });
    expect(adapters.googleVerify).toHaveBeenCalledTimes(4);
  });

  it('retries a known transient error and honors a zero-retry configuration', async () => {
    adapters.firebaseVerify.mockRejectedValueOnce({ code: 'app/network-timeout' }).mockResolvedValue(firebaseProof);
    await expect(provider.verifyFirebase('test-token')).resolves.toMatchObject({ subject: 'member-firebase' });
    expect(adapters.firebaseVerify).toHaveBeenCalledTimes(2);

    adapters.firebaseVerify.mockClear().mockRejectedValue({ code: 'app/network-error' });
    const noRetry = realProvider('local-test-project', 'local-test-client', { timeoutMs: 100, retries: 0 });
    await expect(noRetry.verifyFirebase('test-token')).rejects.toMatchObject({ status: 503 });
    expect(adapters.firebaseVerify).toHaveBeenCalledTimes(1);
  });

  it('shares the deadline across both login proofs and performs no late writes', async () => {
    const fixture = await testDatabase();
    try {
      const issuedAt = new Date('1970-01-01T00:19:59Z');
      const now = new Date('1970-01-01T00:20:01Z');
      await seedHousehold(fixture.db);
      const bounded = realProvider('local-test-project', 'local-test-client', { timeoutMs: 100, retries: 1 });
      let clock = issuedAt;
      const sessions = new SessionService(fixture.db, bounded, () => clock);
      const challenge = await sessions.start();
      clock = now;
      const firebaseStarted = deferred<void>();
      const firebaseResult = deferred<typeof firebaseProof>();
      const googleStarted = deferred<void>();
      const googleResult = deferred<unknown>();
      adapters.firebaseVerify.mockImplementation(() => {
        firebaseStarted.resolve();
        return firebaseResult.promise;
      });
      adapters.googleVerify.mockImplementation(() => {
        googleStarted.resolve();
        return googleResult.promise;
      });
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const result = sessions.issue(challenge.secret, 'firebase-token', 'google-token').catch((failure: unknown) => failure);
      const finished = vi.fn();
      void result.then(finished);
      await firebaseStarted.promise;
      await vi.advanceTimersByTimeAsync(60);
      firebaseResult.resolve(firebaseProof);
      await googleStarted.promise;
      await vi.advanceTimersByTimeAsync(40);
      expect(finished).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));

      googleResult.resolve({ getPayload: () => ({ sub: 'google-subject', nonce: challenge.nonce, exp: 1250 }) });
      expect(await result).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
      expect(await fixture.db.session.count()).toBe(0);
      expect(await fixture.db.loginProof.count()).toBe(0);
      expect(await fixture.db.loginChallenge.findFirst()).toMatchObject({ consumedAt: null });
      expect(adapters.googleVerify).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      await fixture.close();
    }
  });

  it('shares the retry allowance across login proofs and rejects a mismatched proof', async () => {
    const fixture = await testDatabase();
    try {
      const issuedAt = new Date('1970-01-01T00:19:59Z');
      await seedHousehold(fixture.db);
      let clock = issuedAt;
      const sessions = new SessionService(fixture.db, provider, () => clock);
      const challenge = await sessions.start();
      clock = new Date('1970-01-01T00:20:01Z');
      adapters.firebaseVerify.mockRejectedValueOnce({ code: 'app/network-timeout' }).mockResolvedValue(firebaseProof);
      adapters.googleVerify.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue({
        getPayload: () => ({ sub: 'google-other-subject', nonce: challenge.nonce, exp: 1250 }),
      });

      await expect(sessions.issue(challenge.secret, 'firebase-token', 'google-token')).rejects.toMatchObject({ status: 503 });
      expect(adapters.firebaseVerify).toHaveBeenCalledTimes(2);
      expect(adapters.googleVerify).toHaveBeenCalledTimes(1);
      await expect(sessions.issue(challenge.secret, 'firebase-token', 'google-token')).rejects.toMatchObject({ status: 401 });
      expect(adapters.firebaseVerify).toHaveBeenCalledTimes(3);
      expect(adapters.googleVerify).toHaveBeenCalledTimes(2);
      expect(await fixture.db.session.count()).toBe(0);
    } finally {
      await fixture.close();
    }
  });
});
