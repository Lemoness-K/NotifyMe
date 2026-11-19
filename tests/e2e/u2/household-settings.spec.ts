import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { expect, test } from '@playwright/test';

async function freePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('No test port');
  return address.port;
}

function checked(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawnSync(command, args, { env, encoding: 'utf8' });
  if (child.status !== 0) throw new Error(command + ' failed: ' + (child.stderr ?? '').slice(0, 250));
}

test('joins a household, shares a saved display preference and revokes the member’s access', async ({ page, browser }) => {
  test.setTimeout(80_000);
  const port = await freePort();
  const origin = 'https://127.0.0.1:' + port;
  const dir = mkdtempSync(join(process.cwd(), '.u1-db-'));
  const env = { ...process.env, NOTIFY_MODE: 'local', NOTIFY_SYNTHETIC_AUTH: '1',
    NOTIFY_SYNTHETIC_KEY: randomBytes(32).toString('hex'), NOTIFY_PORT: String(port),
    NOTIFY_ORIGIN: origin, NOTIFY_DATABASE_PATH: join(dir, 'app.db'),
    DATABASE_URL: 'file:' + join(dir, 'app.db'), NOTIFY_HOST: '127.0.0.1',
    NOTIFY_TLS_KEY_FILE: join(dir, 'key.pem'), NOTIFY_TLS_CERT_FILE: join(dir, 'cert.pem'),
  };
  let server: ChildProcess | undefined;
  try {
    checked('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', env.NOTIFY_TLS_KEY_FILE,
      '-out', env.NOTIFY_TLS_CERT_FILE, '-days', '1', '-subj', '/CN=localhost'], env);
    checked(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
    checked(process.execPath, ['dist/server/bootstrap-admin.js', '--synthetic'], env);
    server = spawn(process.execPath, ['dist/server/main.js'], { env, stdio: 'ignore' });
    let listening = false;
    for (let i = 0; i < 30 && !listening; ++i) {
      if (server.exitCode !== null) throw new Error('U2 server stopped');
      listening = await page.request.get(origin + '/api/v1/client-config', { timeout: 400 })
        .then((response) => response.ok(), () => false);
      if (!listening) await wait(300);
    }
    expect(listening).toBe(true);
    await page.setViewportSize({ width: 340, height: 740 });
    await page.goto(origin);
    await page.getByRole('button', { name: '테스트 계정으로 로그인' }).click();
    await page.getByRole('link', { name: '설정', exact: true }).click();
    await page.getByRole('link', { name: '초대 관리' }).click();
    await page.getByLabel('초대할 Google 이메일').fill('member@example.test');
    await page.getByRole('button', { name: '초대 발급' }).press('Enter');
    const link = page.getByLabel('공유할 초대 링크');
    await expect(link).toBeVisible();
    const inviteUrl = await link.inputValue();
    expect(new URL(inviteUrl).hash).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(340);

    const guest = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true });
    const member = await guest.newPage();
    try {
      await member.goto(inviteUrl);
      await expect(member.getByRole('heading', { name: '가구 초대 수락' })).toBeVisible();
      await expect.poll(() => new URL(member.url()).hash).toBe('');
      await expect(page.getByText(/활성 · 만료/)).toBeVisible();
      await member.getByRole('button', { name: '테스트 계정으로 초대 수락' }).click();
      await expect(member.getByRole('heading', { name: '리마인더' })).toBeVisible();
      await member.getByRole('link', { name: '설정', exact: true }).click();
      await expect(member.getByRole('link', { name: '초대 관리' })).toHaveCount(0);

      await page.getByRole('navigation').getByRole('link', { name: '설정', exact: true }).click();
      await page.getByRole('link', { name: '개인 설정' }).click();
      await page.getByLabel('표시 언어').selectOption('en-US');
      await page.getByLabel('표시 시간대').fill('UTC');
      await page.getByRole('button', { name: '저장' }).click();
      await expect(page.getByRole('heading', { name: 'Personal settings' })).toBeVisible();
      const other = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true });
      try {
        const replica = await other.newPage();
        await replica.goto(origin);
        await replica.getByRole('button', { name: '테스트 계정으로 로그인' }).click();
        await expect(replica.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
        await replica.getByRole('link', { name: 'Settings', exact: true }).click();
        await replica.getByRole('link', { name: 'Personal settings' }).click();
        await expect(replica.getByLabel('Display time zone')).toHaveValue('UTC');
      } finally {
        await other.close();
      }

      await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
      await page.getByRole('link', { name: 'Manage members' }).click();
      const row = page.locator('.management-list li').filter({ hasText: ' · Member' });
      await expect(row).toHaveCount(1);
      await row.getByRole('button', { name: /Remove$/ }).click();
      await page.getByRole('button', { name: 'Confirm removal' }).click();
      await expect(row).toHaveCount(0);
      await member.getByRole('link', { name: '리마인더', exact: true }).click();
      await expect(member.getByRole('alert')).toContainText('참여 중인 가구가 없습니다.');
      await expect(member.getByRole('link', { name: '설정', exact: true })).toBeVisible();
    } finally {
      await guest.close();
    }
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, 'exit');
      server.kill();
      await stopped;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
