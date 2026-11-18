import type { FirebaseOptions } from 'firebase/app';

export type ClientConfig =
  | { mode: 'synthetic' }
  | { mode: 'google'; googleClientId: string; firebaseConfig: FirebaseOptions };
export type Me = { userId: string; householdId?: string; defaultTimeZone?: string };
type LoginProof = { firebaseToken: string; googleToken: string };
export type Reminder = {
  reminderId: string; title: string; description?: string;
  trigger: { scheduledAt: string; timeZone: string };
};

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly field?: string,
    readonly status?: number,
    readonly retryAt?: number,
  ) { super(code); }
}

function retryDeadline(header: string | null, now: number): number | undefined {
  if (!header) return;
  const value = header.trim();
  let deadline: number;
  if (/^\d+$/.test(value)) deadline = now + Number(value) * 1000;
  else {
    // HTTP dates have a weekday and a time of day, unlike ISO dates and other values Date.parse accepts.
    if (!/^[A-Za-z]{3,9}[, ].+ \d{2}:\d{2}:\d{2} (?:GMT|\d{4})$/.test(value)) return;
    deadline = Date.parse(value);
  }
  if (deadline > now && Number.isFinite(new Date(deadline).getTime())) return deadline;
}

export async function api<T>(path: string, token?: string, init: RequestInit = {}, key?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (key) headers.set('Idempotency-Key', key);
  const response = await fetch('/api/v1' + path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const retryAt = response.status === 429 || response.status === 503
      ? retryDeadline(response.headers.get('Retry-After'), Date.now())
      : undefined;
    const error = await response.json().catch(() => ({}));
    const code = response.status === 429 ? 'RATE_LIMITED' : error?.code;
    throw new ApiError(typeof code === 'string' ? code : 'UNAVAILABLE',
      typeof error?.details?.field === 'string' ? error.details.field : undefined, response.status, retryAt);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

type GoogleIdentity = {
  initialize(config: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, config: { theme: 'outline'; size: 'large' }): void;
};
const googleIdentity = () => (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;

const invalidFirebaseCredentials = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/invalid-user-token',
]);

async function googleProof(clientId: string, nonce: string, elementId: string): Promise<string> {
  if (!googleIdentity()) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new ApiError('AUTH_PROVIDER_UNAVAILABLE'));
      };
      document.head.append(script);
    });
  }
  const vendor = googleIdentity();
  const button = document.getElementById(elementId);
  if (!vendor || !button) throw new ApiError('AUTH_PROVIDER_UNAVAILABLE');
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new ApiError('UNAUTHENTICATED')), 240_000);
      vendor.initialize({ client_id: clientId, nonce, callback: ({ credential }) => {
        window.clearTimeout(timer);
        resolve(credential);
      } });
      vendor.renderButton(button, { theme: 'outline', size: 'large' });
    });
  } finally {
    button.replaceChildren();
  }
}

export async function openSession(config: ClientConfig, buttonId: string) {
  const { nonce, issuedAt } = await api<{ nonce: string; issuedAt: string }>('/sessions/challenges', undefined, { method: 'POST' });
  let token: () => Promise<string>;
  let googleToken: string;
  let signOut = async () => {};
  // Firebase auth_time is measured in whole seconds. Keep it strictly after the challenge.
  const nextSecond = (Math.floor(Date.parse(issuedAt) / 1000) + 1) * 1000;
  if (config.mode === 'synthetic') {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextSecond - Date.now() + 30)));
    const proof = await api<LoginProof>('/sessions/local-proof', undefined, {
      method: 'POST', body: JSON.stringify({ nonce }),
    });
    googleToken = proof.googleToken;
    token = async () => proof.firebaseToken;
  } else {
    const [app, auth] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const instance = app.getApps().length ? app.getApp() : app.initializeApp(config.firebaseConfig);
    const firebase = auth.getAuth(instance);
    await auth.setPersistence(firebase, auth.inMemoryPersistence);
    googleToken = await googleProof(config.googleClientId, nonce, buttonId);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextSecond - Date.now() + 30)));
    const { user } = await auth.signInWithCredential(firebase, auth.GoogleAuthProvider.credential(googleToken));
    token = async () => {
      try {
        return await user.getIdToken();
      } catch (failure) {
        if (failure && typeof failure === 'object' && 'code' in failure && typeof failure.code === 'string'
            && invalidFirebaseCredentials.has(failure.code)) {
          throw new ApiError('UNAUTHENTICATED', undefined, 401);
        }
        throw failure;
      }
    };
    signOut = () => auth.signOut(firebase);
  }
  try {
    await api('/sessions', await token(), { method: 'POST', body: JSON.stringify({ googleToken }) });
    return { token, signOut };
  } catch (error) {
    await signOut();
    throw error;
  }
}

