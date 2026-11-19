import { createHash, randomUUID } from 'node:crypto';
import type { DevicePlan, InstallationScope, Prisma } from './generated/client.js';
import { AppError } from './errors.js';
import { effectiveTrigger, publicTrigger, type PlanCandidate } from './work-scheduling.js';

export const dayMs = 86_400_000;
export const locationLimit = 100;
export const eventLifetimeMs = 30 * dayMs;
export type Tx = Prisma.TransactionClient;
export type SignalType = 'reminder.changed' | 'household.access_revoked';
export type Plan = NonNullable<PlanCandidate['plan']> & { expiresAt?: string };

export function wireScope(scope: Pick<InstallationScope, 'id' | 'epoch'>, generation: string) {
  if (!generation) return { scopeRef: scope.id, epoch: scope.epoch };
  const value = (kind: string, id: string) =>
    createHash('sha256').update(JSON.stringify([kind, id, generation])).digest('base64url');
  return { scopeRef: value('scope', scope.id), epoch: value('epoch', scope.epoch) };
}

export function locationCapacity(scope: Pick<InstallationScope, 'state' | 'locationCount'>) {
  return { state: scope.state === 'CAPACITY_PENDING' ? 'CAPACITY_PENDING' as const : 'ACTIVE' as const,
    requiredSlots: scope.locationCount, limit: locationLimit };
}

export function enqueueSignal(tx: Tx, scopeId: string, revision: number, now: Date, type: SignalType = 'reminder.changed') {
  return tx.deviceSignal.create({ data: {
    id: randomUUID(), scopeId, revision, type,
    createdAt: now, readyAt: now, expiresAt: new Date(now.getTime() + dayMs),
  } });
}

export function capacityError(installationId: string, previouslyRequired: number) {
  return new AppError(409, 'GEOFENCE_CAPACITY_EXCEEDED', {
    installationId, remainingCapacity: String(Math.max(0, locationLimit - previouslyRequired)),
  });
}

function includeExpiry(plan: Plan): Plan {
  if (plan.trigger.kind !== 'TIME') return plan;
  const raw = plan.trigger.scheduledAt;
  if (!raw || !Number.isFinite(Date.parse(raw))) throw new AppError(503, 'INVALID_NOTIFICATION_PLAN');
  return { ...plan, expiresAt: new Date(Date.parse(raw) + dayMs).toISOString() };
}

export async function seedPlans(tx: Tx, scope: InstallationScope, userId: string, now: Date) {
  const candidates = await tx.reminder.findMany({
    where: { householdId: scope.householdId, lifecycle: 'ACTIVE', pausedAt: null,
      assignments: { some: { userId, endedAt: null } } },
    include: {
      trigger: true,
      occurrences: { where: { state: 'PENDING' }, include: { override: true },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: 1 },
      workAudit: { where: { action: 'RESTORE' }, orderBy: { stateAt: 'desc' }, take: 1, select: { stateAt: true } },
    },
  });
  const data = candidates.flatMap((reminder) => {
    const current = reminder.occurrences[0];
    if (!current || !reminder.trigger) return [];
    const trigger = publicTrigger(effectiveTrigger(current, reminder.trigger));
    if (trigger.kind === 'TIME') {
      if (!current.scheduledAt || current.scheduledAt.getTime() + dayMs < now.getTime() ||
          (reminder.workAudit[0] && current.scheduledAt < reminder.workAudit[0].stateAt)) return [];
      trigger.scheduledAt = current.scheduledAt.toISOString();
    }
    const version = scope.revision + 1;
    const plan = includeExpiry({ planId: current.id, occurrenceId: current.id, version, trigger });
    return [{ scopeId: scope.id, id: current.id, reminderId: reminder.id,
      kind: trigger.kind, payload: JSON.stringify(plan), version, revision: version, visible: false }];
  });
  if (data.length) await tx.devicePlan.createMany({ data });
  await revisePlans(tx, scope, now, 'bootstrap');
}

export async function applyCandidates(tx: Tx, scope: InstallationScope, candidates: readonly PlanCandidate[], now: Date) {
  for (const candidate of candidates) {
    const key = { scopeId: scope.id, id: candidate.planId };
    if (candidate.action === 'REMOVE') {
      await tx.devicePlan.updateMany({ where: { ...key, removedAt: null }, data: {
        payload: null, visible: false, removedAt: now, revision: scope.revision + 1,
      } });
      continue;
    }
    if (!candidate.plan) throw new AppError(503, 'INVALID_NOTIFICATION_PLAN');
    const occurrence = await tx.occurrence.findFirst({ where: { id: candidate.plan.occurrenceId,
      reminder: { householdId: scope.householdId } }, select: { reminderId: true } });
    if (!occurrence) throw new AppError(503, 'INVALID_NOTIFICATION_PLAN');
    const version = scope.revision + 1;
    const plan = includeExpiry({ ...candidate.plan, version });
    const data = { reminderId: occurrence.reminderId, kind: plan.trigger.kind,
      payload: JSON.stringify(plan), version, revision: version, removedAt: null };
    await tx.devicePlan.upsert({ where: { scopeId_id: key },
      create: { ...key, ...data, visible: false }, update: data });
  }
  return revisePlans(tx, scope, now, 'change');
}

export async function revisePlans(tx: Tx, scope: InstallationScope, now: Date, operation: 'bootstrap' | 'change' | 'exclude' | 'restore') {
  const revision = scope.revision + 1;
  const exclusions = (await tx.locationExclusion.findMany({ where: { scopeId: scope.id }, select: { reminderId: true } }))
    .map((item) => item.reminderId);
  const base = { scopeId: scope.id, kind: 'LOCATION', removedAt: null };
  const required = await tx.devicePlan.count({ where: { ...base, reminderId: { notIn: exclusions } } });
  const pending = required > locationLimit;
  if (pending && operation !== 'bootstrap' && (operation === 'restore' || required > scope.locationCount)) {
    throw capacityError(scope.installationId, scope.locationCount);
  }
  const locationAllowed = { ...base, reminderId: { notIn: exclusions } };
  await tx.devicePlan.updateMany({ where: { ...locationAllowed, visible: pending }, data: { visible: !pending, revision, version: revision } });
  if (exclusions.length) {
    await tx.devicePlan.updateMany({ where: { ...base, reminderId: { in: exclusions }, visible: true },
      data: { visible: false, revision, version: revision } });
  }
  await tx.devicePlan.updateMany({ where: { scopeId: scope.id, kind: 'TIME', removedAt: null, visible: false },
    data: { visible: true, revision } });
  await tx.installationScope.update({ where: { id: scope.id }, data: {
    revision, locationCount: required, state: pending ? 'CAPACITY_PENDING' : 'ACTIVE',
  } });
  if (operation !== 'bootstrap') await enqueueSignal(tx, scope.id, revision, now);
}

export function readPublishedPlan(row: DevicePlan, now: Date) {
  if (!row.visible || !row.payload) return undefined;
  const plan = JSON.parse(row.payload) as Plan;
  return plan.expiresAt && Date.parse(plan.expiresAt) < now.getTime() ? undefined : { ...plan, version: row.version };
}
