import { Temporal } from '@js-temporal/polyfill';

export function ianaZone(zone: string): boolean {
  if (zone.length > 128 || /^[+-]/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions();
    return !!zone;
  } catch { return false; }
}

export function localToUtc(local: string, zone: string): string {
  if (!ianaZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new RangeError('Invalid local schedule');
  }
  return Temporal.PlainDateTime.from(local).toZonedDateTime(zone, { disambiguation: 'compatible' }).toInstant().toString();
}
