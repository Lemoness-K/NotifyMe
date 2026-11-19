import { describe, expect, it } from 'vitest';
import { catalog, prepareHouseholdSettings, prepareUserSettings } from '../../src/server/settings.js';

describe('settings scope validation', () => {
  it('publishes one definition per key, with all four owner scopes', () => {
    expect(new Set(catalog.map(({ scope }) => scope))).toEqual(new Set(['HOUSEHOLD', 'USER', 'INSTALLATION', 'REMINDER']));
    expect(new Set(catalog.map(({ key }) => key)).size).toBe(catalog.length);
    expect(catalog.every((item) => item.storageOwner && item.migration && item.disabledBehavior && item.retirementBehavior)).toBe(true);
    expect(catalog.find(({ key }) => key === 'locale')).toMatchObject({ scope: 'USER', storageOwner: 'UserSettings.locale' });
    expect(catalog.find(({ key }) => key === 'timeZone')).toMatchObject({ scope: 'USER', storageOwner: 'User.timeZone' });
  });
  it('accepts both locales and only IANA display zones', () => {
    expect(prepareUserSettings({ revision: 0, locale: 'ko-KR' })).toEqual({ revision: 0, locale: 'ko-KR' });
    expect(prepareUserSettings({ revision: 0, locale: 'en-US', timeZone: 'Asia/Seoul' })).toEqual({ revision: 0, locale: 'en-US', timeZone: 'Asia/Seoul' });
    expect(() => prepareUserSettings({ revision: 0, locale: 'fr-FR' })).toThrow('INVALID_FIELD');
    expect(() => prepareUserSettings({ revision: 0, timeZone: '+09:00' })).toThrow('INVALID_FIELD');
  });
  it('rejects another owner and unknown fields instead of assigning them to current scope', () => {
    expect(() => prepareUserSettings({ revision: 0, userId: 'someone' })).toThrow('INVALID_FIELD');
    expect(() => prepareUserSettings({ revision: 0, radiusM: { min: 10, default: 20, max: 30 } })).toThrow('INVALID_FIELD');
    expect(() => prepareHouseholdSettings({ revision: 0, locale: 'en-US' })).toThrow('INVALID_FIELD');
    expect(() => prepareHouseholdSettings({ revision: -1 })).toThrow('INVALID_FIELD');
  });
  it.each([{ min: 0, default: 100, max: 500 }, { min: 50, default: 50, max: 50 }])(
    'accepts radius boundaries and equality %j',
    (radiusM) => expect(prepareHouseholdSettings({ revision: 0, radiusM })).toMatchObject({ radiusM }),
  );
  it.each([{ min: -1, default: 10, max: 20 }, { min: 10, default: 5, max: 30 }, { min: 10, default: 15, max: 12 }, { min: 1.5, default: 3, max: 4 }])(
    'rejects inverted or inexact radii %j',
    (radiusM) => expect(() => prepareHouseholdSettings({ revision: 0, radiusM })).toThrow('INVALID_FIELD'),
  );
  it('enforces inclusive duration caps and exact calendar conventions', () => {
    expect(prepareHouseholdSettings({ revision: 0, maxLocationDurationMin: 10, weeklyCalendarConvention: 'SUNDAY_START' }))
      .toMatchObject({ maxLocationDurationMin: 10, weeklyCalendarConvention: 'SUNDAY_START' });
    expect(prepareHouseholdSettings({ revision: 0, maxLocationDurationMin: 1440, weeklyCalendarConvention: 'ISO_8601' }))
      .toMatchObject({ maxLocationDurationMin: 1440, weeklyCalendarConvention: 'ISO_8601' });
    for (const duration of [9, 1441, '60', 12.5]) {
      expect(() => prepareHouseholdSettings({ revision: 0, maxLocationDurationMin: duration })).toThrow('INVALID_FIELD');
    }
    expect(() => prepareHouseholdSettings({ revision: 0, weeklyCalendarConvention: 'sunday' })).toThrow('INVALID_FIELD');
  });
});
