import { randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('No listening port');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return addr.port;
}

function checked(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawnSync(command, args, { env, encoding: 'utf8' });
  if (child.status !== 0) throw new Error(command + ' failed: ' + (child.stderr ?? '').slice(0, 250));
}

test('creates a time reminder over HTTPS and reads the same SQLite data after process restart', async ({ page }) => {
  test.setTimeout(75_000);
  const dir = mkdtempSync(join(process.cwd(), '.u1-db-'));
  const port = await freePort();
  const origin = 'https://127.0.0.1:' + port;
  const env = { ...process.env, NOTIFY_MODE: 'local', NOTIFY_SYNTHETIC_AUTH: '1',
    NOTIFY_SYNTHETIC_KEY: randomBytes(32).toString('hex'), NOTIFY_PORT: String(port),
    NOTIFY_ORIGIN: origin, NOTIFY_DATABASE_PATH: join(dir, 'app.db'),
    DATABASE_URL: 'file:' + join(dir, 'app.db'), NOTIFY_HOST: '127.0.0.1',
    NOTIFY_TLS_KEY_FILE: join(dir, 'key.pem'), NOTIFY_TLS_CERT_FILE: join(dir, 'cert.pem'),
  };
  let server: ChildProcess | undefined;
  async function stop() {
    if (server && server.exitCode === null) {
      const exited = new Promise<void>((resolve) => server!.once('exit', () => resolve()));
      server.kill();
      await exited;
    }
  }
  async function start() {
    server = spawn(process.execPath, ['dist/server/main.js'], { env, stdio: 'ignore' });
    for (let tries = 0; tries < 30; tries++) {
      if (server.exitCode !== null) throw new Error('U1 server failed to start');
      try {
        const response = await page.request.get(origin + '/api/v1/client-config', { timeout: 400 });
        if (response.ok()) return;
      }
      catch { await wait(300); }
    }
    throw new Error('U1 server unavailable');
  }
  try {
    checked('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', env.NOTIFY_TLS_KEY_FILE,
      '-out', env.NOTIFY_TLS_CERT_FILE, '-days', '1', '-subj', '/CN=localhost'], env);
    checked(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
    checked(process.execPath, ['dist/server/bootstrap-admin.js', '--synthetic'], env);
    await start();
    await page.setViewportSize({ width: 340, height: 720 });
    await page.goto(origin);
    await page.getByRole('button', { name: '테스트 계정으로 로그인' }).click({ timeout: 8_000 });
    await page.getByRole('link', { name: '리마인더 추가' }).click();
    await page.getByLabel('제목').fill('테스트 업무');
    await page.getByLabel('설명').fill('  원문을 보존합니다  ');
    await page.getByRole('button', { name: '저장' }).press('Enter');
    await expect(page.getByRole('alert')).toContainText('유효한 예약 시각');
    await expect(page.getByLabel('제목')).toHaveValue('테스트 업무');
    await expect(page.getByLabel('설명')).toHaveValue('  원문을 보존합니다  ');
    await expect(page.getByLabel('예약 시각')).toBeFocused();
    await page.getByLabel('예약 시각').fill('2032-10-24T12:00');
    await page.getByRole('button', { name: '저장' }).press('Enter');
    await expect(page.getByText('테스트 업무')).toBeVisible();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 720 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    expect(await page.getByText('원문을 보존합니다').textContent()).toBe('  원문을 보존합니다  ');
    await stop();
    await start();
    await page.goto(origin);
    await page.getByRole('button', { name: '테스트 계정으로 로그인' }).click();
    await expect(page.getByText('테스트 업무')).toBeVisible();
    await page.getByRole('button', { name: '로그아웃' }).tap();
    await expect(page.getByText('테스트 업무')).toHaveCount(0);
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sets up a fresh household in the mobile browser and saves a reminder as the new administrator', async ({ page }) => {
  test.setTimeout(90_000);
  const directory = mkdtempSync(join(process.cwd(), '.u1-db-setup-'));
  const state = join(directory, 'state');
  const archives = join(directory, 'archives');
  const volume = join(directory, 'volume');
  const port = await freePort();
  const origin = 'https://127.0.0.1:' + port;
  for (const path of [state, archives, volume]) mkdirSync(path, { mode: 0o700 });
  writeFileSync(join(volume, 'notify-me-volume'), 'synthetic-setup-volume', { mode: 0o600 });
  const archiveKey = join(directory, 'archive-key');
  const authorityKey = join(directory, 'authority-key');
  for (const key of [archiveKey, authorityKey]) writeFileSync(key, randomBytes(32).toString('base64url'), { mode: 0o600 });
  const env = {
    PATH: process.env.PATH,
    NOTIFY_MODE: 'local', NOTIFY_SYNTHETIC_AUTH: '1', NOTIFY_SYNTHETIC_KEY: randomBytes(32).toString('hex'),
    NOTIFY_SETUP_INGRESS: 'tailnet-operator-only', NOTIFY_PORT: String(port), NOTIFY_ORIGIN: origin,
    NOTIFY_DATABASE_PATH: join(state, 'notify.sqlite'), NOTIFY_DELETE_JOURNAL_PATH: join(state, 'delete-journal.sqlite'),
    NOTIFY_TLS_KEY_FILE: join(directory, 'tls-key.pem'), NOTIFY_TLS_CERT_FILE: join(directory, 'tls-cert.pem'),
    NOTIFY_OPS_STATE_DIRECTORY: state, NOTIFY_OPS_ARCHIVES: archives, NOTIFY_OPS_AUTHORITY_MOUNT: volume,
    NOTIFY_OPS_VOLUME_ID: 'synthetic-setup-volume', NOTIFY_OPS_KEY_FILE: archiveKey, NOTIFY_OPS_AUTHORITY_KEY_FILE: authorityKey,
  };
  let server: ChildProcess | undefined;
  try {
    checked('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', env.NOTIFY_TLS_KEY_FILE,
      '-out', env.NOTIFY_TLS_CERT_FILE, '-days', '1', '-subj', '/CN=localhost'], env);
    checked(process.execPath, ['dist/server/operations-cli.js', 'prepare-new-installation'], env);
    server = spawn(process.execPath, ['dist/server/main.js'], { env, stdio: 'ignore' });
    await expect.poll(async () => {
      if (server?.exitCode !== null) throw new Error('Managed setup server failed to start');
      try { return (await page.request.get(origin + '/api/v1/client-config', { timeout: 1000 })).ok(); }
      catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(origin);
    const login = page.getByRole('button', { name: '테스트 계정으로 로그인' });
    const start = page.getByRole('button', { name: '설정 시작' });

    await login.tap();
    await expect(page.getByText('admin@example.test')).toBeVisible();
    await expect(page.getByText('이 계정이 Notify Me의 최초 관리자가 됩니다. 가구를 만들고 구성원을 초대할 수 있습니다.')).toBeVisible();
    await page.getByRole('button', { name: '취소', exact: true }).tap();
    await expect(login).toBeVisible();

    await login.tap();
    await expect(start).toBeVisible();
    await page.reload();
    await expect(page.getByText(/같은 Google 계정으로 다시 로그인/)).toBeVisible();
    await expect(page.getByText('admin@example.test')).toHaveCount(0);
    await login.tap();
    await expect(start).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(origin + '/reminders');
    await page.getByRole('link', { name: '리마인더 추가' }).tap();
    await page.getByLabel('제목').fill('최초 설정 테스트 업무');
    await page.getByLabel('예약 시각').fill('2032-10-29T11:00');
    await page.getByRole('button', { name: '저장', exact: true }).tap();
    await expect(page.getByText('최초 설정 테스트 업무')).toBeVisible();
    await page.reload();
    await login.tap();
    await expect(page.getByText('최초 설정 테스트 업무')).toBeVisible();
    await expect(start).toHaveCount(0);
  } finally {
    if (server && server.exitCode === null) {
      const stopped = new Promise<void>((done) => server!.once('exit', () => done()));
      server.kill();
      await stopped;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
