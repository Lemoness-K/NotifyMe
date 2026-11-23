import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, stat, rm, readFile } from 'node:fs/promises';
import { arch, platform, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { createApp } = await import(pathToFileURL(resolve('dist/server/http.js')));
const { openStore } = await import(pathToFileURL(resolve('dist/server/storage.js')));
const origin = 'https://notify.invalid';
const records = 100;
const warmupCount = 24;
const sampleCount = 240;
const concurrencyLevels = [1, 4, 8];
const now = new Date('2032-01-01T00:00:00Z');
const directory = await mkdtemp(join(process.cwd(), '.u1-db-performance-'));
const dbPath = join(directory, 'app.db');

function percentile(sorted, fraction) {
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

async function sample(url, headers, concurrency, count) {
  const valid = [];
  const statuses = {};
  let transportErrors = 0;
  let rssPeak = process.memoryUsage.rss();
  const recordRss = () => { rssPeak = Math.max(rssPeak, process.memoryUsage.rss()); };
  const timer = setInterval(recordRss, 20);
  const start = performance.now();
  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      for (let i = 0; i < count / concurrency; i++) {
        const requestStart = performance.now();
        try {
          const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
          await response.arrayBuffer();
          statuses[response.status] = (statuses[response.status] ?? 0) + 1;
          if (response.status === 200) valid.push(performance.now() - requestStart);
        } catch {
          transportErrors++;
        }
      }
    }));
  } finally {
    clearInterval(timer);
    recordRss();
  }
  const seconds = (performance.now() - start) / 1000;
  valid.sort((a, b) => a - b);
  const rounded = (value) => value === null ? null : Number(value.toFixed(2));
  return {
    concurrency, count, statuses, transportErrors,
    seconds: rounded(seconds),
    successfulPerSecond: rounded(valid.length / seconds),
    p50Ms: rounded(percentile(valid, 0.50)),
    p95Ms: rounded(percentile(valid, 0.95)),
    p99Ms: rounded(percentile(valid, 0.99)),
    rssPeakMiB: rounded(rssPeak / 2 ** 20),
  };
}

const subject = 'synthetic-member';
const issuer = 'notify-performance-test';
const secret = randomBytes(32).toString('base64url');
const headers = {
  Origin: origin,
  'Content-Type': 'application/json',
  Cookie: '__Host-notify-session=' + secret,
  Authorization: 'Bearer synthetic',
};

let app;
let db;
try {
  db = await openStore(dbPath, { migrate: true });
  await db.household.create({ data: { id: 'home' } });
  for (const [id, role] of [['member', 'ADMIN'], ['second', 'MEMBER'], ['third', 'MEMBER'], ['fourth', 'MEMBER']]) {
    await db.user.create({ data: { id, displayName: id } });
    await db.membership.create({ data: { householdId: 'home', userId: id, role } });
  }
  await db.authIdentity.create({ data: { issuer, subject, userId: 'member' } });
  await db.session.create({ data: {
    digest: createHash('sha256').update(secret).digest('hex'),
    userId: 'member', issuer, subject, authTime: 1,
    expiresAt: new Date('2032-01-31T00:00:00Z'),
  } });
  app = await createApp({
    db, origin, clock: () => now,
    provider: {
      verifyFirebase: async (token) => {
        assert.equal(token, 'synthetic');
        return { issuer, subject, googleSubject: subject, authTime: 1 };
      },
      verifyGoogle: async () => { throw new Error('Login is not part of the probe'); },
    },
  });
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1/households/home';
  let detailId;
  for (let i = 0; i < records; i++) {
    const response = await fetch(base + '/reminders', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'perf-' + i },
      body: JSON.stringify({
        title: 'Synthetic reminder ' + i,
        trigger: { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'Asia/Seoul' },
      }),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 201, 'Preparing synthetic reminders');
    detailId = (await response.json()).reminderId;
  }
  assert.equal(await db.reminder.count(), records);
  assert.equal(typeof detailId, 'string');
  const routes = {
    reminderList: '/reminders',
    members: '/members',
    reminderDetail: '/reminders/' + detailId,
  };
  const results = [];
  for (const [route, endpoint] of Object.entries(routes)) {
    for (const concurrency of concurrencyLevels) {
      const warmup = await sample(base + endpoint, headers, concurrency, warmupCount);
      assert.equal(warmup.statuses[200], warmupCount, 'Warmup ' + route);
      results.push({ route, ...await sample(base + endpoint, headers, concurrency, sampleCount) });
    }
  }
  const board = await readFile('/proc/device-tree/model', 'utf8').catch(() => 'unknown');
  console.log(JSON.stringify({
    board: board.replaceAll(String.fromCharCode(0), ''),
    platform: platform(), arch: arch(), node: process.version, memoryMiB: totalmem() / 2 ** 20,
    records, householdMembers: 4, warmupCount, sampleCount, sqliteFileBytes: (await stat(dbPath)).size, results,
  }, null, 2));
  if (results.some((result) => result.statuses[200] !== sampleCount)) process.exitCode = 1;
} finally {
  try {
    await app?.close();
  } finally {
    try {
      await db?.$disconnect();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
