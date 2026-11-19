// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/web/App.js';
import type { Session } from '../../src/web/App.js';
import { WorkOptions, workFormFields, type TriggerMode } from '../../src/web/work-form.js';
import { WorkDetail, WorkHistory } from '../../src/web/work-pages.js';
import { Route, Routes } from 'react-router';
import { useState } from 'react';
import { workErrorText } from '../../src/web/work-messages.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('shows only approved installation capacity details in the selected language', () => {
  const note = workErrorText('en-US', 'GEOFENCE_CAPACITY_EXCEEDED',
    { installationId: 'test-device', remainingCapacity: '0', coordinates: 'private-value' });
  expect(note).toContain('Target device test-device');
  expect(note).toContain('Remaining capacity 0');
  expect(note).not.toContain('private-value');
});

it('opens prior pending verification and offers only the server-provided withdrawal', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('navigator', { language: 'en-US' });
  const trigger = { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'Asia/Seoul' };
  const work = { title: 'Original', reminderId: 'work', revision: 1, trigger, lifecycle: 'ACTIVE', pendingVerificationCount: 1,
    currentOccurrence: null };
  const paths: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const path = url.replace('/api/v1', '');
    paths.push(path);
    let data: unknown = { items: [work] };
    if (path.endsWith('/client-config')) data = { mode: 'synthetic' };
    else if (path.endsWith('/challenges')) data = { nonce: 'nonce', issuedAt: '2000-01-01T00:00:00Z' };
    else if (path.endsWith('/local-proof')) data = { firebaseToken: 'f', googleToken: 'g' };
    else if (path.endsWith('/me')) data = { userId: 'member', householdId: 'home' };
    else if (path.endsWith('/work')) data = work;
    else if (path.includes('/occurrences?')) data = { items: [{ occurrenceId: 'request', allowedActions: ['WITHDRAW_VERIFICATION'],
      revision: 2, state: 'VERIFICATION_PENDING', scheduledAt: null }] };
    return new Response(JSON.stringify(data));
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  async function click(text: string) {
    const target = [...host.querySelectorAll<HTMLElement>('button,a')].find((node) => node.textContent === text);
    expect(target).toBeDefined();
    await act(async () => target!.click());
  }
  try {
    await act(async () => root.render(<MemoryRouter><App /></MemoryRouter>));
    await click('Sign in with test account');
    await act(async () => vi.runAllTimersAsync());
    expect(paths).toContain('/households/home/reminders?view=MINE');
    await click('Original');
    await click('Pending verification (1)');
    expect(host.textContent).toContain('Withdraw request');
    expect(host.textContent).not.toContain('Approve completion');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

function testSession(request: Session['request']): Session {
  return { request, me: { userId: 'member', householdId: 'home' }, end() {}, async signOut() {},
    pendingCreates: new Map(), pendingWrites: new Map() };
}

async function mounted(run: (host: HTMLDivElement, root: ReturnType<typeof createRoot>) => Promise<void>) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try { await run(host, root); }
  finally { await act(async () => root.unmount()); host.remove(); }
}

async function button(host: HTMLElement, label: string) {
  const match = Array.from(host.querySelectorAll('button')).find((node) => node.textContent === label);
  expect(match, label).toBeDefined();
  await act(async () => match!.click());
}

it('keeps policy, members and localized trigger options scoped to the form', async () => {
  const mock = vi.fn(async (path: string) => path.endsWith('/members') ?
    [{ userId: 'member', displayName: 'Member' }, { userId: 'other', displayName: 'Reviewer' }] :
    { radiusM: { min: 65, default: 90, max: 118 }, maxLocationDurationMin: 15 });
  const session = testSession(mock as Session['request']);
  function Options() {
    const [mode, setMode] = useState<TriggerMode>('LOCATION');
    return <form><WorkOptions session={session} locale="en-US" mode={mode} setMode={setMode} reminder={{
      reminderId: 'test', title: 'Place', trigger: { kind: 'LOCATION', latitude: 40, longitude: 10,
        event: 'DWELL', placeName: 'Here', radiusM: 90 }, assigneeIds: ['member'],
      recurrence: { frequency: 'WEEKLY', weekdays: ['MO'], endOn: '2032-01-20' },
      verification: { enabled: true, verifierId: 'other' },
    }} /></form>;
  }
  await mounted(async (host, root) => {
    await act(async () => root.render(<Options />));
    await act(async () => {
      const details = host.querySelector('details')!;
      details.open = true;
      details.dispatchEvent(new Event('toggle', { bubbles: true }));
    });
    expect(mock).toHaveBeenCalledWith('/households/home/members');
    expect(host.textContent).toContain('Days of the week');
    expect(Array.from(host.querySelectorAll('[name=verifierId] option')).map((node) => node.textContent))
      .toEqual(['Select', 'Reviewer']);
    const range = host.querySelector<HTMLInputElement>('[type=range]')!;
    expect(range.max).toBe('3');
    expect(host.querySelector<HTMLInputElement>('[name=radiusM]')?.value).toBe('90');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(range, '2');
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('[name=radiusM]')?.value).toBe('115');
    await act(async () => {
      setter?.call(range, '3');
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('[name=radiusM]')?.value).toBe('118');
    const fields = workFormFields(new FormData(host.querySelector('form')!), 'UTC', 'LOCATION');
    expect(fields).toMatchObject({
      trigger: { kind: 'LOCATION', event: 'DWELL', latitude: 40, longitude: 10, durationMinutes: 10, radiusM: 118 },
      recurrence: { frequency: 'WEEKLY', weekdays: ['MO'], endOn: '2032-01-20' },
      verification: { enabled: true, verifierId: 'other' },
    });
  });
});

it('shows a confirmation for permanent deletion and retains the operation on a transient failure', async () => {
  const changes: { path: string; method: string | undefined; key: string | undefined }[] = [];
  const item = { reminderId: 'work', title: '원문', revision: 2, lifecycle: 'ARCHIVED',
    trigger: { kind: 'LOCATION', placeName: 'Park', event: 'ENTER', radiusM: 125 }, currentOccurrence: null,
    latestOccurrenceState: 'COMPLETED', requesterId: 'member', assigneeIds: ['other'],
    recurrence: { frequency: 'DAILY', interval: 2, endOn: '2032-01-09' } };
  const session = testSession((async (path, init, key) => {
    if (init?.method === 'DELETE') {
      changes.push({ path, method: init.method, key });
      if (changes.length === 1) throw new Error('network');
      return;
    }
    if (path.endsWith('/members')) return [{ userId: 'member', displayName: 'Requester Name' }, { userId: 'other', displayName: 'Assigned Name' }];
    if (path.includes('/history?')) return { items: [] };
    return item;
  }) as Session['request']);
  await mounted(async (host, root) => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/reminders/work']}><Routes>
      <Route path="/reminders/:reminderId" element={<WorkDetail session={session} locale="en-US" />} />
      <Route path="/reminders/archive" element={<p>Archived list</p>} />
    </Routes></MemoryRouter>));
    expect(host.textContent).toContain('Park · Enter');
    expect(host.querySelector('.work-metadata')?.textContent).toContain('Requester Name');
    expect(host.querySelector('.work-metadata')?.textContent).toContain('Assigned Name');
    expect(host.querySelector('.work-metadata')?.textContent).toContain('Daily · Interval 2');
    await button(host, 'History');
    expect(Array.from(host.querySelectorAll('[aria-current=step]')).map((node) => node.textContent))
      .toEqual(['Archived', 'Completed']);
    await button(host, 'Delete permanently');
    expect(changes).toHaveLength(0);
    expect(host.querySelector('[role=alertdialog]')?.textContent).toContain('원문');
    await button(host, 'Confirm permanent deletion');
    expect(host.querySelector('[role=alert]')?.textContent).toMatch(/Try again/);
    await button(host, 'Confirm permanent deletion');
    expect(changes.map((change) => change.key)).toEqual([changes[0].key, changes[0].key]);
    expect(host.textContent).toContain('Archived list');
  });
});

it('shows localized history and pages through it without changing its view', async () => {
  const calls: string[] = [];
  const session = testSession((async (path: string) => {
    calls.push(path);
    const row = { reminderId: 'work', title: '원문', kind: 'MISSED', occurredAt: '2032-01-01T12:00:00Z' };
    return path.includes('cursor=next') ? { items: [{ ...row, kind: 'SKIPPED' }] } : { items: [row], nextCursor: 'next' };
  }) as Session['request']);
  await mounted(async (host, root) => {
    await act(async () => root.render(<MemoryRouter><WorkHistory session={session} locale="ko-KR" displayTimeZone="Asia/Seoul" /></MemoryRouter>));
    expect(host.textContent).toContain('놓침');
    await button(host, '더 보기');
    expect(host.textContent).toContain('건너뜀');
    expect(calls[0]).toContain('view=MINE');
    expect(calls[1]).toContain('view=MINE&cursor=next');
  });
});
