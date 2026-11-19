import { createHash } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma, type PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';
import { authorizedOccurrenceActions } from './occurrence-actions.js';
import type { StoredRecurrence } from './recurrence.js';
import { effectiveTrigger, publicTrigger } from './work-scheduling.js';
import { legacyCreateOperation, rejectDeletedCreate } from './work-storage.js';

type Reader = Pick<PrismaClient, 'membership' | 'reminder'>;
export interface TimeReminderInput {
  title: string;
  description?: string;
  requesterId: string;
  assigneeIds: string[];
  scheduledAt: Date;
  timeZone: string;
}
export const relations = { assignments: { where: { endedAt: null }, orderBy: { userId: 'asc' } }, trigger: true,
  occurrences: { include: { completions: { where: { state: 'OPEN' } }, override: true },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }] },
  recurrenceRules: { where: { effectiveTo: null }, take: 1, orderBy: { effectiveFrom: 'desc' } } } satisfies Prisma.ReminderInclude;
export type RecordWithDetails = Prisma.ReminderGetPayload<{ include: typeof relations }>;
export const detailRelations = { ...relations, occurrences: { ...relations.occurrences, where: { state: 'PENDING' }, take: 1 } };
const views = ['HOUSEHOLD', 'MINE', 'REQUESTED'] as const;
const buckets = ['OVERDUE', 'TODAY', 'UPCOMING', 'ARCHIVED'] as const;
export interface ListOptions {
  limit?: number;
  cursor?: string;
  view?: typeof views[number];
  bucket?: typeof buckets[number];
  now?: Date;
}

export function currentOccurrence(record: RecordWithDetails) {
  return record.occurrences.find((occurrence) => occurrence.state === 'PENDING') ?? null;
}

export function occurrenceDto(row: RecordWithDetails, occurrence: RecordWithDetails['occurrences'][number], actorId: string, now: Date) {
  const open = occurrence.completions[0];
  const patch = occurrence.override ? JSON.parse(occurrence.override.patch) as {
    title?: string; description?: string; trigger?: object;
  } : undefined;
  const override = patch && { title: patch.title, description: patch.description,
    ...(patch.trigger && row.trigger ? { trigger: publicTrigger(effectiveTrigger(occurrence, row.trigger)) } : {}) };
  return {
    occurrenceId: occurrence.id, reminderId: occurrence.reminderId, state: occurrence.state,
    scheduledAt: occurrence.scheduledAt?.toISOString() ?? null, revision: occurrence.revision,
    ...(override ? { override } : {}),
    allowedActions: authorizedOccurrenceActions({
      state: occurrence.state, active: row.lifecycle === 'ACTIVE', verificationEnabled: row.verificationEnabled,
      assigneeIds: row.assignments.map((item) => item.userId),
      verifierUserId: row.verifierUserId, submittedBy: open?.submittedBy, pendingVerifierId: open?.verifierUserId,
      currentRecurring: !!occurrence.recurrenceRuleId && currentOccurrence(row)?.id === occurrence.id,
      due: !!occurrence.scheduledAt && occurrence.scheduledAt <= now,
    }, actorId),
  };
}

export function present(record: RecordWithDetails, actorId: string, now = new Date(), pendingCount?: number) {
  const { id, title, description, createdBy, requesterId, revision, lifecycle, assignments, trigger } = record;
  if (!trigger) throw new AppError(503, 'STORAGE_UNAVAILABLE');
  const occurrence = currentOccurrence(record);
  const { localStart: _start, timeZone: _zone, calendar: _calendar, anchorWeek: _anchor, ...rule } =
    JSON.parse(record.recurrenceRules[0]?.definition ?? '{}') as Partial<StoredRecurrence>;
  return {
    reminderId: id, title, ...(description === null ? {} : { description }),
    createdBy, requesterId, revision, lifecycle, assigneeIds: assignments.map((x) => x.userId),
    trigger: publicTrigger(trigger),
    currentOccurrence: occurrence && occurrenceDto(record, occurrence, actorId, now),
    pendingVerificationCount: pendingCount ?? record.occurrences.filter((item) => item.state === 'VERIFICATION_PENDING').length,
    ...(rule.frequency ? { recurrence: rule } : {}),
    verification: { enabled: record.verificationEnabled, ...(record.verifierUserId ? { verifierId: record.verifierUserId } : {}) },
  };
}
export type ReminderDto = ReturnType<typeof present>;

export async function requireMember(db: Reader, householdId: string, userId: string) {
  const member = await db.membership.findFirst({
    where: { householdId, userId, active: true, user: { active: true } },
    include: { household: true },
  });
  if (!member) throw new AppError(403, 'HOUSEHOLD_ACCESS_DENIED');
  return member;
}

