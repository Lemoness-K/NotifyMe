import { Temporal } from '@js-temporal/polyfill';
import { invalidField, record, validateRevision } from './household-rules.js';
import { prepareReminder } from './reminders.js';
import { weekdays, type Recurrence } from './recurrence.js';
import { occurrenceActions } from './occurrence-actions.js';

export const locationEvents = ['ENTER', 'EXIT', 'DWELL', 'AFTER_EXIT'] as const;
export type WorkTrigger =
  | { kind: 'TIME'; scheduledAt: Date; timeZone: string }
  | { kind: 'LOCATION'; latitude: number; longitude: number; radiusM?: number; event: typeof locationEvents[number];
      durationMinutes?: number; placeName?: string };
const scopes = ['THIS_OCCURRENCE', 'THIS_AND_FUTURE', 'ENTIRE_SERIES'] as const;
export type Scope = typeof scopes[number];

export interface WorkFields {
  title?: string;
  description?: string;
  requesterId?: string;
  assigneeIds?: string[];
  trigger?: WorkTrigger;
  recurrence?: Recurrence;
  verification?: { enabled: boolean; verifierId?: string };
}

function text(value: unknown, field: string, max: number, allowBlank = false) {
  if (typeof value !== 'string' || value.length > max || (!allowBlank && !value.trim())) throw invalidField(field);
  return value;
}

function number(value: unknown, field: string, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) throw invalidField(field);
  return value;
}

function option<T extends string>(input: unknown, choices: readonly T[], field: string): T {
  return choices.find((item) => item === input) ?? (() => { throw invalidField(field); })();
}

function list<T>(input: unknown, field: string, value: (item: unknown) => T) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw invalidField(field);
  const parsed = input.map(value);
  if (new Set(parsed).size !== parsed.length) throw invalidField(field);
  return parsed;
}

function parseTrigger(input: unknown): WorkTrigger {
  const body = record(input);
  if (body.kind === 'TIME') {
    if (['latitude', 'longitude', 'radiusM', 'event', 'durationMinutes', 'placeName'].some((key) => key in body)) {
      throw invalidField('trigger.kind');
    }
    const result = prepareReminder({ title: 'validation', trigger: body }, 'validation');
    return { kind: 'TIME', scheduledAt: result.scheduledAt, timeZone: result.timeZone };
  }
  if (body.kind !== 'LOCATION' || 'scheduledAt' in body || 'timeZone' in body) throw invalidField('trigger.kind');
  const event = option(body.event, locationEvents, 'trigger.event');
  const sustained = event === 'DWELL' || event === 'AFTER_EXIT';
  if (sustained !== (body.durationMinutes !== undefined)) throw invalidField('trigger.durationMinutes');
  return { kind: 'LOCATION',
    latitude: number(body.latitude, 'trigger.latitude', -90, 90),
    longitude: number(body.longitude, 'trigger.longitude', -180, 180), event,
    radiusM: body.radiusM === undefined ? undefined : number(body.radiusM, 'trigger.radiusM', 0, 2_147_483_647, true),
    durationMinutes: sustained ? number(body.durationMinutes, 'trigger.durationMinutes', 1, 1440, true) : undefined,
    placeName: body.placeName === undefined ? undefined : text(body.placeName, 'trigger.placeName', 200, true) };
}

function recurrence(input: unknown): Recurrence {
  const body = record(input);
  const frequency = option(body.frequency, ['DAILY', 'WEEKLY', 'MONTHLY'], 'recurrence.frequency');
  const result: Recurrence = { frequency,
    interval: body.interval === undefined ? 1 : number(body.interval, 'recurrence.interval', 1, 366, true) };
  if (body.weekdays !== undefined) {
    if (frequency !== 'WEEKLY') throw invalidField('recurrence.weekdays');
    result.weekdays = list(body.weekdays, 'recurrence.weekdays', (item) => option(item, weekdays, 'recurrence.weekdays'));
  }
  if (body.monthDays !== undefined) {
    if (frequency !== 'MONTHLY') throw invalidField('recurrence.monthDays');
    result.monthDays = list(body.monthDays, 'recurrence.monthDays', (item) => number(item, 'recurrence.monthDays', 1, 31, true));
  }
  if (body.lastDayOfMonth !== undefined) {
    if (frequency !== 'MONTHLY' || typeof body.lastDayOfMonth !== 'boolean' || (body.lastDayOfMonth && result.monthDays)) {
      throw invalidField('recurrence.lastDayOfMonth');
    }
    result.lastDayOfMonth = body.lastDayOfMonth;
  }
  if (body.endOn !== undefined) {
    if (typeof body.endOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.endOn)) throw invalidField('recurrence.endOn');
    try { result.endOn = Temporal.PlainDate.from(body.endOn).toString(); } catch { throw invalidField('recurrence.endOn'); }
  }
  return result;
}

function fields(body: Record<string, unknown>): WorkFields {
  const result: WorkFields = {};
  if (body.title !== undefined) result.title = text(body.title, 'title', 200);
  if (body.description !== undefined) result.description = text(body.description, 'description', 4000, true);
  if (body.requesterId !== undefined) result.requesterId = text(body.requesterId, 'requesterId', 128);
  if (body.assigneeIds !== undefined) result.assigneeIds = list(body.assigneeIds, 'assigneeIds', (id) => text(id, 'assigneeIds', 128)).sort();
  if (body.trigger !== undefined) result.trigger = parseTrigger(body.trigger);
  if (body.recurrence !== undefined) result.recurrence = recurrence(body.recurrence);
  if (body.verification !== undefined) {
    const setting = record(body.verification);
    if (typeof setting.enabled !== 'boolean') throw invalidField('verification.enabled');
    if (!setting.enabled && setting.verifierId !== undefined) throw invalidField('verification.verifierId');
    result.verification = { enabled: setting.enabled,
      verifierId: setting.verifierId === undefined ? undefined : text(setting.verifierId, 'verification.verifierId', 128) };
  }
  return result;
}

export function createWorkInput(input: unknown, userId: string) {
  const data = fields(record(input));
  if (data.title === undefined) throw invalidField('title');
  if (data.trigger === undefined) throw invalidField('trigger');
  return { ...data, title: data.title, trigger: data.trigger, requesterId: data.requesterId ?? userId,
    assigneeIds: data.assigneeIds ?? [userId] };
}
export type CreateWorkInput = ReturnType<typeof createWorkInput>;

export function editWorkInput(input: unknown) {
  const body = record(input);
  return { ...fields(body), revision: validateRevision(body.revision),
    scope: body.scope === undefined ? undefined : option(body.scope, scopes, 'scope'),
    occurrenceId: body.occurrenceId === undefined ? undefined : text(body.occurrenceId, 'occurrenceId', 128) };
}
export type EditWorkInput = ReturnType<typeof editWorkInput>;

export function lifecycleInput(input: unknown) {
  const body = record(input);
  return { action: option(body.action, ['ARCHIVE', 'RESTORE'] as const, 'action'), revision: validateRevision(body.revision) };
}

export function actionInput(input: unknown) {
  const body = record(input);
  return { action: option(body.action, occurrenceActions, 'action'), revision: validateRevision(body.revision) };
}
