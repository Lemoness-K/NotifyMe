import { createHash } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma, type PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';

type Reader = Pick<PrismaClient, 'membership' | 'reminder'>;
export interface TimeReminderInput {
  title: string;
  description?: string;
  requesterId: string;
  assigneeIds: string[];
  scheduledAt: Date;
  timeZone: string;
}
const relations = { assignments: { orderBy: { userId: 'asc' } }, trigger: true, occurrence: true } as const;
type RecordWithDetails = Prisma.ReminderGetPayload<{ include: typeof relations }>;
const views = ['HOUSEHOLD', 'MINE', 'REQUESTED'] as const;
const buckets = ['OVERDUE', 'TODAY', 'UPCOMING', 'ARCHIVED'] as const;
export interface ListOptions {
  limit?: number;
  cursor?: string;
  view?: typeof views[number];
  bucket?: typeof buckets[number];
  now?: Date;
}

function present(record: RecordWithDetails) {
  const { id, title, description, createdBy, requesterId, revision, lifecycle, assignments, trigger, occurrence } = record;
  if (!trigger || !occurrence) throw new AppError(503, 'STORAGE_UNAVAILABLE');
  return {
    reminderId: id, title, ...(description === null ? {} : { description }),
    createdBy, requesterId, revision, lifecycle, assigneeIds: assignments.map((x) => x.userId),
    trigger: { kind: trigger.kind, scheduledAt: trigger.scheduledAt.toISOString(), timeZone: trigger.timeZone },
    currentOccurrence: {
      occurrenceId: occurrence.id, reminderId: id, state: occurrence.state,
      scheduledAt: occurrence.scheduledAt.toISOString(), revision: occurrence.revision,
    },
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

export async function createTimeReminder(
  db: PrismaClient, householdId: string, userId: string, key: string, input: TimeReminderInput,
) {
  const scope = { householdId, userId, operation: 'CREATE_TIME_REMINDER', key };
  const assigned = [...input.assigneeIds].sort();
  const inputDigest = createHash('sha256').update(JSON.stringify([
    input.title, input.description ?? null, input.requesterId, assigned, input.scheduledAt.toISOString(), input.timeZone,
  ])).digest('hex');

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        await requireMember(tx, householdId, userId);
        const previous = await tx.requestResult.findUnique({
          where: { householdId_userId_operation_key: scope },
          include: { reminder: { include: relations } },
        });
        if (previous) {
          if (previous.inputDigest !== inputDigest) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
          return present(previous.reminder);
        }
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
        return present(await tx.reminder.findUniqueOrThrow({ where: { id: reminder.id }, include: relations }));
      });
    } catch (error) {
      const code = prismaCode(error);
      if (!['P2002', 'P2034', 'P1008'].includes(code ?? '')) throw error;
      if (attempt >= 2) throw new AppError(503, 'STORAGE_UNAVAILABLE');
      await new Promise((done) => setTimeout(done, 5 * (attempt + 1)));
    }
  }
}

export async function readReminder(db: PrismaClient, householdId: string, userId: string, reminderId: string) {
  return db.$transaction(async (tx) => {
    await requireMember(tx, householdId, userId);
    const row = await tx.reminder.findFirst({ where: { id: reminderId, householdId }, include: relations });
    if (!row) throw new AppError(404, 'REMINDER_NOT_FOUND');
    return present(row);
  });
}

function dateBounds(now: Date, zone: string) {
  const midnight = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(zone).startOfDay();
  return [new Date(midnight.epochMilliseconds), new Date(midnight.add({ days: 1 }).epochMilliseconds)];
}

export async function listReminders(db: PrismaClient, householdId: string, userId: string, opts: ListOptions) {
  const view = opts.view ?? 'HOUSEHOLD';
  const { bucket } = opts;
  if (!views.includes(view) || (bucket && !buckets.includes(bucket))) throw new AppError(422, 'INVALID_FILTER');
  const limit = opts.limit ?? 30;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(422, 'INVALID_LIMIT');
  const tokenScope = JSON.stringify([householdId, userId, view, bucket ?? null]);
  const filters: Prisma.ReminderWhereInput[] = [
    { householdId, lifecycle: bucket === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE' },
  ];
  if (view === 'MINE') filters.push({ assignments: { some: { userId } } });
  if (view === 'REQUESTED') filters.push({ requesterId: userId });
  if (opts.cursor) {
    try {
      if (opts.cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(opts.cursor)) throw new Error();
      const [scope, value, id] = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8'));
      const at = new Date(value);
      if (scope !== tokenScope || typeof id !== 'string' || !id || !Number.isFinite(at.getTime())) throw new Error();
      filters.push({ OR: [
        { occurrence: { scheduledAt: { gt: at } } },
        { occurrence: { scheduledAt: at }, id: { gt: id } },
      ] });
    } catch {
      throw new AppError(422, 'INVALID_CURSOR');
    }
  }
  return db.$transaction(async (tx) => {
    const { household } = await requireMember(tx, householdId, userId);
    const now = opts.now ?? new Date();
    if (bucket && bucket !== 'ARCHIVED') {
      const [, tomorrow] = dateBounds(now, household.defaultTimeZone);
      const scheduledAt = bucket === 'OVERDUE' ? { lt: now } :
        bucket === 'TODAY' ? { gte: now, lt: tomorrow } : { gte: tomorrow };
      filters.push({ occurrence: { scheduledAt } });
    }
    const rows = await tx.reminder.findMany({
      where: { AND: filters }, include: relations,
      orderBy: [{ occurrence: { scheduledAt: 'asc' } }, { id: 'asc' }], take: limit + 1,
    });
    const items = rows.slice(0, limit).map(present);
    const last = items.at(-1);
    const nextCursor = rows.length > limit && last ?
      Buffer.from(JSON.stringify([tokenScope, last.currentOccurrence.scheduledAt, last.reminderId])).toString('base64url') :
      undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  });
}