export function prismaCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

export function legacyTimeDigest(input: TimeReminderInput) {
  return createHash('sha256').update(JSON.stringify([
    input.title, input.description ?? null, input.requesterId, [...input.assigneeIds].sort(),
    input.scheduledAt.toISOString(), input.timeZone,
  ])).digest('hex');
}

export async function legacyTimeReplay(tx: Prisma.TransactionClient, householdId: string, userId: string, key: string, inputDigest?: string) {
  const previous = await tx.requestResult.findUnique({
    where: { householdId_userId_operation_key: { householdId, userId, operation: legacyCreateOperation, key } },
    include: { reminder: { include: relations } },
  });
  if (previous && previous.inputDigest !== inputDigest) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
  return previous?.reminder;
}

export async function createTimeReminder(
  db: PrismaClient, householdId: string, userId: string, key: string, input: TimeReminderInput,
) {
  const scope = { householdId, userId, operation: legacyCreateOperation, key };
  const assigned = [...input.assigneeIds].sort();
  const inputDigest = legacyTimeDigest(input);

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        await requireMember(tx, householdId, userId);
        const previous = await legacyTimeReplay(tx, householdId, userId, key, inputDigest);
        if (previous) return present(previous, userId);
        await rejectDeletedCreate(tx, householdId, userId, key, { LEGACY_TIME: inputDigest });
        if (await tx.reminderCommandResult.findUnique({
          where: { householdId_actorId_operation_key: { householdId, actorId: userId, operation: 'CREATE', key } }, select: { key: true },
        })) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
        const memberIds = [...new Set([input.requesterId, ...assigned])];
        const valid = new Set((await tx.membership.findMany({
          where: { householdId, userId: { in: memberIds }, active: true, user: { active: true } },
          select: { userId: true },
        })).map((member) => member.userId));
        if (!valid.has(input.requesterId)) throw new AppError(422, 'INVALID_REQUESTER', { field: 'requesterId' });
        if (!assigned.length || assigned.some((id) => !valid.has(id))) {
          throw new AppError(422, 'INVALID_ASSIGNEE', { field: 'assigneeIds' });
        }

        const reminder = await tx.reminder.create({
          data: {
            householdId, title: input.title, description: input.description,
            createdBy: userId, requesterId: input.requesterId,
          },
        });
        await tx.assignment.createMany({
          data: assigned.map((assignee) => ({ householdId, reminderId: reminder.id, userId: assignee })),
        });
        await tx.trigger.create({
          data: { reminderId: reminder.id, scheduledAt: input.scheduledAt, timeZone: input.timeZone },
        });
        await tx.occurrence.create({ data: { reminderId: reminder.id, scheduledAt: input.scheduledAt } });
        await tx.requestResult.create({ data: { ...scope, inputDigest, reminderId: reminder.id } });
        return present(await tx.reminder.findUniqueOrThrow({ where: { id: reminder.id }, include: relations }), userId);
      });
    } catch (error) {
      const code = prismaCode(error);
      if (!['P2002', 'P2034', 'P1008'].includes(code ?? '')) throw error;
      if (attempt >= 2) throw new AppError(503, 'STORAGE_UNAVAILABLE');
      await new Promise((done) => setTimeout(done, 5 * (attempt + 1)));
    }
  }
}

export async function readReminder(db: PrismaClient, householdId: string, userId: string, reminderId: string, now?: Date) {
  return db.$transaction(async (tx) => {
    await requireMember(tx, householdId, userId);
    const row = await tx.reminder.findFirst({
      where: { id: reminderId, householdId },
      include: { ...detailRelations,
        _count: { select: { occurrences: { where: { state: 'VERIFICATION_PENDING' } } } },
      },
    });
    if (!row) throw new AppError(404, 'REMINDER_NOT_FOUND');
    const item = present(row, userId, now, row._count.occurrences);
    const latest = item.currentOccurrence ? null : await tx.occurrence.findFirst({
      where: { reminderId }, orderBy: [{ stateAt: 'desc' }, { id: 'asc' }], select: { state: true },
    });
    return { ...item, ...(latest ? { latestOccurrenceState: latest.state } : {}) };
  });
}

export function dateBounds(now: Date, zone: string) {
  const midnight = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(zone).startOfDay();
  return [new Date(midnight.epochMilliseconds), new Date(midnight.add({ days: 1 }).epochMilliseconds)];
}

