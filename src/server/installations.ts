import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { InstallationScope, PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';
import { applyCandidates, enqueueSignal, eventLifetimeMs, locationCapacity, readPublishedPlan, revisePlans,
  seedPlans, wireScope, type Plan, type Tx } from './installation-plans.js';
import { prismaCode } from './repository.js';
import type { InstallationPlanParticipant, PlanCandidate } from './work-scheduling.js';

export interface Registration { installationId: string; appVersion: string; pushToken?: string }
export interface LocationReport {
  epoch: string; eventId: string; occurrenceId: string; triggerVersion: number; condition: string; detectedAt: Date;
}
type InstallationResponse = { installationId: string; revision: number };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const denied = () => new AppError(403, 'INSTALLATION_ACCESS_DENIED');
const stale = () => new AppError(409, 'STALE_REVISION');

function protectToken(key: Buffer, installationId: string, token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(installationId));
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function recoverToken(key: Buffer, installationId: string, value: string) {
  const raw = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  cipher.setAAD(Buffer.from(installationId));
  cipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8');
}

async function command<T>(tx: Tx, scope: string, key: string, input: unknown, now: Date, write: () => Promise<T>): Promise<T> {
  const compound = { scope, key };
  const hash = digest(input);
  const old = await tx.installationCommand.findUnique({ where: { scope_key: compound } });
  if (old) {
    if (old.digest !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
    return JSON.parse(old.result) as T;
  }
  const result = await write();
  await tx.installationCommand.create({ data: { ...compound, digest: hash, result: JSON.stringify(result),
    expiresAt: new Date(now.getTime() + eventLifetimeMs) } });
  return result;
}

export class InstallationRepository implements InstallationPlanParticipant {
  constructor(private readonly db: PrismaClient, private readonly clock = () => new Date(),
    private readonly tokenKey?: Buffer, readonly generation = '') {}

  private async transact<T>(action: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(action); }
      catch (error) {
        const busy = prismaCode(error) === 'P2034' || error instanceof Error && error.message.includes('SQLITE_BUSY');
        if (!busy) throw error;
        if (attempt === 2) throw new AppError(503, 'STORAGE_UNAVAILABLE');
        await new Promise((resume) => setTimeout(resume, (attempt + 1) * 10));
      }
    }
  }

  private async scope(tx: Tx, householdId: string, installationId: string, userId: string) {
    const device = await tx.installation.findFirst({ where: { id: installationId, userId, active: true } });
    if (!device) throw denied();
    const scope = await tx.installationScope.findUnique({ where: {
      installationId_householdId: { installationId, householdId },
    } });
    const member = await tx.membership.findFirst({ where: { householdId, userId, active: true, user: { active: true } } });
    if (scope?.state === 'REVOKED' || scope && !member) throw new AppError(403, 'HOUSEHOLD_ACCESS_REVOKED');
    if (!scope || !member) throw new AppError(403, 'HOUSEHOLD_ACCESS_DENIED');
    return scope;
  }

  register(userId: string, sessionDigest: string | undefined, key: string, input: Registration): Promise<InstallationResponse> {
    return this.transact(async (tx) => {
      const now = this.clock();
      if (sessionDigest !== undefined && !await tx.session.findFirst({
        where: { digest: sessionDigest, userId, endedAt: null, expiresAt: { gt: now } }, select: { digest: true },
      })) throw new AppError(401, 'UNAUTHENTICATED');
      const old = await tx.installation.findUnique({ where: { id: input.installationId } });
      if (old && old.userId !== userId) throw denied();
      return command(tx, JSON.stringify(['register', userId, input.installationId, sessionDigest]), key, input, now, async () => {
        if (input.pushToken && !this.tokenKey) throw new AppError(503, 'PUSH_UNAVAILABLE');
        const tokenCiphertext = input.pushToken && this.tokenKey ?
          protectToken(this.tokenKey, input.installationId, input.pushToken) : undefined;
        const data = { appVersion: input.appVersion, sessionDigest, tokenCiphertext, active: true };
        const installation = await tx.installation.upsert({ where: { id: input.installationId },
          update: { ...data, revision: { increment: 1 } },
          create: { ...data, id: input.installationId, userId, createdAt: now } });
        const memberships = await tx.membership.findMany({ where: { userId, active: true, user: { active: true } },
          select: { householdId: true } });
        for (const { householdId } of memberships) {
          const scope = await tx.installationScope.findUnique({ where: {
            installationId_householdId: { installationId: installation.id, householdId },
          } });
          if (scope && scope.state !== 'REVOKED' && old?.active) continue;
          const exclusions = scope && scope.state !== 'REVOKED' ?
            await tx.locationExclusion.findMany({ where: { scopeId: scope.id }, select: { reminderId: true } }) : [];
          if (scope) await tx.installationScope.delete({ where: { id: scope.id } });
          const created = await tx.installationScope.create({ data: {
            id: randomUUID(), installationId: installation.id, householdId, epoch: randomUUID(),
          } });
          if (exclusions.length) await tx.locationExclusion.createMany({ data: exclusions.map((it) => ({ ...it, scopeId: created.id })) });
          await seedPlans(tx, created, userId, now);
        }
        return { installationId: installation.id, revision: installation.revision };
      });
    });
  }

  async logout(sessionDigest: string) {
    await this.transact((tx) => this.endSession(tx, sessionDigest));
  }

  async endSession(tx: Tx, sessionDigest: string) {
    await tx.installation.updateMany({ where: { sessionDigest }, data: { active: false, tokenCiphertext: null } });
  }

  async prune() {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - eventLifetimeMs);
    await this.transact(async (tx) => {
      // Keep the cursor floor and its removed plans in the same commit.
      const expired = await tx.devicePlan.findMany({ where: { removedAt: { lte: cutoff } },
        select: { scopeId: true, id: true, revision: true }, orderBy: [{ removedAt: 'asc' }, { id: 'asc' }], take: 100 });
      const floors = new Map<string, number>();
      for (const { scopeId, id, revision } of expired) {
        floors.set(scopeId, Math.max(floors.get(scopeId) ?? 0, revision));
        await tx.devicePlan.delete({ where: { scopeId_id: { scopeId, id } } });
      }
      for (const [id, retainedFrom] of floors) {
        await tx.installationScope.updateMany({ where: { id, retainedFrom: { lt: retainedFrom } }, data: { retainedFrom } });
      }
      await tx.locationEvent.deleteMany({ where: { detectedAt: { lte: cutoff } }, limit: 100 });
      await tx.installationCommand.deleteMany({ where: { expiresAt: { lte: now } }, limit: 100 });
      await tx.deviceSignal.deleteMany({ where: { expiresAt: { lte: cutoff } }, limit: 100 });
    });
  }

  async targets(tx: Tx, householdId: string, userIds: readonly string[]) {
    const rows = await tx.installationScope.findMany({ where: {
      householdId, state: { not: 'REVOKED' }, installation: { active: true, userId: { in: [...userIds] },
        user: { active: true, memberships: { some: { householdId, active: true } } } },
    }, select: { installationId: true } });
    return rows.map((scope) => scope.installationId);
  }

  async validateAndStore(tx: Tx, householdId: string, candidates: readonly PlanCandidate[]) {
    const byDevice = new Map<string, PlanCandidate[]>();
    for (const candidate of candidates) {
      const group = byDevice.get(candidate.installationId);
      if (group) group.push(candidate);
      else byDevice.set(candidate.installationId, [candidate]);
    }
    const now = this.clock();
    for (const [installationId, changes] of byDevice) {
      const scope = await tx.installationScope.findUnique({ where: { installationId_householdId: { installationId, householdId } } });
      if (scope && scope.state !== 'REVOKED') await applyCandidates(tx, scope, changes, now);
    }
  }

  async revoke(tx: Tx, householdId: string, userId: string, now: Date) {
    const scopes = await tx.installationScope.findMany({ where: {
      householdId, state: { not: 'REVOKED' }, installation: { userId },
    } });
    for (const scope of scopes) {
      const revision = scope.revision + 1;
      await tx.installationScope.update({ where: { id: scope.id }, data: { state: 'REVOKED', revision, locationCount: 0 } });
      await tx.devicePlan.deleteMany({ where: { scopeId: scope.id } });
      await tx.locationExclusion.deleteMany({ where: { scopeId: scope.id } });
      await tx.locationEvent.deleteMany({ where: { scopeId: scope.id } });
      await tx.deviceSignal.deleteMany({ where: { scopeId: scope.id } });
      await enqueueSignal(tx, scope.id, revision, now, 'household.access_revoked');
    }
  }

  sync(householdId: string, installationId: string, userId: string, afterEpoch?: string, afterRevision?: number) {
    return this.transact(async (tx) => {
      const scope = await this.scope(tx, householdId, installationId, userId);
      const wire = wireScope(scope, this.generation);
      const delta = afterEpoch === wire.epoch && afterRevision !== undefined &&
        afterRevision >= scope.retainedFrom && afterRevision <= scope.revision;
      const rows = await tx.devicePlan.findMany({ where: {
        scopeId: scope.id, ...(delta ? { revision: { gt: afterRevision } } : { visible: true }),
      }, orderBy: { id: 'asc' } });
      const now = this.clock();
      const plans: Plan[] = [];
      const removedPlanIds: string[] = [];
      for (const row of rows) {
        const plan = readPublishedPlan(row, now);
        if (plan) plans.push(plan);
        else if (delta) removedPlanIds.push(row.id);
      }
      return { ...wire, revision: scope.revision, mode: delta ? 'DELTA' as const : 'FULL' as const,
        locationCapacity: locationCapacity(scope), plans, removedPlanIds };
    });
  }

  exclusions(householdId: string, installationId: string, userId: string, query: { limit?: number; cursor?: string } = {}) {
    return this.transact(async (tx) => {
      const scope = await this.scope(tx, householdId, installationId, userId);
      const { epoch } = wireScope(scope, this.generation);
      const cursorScope = [userId, scope.id, epoch, scope.revision];
      let after: string | undefined;
      if (query.cursor) {
        try {
          const [scopeKey, offset] = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as [unknown, unknown];
          if (JSON.stringify(scopeKey) !== JSON.stringify(cursorScope) || typeof offset !== 'string' || !offset) throw stale();
          after = offset;
        } catch {
          throw new AppError(422, 'INVALID_CURSOR');
        }
      }
      const limit = query.limit ?? 25;
      const rows = await tx.devicePlan.groupBy({ by: ['reminderId'], _count: { id: true }, take: limit + 1,
        orderBy: { reminderId: 'asc' }, where: { scopeId: scope.id, kind: 'LOCATION', removedAt: null,
          ...(after ? { reminderId: { gt: after } } : {}) } });
      const page = rows.slice(0, limit);
      const ids = page.map((row) => row.reminderId);
      const reminders = await tx.reminder.findMany({ where: { householdId, id: { in: ids } }, select: { id: true, title: true } });
      const excluded = new Set((await tx.locationExclusion.findMany({ where: { scopeId: scope.id, reminderId: { in: ids } } }))
        .map((row) => row.reminderId));
      const names = new Map(reminders.map((row) => [row.id, row.title]));
      const last = page.at(-1)?.reminderId;
      return { epoch, revision: scope.revision, locationCapacity: locationCapacity(scope),
        items: page.flatMap((row) => {
          const title = names.get(row.reminderId);
          return title === undefined ? [] : [{ reminderId: row.reminderId, title, excluded: excluded.has(row.reminderId), slots: row._count.id }];
        }),
        ...(last && rows.length > limit ? { nextCursor: Buffer.from(JSON.stringify([cursorScope, last])).toString('base64url') } : {}),
      };
    });
  }

  setExclusion(householdId: string, installationId: string, userId: string, reminderId: string, key: string,
    epoch: string, revision: number, excluded: boolean) {
    return this.transact(async (tx) => {
      const scope = await this.scope(tx, householdId, installationId, userId);
      if (wireScope(scope, this.generation).epoch !== epoch) throw stale();
      const now = this.clock();
      await command(tx, JSON.stringify(['exclusion', scope.id, epoch, userId]), key, [reminderId, revision, excluded], now, async () => {
        if (scope.revision !== revision) throw stale();
        const plan = await tx.devicePlan.findFirst({ where: { scopeId: scope.id, kind: 'LOCATION', reminderId, removedAt: null } });
        if (!plan) throw new AppError(404, 'LOCATION_CANDIDATE_NOT_FOUND');
        const where = { scopeId: scope.id, reminderId };
        if (excluded) await tx.locationExclusion.upsert({ where: { scopeId_reminderId: where }, create: where, update: {} });
        else await tx.locationExclusion.deleteMany({ where });
        await revisePlans(tx, scope, now, excluded ? 'exclude' : 'restore');
        return null;
      });
    });
  }

  recordEvent(householdId: string, installationId: string, userId: string, key: string, input: LocationReport) {
    return this.transact(async (tx) => {
      const scope = await this.scope(tx, householdId, installationId, userId);
      const { epoch } = wireScope(scope, this.generation);
      if (input.epoch !== epoch) throw stale();
      const now = this.clock();
      const age = now.getTime() - input.detectedAt.getTime();
      if (age >= eventLifetimeMs || age < -60_000) throw new AppError(422, 'LOCATION_EVENT_EXPIRED');
      await command(tx, JSON.stringify(['event', scope.id, epoch, userId]), key, input, now, async () => {
        // The wire epoch changes after recovery even when the restored database IDs do not.
        const identity = { scopeId: scope.id, id: digest([epoch, input.eventId]) };
        const hash = digest(input);
        const saved = await tx.locationEvent.findUnique({ where: { scopeId_id: identity } });
        if (saved) {
          if (saved.digest !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
          return null;
        }
        const plan = await tx.devicePlan.findUnique({ where: { scopeId_id: { scopeId: scope.id, id: input.occurrenceId } } });
        const expected = plan && readPublishedPlan(plan, now);
        if (!expected || expected.trigger.kind !== 'LOCATION' || expected.trigger.event !== input.condition ||
            plan.version !== input.triggerVersion) throw new AppError(409, 'STALE_NOTIFICATION_PLAN');
        await tx.locationEvent.create({ data: { ...identity, occurrenceId: input.occurrenceId, version: input.triggerVersion,
          detectedAt: input.detectedAt, condition: input.condition, digest: hash } });
        return null;
      });
    });
  }
}
