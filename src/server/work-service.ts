import { createHash } from 'node:crypto';
import { AppError } from './errors.js';
import type { DeleteJournal } from './delete-journal.js';
import { householdDefaults } from './households.js';
import type { Prisma, PrismaClient, Reminder, Trigger } from './generated/client.js';
import { validateVerifier, type OccurrenceAction } from './occurrence-actions.js';
import { currentOccurrence, legacyTimeDigest, legacyTimeReplay, occurrenceDto, prismaCode,
  present as workDto, relations, requireMember, type RecordWithDetails } from './repository.js';
import { type Calendar, type StoredRecurrence } from './recurrence.js';
import { createRule, effectiveTrigger, fillSchedule, synchronizePlans, type InstallationPlanParticipant } from './work-scheduling.js';
import { appendChange, preserveDeletedCreateKeys, rejectDeletedCreate, updateOccurrence, workAudit } from './work-storage.js';
import type { CreateWorkInput, EditWorkInput, WorkTrigger } from './work-input.js';

type Tx = Prisma.TransactionClient;
const stale = () => new AppError(409, 'STALE_REVISION');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scopeDenied = () => new AppError(403, 'WORK_ACTION_DENIED');
const retryable = (error: unknown) => ['P2002', 'P2034', 'P1008'].includes(prismaCode(error) ?? '');

export async function loadWork(tx: Tx, householdId: string, reminderId: string) {
  const row = await tx.reminder.findFirst({ where: { householdId, id: reminderId }, include: relations });
  if (!row?.trigger) throw new AppError(404, 'REMINDER_NOT_FOUND');
  return { ...row, trigger: row.trigger };
}
type Work = Awaited<ReturnType<typeof loadWork>>;

export async function workMembers(tx: Tx, householdId: string, ids: (string | null)[]) {
  return new Set((await tx.membership.findMany({
    where: { householdId, userId: { in: ids.filter((id): id is string => id !== null) }, active: true, user: { active: true } },
    select: { userId: true },
  })).map((row) => row.userId));
}

function memberTargets(row: RecordWithDetails) {
  return row.assignments.map((assignment) => assignment.userId);
}

function people(requesterId: string, assigneeIds: string[], verifierId: string | null, verification: boolean, active: Set<string>) {
  if (!active.has(requesterId)) throw new AppError(422, 'INVALID_REQUESTER', { field: 'requesterId' });
  if (assigneeIds.some((id) => !active.has(id))) throw new AppError(422, 'INVALID_ASSIGNEE', { field: 'assigneeIds' });
  if (verification) validateVerifier(verifierId, assigneeIds, active);
}

async function triggerData(tx: Tx, householdId: string, trigger: WorkTrigger): Promise<Omit<Trigger, 'reminderId'>> {
  const empty = {
    scheduledAt: null, timeZone: null, latitude: null, longitude: null, placeName: null, radiusM: null, event: null, durationMin: null,
  };
  if (trigger.kind === 'TIME') return { ...empty, ...trigger };
  const policy = await tx.householdSettings.findUnique({ where: { householdId } });
  const shape = householdDefaults.radiusM;
  const radiusM = trigger.radiusM ?? policy?.defaultRadiusM ?? shape.default;
  const min = policy?.minRadiusM ?? shape.min;
  const max = policy?.maxRadiusM ?? shape.max;
  if (radiusM < min || radiusM > max) throw new AppError(422, 'INVALID_FIELD', { field: 'trigger.radiusM' });
  if (trigger.durationMinutes && trigger.durationMinutes > (policy?.maxLocationDurationMin ?? householdDefaults.maxLocationDurationMin)) {
    throw new AppError(422, 'INVALID_FIELD', { field: 'trigger.durationMinutes' });
  }
  return { ...empty, kind: 'LOCATION', latitude: trigger.latitude, longitude: trigger.longitude, radiusM,
    placeName: trigger.placeName ?? null, event: trigger.event, durationMin: trigger.durationMinutes ?? null };
}

