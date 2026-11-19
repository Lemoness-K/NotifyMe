import { AppError } from './errors.js';
import { Prisma, type PrismaClient } from './generated/client.js';
import { detailRelations, occurrenceDto, relations, requireMember } from './repository.js';

type Query = Record<string, unknown>;

function page(query: Query, scope: string) {
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if ((query.limit !== undefined && (typeof query.limit !== 'string' || !/^\d{1,3}$/.test(query.limit))) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(422, 'INVALID_LIMIT');
  if (query.cursor === undefined) return { limit, cursor: undefined };
  try {
    if (typeof query.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(query.cursor)) throw new Error();
    const [bound, at, id] = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
    if (bound !== scope || typeof at !== 'string' || typeof id !== 'string' || !id) throw new Error();
    const date = new Date(at);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== at) throw new Error();
    return { limit, cursor: { at: date, id } };
  } catch { throw new AppError(422, 'INVALID_CURSOR'); }
}

function token(scope: string, at: Date, id: string) {
  return Buffer.from(JSON.stringify([scope, at.toISOString(), id])).toString('base64url');
}

const states = ['PENDING', 'COMPLETED', 'MISSED', 'SKIPPED', 'CANCELLED', 'VERIFICATION_PENDING'];

export async function listOccurrences(db: PrismaClient, householdId: string, actorId: string, reminderId: string, query: Query, now: Date) {
  const state = query.state;
  if (state !== undefined && (typeof state !== 'string' || !states.includes(state))) throw new AppError(422, 'INVALID_FILTER');
  const scope = JSON.stringify(['occurrences', householdId, actorId, reminderId, state ?? null]);
  const { limit, cursor } = page(query, scope);
  return db.$transaction(async (tx) => {
    await requireMember(tx, householdId, actorId);
    const work = await tx.reminder.findFirst({ where: { id: reminderId, householdId }, include: detailRelations });
    if (!work) throw new AppError(404, 'REMINDER_NOT_FOUND');
    const byRequest = state === 'VERIFICATION_PENDING';
    const stage = byRequest ? Prisma.sql`coalesce(c.requestedAt, o.stateAt)` : Prisma.sql`coalesce(o.scheduledAt, o.stateAt)`;
    const stateFilter = state ? Prisma.sql` AND o.state = ${state}` : Prisma.empty;
    const cursorFilter = cursor ? Prisma.sql` WHERE (at > ${cursor.at.toISOString()} OR (at = ${cursor.at.toISOString()} AND id > ${cursor.id}))` : Prisma.empty;
    const rows = await tx.$queryRaw<{ id: string; at: string }[]>`
      WITH scoped AS (
        SELECT o.id, strftime('%Y-%m-%dT%H:%M:%fZ', ${stage}) AS at FROM Occurrence o
        LEFT JOIN Completion c ON ${byRequest} AND c.occurrenceId = o.id AND c.state = 'OPEN'
        WHERE o.reminderId = ${reminderId} ${stateFilter})
      SELECT id, at FROM scoped ${cursorFilter} ORDER BY at, id LIMIT ${limit + 1}`;
    const selected = rows.slice(0, limit);
    const last = selected.at(-1);
    const records = await tx.occurrence.findMany({ where: { reminderId, id: { in: selected.map(({ id }) => id) } },
      include: relations.occurrences.include });
    const byId = new Map(records.map((occurrence) => [occurrence.id, occurrence]));
    return {
      items: selected.map(({ id }) => occurrenceDto(work, byId.get(id)!, actorId, now)),
      ...(last && rows.length > limit ? { nextCursor: token(scope, new Date(last.at), last.id) } : {}),
    };
  });
}

export async function listHistory(db: PrismaClient, householdId: string, actorId: string, query: Query) {
  const view = query.view ?? 'MINE';
  if (view !== 'MINE' && view !== 'HOUSEHOLD') throw new AppError(422, 'INVALID_FILTER');
  const reminderId = query.reminderId;
  if (reminderId !== undefined && (typeof reminderId !== 'string' || !reminderId || reminderId.length > 128)) {
    throw new AppError(422, 'INVALID_FILTER');
  }
  const scope = JSON.stringify(['history', householdId, actorId, view, reminderId ?? null]);
  const { limit, cursor } = page(query, scope);
  const filters: Prisma.ReminderAuditWhereInput[] = [{ householdId }];
  if (reminderId) filters.push({ reminderId });
  if (view === 'MINE') filters.push({ reminder: { assignments: { some: { userId: actorId, endedAt: null } } } });
  if (cursor) filters.push({ OR: [{ stateAt: { lt: cursor.at } }, { stateAt: cursor.at, id: { lt: cursor.id } }] });
  return db.$transaction(async (tx) => {
    await requireMember(tx, householdId, actorId);
    const rows = await tx.reminderAudit.findMany({ where: { AND: filters }, orderBy: [{ stateAt: 'desc' }, { id: 'desc' }],
      include: { reminder: { select: { title: true, lifecycle: true } } }, take: limit + 1 });
    const selected = rows.slice(0, limit);
    const last = selected.at(-1);
    return { items: selected.map((row) => ({ reminderId: row.reminderId, occurrenceId: row.occurrenceId ?? undefined,
      kind: row.action, occurredAt: row.stateAt.toISOString(), actorId: row.actorId, title: row.reminder.title,
      lifecycle: row.reminder.lifecycle, changes: JSON.parse(row.changes) as unknown })),
      ...(last && rows.length > limit ? { nextCursor: token(scope, last.stateAt, last.id) } : {}) };
  });
}
