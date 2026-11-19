import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { AppError } from './errors.js';
import type { HouseholdRepository } from './households.js';
import type { WorkService } from './work-service.js';

export type HouseholdConfig = {
  inviteIpPerMinute: number;
  inviteIdentityPerMinute: number;
  administrationPerMinute: number;
  cleanupIntervalMs: number;
};
export const householdRuntimeDefaults: HouseholdConfig = {
  inviteIpPerMinute: 30,
  inviteIdentityPerMinute: 10,
  administrationPerMinute: 20,
  cleanupIntervalMs: 300_000,
};

export function requestSource(request: Request, trustedProxy: boolean) {
  const direct = request.socket.remoteAddress;
  if (trustedProxy && (direct === '127.0.0.1' || direct === '::1' || direct === '::ffff:127.0.0.1')) {
    const address = request.get('x-notify-client-ip');
    if (address && isIP(address)) return address;
  }
  return direct ?? 'unknown';
}

export class HouseholdRateLimit {
  private readonly buckets = new Map<string, { expiresAt: number; count: number }>();
  private lastCleanup = 0;

  constructor(private readonly clock: () => number = () => performance.now()) {}

  check(key: string, limit: number) {
    const now = this.clock();
    if (now - this.lastCleanup >= 60_000 || now < this.lastCleanup) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.expiresAt <= now || now < this.lastCleanup) this.buckets.delete(key);
      }
      this.lastCleanup = now;
    }
    const bucket = this.buckets.get(key);
    if (bucket && bucket.expiresAt > now) {
      if (bucket.count >= limit) {
        throw new AppError(429, 'RATE_LIMITED', undefined, Math.ceil((bucket.expiresAt - now) / 1000));
      }
      bucket.count++;
    } else {
      if (!bucket && this.buckets.size >= 4096) throw new AppError(429, 'RATE_LIMITED', undefined, 60);
      this.buckets.set(key, { expiresAt: now + 60_000, count: 1 });
    }
  }
}

export function startInviteCleanup(
  repo: HouseholdRepository, intervalMs: number, log: (record: Record<string, number | string>) => void,
) {
  let running: Promise<void> | undefined;
  let stopped = false;
  async function clean() {
    const runId = randomUUID();
    const started = performance.now();
    let count = 0;
    let oldestDelayMs = 0;
    try {
      while (!stopped) {
        const result = await repo.cleanExpiredInvitations();
        count += result.count;
        oldestDelayMs = Math.max(oldestDelayMs, result.oldestDelayMs);
        if (result.count < 100) break;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      log({ event: oldestDelayMs > intervalMs * 2 ? 'INVITATION_CLEANUP_DELAY' : 'INVITATION_CLEANUP',
        runId, count, oldestDelayMs, durationMs: Math.round(performance.now() - started) });
    } catch {
      log({ event: 'INVITATION_CLEANUP_FAILED', runId, count, durationMs: Math.round(performance.now() - started) });
    }
  }
  function run() {
    if (!running) running = clean().finally(() => { running = undefined; });
  }
  const timer = setInterval(run, intervalMs);
  timer.unref();
  run();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}

export function startWorkMaintenance(work: WorkService, intervalMs: number) {
  let running: Promise<void> | undefined;
  let stopped = false;
  async function run() {
    const runId = randomUUID();
    const started = performance.now();
    let count = 0;
    let after = '';
    try {
      while (!stopped) {
        const rows = await work.db.reminder.findMany({
          where: { id: { gt: after }, lifecycle: 'ACTIVE', pausedAt: null, recurrenceRules: { some: { effectiveTo: null } } },
          select: { id: true, householdId: true }, orderBy: { id: 'asc' }, take: 100,
        });
        for (const row of rows) {
          if (stopped) break;
          try { await work.advance(row.householdId, row.id); count++; }
          catch { work.log?.({ event: 'RECURRENCE_ADVANCE_FAILED', runId }); }
        }
        if (rows.length < 100) break;
        after = rows[rows.length - 1].id;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      if (!stopped) {
        const now = work.clock();
        await work.db.reminderFeedEntry.deleteMany({ where: { expiresAt: { lte: now } } });
        if (work.journal) {
          const reconciled = await work.reconcileCommittedDeletes();
          const unsettled = work.journal.unsettled(now);
          const pruned = work.journal.prune(now);
          if (unsettled.count) work.log?.({ event: 'DELETE_EVIDENCE_PENDING', runId, ...unsettled });
          if (pruned.count) work.log?.({ event: 'DELETE_EVIDENCE_RETENTION_ADVANCED', runId, ...pruned });
          if (reconciled) work.log?.({ event: 'DELETE_EVIDENCE_RECONCILED', runId, count: reconciled });
        }
      }
      work.log?.({ event: 'WORK_MAINTENANCE', runId, count, durationMs: Math.round(performance.now() - started) });
    } catch {
      work.log?.({ event: 'WORK_MAINTENANCE_FAILED', runId, count });
    }
  }
  function tick() {
    if (!running) running = run().finally(() => { running = undefined; });
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