function activePlans(row: Work) {
  const current = currentOccurrence(row);
  return row.lifecycle === 'ACTIVE' && !row.pausedAt && current ? [current] : [];
}

function newPlans(row: Work, now: Date) {
  return activePlans(row).filter((item) => effectiveTrigger(item, row.trigger).kind === 'LOCATION' ||
    !!item.scheduledAt && item.scheduledAt >= now);
}

function futureDate(reminder: Reminder, trigger: Trigger, householdZone: string) {
  return { start: trigger.scheduledAt ?? reminder.createdAt, zone: trigger.timeZone ?? householdZone };
}

async function replaceAssignments(tx: Tx, old: Work, next: string[], at: Date) {
  const ending = old.assignments.filter((assignment) => !next.includes(assignment.userId));
  await tx.assignment.updateMany({ where: { reminderId: old.id, userId: { in: ending.map((x) => x.userId) },
    endedAt: null }, data: { endedAt: at } });
  for (const userId of next) {
    if (old.assignments.some((assignment) => assignment.userId === userId)) continue;
    await tx.assignment.create({ data: { householdId: old.householdId, reminderId: old.id, userId, assignedAt: at } });
  }
}

export class WorkService {
  private readonly deletes = new Map<string, { digest: string; run: Promise<void> }>();

  constructor(readonly db: PrismaClient, readonly clock = () => new Date(),
    readonly planPort?: InstallationPlanParticipant, readonly journal?: DeleteJournal,
    readonly log?: (event: Record<string, unknown>) => void) {}

