import { Temporal } from '@js-temporal/polyfill';

export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Calendar = 'MONDAY_START' | 'SUNDAY_START' | 'ISO_8601';
export interface Recurrence {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  weekdays?: typeof weekdays[number][];
  monthDays?: number[];
  lastDayOfMonth?: boolean;
  endOn?: string;
}

export interface StoredRecurrence extends Recurrence {
  localStart: string;
  timeZone: string;
  calendar: Calendar;
  anchorWeek?: string;
}

function weekStart(day: Temporal.PlainDate, calendar: Calendar) {
  return day.subtract({ days: calendar === 'SUNDAY_START' ? day.dayOfWeek % 7 : day.dayOfWeek - 1 });
}

export function makeRecurrence(rule: Recurrence, localStart: string, timeZone: string, calendar: Calendar, former?: StoredRecurrence) {
  const start = Temporal.PlainDateTime.from(localStart).toPlainDate();
  const result: StoredRecurrence = { ...rule, localStart, timeZone, calendar };
  if (rule.frequency === 'WEEKLY') {
    result.weekdays = rule.weekdays?.length ? rule.weekdays : [weekdays[start.dayOfWeek - 1]];
    let first = start;
    while (!result.weekdays.includes(weekdays[first.dayOfWeek - 1])) first = first.add({ days: 1 });
    result.anchorWeek = former?.localStart === localStart && former.frequency === 'WEEKLY' ?
      former.anchorWeek : weekStart(first, calendar).toString();
  }
  return result;
}

function daysApart(first: Temporal.PlainDate, second: Temporal.PlainDate) {
  return first.until(second).days;
}

function allowedDay(rule: StoredRecurrence, day: Temporal.PlainDate, origin: Temporal.PlainDate) {
  if (rule.frequency === 'DAILY') return daysApart(origin, day) % rule.interval === 0;
  if (rule.frequency === 'WEEKLY') {
    const distance = daysApart(Temporal.PlainDate.from(rule.anchorWeek!), weekStart(day, rule.calendar)) / 7;
    return distance >= 0 && distance % rule.interval === 0 && rule.weekdays!.includes(weekdays[day.dayOfWeek - 1]);
  }
  const months = (day.year - origin.year) * 12 + day.month - origin.month;
  return months % rule.interval === 0 && (rule.lastDayOfMonth ? day.day === day.daysInMonth :
    (rule.monthDays?.length ? rule.monthDays : [origin.day]).includes(day.day));
}

export function nextOccurrence(rule: StoredRecurrence, after?: string) {
  const start = Temporal.PlainDateTime.from(rule.localStart);
  const origin = start.toPlainDate();
  let day = after ? Temporal.PlainDateTime.from(after).toPlainDate().add({ days: 1 }) : origin;
  if (Temporal.PlainDate.compare(day, origin) < 0) day = origin;
  const end = rule.endOn && Temporal.PlainDate.from(rule.endOn);
  // Input intervals are bounded, and Gregorian month/day patterns repeat every 400 years.
  for (let checked = 0; checked < 146_097; checked++, day = day.add({ days: 1 })) {
    if (end && Temporal.PlainDate.compare(day, end) > 0) break;
    if (allowedDay(rule, day, origin)) {
      const local = day.toPlainDateTime(start.toPlainTime());
      const scheduledAt = new Date(local.toZonedDateTime(rule.timeZone, { disambiguation: 'compatible' }).epochMilliseconds);
      return { key: local.toString({ smallestUnit: 'minute' }), scheduledAt };
    }
  }
  return null;
}

export function scheduleLocal(instant: Date, zone: string) {
  return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone)
    .toPlainDateTime().toString({ smallestUnit: 'minute' });
}
