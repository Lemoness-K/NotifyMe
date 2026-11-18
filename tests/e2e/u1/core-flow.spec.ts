import { randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
