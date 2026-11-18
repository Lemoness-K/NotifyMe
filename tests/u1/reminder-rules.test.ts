import { describe, expect, it } from 'vitest';
import { localToUtc, prepareReminder } from '../../src/server/reminders.js';

const time = {kind: 'TIME', scheduledAt: '2027-01-01T12:00:00.000Z', timeZone: 'Asia/Seoul'};

describe('U1 time and reminder rules', () => {
  it('keeps original text and uses the current requester and initial assignee', () => {
    const draft = prepareReminder({title: ' 식물 돌보기 ', description: ' 기억 ', trigger: time}, 'member');
    expect(draft).toMatchObject({
      title: ' 식물 돌보기 ', description: ' 기억 ', requesterId: 'member', assigneeIds: ['member'],
    });
  });

  it.each([
    ['invalid body', null],
    ['empty title', {title: ' ', trigger: time}],
    ['not UTC', {title: '작업', trigger: {...time, scheduledAt: '2027-01-01T12:00:00'}}],
    ['bad zone', {title: '작업', trigger: {...time, timeZone: 'Not/AZone'}}],
    ['offset instead of IANA zone', {title: '작업', trigger: {...time, timeZone: '+00:00'}}],
    ['wrong type', {title: '작업', trigger: {...time, kind: 'LOCATION'}}],
    ['duplicate assignee', {title: '작업', trigger: time, assigneeIds: ['m', 'm']}],
    ['empty assignees', {title: '작업', trigger: time, assigneeIds: []}],
    ['blank requester', {title: '작업', trigger: time, requesterId: ''}],
    ['recurrence', {title: '작업', trigger: time, recurrence: {frequency: 'DAILY'}}],
  ])('rejects %s with 422', (_name, draft) => {
    expect(() => prepareReminder(draft, 'member')).toThrow(expect.objectContaining({ status: 422 }));
  });

  it.each([
    ['2026-03-08T02:30', '2026-03-08T07:30:00Z'],
    ['2026-11-01T01:30', '2026-11-01T05:30:00Z'],
  ])('converts DST-compatible %s to %s', (input, expected) => {
    expect(localToUtc(input, 'America/New_York')).toBe(expected);
  });
});
