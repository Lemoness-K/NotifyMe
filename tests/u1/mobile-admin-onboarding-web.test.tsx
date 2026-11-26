// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/web/App.js';

const description = '이 계정이 Notify Me의 최초 관리자가 됩니다. 가구를 만들고 구성원을 초대할 수 있습니다.';
const email = 'owner@example.test';
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let answer: (path: string, options: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const fetcher = vi.fn((path: string, options: RequestInit) => answer(path, options));

function render() {
  return act(async () => root.render(<MemoryRouter><App /></MemoryRouter>));
}

async function click(label: string) {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => { button!.click(); await vi.runAllTimersAsync(); });
}

describe('mobile first-administrator screen', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('navigator', { language: 'ko-KR' });
    vi.stubGlobal('fetch', fetcher);
    fetcher.mockClear();
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    answer = (path) => {
      if (path.endsWith('/client-config')) return json({ mode: 'synthetic' });
      if (path.endsWith('/challenges')) return json({ nonce: 'test', issuedAt: '2000-01-01T00:00:00Z' }, 201);
      if (path.endsWith('/local-proof')) return json({ firebaseToken: 'verified', googleToken: 'fake-google' }, 201);
      if (path.endsWith('/sessions')) return json({ setup: { displayAccount: email, expiresAt: '2032-01-01T00:10:00Z' } }, 201);
      if (path.endsWith('/setup/confirm')) return json({ expiresAt: '2032-01-01T12:00:00Z' }, 201);
      if (path.endsWith('/setup/candidate')) return new Response(null, { status: 204 });
      if (path.endsWith('/me')) return json({ userId: 'admin', householdId: 'home', householdRole: 'ADMIN' });
      if (path.endsWith('/settings')) return json({ revision: 1 });
      return json({ items: [] });
    };
    await render();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the account and required explanation only after candidate authentication', async () => {
    expect(host.textContent).not.toContain(email);
    await click('테스트 계정으로 로그인');
    expect(host.textContent).toContain(email);
    expect(host.textContent).toContain(description);
    expect(host.querySelector('nav')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('h2'));
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/me'))).toBe(false);
  });

  it('confirms through the existing application login and opens the reminders page', async () => {
    await click('테스트 계정으로 로그인');
    await click('설정 시작');
    expect(host.textContent).toContain('리마인더 추가');
    expect(host.textContent).not.toContain(email);
    expect(fetcher.mock.calls.some(([path, options]) => path.endsWith('/setup/confirm') &&
      (options.headers as Headers).get('authorization') === 'Bearer verified')).toBe(true);
  });

  it('returns to sign-in after acknowledged cancellation without issuing an application request', async () => {
    await click('테스트 계정으로 로그인');
    await click('취소');
    expect(host.textContent).toContain('테스트 계정으로 로그인');
    expect(host.textContent).not.toContain(email);
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/setup/candidate'))[0][1].method).toBe('DELETE');
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/me'))).toBe(false);
  });

  it('reports an unknown confirmation outcome and keeps the candidate so confirmation can be checked again', async () => {
    const standard = answer;
    answer = (path, options) => path.endsWith('/setup/confirm') ? Promise.reject(new TypeError('network')) : standard(path, options);
    await click('테스트 계정으로 로그인');
    await click('설정 시작');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('설정 결과를 확인하지 못했습니다');
    expect(host.textContent).toContain(email);
    answer = standard;
    await click('설정 시작');
    expect(host.textContent).toContain('리마인더 추가');
  });

  it('retains the candidate through an unacknowledged cancellation', async () => {
    const standard = answer;
    answer = (path, options) => path.endsWith('/setup/candidate') ? json({ code: 'SETUP_UNAVAILABLE' }, 503) : standard(path, options);
    await click('테스트 계정으로 로그인');
    await click('취소');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('취소를 확인하지 못했습니다');
    expect(host.textContent).toContain(email);
  });

  it('prompts for reauthentication after refresh and keeps another account from seeing the reserved identity', async () => {
    await click('테스트 계정으로 로그인');
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(host.textContent).toContain('같은 Google 계정으로 다시 로그인');
    expect(host.textContent).not.toContain(email);
    const standard = answer;
    answer = (path, options) => path.endsWith('/sessions') ? json({ code: 'SETUP_RESERVED' }, 409) : standard(path, options);
    await click('테스트 계정으로 로그인');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('다른 설정 시도가 진행 중');
    expect(host.textContent).not.toContain(email);
  });

  it('sends one confirmation for immediate duplicate clicks', async () => {
    const standard = answer;
    let fulfill!: (response: Response) => void;
    answer = (path, options) => path.endsWith('/setup/confirm')
      ? new Promise<Response>((resolve) => { fulfill = resolve; }) : standard(path, options);
    await click('테스트 계정으로 로그인');
    const confirm = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === '설정 시작')!;
    await act(async () => { confirm.click(); confirm.click(); });
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/setup/confirm'))).toHaveLength(1);
    expect(confirm.disabled).toBe(true);
    await act(async () => fulfill(json({}, 201)));
  });
});
