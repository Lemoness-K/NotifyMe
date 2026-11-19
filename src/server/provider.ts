import { createHmac, timingSafeEqual } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { OAuth2Client } from 'google-auth-library';
import type { FirebaseIdentity, GoogleProof, IdentityProvider, VerificationBudget } from './auth.js';
import { AppError } from './errors.js';

const badCredential = () => new AppError(401, 'UNAUTHENTICATED');
const down = () => new AppError(503, 'AUTH_PROVIDER_UNAVAILABLE');
const invalidFirebaseCodes = new Set([
  'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token',
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found',
]);
const transientNetworkCodes = new Set([
  'app/network-error', 'app/network-timeout', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
]);
const transientHttpStatuses = new Set([408, 429, 500, 502, 503, 504]);

type VerificationPolicy = { timeoutMs: number; retries: number };
type ProviderError = { code?: string; response?: { status?: number }; request?: unknown; cause?: { code?: string } };
export const defaultVerificationPolicy: Readonly<VerificationPolicy> = { timeoutMs: 2000, retries: 1 };

function providerError(error: unknown): ProviderError {
  return error !== null && typeof error === 'object' ? error as ProviderError : {};
}

function isTransient(error: unknown) {
  const { code, response, cause } = providerError(error);
  if (invalidFirebaseCodes.has(code ?? '')) return false;
  if (response?.status !== undefined) return transientHttpStatuses.has(response.status);
  return transientNetworkCodes.has(code ?? '') || transientNetworkCodes.has(cause?.code ?? '');
}

async function verifyWithin<T>(verify: () => Promise<T>, budget: VerificationBudget): Promise<T> {
  for (;;) {
    const remaining = budget.deadline - performance.now();
    if (remaining <= 0) throw down();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(down()), Math.ceil(remaining));
      });
      // The SDK has no cancellation signal here. Only a result within the budget reaches the caller.
      const proof = await Promise.race([deadline, verify()]);
      if (performance.now() >= budget.deadline) throw down();
      return proof;
    } catch (error) {
      if (performance.now() >= budget.deadline) throw down();
      if (!isTransient(error) || budget.retriesRemaining === 0) throw error;
      budget.retriesRemaining--;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function realProvider(
  projectId: string, googleClientId: string, policy: Readonly<VerificationPolicy> = defaultVerificationPolicy,
): IdentityProvider {
  const firebase = getAuth(initializeApp({ projectId, credential: applicationDefault() }));
  const google = new OAuth2Client(googleClientId);
  const createVerificationBudget = (): VerificationBudget => ({
    deadline: performance.now() + policy.timeoutMs, retriesRemaining: policy.retries,
  });
  return {
    createVerificationBudget,
    async verifyFirebase(token, budget = createVerificationBudget()) {
      try {
        const proof = await verifyWithin(() => firebase.verifyIdToken(token, true), budget);
        const subjects: unknown = proof.firebase.identities['google.com'];
        if (proof.firebase.sign_in_provider !== 'google.com' || !Array.isArray(subjects) ||
            subjects.length !== 1 || typeof subjects[0] !== 'string' || !subjects[0]) throw badCredential();
        return {
          issuer: proof.iss, subject: proof.sub, googleSubject: subjects[0],
          authTime: proof.auth_time, displayName: typeof proof.name === 'string' ? proof.name : undefined,
          ...(typeof proof.email === 'string' && proof.email_verified === true ? { email: proof.email, emailVerified: true } : {}),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        const { code = '' } = providerError(error);
        throw invalidFirebaseCodes.has(code) ? badCredential() : down();
      }
    },
    async verifyGoogle(token, budget = createVerificationBudget()) {
      try {
        const ticket = await verifyWithin(() => google.verifyIdToken({ idToken: token, audience: googleClientId }), budget);
        const proof = ticket.getPayload() as unknown as Record<string, unknown> | undefined;
        if (!proof || typeof proof.sub !== 'string' || typeof proof.nonce !== 'string' ||
            typeof proof.exp !== 'number' || !Number.isFinite(proof.exp)) throw badCredential();
        return { subject: proof.sub, nonce: proof.nonce, expiresAt: new Date(proof.exp * 1000) };
      } catch (error) {
        if (error instanceof AppError) throw error;
        const transport = providerError(error);
        if (transport.request || (transport.response?.status ?? 0) >= 500 ||
            transport.code === 'ENOTFOUND' || isTransient(error)) {
          throw down();
        }
        throw badCredential();
      }
    },
  };
}

export type SyntheticAccount = 'admin' | 'member';
type Signed = { kind: 'google' | 'firebase'; nonce?: string; authTime: number; expires: number; account: SyntheticAccount };

export function syntheticProvider(key: string) {
  const identities = {
    admin: {
      issuer: 'urn:notifyme:local-test', subject: 'local-synthetic-admin', googleSubject: 'local-synthetic-google',
      displayName: '로컬 테스트', email: 'admin@example.test', emailVerified: true,
    },
    member: {
      issuer: 'urn:notifyme:local-test', subject: 'local-synthetic-member', googleSubject: 'local-synthetic-member-google',
      displayName: '로컬 구성원', email: 'member@example.test', emailVerified: true,
    },
  };
  const sign = (value: string) => createHmac('sha256', key).update(value).digest();
  function mint(payload: Signed) {
    const content = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return content + '.' + sign(content).toString('base64url');
  }
  function parse(token: string, kind: Signed['kind']): Signed {
    try {
      const [data, signature, extra] = token.split('.');
      if (!data || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(data) ||
          !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw badCredential();
      const actual = Buffer.from(signature, 'base64url');
      const expected = sign(data);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw badCredential();
      const proof = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Signed;
      if (proof.kind !== kind || !Number.isSafeInteger(proof.expires) || proof.expires <= Date.now() ||
          !Number.isSafeInteger(proof.authTime) || (proof.account !== 'admin' && proof.account !== 'member')) throw badCredential();
      return proof;
    } catch { throw badCredential(); }
  }
  return {
    mint(nonce = '', account: SyntheticAccount = 'admin') {
      const authTime = Math.floor(Date.now() / 1000);
      const expires = Date.now() + 60 * 60_000;
      return {
        firebaseToken: mint({ kind: 'firebase', authTime, expires, account }),
        googleToken: mint({ kind: 'google', nonce, authTime, expires, account }),
      };
    },
    async verifyFirebase(token: string): Promise<FirebaseIdentity> {
      const proof = parse(token, 'firebase');
      return { ...identities[proof.account], authTime: proof.authTime };
    },
    async verifyGoogle(token: string): Promise<GoogleProof> {
      const proof = parse(token, 'google');
      if (!proof.nonce) throw badCredential();
      return { subject: identities[proof.account].googleSubject, nonce: proof.nonce, expiresAt: new Date(proof.expires) };
    },
  };
}