export async function listReminders(db: PrismaClient, householdId: string, userId: string, opts: ListOptions) {
  const view = opts.view ?? 'HOUSEHOLD';
  const { bucket } = opts;
  if (!views.includes(view) || (bucket && !buckets.includes(bucket))) throw new AppError(422, 'INVALID_FILTER');
  const limit = opts.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(422, 'INVALID_LIMIT');
  const tokenScope = JSON.stringify([householdId, userId, view, bucket ?? null]);
  const lifecycle = bucket === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  const viewFilter = view === 'MINE' ? Prisma.sql` AND EXISTS (
    SELECT 1 FROM Assignment a WHERE a.reminderId = r.id AND a.userId = ${userId} AND a.endedAt IS NULL
  )` : view === 'REQUESTED' ? Prisma.sql` AND r.requesterId = ${userId}` : Prisma.empty;
  let cursor: { sort: string; id: string } | undefined;
  if (opts.cursor) {
    try {
      if (opts.cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(opts.cursor)) throw new Error();
      const [scope, value, id] = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8'));
      if (scope !== tokenScope || typeof id !== 'string' || !id || typeof value !== 'string') throw new Error();
      cursor = { sort: value, id };
    } catch {
      throw new AppError(422, 'INVALID_CURSOR');
    }
  }
  return db.$transaction(async (tx) => {
    const { household } = await requireMember(tx, householdId, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
    const now = opts.now ?? new Date();
    const [, tomorrow] = dateBounds(now, user.timeZone ?? household.defaultTimeZone);
    const bucketFilter = bucket && bucket !== 'ARCHIVED' ? Prisma.sql` AND sort LIKE ${bucket + ':%'}` : Prisma.empty;
    const cursorFilter = cursor ? Prisma.sql` AND (sort > ${cursor.sort} OR (sort = ${cursor.sort} AND id > ${cursor.id}))` : Prisma.empty;
    const ordered = await tx.$queryRaw<{ id: string; sort: string; count: bigint }[]>`
      WITH scoped AS (
        SELECT r.id, r.archivedAt,
          (SELECT o.id FROM Occurrence o WHERE o.reminderId = r.id AND o.state = 'PENDING'
            ORDER BY o.scheduledAt, o.id LIMIT 1) AS currentId,
          (SELECT count(*) FROM Occurrence o WHERE o.reminderId = r.id AND o.state = 'VERIFICATION_PENDING') AS count
        FROM Reminder r WHERE r.householdId = ${householdId} AND r.lifecycle = ${lifecycle} ${viewFilter}
      ), sortable AS (
        SELECT s.id, s.count, CASE
          WHEN ${lifecycle} = 'ARCHIVED' THEN printf('%016d',
            9000000000000000 - coalesce(cast(unixepoch(s.archivedAt, 'subsec') * 1000 AS INTEGER), 0))
          WHEN s.currentId IS NOT NULL THEN
            CASE WHEN coalesce(json_extract(x.patch, '$.trigger.kind'), t.kind) = 'LOCATION' THEN 'UPCOMING'
              WHEN julianday(o.scheduledAt) < julianday(${now.toISOString()}) THEN 'OVERDUE'
              WHEN julianday(o.scheduledAt) < julianday(${tomorrow.toISOString()}) THEN 'TODAY'
              ELSE 'UPCOMING' END || ':' || coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', o.scheduledAt), '~')
          WHEN s.count > 0 THEN 'VERIFICATION:' ||
            coalesce((SELECT c.requestedAt || ':' || q.id FROM Occurrence q
              JOIN Completion c ON c.occurrenceId = q.id AND c.state = 'OPEN'
              WHERE q.reminderId = s.id AND q.state = 'VERIFICATION_PENDING' ORDER BY c.requestedAt, q.id LIMIT 1), '')
        END AS sort FROM scoped s LEFT JOIN Occurrence o ON o.id = s.currentId LEFT JOIN Trigger t ON t.reminderId = s.id
          LEFT JOIN OccurrenceOverride x ON x.occurrenceId = s.currentId
      )
      SELECT id, sort, count FROM sortable WHERE sort IS NOT NULL ${bucketFilter} ${cursorFilter}
      ORDER BY sort, id LIMIT ${limit + 1}`;
    const page = ordered.slice(0, limit);
    const rows = await tx.reminder.findMany({ where: { id: { in: page.map(({ id }) => id) }, householdId },
      include: detailRelations });
    const records = new Map(rows.map((row) => [row.id, row]));
    const items = page.map(({ id, count }) => present(records.get(id)!, userId, now, Number(count)));
    const last = page.at(-1);
    const nextCursor = ordered.length > limit && last ?
      Buffer.from(JSON.stringify([tokenScope, last.sort, last.id])).toString('base64url') :
      undefined;
    const sections = bucket === 'ARCHIVED' ? undefined : Object.fromEntries(page.map(({ id, sort }) => [id, sort.split(':', 1)[0]]));
    return { items, ...(sections ? { sections } : {}), ...(nextCursor ? { nextCursor } : {}) };
  });
}
