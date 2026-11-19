import { randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, locale: 'en-US' });

test('edits, completes, archives and permanently deletes a reminder from responsive web', async ({ page }) => {
  test.setTimeout(90_000);
  const dir = mkdtempSync(join(process.cwd(), '.u1-db-'));
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (address === null || typeof address === 'string') throw new Error('No local port');
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const origin = 'https://127.0.0.1:' + address.port;
  const db = join(dir, 'app.db');
  const keyFile = join(dir, 'key.pem');
  const certFile = join(dir, 'cert.pem');
  const env = { ...process.env, NOTIFY_MODE: 'local', NOTIFY_SYNTHETIC_AUTH: '1',
    NOTIFY_SYNTHETIC_KEY: randomBytes(32).toString('hex'), NOTIFY_PORT: String(address.port), NOTIFY_ORIGIN: origin,
    NOTIFY_DATABASE_PATH: db, DATABASE_URL: 'file:' + db, NOTIFY_TLS_KEY_FILE: keyFile, NOTIFY_TLS_CERT_FILE: certFile };
  function command(cmd: string, args: string[]) {
    const result = spawnSync(cmd, args, { env, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(cmd + ' failed: ' + result.stderr.slice(0, 400));
  }
  let server: ChildProcess | undefined;
  try {
    command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost']);
    command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
    command(process.execPath, ['dist/server/bootstrap-admin.js', '--synthetic']);
    server = spawn(process.execPath, ['dist/server/main.js'], { env, stdio: 'ignore' });
    for (let tries = 0; tries < 30; tries++) {
      if (server.exitCode !== null) throw new Error('App failed to start');
      if (await page.request.get(origin + '/api/v1/client-config', { timeout: 400 }).then((res) => res.ok(), () => false)) break;
      await wait(250);
    }
    await page.setViewportSize({ width: 340, height: 700 });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Sign in with test account' }).click();
    await page.getByRole('link', { name: 'Add reminder' }).click();
    await page.getByLabel('Title').fill('  원문  ');
    await page.getByLabel('Scheduled time').fill('2032-02-01T12:00');
    await page.getByRole('button', { name: 'Save' }).press('Enter');
    await page.getByRole('link', { name: '원문' }).tap();
    await page.getByRole('link', { name: 'Edit reminder' }).click();
    await page.getByLabel('Title').fill('Updated reminder');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Complete', exact: true }).click();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page.getByText('This reminder cannot be recovered in the app.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm permanent deletion' }).tap();
    await expect(page.getByText('Updated reminder')).toHaveCount(0);
    for (const width of [320, 420, 850]) {
      await page.setViewportSize({ width, height: 730 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  } finally {
    if (server && server.exitCode === null) {
      const done = new Promise<void>((resolve) => server!.once('exit', () => resolve()));
      server.kill();
      await done;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
