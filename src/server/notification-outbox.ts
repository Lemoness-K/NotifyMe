import { randomUUID } from 'node:crypto';
import type { Messaging } from 'firebase-admin/messaging';
import type { Prisma, PrismaClient } from './generated/client.js';
import { wireScope } from './installation-plans.js';
import { recoverToken } from './installations.js';

type Delivery = 'SENT' | 'TRANSIENT' | 'INVALID_TOKEN' | 'PERMANENT';

export interface SignalSender {
  send(token: string, data: Readonly<Record<string, string>>, ttlMs: number): Promise<Delivery>;
}

export function firebaseSignalSender(messaging: Pick<Messaging, 'send'>): SignalSender {
  return {
    async send(token, data, ttlMs) {
      try {
        await messaging.send({ token, data, android: { ttl: ttlMs } });
        return 'SENT';
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') return 'INVALID_TOKEN';
        if (code === 'messaging/mismatched-credential' || code === 'messaging/invalid-argument') return 'PERMANENT';
        return 'TRANSIENT';
      }
    },
  };
}

export function startSignalDelivery(db: PrismaClient, sender: SignalSender, key: Buffer, generation: string,
  log?: (event: Record<string, unknown>) => void, clock?: () => Date) {
  let running: Promise<void> | undefined;
  const tick = () => {
    if (running) return;
    running = runSignalBatch(db, sender, key, generation, clock)
      .catch(() => { log?.({ code: 'DEVICE_SIGNAL_DELIVERY_UNAVAILABLE' }); })
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, 5_000);
  timer.unref();
  tick();
  return async () => { clearInterval(timer); await running; };
}

const batchSize = 25;
const leaseMs = 60_000;
const maximumDelayMs = 60 * 60_000;

function available(now: Date): Prisma.DeviceSignalWhereInput {
  return { expiresAt: { gt: now }, OR: [
    { state: 'PENDING', readyAt: { lte: now } },
    { state: 'LEASED', leaseUntil: { lte: now } },
  ] };
}

export async function runSignalBatch(
  db: PrismaClient,
  sender: SignalSender,
  tokenKey: Buffer,
  generation: string,
  clock: () => Date = () => new Date(),
) {
  const start = clock();
  await db.deviceSignal.updateMany({
    where: { state: { in: ['PENDING', 'LEASED'] }, expiresAt: { lte: start } },
    data: { state: 'EXPIRED', leaseUntil: null, leaseToken: null },
  });
  const candidates = await db.deviceSignal.findMany({
    where: available(start), select: { id: true },
    orderBy: [{ readyAt: 'asc' }, { id: 'asc' }], take: batchSize,
  });

  for (const { id } of candidates) {
    const claimedAt = clock();
    const leaseToken = randomUUID();
    const claim = await db.deviceSignal.updateMany({
      where: { id, ...available(claimedAt) },
      data: { state: 'LEASED', leaseToken, leaseUntil: new Date(claimedAt.getTime() + leaseMs), attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;

    const identity = { id, state: 'LEASED', leaseToken };
    const signal = await db.deviceSignal.findFirst({
      where: identity, include: { scope: { include: { installation: true } } },
    });
    if (!signal) continue;
    const { scope, expiresAt, type, revision } = signal;
    const { installation } = scope;
    let result: Delivery = 'PERMANENT';
    const sendingAt = clock();
    const ttl = expiresAt.getTime() - sendingAt.getTime();
    if (ttl > 0 && installation.active && installation.tokenCiphertext &&
        ((type === 'reminder.changed' && scope.state !== 'REVOKED') ||
         (type === 'household.access_revoked' && scope.state === 'REVOKED'))) {
      let providerToken: string | undefined;
      try { providerToken = recoverToken(tokenKey, installation.id, installation.tokenCiphertext); }
      catch { /* Unreadable credentials cannot be sent. */ }
      if (providerToken) {
        try {
          result = await sender.send(providerToken, {
            schemaVersion: '1', eventId: id, eventType: type,
            scopeRef: wireScope(scope, generation).scopeRef,
            householdRevision: String(revision), expiresAt: expiresAt.toISOString(),
          }, ttl);
        } catch {
          result = 'TRANSIENT';
        }
      }
    }

    const completedAt = clock();
    const nextDelay = Math.min(maximumDelayMs, 30_000 * (2 ** Math.min(10, signal.attempts - 1)));
    const nextAttempt = new Date(Math.min(expiresAt.getTime(), completedAt.getTime() + nextDelay));
    const state = result === 'SENT' ? 'SENT'
      : ttl <= 0 || completedAt >= expiresAt ? 'EXPIRED'
        : result === 'TRANSIENT' ? 'PENDING' : 'FAILED';
    await db.$transaction(async (tx) => {
      const finished = await tx.deviceSignal.updateMany({
        where: identity,
        data: { state, leaseUntil: null, leaseToken: null, ...(state === 'PENDING' ? { readyAt: nextAttempt } : {}) },
      });
      if (finished.count && result === 'INVALID_TOKEN') {
        await tx.installation.updateMany({
          where: { id: installation.id, tokenCiphertext: installation.tokenCiphertext },
          data: { tokenCiphertext: null },
        });
      }
    });
  }
}
