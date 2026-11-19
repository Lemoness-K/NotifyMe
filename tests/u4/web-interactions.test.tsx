// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/web/App.js';

const bridge = vi.hoisted(() => ({ active: true, status: vi.fn(), bind: vi.fn(), request: vi.fn(), openSettings: vi.fn(), locale: vi.fn(),
  addListener: vi.fn(async () => ({ remove: async () => {} })) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => bridge.active ? 'android' : 'web', isPluginAvailable: () => bridge.active },
  registerPlugin: () => bridge }));

const devicePath = '/households/home/installations/device-a/location-exclusions';
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let excluded: boolean;

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  excluded = false;
  const status = { signedIn: true, installationId: 'device-a', installationName: 'Device A', notifications: true,
    exactAlarms: false, location: true, timeChannel: true, locationChannel: true };
  bridge.status.mockResolvedValue(status);
  bridge.bind.mockResolvedValue(status);
  bridge.locale.mockResolvedValue(undefined);
  bridge.openSettings.mockResolvedValue(undefined);
  bridge.request.mockImplementation(async ({ path, method, body }) => {
    if (path === '/me') return { status: 200, body: { userId: 'self', householdId: 'home', householdRole: 'ADMIN' } };
    if (path === '/me/settings') return { status: 200, body: { revision: 0, locale: 'en-US' } };
    if (path === '/households/home/members') return { status: 200, body: [{ userId: 'self', displayName: 'Member' }] };
    if (path === devicePath) return { status: 200, body: { epoch: 'epoch', revision: excluded ? 2 : 1,
      locationCapacity: { state: excluded ? 'ACTIVE' : 'CAPACITY_PENDING', requiredSlots: excluded ? 100 : 101, limit: 100 },
      items: [{ reminderId: 'reminder-a', title: '현관', excluded, slots: 1 }] } };
    if (path === `${devicePath}/reminder-a` && method === 'PUT') {
      excluded = body.excluded;
      return { status: 204 };
    }
    return { status: 200, body: { items: [] } };
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ mode: 'synthetic' }))));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const control = Array.from(host.querySelectorAll<HTMLElement>('a, button')).find((item) => item.textContent === label);
  expect(control, label).toBeDefined();
  await act(async () => control!.click());
}

it('keeps capacity changes on this installation and requires confirmation before the write', async () => {
  await act(async () => root.render(<MemoryRouter><App /></MemoryRouter>));
  await click('Settings');
  await click('This device');
  expect(host.textContent).toContain('Location monitoring is waiting for capacity');
  expect(host.textContent).toContain('Exact alarms: delivery may be delayed');
  await click('Open exact alarm settings');
  expect(bridge.openSettings).toHaveBeenCalledWith({ kind: 'exact' });
  await click('Exclude');
  expect(bridge.request.mock.calls.some(([argument]) => argument.method === 'PUT')).toBe(false);
  expect(host.textContent).toContain('현관');
  expect(host.textContent).toContain('Device A');
  await click('Confirm exclusion');
  expect(bridge.request).toHaveBeenCalledWith(expect.objectContaining({ path: `${devicePath}/reminder-a`,
    method: 'PUT', body: { epoch: 'epoch', revision: 1, excluded: true } }));
  expect(host.textContent).toContain('Location plans fit on this device');
  expect(bridge.request.mock.calls.some(([argument]) => argument.path.includes('device-b'))).toBe(false);
});
