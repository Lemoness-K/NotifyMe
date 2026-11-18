// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/web/App.js';

const firebase = vi.hoisted(() => ({ getIdToken: vi.fn(), signOut: vi.fn() }));
vi.mock('firebase/app', () => ({ getApps: () => [{}], getApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  setPersistence: async () => {},
  inMemoryPersistence: {},
  GoogleAuthProvider: { credential: () => ({}) },
  signInWithCredential: async () => ({ user: { getIdToken: firebase.getIdToken } }),
  signOut: firebase.signOut,
}));

const setup = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const reply = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });
const reminder = {
  reminderId: 'first', title: '일정',
  trigger: { scheduledAt: '2030-04-10T00:00:00Z', timeZone: 'Asia/Seoul' },
};

beforeEach(() => {
  setup.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('navigator', { language: 'ko-KR' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  firebase.getIdToken.mockReset().mockResolvedValue('firebase');
  firebase.signOut.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = Array.from(host.querySelectorAll<HTMLElement>('button, a')).find((x) => x.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

async function render() {
  await act(async () => root.render(<MemoryRouter><App /></MemoryRouter>));
}

it('retains form values on rejection and retries the same submitted operation', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const keys: string[] = [];
  let account = 'first-user';
  const requests = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/client-config')) return reply({ mode: 'synthetic' });
    if (url.endsWith('/challenges')) return reply({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
    if (url.endsWith('/local-proof')) return reply({ firebaseToken: 'firebase', googleToken: 'google' }, 201);
    if (url.endsWith('/sessions')) return reply({ expiresAt: '2030-04-10T00:00:00Z' }, 201);
    if (url.endsWith('/me')) return reply({ userId: account, householdId: 'home' });
    if (url.endsWith('/current')) return new Response(null, { status: 204 });
    if (init.method === 'POST') {
      keys.push((init.headers as Headers).get('Idempotency-Key') ?? '');
      if (JSON.parse(String(init.body)).title === '다른 일정') return reply({ code: 'INVALID_FIELD', details: { field: 'title' } }, 422);
      return [1, 5].includes(keys.length) ? reply({ code: 'UNAVAILABLE' }, 503) : reply(reminder, 201);
    }
    return reply({ items: keys.length > 1 ? [reminder] : [] });
  });
  vi.stubGlobal('fetch', requests);
  try {
    await render();
    await click('테스트 계정으로 로그인');
    await act(async () => vi.runAllTimersAsync());
    await click('리마인더 추가');
    await click('저장');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('제목을 입력');

    const title = host.querySelector<HTMLInputElement>('[name=title]')!;
    const date = host.querySelector<HTMLInputElement>('[name=scheduledAt]')!;
    title.value = '일정';
    await click('저장');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('예약 시각');
    date.value = '2030-04-10T09:00';
    await click('저장');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('다시 시도');
    expect(title.value).toBe('일정');
    await click('취소');
    await click('리마인더 추가');
    const reopenedTitle = host.querySelector<HTMLInputElement>('[name=title]')!;
    expect(reopenedTitle.value).toBe('일정');
    expect(host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value).toBe('2030-04-10T09:00');
    reopenedTitle.value = '다른 일정';
    host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value = '2030-04-10T09:00';
    await click('저장');
    await click('저장');
    expect(keys[1]).not.toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
    reopenedTitle.value = '일정';
    await click('저장');
    expect(keys[0]).toBeTruthy();
    expect(keys[3]).toBe(keys[0]);
    expect(host.querySelector('h3')?.textContent).toBe('일정');
    await click('리마인더 추가');
    host.querySelector<HTMLInputElement>('[name=title]')!.value = '일정';
    host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value = '2030-04-10T09:00';
    await click('저장');
    expect(keys[4]).not.toBe(keys[0]);
    await click('로그아웃');
    expect(host.querySelector('h3')).toBeNull();
    expect(host.textContent).toContain('테스트 계정으로 로그인');
    account = 'second-user';
    await click('테스트 계정으로 로그인');
    await act(async () => vi.runAllTimersAsync());
    await click('리마인더 추가');
    expect(host.querySelector<HTMLInputElement>('[name=title]')!.value).toBe('');
    host.querySelector<HTMLInputElement>('[name=title]')!.value = '일정';
    host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value = '2030-04-10T09:00';
    await click('저장');
    expect(keys[5]).toBeTruthy();
    expect(keys[5]).not.toBe(keys[4]);
  } finally {
    vi.useRealTimers();
  }
});

it('keeps protected data on a temporary outage and clears it on session loss', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  let pages = 0;
  let finishPage: ((response: Response) => void) | undefined;
  let pageSignal: AbortSignal | undefined;
  const requests = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/client-config')) return reply({ mode: 'synthetic' });
    if (url.endsWith('/challenges')) return reply({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
    if (url.endsWith('/local-proof')) return reply({ firebaseToken: 'firebase', googleToken: 'google' }, 201);
    if (url.endsWith('/sessions')) return reply({}, 201);
    if (url.endsWith('/me')) return reply({ userId: 'user', householdId: 'home' });
    if (init.method === 'POST') return reply({}, 401);
    if (url.endsWith('cursor=second')) {
      if (++pages === 1) return reply({ code: 'AUTH_PROVIDER_UNAVAILABLE' }, 503);
      pageSignal = init.signal ?? undefined;
      return new Promise<Response>((resolve) => { finishPage = resolve; });
    }
    return reply({ items: [reminder], nextCursor: 'second' });
  });
  vi.stubGlobal('fetch', requests);
  try {
    await render();
    await click('테스트 계정으로 로그인');
    await act(async () => vi.runAllTimersAsync());
    await click('더 보기');
    expect(host.querySelector('h3')?.textContent).toBe('일정');
    expect(host.textContent).toContain('로그아웃');
    await click('다시 시도');
    expect(finishPage).toBeDefined();
    await click('리마인더 추가');
    host.querySelector<HTMLInputElement>('[name=title]')!.value = '비공개 초안';
    host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value = '2030-04-10T09:00';
    await click('저장');
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('h3')).toBeNull();
    expect(host.textContent).toContain('다시 로그인하세요');
    expect(host.textContent).toContain('테스트 계정으로 로그인');
    expect(pageSignal?.aborted).toBe(true);
    await act(async () => finishPage?.(reply({ items: [{ ...reminder, title: '지연된 응답' }] })));
    expect(host.textContent).not.toContain('지연된 응답');
  } finally {
    vi.useRealTimers();
  }
});

it.each(['auth/user-token-expired', 'auth/user-disabled', 'auth/invalid-user-token'])(
  'clears protected data on definitive Firebase token failure %s, while preserving it on network failure',
  async (code) => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    vi.stubGlobal('google', {
      accounts: {
        id: {
          initialize: ({ callback }: { callback: (reply: { credential: string }) => void }) => {
            callback({ credential: 'google' });
          },
          renderButton: vi.fn(),
        },
      },
    });
    const requests = vi.fn(async (url: string) => {
      if (url.endsWith('/client-config')) return reply({ mode: 'google', googleClientId: 'test', firebaseConfig: {} });
      if (url.endsWith('/challenges')) return reply({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
      if (url.endsWith('/sessions')) return reply({}, 201);
      if (url.endsWith('/me')) return reply({ userId: 'user', householdId: 'home' });
      return reply({ items: [reminder], nextCursor: 'second' });
    });
    vi.stubGlobal('fetch', requests);
    try {
      await render();
      await click('Google 로그인 시작');
      await act(async () => vi.runAllTimersAsync());
      expect(host.querySelector('h3')?.textContent).toBe('일정');
      const requestCount = requests.mock.calls.length;
      firebase.getIdToken.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
      await click('더 보기');
      expect(host.querySelector('h3')?.textContent).toBe('일정');
      expect(host.querySelector('[role=alert]')?.textContent).toContain('다시 시도');
      expect(firebase.signOut).not.toHaveBeenCalled();
      firebase.getIdToken.mockRejectedValueOnce({ code });
      await click('다시 시도');
      expect(host.querySelector('h3')).toBeNull();
      expect(host.textContent).toContain('다시 로그인하세요');
      expect(host.textContent).toContain('Google 로그인 시작');
      expect(requests).toHaveBeenCalledTimes(requestCount);
      expect(firebase.signOut).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  },
);

it.each([
  { status: 429, header: '2', wait: true },
  { status: 429, header: 'Thu, 10 Apr 2031 00:00:02 GMT', wait: true },
  { status: 429, header: 'invalid', wait: false },
  { status: 429, header: '2031-04-11', wait: false },
  { status: 429, header: undefined, wait: false },
  { status: 503, header: '2', wait: true },
])('retains the uncertain write key after $status with Retry-After $header', async ({ status, header, wait }) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
  vi.setSystemTime(new Date('2031-04-10T00:00:00Z'));
  const keys: (string | null)[] = [];
  const requests = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/client-config')) return reply({ mode: 'synthetic' });
    if (url.endsWith('/challenges')) return reply({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
    if (url.endsWith('/local-proof')) return reply({ firebaseToken: 'firebase', googleToken: 'google' }, 201);
    if (url.endsWith('/sessions')) return reply({}, 201);
    if (url.endsWith('/me')) return reply({ userId: 'user', householdId: 'home' });
    if (init.method === 'POST') {
      keys.push(new Headers(init.headers).get('Idempotency-Key'));
      if (keys.length === 1) return reply({}, 503);
      if (keys.length === 2) return reply({}, status, header === undefined ? undefined : { 'Retry-After': header });
      return reply(reminder, 201);
    }
    return reply({ items: keys.length === 3 ? [reminder] : [] });
  });
  vi.stubGlobal('fetch', requests);
  try {
    await render();
    await click('테스트 계정으로 로그인');
    await act(async () => vi.runAllTimersAsync());
    await click('리마인더 추가');
    host.querySelector<HTMLInputElement>('[name=title]')!.value = '일정';
    host.querySelector<HTMLInputElement>('[name=scheduledAt]')!.value = '2032-04-10T09:00';
    await click('저장');
    await click('저장');
    expect(host.querySelector('[role=alert]')?.textContent).toContain(status === 429 ? '요청이 너무 많' : '다시 시도');
    await click('취소');
    await click('리마인더 추가');
    expect(host.querySelector<HTMLInputElement>('[name=title]')!.value).toBe('일정');
    if (wait) {
      expect(host.querySelector('[role=alert]')?.textContent).toContain('이후');
      await click('저장');
      expect(keys).toHaveLength(2);
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
    }
    await click('저장');
    expect(keys[0]).toBeTruthy();
    expect(keys).toEqual([keys[0], keys[0], keys[0]]);
    expect(host.querySelector('h3')?.textContent).toBe('일정');
  } finally {
    vi.useRealTimers();
  }
});

it('lets users retry the sign-in configuration without exposing response details', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('PRIVATE')).mockResolvedValueOnce(reply({ mode: 'google' }));
  vi.stubGlobal('fetch', fetcher);
  await render();
  expect(host.querySelector('[role=alert]')?.textContent).toContain('다시 시도');
  expect(host.textContent).not.toContain('PRIVATE');
  await click('다시 시도');
  expect(host.querySelector('button')?.disabled).toBe(false);
});
