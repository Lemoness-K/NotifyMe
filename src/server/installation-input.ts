import { invalidField, optionalId, record, validateRevision } from './household-rules.js';
import type { LocationReport, Registration } from './installations.js';

export function installationId(value: unknown, field: string) {
  const id = optionalId(value, field);
  if (id === undefined) throw invalidField(field);
  return id;
}

export function registrationInput(input: unknown): Registration {
  const { installationId: id, appVersion, platform, pushToken, capabilities } = record(input);
  if (platform !== 'ANDROID') throw invalidField('platform');
  if (typeof appVersion !== 'string' || !/^[A-Za-z0-9.+_-]{1,64}$/.test(appVersion)) throw invalidField('appVersion');
  if (pushToken !== undefined && (typeof pushToken !== 'string' || !/^[A-Za-z0-9:_-]{1,4096}$/.test(pushToken))) {
    throw invalidField('pushToken');
  }
  if (capabilities !== undefined) {
    const flags = record(capabilities);
    for (const key of ['canNotify', 'canScheduleExactAlarm', 'canUseBackgroundLocation']) {
      if (flags[key] !== undefined && typeof flags[key] !== 'boolean') throw invalidField('capabilities');
    }
  }
  return { installationId: installationId(id, 'installationId'), appVersion, pushToken };
}

export function exclusionInput(input: unknown) {
  const { excluded, epoch, revision } = record(input);
  if (typeof excluded !== 'boolean') throw invalidField('excluded');
  return { excluded, epoch: installationId(epoch, 'epoch'), revision: validateRevision(revision) };
}

export function installationQueryInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^[0-9]{1,10}$/.test(value)) throw invalidField(field);
  return validateRevision(Number(value), field);
}

export function locationPageQuery(query: Record<string, unknown>) {
  const { cursor } = query;
  const limit = installationQueryInteger(query.limit, 'limit');
  if (limit !== undefined && (limit < 1 || limit > 100)) throw invalidField('limit');
  if (cursor !== undefined && (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(cursor))) throw invalidField('cursor');
  return { cursor, limit };
}

export function locationEventInput(input: unknown): LocationReport {
  const { detectedAt, epoch, eventId, occurrenceId, triggerVersion, condition } = record(input);
  if (condition !== 'ENTER' && condition !== 'EXIT' && condition !== 'DWELL' && condition !== 'AFTER_EXIT') throw invalidField('condition');
  if (typeof detectedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(detectedAt) ||
      !Number.isFinite(Date.parse(detectedAt))) throw invalidField('detectedAt');
  return { epoch: installationId(epoch, 'epoch'), eventId: installationId(eventId, 'eventId'), occurrenceId: installationId(occurrenceId, 'occurrenceId'),
    triggerVersion: validateRevision(triggerVersion, 'triggerVersion'), condition, detectedAt: new Date(detectedAt) };
}
