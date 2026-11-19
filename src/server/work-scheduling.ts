import type { Occurrence, Prisma, Trigger } from './generated/client.js';
import { Temporal } from '@js-temporal/polyfill';
import { makeRecurrence, nextOccurrence, scheduleLocal, type Calendar, type Recurrence, type StoredRecurrence } from './recurrence.js';
import { workAudit } from './work-storage.js';

const runLimit = 100;

export function publicTrigger(trigger: Trigger) {
  return trigger.kind === 'LOCATION' ? {
    kind: 'LOCATION', latitude: trigger.latitude, longitude: trigger.longitude, radiusM: trigger.radiusM,
    placeName: trigger.placeName ?? undefined, event: trigger.event, durationMinutes: trigger.durationMin ?? undefined,
  } : { kind: 'TIME', scheduledAt: trigger.scheduledAt?.toISOString(), timeZone: trigger.timeZone };
}

type PlannedOccurrence = Occurrence & { override?: { patch: string } | null };

export function effectiveTrigger(occurrence: PlannedOccurrence, base: Trigger): Trigger {
  const patch = JSON.parse(occurrence.override?.patch ?? '{}') as { trigger?: Omit<Trigger, 'reminderId' | 'scheduledAt'> & {
    scheduledAt: string | null;
  } };
  if (!patch.trigger) return base;
  return { reminderId: base.reminderId, ...patch.trigger,
    scheduledAt: patch.trigger.scheduledAt ? new Date(patch.trigger.scheduledAt) : null };
}

export interface PlanCandidate {
  action: 'UPSERT' | 'REMOVE';
  installationId: string;
  planId: string;
  version: number;
  plan?: { planId: string; occurrenceId: string; version: number; trigger: ReturnType<typeof publicTrigger> };
}
export interface InstallationPlanParticipant {
  targets(tx: Prisma.TransactionClient, householdId: string, userIds: readonly string[]): Promise<string[]>;
  validateAndStore(tx: Prisma.TransactionClient, householdId: string, candidates: readonly PlanCandidate[]): Promise<void>;
}

export async function synchronizePlans(tx: Prisma.TransactionClient, port: InstallationPlanParticipant | undefined,
  householdId: string, before: PlannedOccurrence[], after: PlannedOccurrence[], beforeAssignees: string[], afterAssignees: string[],
  trigger: Trigger, version: number) {
  if (!port) return;
  const previous = await port.targets(tx, householdId, beforeAssignees);
  const next = await port.targets(tx, householdId, afterAssignees);
  const candidates = new Map<string, PlanCandidate>();
  for (const installationId of previous) {
    for (const occurrence of before) {
      const planId = occurrence.id;
      candidates.set(JSON.stringify([installationId, planId]), { action: 'REMOVE', installationId, planId, version });
    }
  }
  for (const installationId of next) {
    for (const occurrence of after) {
      const planId = occurrence.id;
      const planTrigger = publicTrigger(effectiveTrigger(occurrence, trigger));
      if (planTrigger.kind === 'TIME') planTrigger.scheduledAt = occurrence.scheduledAt?.toISOString();
      candidates.set(JSON.stringify([installationId, planId]), { action: 'UPSERT', installationId, planId, version,
        plan: { planId, occurrenceId: occurrence.id, version, trigger: planTrigger } });
    }
  }
  await port.validateAndStore(tx, householdId, [...candidates.values()]);
}

export async function createRule(tx: Prisma.TransactionClient, reminderId: string, rule: Recurrence, start: Date,
  timeZone: string, calendar: Calendar, boundary?: string, previous?: StoredRecurrence) {
  const startLocal = scheduleLocal(start, timeZone);
  const definition = makeRecurrence(rule, startLocal, timeZone, calendar, previous);
  return tx.recurrenceRule.create({ data: {
    reminderId, definition: JSON.stringify(definition), effectiveFrom: boundary ?? start.toISOString(),
  } });
}

export async function fillSchedule(tx: Prisma.TransactionClient, reminderId: string, now: Date,
  resumeAt?: Date) {
  const rule = await tx.recurrenceRule.findFirst({ where: { reminderId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' } });
  if (!rule) return false;
  const start = Date.parse(rule.effectiveFrom);
  const recurrence = JSON.parse(rule.definition) as StoredRecurrence;
  const resume = resumeAt?.getTime();
  let through = rule.generatedThrough ?? undefined;
  if (resumeAt) {
    const local = scheduleLocal(resumeAt, recurrence.timeZone);
    const lower = local.slice(0, 10) + 'T00:00';
    const previousDay = new Date(Date.parse(lower + 'Z') - 86_400_000).toISOString().slice(0, 16);
    if (!through || previousDay > through) through = previousDay;
  }
  let changed = false;
  const ahead = through && Temporal.PlainDateTime.from(through).toZonedDateTime(recurrence.timeZone).epochMilliseconds > now.getTime();
  const priorRules = ahead ? [] : await tx.recurrenceRule.findMany({
    where: { reminderId, id: { not: rule.id } }, select: { id: true },
  });
  for (let count = 0; !ahead && count < runLimit; count++) {
    const next = nextOccurrence(recurrence, through);
    if (!next) break;
    through = next.key;
    const scheduled = next.scheduledAt.getTime();
    if (scheduled < start || (resume !== undefined && scheduled < resume)) continue;
    const key = rule.id + ':' + next.key;
    const existing = await tx.occurrence.findFirst({
      where: { reminderId, OR: [{ occurrenceKey: key }, { state: { not: 'PENDING' }, OR: [
        { scheduledAt: next.scheduledAt },
        { occurrenceKey: { in: priorRules.map((prior) => prior.id + ':' + next.key) } },
      ] }] },
      select: { id: true },
    });
    if (!existing) {
      await tx.occurrence.create({ data: { reminderId, occurrenceKey: key, recurrenceRuleId: rule.id,
        scheduledAt: next.scheduledAt, stateAt: now } });
      changed = true;
    }
    if (scheduled > now.getTime()) break;
  }
  if (through !== (rule.generatedThrough ?? undefined)) {
    await tx.recurrenceRule.update({ where: { id: rule.id }, data: { generatedThrough: through } });
  }
  const latestDue = resumeAt ? null : await tx.occurrence.findFirst({
    where: { reminderId, recurrenceRuleId: rule.id, scheduledAt: { lte: now } }, orderBy: { scheduledAt: 'desc' },
  });
  if (latestDue?.scheduledAt) {
    const overdue = await tx.occurrence.findMany({ where: {
      reminderId, state: 'PENDING', scheduledAt: { lt: latestDue.scheduledAt },
    }, take: runLimit });
    if (overdue.length) {
      const reminder = await tx.reminder.findUniqueOrThrow({ where: { id: reminderId }, select: { householdId: true } });
      await tx.occurrence.updateMany({ where: { id: { in: overdue.map((occurrence) => occurrence.id) }, state: 'PENDING' },
        data: { state: 'MISSED', stateAt: now, reason: 'NEXT_OCCURRENCE', revision: { increment: 1 } } });
      for (const occurrence of overdue) await workAudit(tx, reminder.householdId, reminderId, 'SYSTEM', 'MISSED', now, occurrence.id);
      changed = true;
    }
  }
  return changed;
}