  async transact<T>(action: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(action); }
      catch (error) {
        if (!retryable(error)) throw error;
        if (attempt >= 2) throw new AppError(503, 'STORAGE_UNAVAILABLE', undefined, 1);
        await new Promise((done) => setTimeout(done, 5 * (attempt + 1)));
      }
    }
  }

  private command<T>(householdId: string, actorId: string, operation: string, key: string, payload: unknown,
    action: (tx: Tx, now: Date) => Promise<{ reminderId: string; result: T }>,
    replay?: (tx: Tx, digest: string) => Promise<T | undefined>) {
    const identity = { householdId, actorId, operation, key };
    const inputDigest = digest(payload);
    return this.transact(async (tx) => {
      await requireMember(tx, householdId, actorId);
      const previous = await tx.reminderCommandResult.findUnique({ where: { householdId_actorId_operation_key: identity } });
      if (previous) {
        if (previous.digest !== inputDigest) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
        return JSON.parse(previous.result) as T;
      }
      const migrated = await replay?.(tx, inputDigest);
      if (migrated !== undefined) return migrated;
      const { reminderId, result } = await action(tx, this.clock());
      await tx.reminderCommandResult.create({ data: { ...identity, digest: inputDigest, reminderId, result: JSON.stringify(result) } });
      return result;
    });
  }

  private async publish(tx: Tx, previous: Work | undefined, row: Work, actorId: string, action: string, now: Date,
    occurrenceId?: string, changes?: Record<string, string | number | boolean>) {
    await workAudit(tx, row.householdId, row.id, actorId, action, now, occurrenceId, changes);
    const entry = await appendChange(tx, row.householdId, row.id, 'UPSERT', now);
    await synchronizePlans(tx, this.planPort, row.householdId, previous ? activePlans(previous) : [], newPlans(row, now),
      previous ? memberTargets(previous) : [], memberTargets(row), row.trigger, entry.revision);
  }

  add(householdId: string, actorId: string, key: string, input: CreateWorkInput) {
    return this.command(householdId, actorId, 'CREATE', key, input, async (tx, now) => {
      const { requesterId, assigneeIds } = input;
      const verification = input.verification?.enabled ?? false;
      const verifierId = input.verification?.verifierId ?? null;
      people(requesterId, assigneeIds, verifierId, verification, await workMembers(tx, householdId, [requesterId, ...assigneeIds, verifierId]));
      const reminder = await tx.reminder.create({ data: { householdId, title: input.title, description: input.description,
        requesterId, createdBy: actorId, verificationEnabled: verification, verifierUserId: verifierId, createdAt: now } });
      await tx.assignment.createMany({ data: assigneeIds.map((userId) => ({ householdId, reminderId: reminder.id, userId, assignedAt: now })) });
      const schedule = await tx.trigger.create({ data: { reminderId: reminder.id, ...await triggerData(tx, householdId, input.trigger) } });
      if (input.recurrence) {
        const household = await tx.household.findUniqueOrThrow({ where: { id: householdId }, include: { settings: true } });
        const { start } = futureDate(reminder, schedule, household.defaultTimeZone);
        await createRule(tx, reminder.id, input.recurrence, start, household.defaultTimeZone,
          (household.settings?.weeklyCalendarConvention ?? 'MONDAY_START') as Calendar);
        await fillSchedule(tx, reminder.id, now);
      } else {
        await tx.occurrence.create({ data: { reminderId: reminder.id, scheduledAt: schedule.scheduledAt, stateAt: now } });
      }
      const row = await loadWork(tx, householdId, reminder.id);
      await this.publish(tx, undefined, row, actorId, 'CREATED', now);
      return { reminderId: row.id, result: workDto(row, actorId, now) };
    }, async (tx, digest) => {
      const compatibleTime = input.trigger.kind === 'TIME' && !input.recurrence && !input.verification?.enabled ?
        legacyTimeDigest({ ...input, scheduledAt: input.trigger.scheduledAt, timeZone: input.trigger.timeZone }) : undefined;
      await rejectDeletedCreate(tx, householdId, actorId, key, { WORK_V1: digest, LEGACY_TIME: compatibleTime });
      const existing = await legacyTimeReplay(tx, householdId, actorId, key, compatibleTime);
      return existing && workDto(existing, actorId, this.clock());
    });
  }

  edit(householdId: string, actorId: string, reminderId: string, key: string, input: EditWorkInput) {
    return this.command(householdId, actorId, 'EDIT', key, [reminderId, input], async (tx, now) => {
      const old = await loadWork(tx, householdId, reminderId);
      if (old.revision !== input.revision) throw stale();
      if (old.lifecycle !== 'ACTIVE') throw new AppError(409, 'INVALID_WORK_STATE');
      const selected = input.occurrenceId ? old.occurrences.find((item) => item.id === input.occurrenceId) : undefined;
      if ((input.occurrenceId && !selected) || (input.scope !== undefined && input.scope !== 'ENTIRE_SERIES' && !selected)) {
        throw new AppError(422, 'INVALID_FIELD', { field: 'occurrenceId' });
      }
      if (old.recurrenceRules.length && !input.scope) throw new AppError(422, 'INVALID_FIELD', { field: 'scope' });
      const single = input.scope === 'THIS_OCCURRENCE';
      if (single && (!old.recurrenceRules.length || selected?.state !== 'PENDING' || input.recurrence || input.assigneeIds ||
        input.requesterId || input.verification)) throw new AppError(409, 'INVALID_WORK_STATE');
      const assignees = input.assigneeIds ?? memberTargets(old);
      const verification = input.verification?.enabled ?? old.verificationEnabled;
      const verifier = input.verification ? input.verification.verifierId ?? null : old.verifierUserId;
      if ((verification !== old.verificationEnabled || verifier !== old.verifierUserId || assignees.includes(verifier ?? '')) &&
          old.occurrences.some((item) => item.state === 'VERIFICATION_PENDING')) throw new AppError(409, 'VERIFICATION_PENDING');
      if (input.requesterId || input.assigneeIds || input.verification) {
        const requester = input.requesterId ?? old.requesterId;
        const active = await workMembers(tx, householdId, [requester, ...assignees, verifier]);
        if (!input.requesterId) active.add(requester);
        people(requester, assignees, verifier, verification, active);
      }
      const trigger = input.trigger && await triggerData(tx, householdId, input.trigger);
      if (input.scope === 'THIS_AND_FUTURE' && selected?.scheduledAt && (input.title !== undefined || input.description !== undefined)) {
        const earlier = await tx.occurrence.findMany({ where: { reminderId, scheduledAt: { lt: selected.scheduledAt } },
          include: { override: true } });
        for (const occurrence of earlier) {
          const previous = JSON.parse(occurrence.override?.patch ?? '{}') as Record<string, unknown>;
          const patch = JSON.stringify({ title: old.title, description: old.description ?? '', ...previous });
          await tx.occurrenceOverride.upsert({ where: { occurrenceId: occurrence.id },
            create: { occurrenceId: occurrence.id, patch }, update: { patch } });
        }
      }
      const changes = await tx.reminder.updateMany({ where: { id: old.id, revision: input.revision }, data: {
        revision: { increment: 1 },
        ...(single ? {} : { title: input.title, description: input.description, requesterId: input.requesterId,
          verificationEnabled: input.verification?.enabled, verifierUserId: input.verification ? verifier : undefined,
          pausedAt: assignees.length ? null : undefined }),
      } });
      if (changes.count !== 1) throw stale();
      if (single && selected) {
        const previous = JSON.parse(selected.override?.patch ?? '{}') as Record<string, unknown>;
        const patch = JSON.stringify({ ...previous, ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }), ...(trigger ? { trigger } : {}) });
        await tx.occurrenceOverride.upsert({ where: { occurrenceId: selected.id },
          create: { occurrenceId: selected.id, patch }, update: { patch } });
        await updateOccurrence(tx, selected.id, selected.revision, {
          ...(trigger?.kind === 'TIME' ? { scheduledAt: trigger.scheduledAt } : {}),
        });
      } else {
        if (input.assigneeIds) await replaceAssignments(tx, old, assignees, now);
        if (trigger) await tx.trigger.update({ where: { reminderId }, data: trigger });
        if (old.pausedAt && assignees.length) {
          await tx.occurrence.updateMany({ where: { reminderId, state: 'PENDING', scheduledAt: { gt: old.pausedAt, lt: now } },
            data: { state: 'SKIPPED', reason: 'NO_ACTIVE_ASSIGNEE', stateAt: now, revision: { increment: 1 } } });
        }
        if (input.recurrence || (trigger && old.recurrenceRules.length)) {
          const oldRule = old.recurrenceRules[0];
          const previous = oldRule && JSON.parse(oldRule.definition) as StoredRecurrence;
          const recurrence = input.recurrence ?? previous;
          if (recurrence) {
            const household = await tx.household.findUniqueOrThrow({ where: { id: householdId }, include: { settings: true } });
            const { start, zone } = futureDate(old, { ...old.trigger, ...trigger }, household.defaultTimeZone);
            const boundary = input.scope === 'THIS_AND_FUTURE' ? selected?.scheduledAt ?? now : start;
            if (oldRule) {
              await tx.recurrenceRule.update({ where: { id: oldRule.id }, data: { effectiveTo: boundary.toISOString() } });
              await tx.occurrence.deleteMany({ where: { reminderId, recurrenceRuleId: oldRule.id, state: 'PENDING',
                scheduledAt: { gte: boundary } } });
            } else {
              await tx.occurrence.deleteMany({ where: { reminderId, state: 'PENDING' } });
            }
            await createRule(tx, old.id, recurrence, start, previous?.timeZone ?? zone,
              previous?.calendar ?? ((household.settings?.weeklyCalendarConvention ?? 'MONDAY_START') as Calendar),
              boundary.toISOString(), previous || undefined);
            if (assignees.length) await fillSchedule(tx, old.id, now, old.pausedAt ? now : undefined);
          }
        } else if (trigger) {
          const current = currentOccurrence(old);
          if (current) await updateOccurrence(tx, current.id, current.revision, { scheduledAt: trigger.scheduledAt });
        } else if (old.pausedAt && assignees.length) {
          await fillSchedule(tx, old.id, now, now);
        }
      }
      const row = await loadWork(tx, householdId, reminderId);
      const changesForAudit: Record<string, string | number | boolean> = { scope: input.scope ?? 'ENTIRE_SERIES' };
      if (input.title !== undefined) Object.assign(changesForAudit, { beforeTitle: old.title, afterTitle: input.title });
      if (input.assigneeIds) Object.assign(changesForAudit, { beforeAssignees: memberTargets(old).join(','),
        afterAssignees: input.assigneeIds.join(',') });
      if (trigger) Object.assign(changesForAudit, { beforeTrigger: old.trigger.kind, afterTrigger: trigger.kind });
      if (input.recurrence) Object.assign(changesForAudit, { afterRecurrence: input.recurrence.frequency });
      await this.publish(tx, old, row, actorId, 'EDITED', now, selected?.id, changesForAudit);
      return { reminderId, result: workDto(row, actorId, now) };
    });
  }

  lifecycle(householdId: string, actorId: string, reminderId: string, key: string, input: { action: 'ARCHIVE' | 'RESTORE'; revision: number }) {
    return this.command(householdId, actorId, 'LIFECYCLE', key, [reminderId, input], async (tx, now) => {
      const old = await loadWork(tx, householdId, reminderId);
      if (old.revision !== input.revision) throw stale();
      const archiving = input.action === 'ARCHIVE';
      if (archiving === (old.lifecycle === 'ARCHIVED')) throw new AppError(409, 'INVALID_WORK_STATE');
      const changed = await tx.reminder.updateMany({ where: { id: reminderId, revision: old.revision },
        data: { archivedAt: archiving ? now : null, lifecycle: archiving ? 'ARCHIVED' : 'ACTIVE', revision: { increment: 1 } } });
      if (changed.count !== 1) throw stale();
      if (!archiving && !old.pausedAt) await fillSchedule(tx, reminderId, now, now);
      const row = await loadWork(tx, householdId, reminderId);
      await this.publish(tx, old, row, actorId, input.action, now);
      return { reminderId, result: workDto(row, actorId, now) };
    });
  }

  occurrenceAction(householdId: string, actorId: string, occurrenceId: string, key: string,
    input: { action: OccurrenceAction; revision: number }) {
    return this.command(householdId, actorId, 'OCCURRENCE', key, [occurrenceId, input], async (tx, now) => {
      const target = await tx.occurrence.findFirst({ where: { id: occurrenceId, reminder: { householdId } } });
      if (!target) throw new AppError(404, 'OCCURRENCE_NOT_FOUND');
      const reminderId = target.reminderId;
      const old = await loadWork(tx, householdId, reminderId);
      const current = old.occurrences.find((item) => item.id === occurrenceId)!;
      if (current.revision !== input.revision) throw stale();
      const { action } = input;
      const available = occurrenceDto(old, current, actorId, now).allowedActions;
      if (!available.includes(action)) {
        if (['APPROVE', 'REJECT', 'WITHDRAW_VERIFICATION'].includes(action) && current.state === 'VERIFICATION_PENDING') {
          throw scopeDenied();
        }
        if (action === 'COMPLETE' && current.state === 'PENDING' && old.verificationEnabled) throw scopeDenied();
        throw new AppError(409, 'INVALID_OCCURRENCE_STATE');
      }
      let state: string;
      if (action === 'COMPLETE') {
        if (old.verificationEnabled && old.verifierUserId === actorId) throw scopeDenied();
        const verifierId = old.verificationEnabled ? validateVerifier(old.verifierUserId, memberTargets(old),
          await workMembers(tx, householdId, [old.verifierUserId])) : null;
        state = verifierId ? 'VERIFICATION_PENDING' : 'COMPLETED';
        await tx.completion.create({ data: { occurrenceId, submittedBy: actorId, verifierUserId: verifierId,
          state: verifierId ? 'OPEN' : 'COMPLETED', requestedAt: now, respondedAt: verifierId ? null : now } });
      } else if (action === 'SKIP') {
        state = 'SKIPPED';
      } else if (action === 'UNDO_COMPLETE') {
        state = 'PENDING';
        const completion = await tx.completion.findFirst({ where: { occurrenceId, state: 'COMPLETED' }, orderBy: { requestedAt: 'desc' } });
        if (completion) await tx.completion.update({ where: { id: completion.id },
          data: { state: 'UNDONE', responseActorId: actorId, respondedAt: now } });
      } else {
        const open = current.completions[0];
        if (!open) throw stale();
        if (action !== 'WITHDRAW_VERIFICATION') {
          if (open.submittedBy === actorId) throw scopeDenied();
          validateVerifier(open.verifierUserId, memberTargets(old), await workMembers(tx, householdId, [open.verifierUserId]));
        }
        state = action === 'APPROVE' ? 'COMPLETED' : 'PENDING';
        const response = await tx.completion.updateMany({ where: { id: open.id, state: 'OPEN' }, data: {
          state: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'WITHDRAWN',
          respondedAt: now, responseActorId: actorId,
        } });
        if (response.count !== 1) throw stale();
      }
      await updateOccurrence(tx, occurrenceId, input.revision, { state, stateAt: now, reason: action });
      const row = await loadWork(tx, householdId, reminderId);
      const result = occurrenceDto(row, row.occurrences.find((item) => item.id === occurrenceId)!, actorId, now);
      await this.publish(tx, old, row, actorId, action, now, occurrenceId, { from: current.state, to: state });
      return { reminderId, result };
    });
  }

  async advance(householdId: string, reminderId: string, actorId?: string) {
    return this.transact(async (tx) => {
      if (actorId !== undefined) await requireMember(tx, householdId, actorId);
      const old = await loadWork(tx, householdId, reminderId);
      if (old.lifecycle !== 'ACTIVE' || old.pausedAt || !old.recurrenceRules.length) return;
      const now = this.clock();
      if (!await fillSchedule(tx, reminderId, now)) return;
      const row = await loadWork(tx, householdId, reminderId);
      await this.publish(tx, old, row, 'SYSTEM', 'RECURRENCE_ADVANCED', now);
    });
  }

  async delete(householdId: string, actorId: string, reminderId: string, key: string, revision: number) {
    const journal = this.journal;
    if (!journal) throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE');
    const requestId = digest(['DELETE_REMINDER', householdId, actorId, key]);
    const inputDigest = digest([reminderId, revision]);
    await requireMember(this.db, householdId, actorId);
    const concurrent = this.deletes.get(requestId);
    if (concurrent) {
      if (concurrent.digest !== inputDigest) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
      return concurrent.run;
    }
    const run = this.removeWithEvidence(journal, { requestId, householdId, reminderId, digest: inputDigest, at: this.clock() },
      actorId, revision);
    this.deletes.set(requestId, { digest: inputDigest, run });
    try { await run; }
    finally { this.deletes.delete(requestId); }
  }

  private async removeWithEvidence(journal: DeleteJournal, request: Parameters<DeleteJournal['request']>[0], actorId: string, revision: number) {
    const { requestId, householdId, reminderId, at } = request;
    let hasRequest = false;
    let newlyRequested = false;
    let committed = false;
    try {
      const prior = journal.find(requestId);
      if (!prior) {
        const target = await this.db.reminder.findFirst({ where: { householdId, id: reminderId } });
        if (!target) throw new AppError(404, 'REMINDER_NOT_FOUND');
        if (target.revision !== revision) throw stale();
      }
      const entry = journal.request(request);
      if (entry.state === 'ABORTED') throw new AppError(409, 'DELETE_ABORTED');
      hasRequest = true;
      newlyRequested = prior === undefined;
      const proof = await this.transact(async (tx) => {
        await requireMember(tx, householdId, actorId);
        const saved = await tx.deletionCommit.findUnique({ where: { requestId } });
        if (saved) {
          if (saved.householdId !== householdId || saved.reminderId !== reminderId ||
              (saved.inputDigest !== null && saved.inputDigest !== request.digest) ||
              (entry.state === 'COMMITTED' && saved.revision !== entry.revision)) {
            throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
          }
          return saved;
        }
        if (entry.state === 'COMMITTED') throw new AppError(503, 'DELETE_EVIDENCE_PENDING');
        const competing = await tx.deletionCommit.findFirst({ where: { householdId, reminderId, requestId: { not: requestId } } });
        if (competing) throw new AppError(409, 'DELETE_SUPERSEDED');
        const work = await loadWork(tx, householdId, reminderId).catch((error: unknown) => {
          if (error instanceof AppError && error.code === 'REMINDER_NOT_FOUND') {
            throw new AppError(503, 'DELETE_EVIDENCE_PENDING', undefined, 2);
          }
          throw error;
        });
        if (work.revision !== revision) throw stale();
        const change = await appendChange(tx, householdId, reminderId, 'DELETE', at);
        await synchronizePlans(tx, this.planPort, householdId, activePlans(work), [], memberTargets(work), [], work.trigger, change.revision);
        await preserveDeletedCreateKeys(tx, householdId, reminderId);
        const deleted = await tx.reminder.deleteMany({ where: { householdId, id: reminderId, revision } });
        if (deleted.count !== 1) throw stale();
        return tx.deletionCommit.create({ data: { requestId, householdId, reminderId, revision: change.revision,
          committedAt: at, inputDigest: request.digest } });
      });
      committed = true;
      journal.finish({ ...request, at: proof.committedAt }, 'COMMITTED', proof.revision);
    } catch (error) {
      if (hasRequest) {
        if (!committed && error instanceof AppError &&
            (['STALE_REVISION', 'DELETE_SUPERSEDED', 'GEOFENCE_CAPACITY_EXCEEDED'].includes(error.code) ||
             (newlyRequested && error.code === 'HOUSEHOLD_ACCESS_DENIED'))) {
          try { journal.finish(request, 'ABORTED', null); } catch { /* Keep the request unsettled on journal failure. */ }
        }
        const unsettled = journal.unsettled(at);
        if (unsettled.count) this.log?.({ event: 'DELETE_EVIDENCE_PENDING', operationId: requestId, ...unsettled });
      }
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'DELETE_JOURNAL_UNAVAILABLE', undefined, 2);
    }
  }

  async reconcileCommittedDeletes() {
    const journal = this.journal;
    if (!journal) return 0;
    const limit = 100;
    let after = 0;
    let reconciled = 0;
    for (;;) {
      const pending = journal.pending(after, limit);
      if (!pending.length) return reconciled;
      const proofs = await this.db.deletionCommit.findMany({
        where: { requestId: { in: pending.map((entry) => entry.requestId) } },
      });
      const byId = new Map(proofs.map((proof) => [proof.requestId, proof]));
      for (const entry of pending) {
        const proof = byId.get(entry.requestId);
        if (!proof || proof.householdId !== entry.householdId || proof.reminderId !== entry.reminderId ||
            proof.inputDigest !== entry.digest || proof.committedAt < new Date(entry.at)) continue;
        const persisted = await this.db.reminder.findFirst({
          where: { householdId: entry.householdId, id: entry.reminderId }, select: { id: true },
        });
        if (persisted) continue;
        journal.finish({ ...entry, at: proof.committedAt }, 'COMMITTED', proof.revision);
        reconciled++;
      }
      if (pending.length < limit) return reconciled;
      after = pending[pending.length - 1].position;
    }
  }
}
