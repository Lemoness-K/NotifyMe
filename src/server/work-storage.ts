import { createHash } from 'node:crypto';
import type { Prisma } from './generated/client.js';
import { AppError } from './errors.js';

export async function updateOccurrence(tx: Prisma.TransactionClient, id: string, revision: number,
  changes: Prisma.OccurrenceUpdateManyMutationInput) {
  const result = await tx.occurrence.updateMany({ where: { id, revision }, data: { ...changes, revision: { increment: 1 } } });
  if (result.count !== 1) throw new AppError(409, 'STALE_REVISION');
  return tx.occurrence.findUniqueOrThrow({ where: { id } });
}

export async function appendChange(tx: Prisma.TransactionClient, householdId: string, reminderId: string,
  kind: 'UPSERT' | 'DELETE', changedAt: Date) {
  const { revision } = await tx.householdFeedCursor.upsert({
    where: { householdId }, create: { householdId, revision: 1 }, update: { revision: { increment: 1 } },
  });
  if (kind === 'DELETE') await tx.reminderFeedEntry.deleteMany({ where: { householdId, reminderId } });
  return tx.reminderFeedEntry.create({ data: { householdId, reminderId, kind, revision, changedAt,
    expiresAt: kind === 'DELETE' ? new Date(changedAt.getTime() + 30 * 86_400_000) : null } });
}

export function workAudit(tx: Prisma.TransactionClient, householdId: string, reminderId: string, actorId: string,
  action: string, stateAt: Date, occurrenceId?: string, changes: Record<string, string | number | boolean> = {}) {
  return tx.reminderAudit.create({ data: { householdId, reminderId, actorId, action, stateAt, occurrenceId,
    changes: JSON.stringify(changes) } });
}

export const legacyCreateOperation = 'CREATE_TIME_REMINDER';
type CreateFormat = 'WORK_V1' | 'LEGACY_TIME';

function createScope(householdId: string, actorId: string, key: string) {
  return createHash('sha256').update(JSON.stringify([householdId, actorId, key])).digest('hex');
}

export async function rejectDeletedCreate(tx: Prisma.TransactionClient, householdId: string, actorId: string, key: string,
  digests: Partial<Record<CreateFormat, string>>) {
  const rows = await tx.deletedCreateKey.findMany({ where: { scopeDigest: createScope(householdId, actorId, key) } });
  if (!rows.length) return;
  const exact = rows.some((row) => row.inputDigest === digests[row.format as CreateFormat]);
  throw new AppError(409, exact ? 'REMINDER_ALREADY_DELETED' : 'IDEMPOTENCY_CONFLICT');
}

export async function preserveDeletedCreateKeys(tx: Prisma.TransactionClient, householdId: string, reminderId: string) {
  const current = await tx.reminderCommandResult.findMany({
    where: { householdId, reminderId, operation: 'CREATE' }, select: { actorId: true, key: true, digest: true },
  });
  const legacy = await tx.requestResult.findMany({
    where: { householdId, reminderId, operation: legacyCreateOperation }, select: { userId: true, key: true, inputDigest: true },
  });
  const records = [
    ...current.map(({ actorId, key, digest }) => ({ scopeDigest: createScope(householdId, actorId, key), format: 'WORK_V1', inputDigest: digest })),
    ...legacy.map(({ userId, key, inputDigest }) => ({ scopeDigest: createScope(householdId, userId, key), format: 'LEGACY_TIME', inputDigest })),
  ];
  for (const record of records) {
    await tx.deletedCreateKey.upsert({
      where: { scopeDigest_format: { scopeDigest: record.scopeDigest, format: record.format } }, create: record, update: {},
    });
  }
}
