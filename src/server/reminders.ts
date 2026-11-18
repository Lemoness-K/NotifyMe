import { Temporal } from '@js-temporal/polyfill';
import { AppError } from './errors.js';
import { ianaZone, localToUtc } from './time.js';
import type { TimeReminderInput } from './repository.js';

export { localToUtc };

const invalid = (field: string) => new AppError(422, 'INVALID_FIELD', { field });
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 128;
}

export function prepareReminder(body: unknown, userId: string): TimeReminderInput {
  const data = asRecord(body);
  if (!data) throw invalid('body');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw invalid('title');
  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.length > 4_000)) {
    throw invalid('description');
  }
  if (data.recurrence !== undefined || data.verification !== undefined) throw invalid('unsupported');
  const requesterId = data.requesterId === undefined ? userId : data.requesterId;
  if (!isId(requesterId)) throw invalid('requesterId');
  const assigneeIds = data.assigneeIds === undefined ? [userId] : data.assigneeIds;
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0 || assigneeIds.length > 100 ||
      !assigneeIds.every(isId) || new Set(assigneeIds).size !== assigneeIds.length) {
    throw invalid('assigneeIds');
  }
  const trigger = asRecord(data.trigger);
  if (!trigger || trigger.kind !== 'TIME') throw invalid('trigger.kind');
  if (typeof trigger.timeZone !== 'string' || !ianaZone(trigger.timeZone)) throw invalid('trigger.timeZone');
  if (typeof trigger.scheduledAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(trigger.scheduledAt)) {
    throw invalid('trigger.scheduledAt');
  }
  let scheduledAt: Date;
  try {
    scheduledAt = new Date(Temporal.Instant.from(trigger.scheduledAt).epochMilliseconds);
  } catch { throw invalid('trigger.scheduledAt'); }
  return { title: data.title, description: data.description, requesterId, assigneeIds, scheduledAt, timeZone: trigger.timeZone };
}
