// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/web/App.js';

const reply = (value: unknown, status = 200, headers?: HeadersInit) =>
  new Response(status === 204 ? null : JSON.stringify(value), { status, headers });
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let fetcher: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
let role: 'ADMIN' | 'MEMBER';
let preferences: { revision: number; locale?: string; timeZone?: string };
let destination: (path: string, init: RequestInit) => Response | Promise<Response>;

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
  vi.setSystemTime(new Date('2031-04-10T00:00:00Z'));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  role = 'ADMIN';
  preferences = { revision: 0 };
  destination = () => reply({ items: [] });
  fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('/api/v1', '');
    if (path === '/client-config') return reply({ mode: 'synthetic' });
    if (path === '/sessions/challenges') return reply({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
    if (path === '/sessions/local-proof') return reply({ firebaseToken: 'firebase', googleToken: 'google' }, 201);
    if (path === '/sessions') return reply({}, 201);
    if (path === '/me') return reply({ userId: 'self', householdId: 'home', householdRole: role });
    if (path === '/me/settings') {
      if (init.method === 'PATCH') preferences = { ...JSON.parse(String(init.body)), revision: 1 };
      return reply(preferences);
    }
    if (path === '/settings/catalog') return reply([]);
    return destination(path, init);
  });
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('navigator', { language: 'ko-KR' });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function render(path = '/') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>));
}

async function click(label: string) {
  const element = [...host.querySelectorAll<HTMLElement>('button, a')].find((node) => node.textContent === label);
  expect(element, label).toBeDefined();
  await act(async () => element?.click());
}

async function login() {
  await render();
  await click('테스트 계정으로 로그인');
  await act(async () => vi.runAllTimersAsync());
}

function field(name: string) {
  const control = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  expect(control, name).toBeTruthy();
  return control!;
}

function requests(path: string, method: string) {
  return fetcher.mock.calls.filter(([url, init]) => url.endsWith(path) && (init.method ?? 'GET') === method);
}

it('loads a saved account locale before displaying authenticated navigation', async () => {
  preferences = { revision: 1, locale: 'en-US', timeZone: 'UTC' };
  await login();
  expect(document.documentElement.lang).toBe('en-US');
  expect(host.textContent).toContain('Settings');
  expect(host.textContent).toContain('Sign out');
});

it('saves personal language and time zone and immediately localizes the app', async () => {
  await login();
  await click('설정');
  await click('개인 설정');
  field('locale').value = 'en-US';
  field('timeZone').value = 'UTC';
  await click('저장');
  expect(preferences).toEqual({ revision: 1, locale: 'en-US', timeZone: 'UTC' });
  expect(document.documentElement.lang).toBe('en-US');
  expect(host.textContent).toContain('Personal settings');
});

it('opens an invite without changing membership and accepts only on an explicit action', async () => {
  destination = (path) => path === '/invitations/accept' ? reply({}) : reply({ items: [] });
  await render('/invite#test-invite');
  expect(requests('/invitations/accept', 'POST')).toHaveLength(0);
  await click('테스트 계정으로 초대 수락');
  await act(async () => vi.runAllTimersAsync());
  expect(requests('/invitations/accept', 'POST')).toHaveLength(1);
  const [url, init] = requests('/invitations/accept', 'POST')[0];
  expect(JSON.parse(String(init.body))).toEqual({ code: 'test-invite' });
  expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
  expect(fetcher.mock.calls.findIndex(([path]) => path === url))
    .toBeLessThan(fetcher.mock.calls.findIndex(([path]) => path.endsWith('/sessions')));
});

it('lists safe invitation state, issues a link once and lets the Admin navigate back to metadata', async () => {
  const now = new Date().toISOString();
  destination = (path, init) => !path.includes('/invitations') ? reply({ items: [] }) : init.method === 'POST'
    ? reply({ invitationId: 'one', inviteUrl: 'https://example.test/invite#first', expiresAt: now }, 201)
    : reply({ items: [{ invitationId: 'one', status: 'ACTIVE', createdAt: now, expiresAt: now }] });
  await login();
  await click('설정');
  await click('초대 관리');
  expect(host.textContent).toContain('활성');
  field('email').value = 'member@example.test';
  await click('초대 발급');
  expect((field('inviteUrl') as HTMLInputElement).value).toContain('#first');
  await click('설정');
  await click('초대 관리');
  expect(host.querySelector('[name=inviteUrl]')).toBeNull();
  expect(host.textContent).toContain('활성');
});

it('requires the recovered invite to be revoked before issuing a replacement link', async () => {
  const now = new Date().toISOString();
  const path = '/households/home/invitations';
  destination = (target, init) => {
    if (target === path && init.method === 'POST') {
      return reply({ code: 'INVITATION_ALREADY_ISSUED', details: { invitationId: 'original', expiresAt: now } }, 409);
    }
    return init.method === 'DELETE' ? reply(null, 204) : reply({ items: [] });
  };
  await login();
  await click('설정');
  await click('초대 관리');
  field('email').value = 'member@example.test';
  await click('초대 발급');
  await click('초대 발급');
  expect(requests(path, 'POST')).toHaveLength(1);
  expect(host.querySelector('[name=inviteUrl]')).toBeNull();
  await click('초대 취소');
  expect(requests(path + '/original', 'DELETE')).toHaveLength(1);
  await click('초대 발급');
  expect(requests(path, 'POST')).toHaveLength(2);
});

it('shows household settings to Members and withholds Admin editing and invitation links', async () => {
  role = 'MEMBER';
  destination = (path) => path.endsWith('/settings') ? reply({
    revision: 0, defaultTimeZone: 'Asia/Seoul', radiusM: { min: 50, default: 100, max: 500 },
    maxLocationDurationMin: 60, weeklyCalendarConvention: 'MONDAY_START',
  }) : reply({ items: [] });
  await login();
  await click('설정');
  expect(host.textContent).not.toContain('초대 관리');
  await click('가구 설정');
  expect(field('defaultTimeZone').hasAttribute('disabled')).toBe(true);
  expect(host.textContent).not.toContain('저장');
});

it('sends a selected Admin successor and the target revision when removing the current Admin', async () => {
  destination = (path, init) => !path.includes('/members') ? reply({ items: [] }) : init.method === 'DELETE' ? reply(null, 204) : reply([
    { userId: 'self', displayName: '관리자', role: 'ADMIN', revision: 4 },
    { userId: 'next', displayName: '후임', role: 'MEMBER', revision: 1 },
  ]);
  await login();
  await click('설정');
  await click('구성원 관리');
  await click('관리자 제거');
  field('successorAdminId').value = 'next';
  await click('제거 확인');
  const [, init] = requests('/members/self?successorAdminId=next', 'DELETE')[0];
  expect(new Headers(init.headers).get('If-Match')).toBe('"4"');
});

it('honors the list Retry-After deadline before sending another request', async () => {
  destination = () => reply({ code: 'UNAVAILABLE' }, 503, { 'Retry-After': '2' });
  await login();
  const calls = () => requests('/households/home/reminders?view=MINE', 'GET');
  expect(calls()).toHaveLength(1);
  await click('다시 시도');
  expect(calls()).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  await click('다시 시도');
  expect(calls()).toHaveLength(2);
});
