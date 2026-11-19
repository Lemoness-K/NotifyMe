import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test.use({ locale: 'ko-KR', hasTouch: true });

test('preserves the location reminder draft while adjusting this installation on a narrow touch screen', async ({ page }) => {
  await page.addInitScript(() => {
    let excluded = false;
    const methodNames = ['status', 'bind', 'request', 'locale', 'openSettings', 'clearSession'];
    const device = { signedIn: true, installationId: 'local-device', installationName: 'Android test', notifications: true,
      exactAlarms: false, location: true, timeChannel: true, locationChannel: true };
    const target = window as Window & { androidBridge?: unknown; Capacitor?: unknown };
    target.androidBridge = {};
    target.Capacitor = {
      PluginHeaders: [{ name: 'NotifyDevice', methods: methodNames.map((name) => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_plugin: string, method: string, input: { path?: string; method?: string; body?: { title?: string; excluded?: boolean } }) => {
        if (method === 'status' || method === 'bind') return device;
        if (method !== 'request') return undefined;
        const { path, method: verb, body } = input;
        if (path === '/me') return { status: 200, body: { userId: 'member', householdId: 'home', householdRole: 'ADMIN' } };
        if (path === '/me/settings') return { status: 200, body: { locale: 'en-US', revision: 1 } };
        if (path === '/households/home/members') return { status: 200, body: [{ userId: 'member', displayName: 'Member' }] };
        if (path?.includes('/location-exclusions')) {
          if (verb === 'PUT') { excluded = body?.excluded === true; return { status: 204 }; }
          return { status: 200, body: { epoch: 'current', revision: excluded ? 2 : 1,
            locationCapacity: { state: 'ACTIVE', requiredSlots: excluded ? 99 : 100, limit: 100 },
            items: [{ reminderId: 'assigned', title: '현관', slots: 1, excluded }] } };
        }
        if (path === '/households/home/reminders' && verb === 'POST') {
          if (!excluded) throw { code: 'GEOFENCE_CAPACITY_EXCEEDED', data: { status: 409,
            body: { code: 'GEOFENCE_CAPACITY_EXCEEDED', details: { installationId: 'local-device', remainingCapacity: '0' } } } };
          if (body?.title !== '보존할 입력') throw { code: 'INVALID_FIELD', data: { status: 422 } };
          return { status: 201, body: { reminderId: 'created' } };
        }
        return { status: 200, body: { items: [] } };
      },
    };
  });
  await page.route('https://notify.invalid/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const file = path.startsWith('/assets/') ? resolve('dist/web' + path) : resolve('dist/web/index.html');
    await route.fulfill({ body: readFileSync(file), contentType: path.endsWith('.js') ? 'application/javascript' :
      path.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('https://notify.invalid/');
  await page.getByRole('link', { name: 'Add reminder' }).click();
  await page.getByLabel('Title').fill('보존할 입력');
  await page.getByLabel('Scheduled time').fill('2032-11-20T12:00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Manage this device’s location capacity' }).tap();
  await page.getByRole('button', { name: 'Exclude', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Confirm exclusion' }).tap();
  await expect(page.getByLabel('Title')).toHaveValue('보존할 입력');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
});
