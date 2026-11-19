import { describe, expect, it } from 'vitest';
import { makeRecurrence, nextOccurrence } from '../../src/server/recurrence.js';

describe('recurrence schedules', () => {
  it('moves daily gaps forward and chooses the earlier repeated local time', () => {
    const spring = makeRecurrence({ frequency: 'DAILY', interval: 1 }, '2031-03-08T02:30', 'America/New_York', 'MONDAY_START');
    expect(nextOccurrence(spring, '2031-03-08T02:30')?.scheduledAt.toISOString()).toBe('2031-03-09T07:30:00.000Z');
    const fall = makeRecurrence({ frequency: 'DAILY', interval: 1 }, '2031-11-01T01:30', 'America/New_York', 'MONDAY_START');
    expect(nextOccurrence(fall, '2031-11-01T01:30')?.scheduledAt.toISOString()).toBe('2031-11-02T05:30:00.000Z');
  });

  it('skips impossible dates and includes the local end date', () => {
    const rule = makeRecurrence({ frequency: 'MONTHLY', interval: 1, monthDays: [31], endOn: '2032-05-31' },
      '2032-03-31T09:00', 'Asia/Seoul', 'MONDAY_START');
    const may = nextOccurrence(rule, '2032-03-31T09:00');
    expect(may?.key).toBe('2032-05-31T09:00');
    expect(nextOccurrence(rule, may!.key)).toBeNull();
  });

  it('uses the last calendar day in leap years', () => {
    const rule = makeRecurrence({ frequency: 'MONTHLY', interval: 1, lastDayOfMonth: true },
      '2032-01-31T15:00', 'UTC', 'MONDAY_START');
    expect(nextOccurrence(rule, '2032-01-31T15:00')?.key).toBe('2032-02-29T15:00');
  });

  it('anchors a biweekly rule on the first eligible instance and preserves existing anchor on an unchanged start', () => {
    const original = makeRecurrence({ frequency: 'WEEKLY', interval: 2, weekdays: ['MO'] },
      '2032-01-06T09:00', 'UTC', 'MONDAY_START');
    expect(nextOccurrence(original)?.key).toBe('2032-01-12T09:00');
    const changed = makeRecurrence({ frequency: 'WEEKLY', interval: 2, weekdays: ['TH'] },
      '2032-01-06T09:00', 'UTC', 'MONDAY_START', original);
    expect(changed.anchorWeek).toBe(original.anchorWeek);
    expect(nextOccurrence(changed)?.key).toBe('2032-01-15T09:00');
  });
});
