import { describe, expect, it } from 'vitest';

import { civilDate, civilTime, formatCivilDate } from '../../src/time/civil.js';
import {
  CIVIL_AMBIGUOUS,
  CIVIL_GAP,
  CIVIL_PLAIN,
  abbreviationAt,
  daylightEnd,
  daylightStart,
  lookupZone,
  nthWeekdayOfMonth,
  observesDaylightTime,
  offsetAt,
  resolveCivil,
  zoneNames,
} from '../../src/time/zone.js';

const eastern = lookupZone('eastern');
const hawaii = lookupZone('hawaii');

describe('the zone table', () => {
  it('lists what it knows', () => {
    expect(zoneNames()).toContain('eastern');
    expect(zoneNames()).toHaveLength(6);
  });

  it('is not fussy about case or surrounding space', () => {
    expect(lookupZone('  Eastern ').name).toBe('eastern');
  });

  it('refuses a zone it does not hold, and says what it does hold', () => {
    try {
      lookupZone('America/New_York', 'areaZone');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('zone.unknown');
      expect(error.detail.known).toContain('eastern');
    }
  });

  it('refuses something that is not a name at all', () => {
    expect(() => lookupZone(5)).toThrow(/must be the name of a zone/);
  });

  it('knows which zones move', () => {
    expect(observesDaylightTime(eastern)).toBe(true);
    expect(observesDaylightTime(hawaii)).toBe(false);
  });
});

describe('nthWeekdayOfMonth', () => {
  it('finds the second Sunday in March', () => {
    expect(formatCivilDate(nthWeekdayOfMonth(2025, 3, 0, 2))).toBe('2025-03-09');
    expect(formatCivilDate(nthWeekdayOfMonth(2026, 3, 0, 2))).toBe('2026-03-08');
  });

  it('finds the first Sunday in November', () => {
    expect(formatCivilDate(nthWeekdayOfMonth(2025, 11, 0, 1))).toBe('2025-11-02');
    expect(formatCivilDate(nthWeekdayOfMonth(2026, 11, 0, 1))).toBe('2026-11-01');
  });

  it('handles a month whose first day is the weekday asked for', () => {
    expect(formatCivilDate(nthWeekdayOfMonth(2025, 6, 0, 1))).toBe('2025-06-01');
  });

  it('refuses a fifth weekday a month does not have', () => {
    expect(() => nthWeekdayOfMonth(2025, 2, 0, 5)).toThrow(/has no day/);
  });

  it('refuses a count outside one to five', () => {
    expect(() => nthWeekdayOfMonth(2025, 3, 0, 0)).toThrow(/counts from one to five/);
    expect(() => nthWeekdayOfMonth(2025, 3, 0, 6)).toThrow(/counts from one to five/);
  });
});

describe('the transitions', () => {
  it.each([
    [2025, '2025-03-09T07:00:00.000Z', '2025-11-02T06:00:00.000Z'],
    [2026, '2026-03-08T07:00:00.000Z', '2026-11-01T06:00:00.000Z'],
  ])('places the %i transitions in eastern', (year, start, end) => {
    expect(new Date(daylightStart(eastern, year) * 1000).toISOString()).toBe(start);
    expect(new Date(daylightEnd(eastern, year) * 1000).toISOString()).toBe(end);
  });

  it('reads standard time in January and daylight time in July', () => {
    expect(offsetAt(eastern, Date.UTC(2025, 0, 15) / 1000)).toBe(-5 * 3600);
    expect(offsetAt(eastern, Date.UTC(2025, 6, 15) / 1000)).toBe(-4 * 3600);
  });

  it('flips exactly at the transition and not a second before', () => {
    const start = daylightStart(eastern, 2025);
    expect(offsetAt(eastern, start - 1)).toBe(-5 * 3600);
    expect(offsetAt(eastern, start)).toBe(-4 * 3600);
    const end = daylightEnd(eastern, 2025);
    expect(offsetAt(eastern, end - 1)).toBe(-4 * 3600);
    expect(offsetAt(eastern, end)).toBe(-5 * 3600);
  });

  it('holds one offset all year where nothing moves', () => {
    expect(offsetAt(hawaii, Date.UTC(2025, 0, 15) / 1000)).toBe(-10 * 3600);
    expect(offsetAt(hawaii, Date.UTC(2025, 6, 15) / 1000)).toBe(-10 * 3600);
  });

  it('names the abbreviation the record should carry', () => {
    expect(abbreviationAt(eastern, Date.UTC(2025, 0, 15) / 1000)).toBe('EST');
    expect(abbreviationAt(eastern, Date.UTC(2025, 6, 15) / 1000)).toBe('EDT');
  });

  it('reads correctly on either side of a year boundary', () => {
    expect(offsetAt(eastern, Date.UTC(2024, 11, 31, 23) / 1000)).toBe(-5 * 3600);
    expect(offsetAt(eastern, Date.UTC(2025, 0, 1, 1) / 1000)).toBe(-5 * 3600);
  });
});

describe('resolveCivil', () => {
  it('reads an ordinary afternoon as one instant', () => {
    const answer = resolveCivil(eastern, civilDate(2025, 8, 14), civilTime(14, 0));
    expect(answer.kind).toBe(CIVIL_PLAIN);
    expect(answer.instants).toHaveLength(1);
  });

  it('reads the hour that never happened as a gap', () => {
    const answer = resolveCivil(eastern, civilDate(2025, 3, 9), civilTime(2, 30));
    expect(answer.kind).toBe(CIVIL_GAP);
    expect(answer.instants).toEqual([]);
  });

  it('reads the hour that happened twice as ambiguous, earlier first', () => {
    const answer = resolveCivil(eastern, civilDate(2025, 11, 2), civilTime(1, 30));
    expect(answer.kind).toBe(CIVIL_AMBIGUOUS);
    expect(answer.instants).toHaveLength(2);
    expect(answer.instants[1] - answer.instants[0]).toBe(3600);
  });

  it('has no gap and no ambiguity in a zone that does not move', () => {
    expect(resolveCivil(hawaii, civilDate(2025, 3, 9), civilTime(2, 30)).kind).toBe(CIVIL_PLAIN);
    expect(resolveCivil(hawaii, civilDate(2025, 11, 2), civilTime(1, 30)).kind).toBe(CIVIL_PLAIN);
  });
});
