import { invalidField, record, validateRevision } from './household-rules.js';
import { householdDefaults, type HouseholdSettingsPatch, type UserSettings } from './households.js';
import { ianaZone } from './time.js';

type SettingScope = 'HOUSEHOLD' | 'USER' | 'INSTALLATION' | 'REMINDER';
type Definition = {
  key: string;
  scope: SettingScope;
  valueType: string;
  defaultValue: unknown;
  validation: Record<string, unknown>;
  storageOwner: string;
};
const locales = ['ko-KR', 'en-US'] as const;
const calendars = ['MONDAY_START', 'SUNDAY_START', 'ISO_8601'] as const;
const definitions: Definition[] = [
  { key: 'defaultTimeZone', scope: 'HOUSEHOLD', valueType: 'iana-time-zone', defaultValue: 'Asia/Seoul',
    validation: { iana: true }, storageOwner: 'Household.defaultTimeZone' },
  { key: 'radiusM', scope: 'HOUSEHOLD', valueType: 'meter-range', defaultValue: householdDefaults.radiusM,
    validation: { integer: true, minimum: 0, order: ['min', 'default', 'max'] }, storageOwner: 'HouseholdSettings.radius' },
  { key: 'maxLocationDurationMin', scope: 'HOUSEHOLD', valueType: 'minutes', defaultValue: householdDefaults.maxLocationDurationMin,
    validation: { minimum: 10, maximum: 1440, integer: true }, storageOwner: 'HouseholdSettings.maxLocationDurationMin' },
  { key: 'weeklyCalendarConvention', scope: 'HOUSEHOLD', valueType: 'enum', defaultValue: householdDefaults.weeklyCalendarConvention,
    validation: { allowed: calendars }, storageOwner: 'HouseholdSettings.weeklyCalendarConvention' },
  { key: 'locale', scope: 'USER', valueType: 'locale', defaultValue: null,
    validation: { allowed: locales, fallback: ['DEVICE_LOCALE', 'ko-KR'] }, storageOwner: 'UserSettings.locale' },
  { key: 'timeZone', scope: 'USER', valueType: 'iana-time-zone', defaultValue: null,
    validation: { iana: true }, storageOwner: 'User.timeZone' },
  { key: 'notificationChannels', scope: 'INSTALLATION', valueType: 'os-managed', defaultValue: null,
    validation: { owner: 'ANDROID_OS' }, storageOwner: 'Android.OS.NotificationChannels' },
  { key: 'notificationPermissions', scope: 'INSTALLATION', valueType: 'os-managed', defaultValue: null,
    validation: { owner: 'ANDROID_OS' }, storageOwner: 'Android.OS.Permissions' },
  { key: 'trigger', scope: 'REMINDER', valueType: 'discriminated-trigger', defaultValue: null,
    validation: { allowed: ['TIME', 'LOCATION'] }, storageOwner: 'Trigger' },
  { key: 'recurrence', scope: 'REMINDER', valueType: 'recurrence-rule', defaultValue: null,
    validation: { timeZoneSnapshot: true, calendarSnapshot: true }, storageOwner: 'RecurrenceRule' },
  { key: 'completionVerification', scope: 'REMINDER', valueType: 'optional-verification', defaultValue: null,
    validation: { owner: 'REMINDER' }, storageOwner: 'Reminder' },
];
export const catalog = definitions.map((item) => ({
  ...item, definitionVersion: 1,
  disabledBehavior: 'NO_NEW_WRITES_KEEP_EXISTING_VALUES',
  retirementBehavior: 'KEEP_VALUES_UNTIL_APPROVED_MIGRATION',
  migration: 'OWNER_SCOPE_SCHEMA_MIGRATION',
}));

function fields(input: unknown, allowed: string[]) {
  const body = record(input);
  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) throw invalidField(field);
  }
  return body;
}

function timeZone(value: unknown, field: string) {
  if (typeof value !== 'string' || !ianaZone(value)) throw invalidField(field);
  return value;
}

function valueOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  const result = choices.find((choice) => choice === value);
  if (result === undefined) throw invalidField(field);
  return result;
}

export function prepareUserSettings(input: unknown): UserSettings {
  const body = fields(input, ['revision', 'locale', 'timeZone']);
  const result: UserSettings = { revision: validateRevision(body.revision) };
  if (body.locale !== undefined) result.locale = valueOf(body.locale, locales, 'locale');
  if (body.timeZone !== undefined) result.timeZone = timeZone(body.timeZone, 'timeZone');
  return result;
}

export function prepareHouseholdSettings(input: unknown): HouseholdSettingsPatch {
  const body = fields(input, ['revision', 'defaultTimeZone', 'radiusM', 'maxLocationDurationMin', 'weeklyCalendarConvention']);
  const result: HouseholdSettingsPatch = { revision: validateRevision(body.revision) };
  if (body.defaultTimeZone !== undefined) result.defaultTimeZone = timeZone(body.defaultTimeZone, 'defaultTimeZone');
  if (body.radiusM !== undefined) {
    const { min, default: standard, max } = fields(body.radiusM, ['min', 'default', 'max']);
    if (typeof min !== 'number' || typeof standard !== 'number' || typeof max !== 'number' ||
        ![min, standard, max].every(Number.isSafeInteger) || min < 0 || min > standard || standard > max || max > 2_147_483_647) {
      throw invalidField('radiusM');
    }
    result.radiusM = { min, default: standard, max };
  }
  if (body.maxLocationDurationMin !== undefined) {
    const duration = body.maxLocationDurationMin;
    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 10 || duration > 1440) {
      throw invalidField('maxLocationDurationMin');
    }
    result.maxLocationDurationMin = duration;
  }
  if (body.weeklyCalendarConvention !== undefined) {
    result.weeklyCalendarConvention = valueOf(body.weeklyCalendarConvention, calendars, 'weeklyCalendarConvention');
  }
  return result;
}
