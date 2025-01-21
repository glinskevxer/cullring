import { describe, expect, it } from 'vitest';

import {
  MIDNIGHT,
  addDays,
  civilDate,
  civilTime,
  compareCivilDate,
  dayOfWeek,
  dayOfYear,
  daysBetween,
  daysInMonth,
  formatCivilDate,
  formatCivilTime,
  fromEpochDay,
  isLeapYear,
  monthName,
  parseCivilDate,
  parseCivilTime,
  sameCivilDate,
  secondOfDay,
  toEpochDay,
  weekdayName,
} from '../../src/time/civil.js';

describe('leap years and month lengths', () => {
  it.each([
    [1900, false],
    [1999, false],
    [2000, true],
    [2024, true],
    [2025, false],
    [2100, false],
  ])('reads %i correctly', (year, leap) => {
    expect(isLeapYear(year)).toBe(leap);
  });

  it('gives February its extra day only in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('knows the short months', () => {
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 9)).toBe(30);
    expect(daysInMonth(2025, 12)).toBe(31);
  });
});

describe('civilDate', () => {
  it('builds a frozen record', () => {
    const date = civilDate(2025, 7, 4);
    expect(date).toEqual({ year: 2025, month: 7, day: 4 });
    expect(Object.isFrozen(date)).toBe(true);
  });

  it('refuses a month outside the year', () => {
    expect(() => civilDate(2025, 13, 1)).toThrow(/is not a month/);
    expect(() => civilDate(2025, 0, 1)).toThrow(/is not a month/);
  });

  it('refuses a day the month does not have, rather than rolling it forward', () => {
    expect(() => civilDate(2025, 9, 31)).toThrow(/has no day 31/);
    expect(() => civilDate(2025, 2, 29)).toThrow(/has no day 29/);
    expect(civilDate(2024, 2, 29).day).toBe(29);
  });

  it('refuses fractional parts', () => {
    expect(() => civilDate(2025.5, 1, 1)).toThrow(/whole numbers/);
  });
});

describe('parseCivilDate', () => {
  it('reads the written form', () => {
    expect(parseCivilDate('2025-03-09')).toEqual({ year: 2025, month: 3, day: 9 });
  });

  it('trims surrounding space, because a sheet column often carries it', () => {
    expect(parseCivilDate('  2025-03-09  ')).toEqual({ year: 2025, month: 3, day: 9 });
  });

  it.each(['2025-3-9', '03/09/2025', '2025-03-09T08:00', ''])('refuses %s', (text) => {
    expect(() => parseCivilDate(text, 'harvestedOn')).toThrow(/harvestedOn/);
  });

  it('names the field when handed something that is not text', () => {
    expect(() => parseCivilDate(20250309, 'sampledOn')).toThrow(/sampledOn must be written/);
  });
});

describe('epoch days', () => {
  it.each([
    ['1970-01-01', 0],
    ['1970-01-02', 1],
    ['1969-12-31', -1],
    ['2000-03-01', 11017],
    ['2025-01-15', 20103],
  ])('numbers %s as %i', (text, days) => {
    expect(toEpochDay(parseCivilDate(text))).toBe(days);
  });

  it('round trips every day across a leap boundary', () => {
    for (
      let day = toEpochDay(civilDate(2024, 2, 20));
      day <= toEpochDay(civilDate(2024, 3, 5));
      day += 1
    ) {
      expect(toEpochDay(fromEpochDay(day))).toBe(day);
    }
  });

  it('round trips a century boundary that is not a leap year', () => {
    const date = civilDate(2100, 2, 28);
    expect(fromEpochDay(toEpochDay(date))).toEqual(date);
    expect(addDays(date, 1)).toEqual(civilDate(2100, 3, 1));
  });

  it('refuses a fractional day number', () => {
    expect(() => fromEpochDay(1.5)).toThrow(/whole number/);
  });
});

describe('date arithmetic', () => {
  it('adds and subtracts days across a month end', () => {
    expect(addDays(civilDate(2025, 1, 31), 1)).toEqual(civilDate(2025, 2, 1));
    expect(addDays(civilDate(2025, 3, 1), -1)).toEqual(civilDate(2025, 2, 28));
  });

  it('measures the gap in whole days and signs it', () => {
    expect(daysBetween(civilDate(2025, 1, 1), civilDate(2025, 1, 31))).toBe(30);
    expect(daysBetween(civilDate(2025, 1, 31), civilDate(2025, 1, 1))).toBe(-30);
    expect(daysBetween(civilDate(2025, 1, 1), civilDate(2025, 1, 1))).toBe(0);
  });

  it('refuses a fractional step', () => {
    expect(() => addDays(civilDate(2025, 1, 1), 0.5)).toThrow(/whole/);
  });
});

describe('comparison', () => {
  it('orders two dates', () => {
    expect(compareCivilDate(civilDate(2025, 1, 1), civilDate(2025, 1, 2))).toBe(-1);
    expect(compareCivilDate(civilDate(2025, 1, 2), civilDate(2025, 1, 1))).toBe(1);
    expect(compareCivilDate(civilDate(2025, 1, 1), civilDate(2025, 1, 1))).toBe(0);
  });

  it('sorts a list the way a report wants it', () => {
    const dates = [civilDate(2025, 5, 1), civilDate(2024, 12, 31), civilDate(2025, 1, 1)];
    expect(dates.sort(compareCivilDate).map(formatCivilDate)).toEqual([
      '2024-12-31',
      '2025-01-01',
      '2025-05-01',
    ]);
  });

  it('answers sameness directly', () => {
    expect(sameCivilDate(civilDate(2025, 1, 1), civilDate(2025, 1, 1))).toBe(true);
    expect(sameCivilDate(civilDate(2025, 1, 1), civilDate(2025, 1, 2))).toBe(false);
  });
});

describe('naming days', () => {
  it.each([
    ['2025-01-15', 3, 'Wednesday'],
    ['2025-01-19', 0, 'Sunday'],
    ['1970-01-01', 4, 'Thursday'],
    ['1969-12-28', 0, 'Sunday'],
  ])('reads %s as %i', (text, index, name) => {
    const date = parseCivilDate(text);
    expect(dayOfWeek(date)).toBe(index);
    expect(weekdayName(date)).toBe(name);
  });

  it('names months and refuses a number that is not one', () => {
    expect(monthName(8)).toBe('August');
    expect(() => monthName(0)).toThrow(/is not a month/);
  });

  it('counts the day of the year, leap day included', () => {
    expect(dayOfYear(civilDate(2025, 1, 1))).toBe(1);
    expect(dayOfYear(civilDate(2025, 12, 31))).toBe(365);
    expect(dayOfYear(civilDate(2024, 12, 31))).toBe(366);
  });
});

describe('civil times', () => {
  it('builds and formats', () => {
    expect(formatCivilTime(civilTime(9, 5))).toBe('09:05');
    expect(formatCivilTime(civilTime(9, 5, 30), { seconds: true })).toBe('09:05:30');
  });

  it('parses with and without seconds', () => {
    expect(parseCivilTime('06:45')).toEqual({ hour: 6, minute: 45, second: 0 });
    expect(parseCivilTime('06:45:09')).toEqual({ hour: 6, minute: 45, second: 9 });
  });

  it.each([
    [24, 0, /is not an hour/],
    [0, 60, /is not a minute/],
    [0, 0, /is not a second/],
  ])('refuses %i:%i out of range', (hour, minute, pattern) => {
    const second = pattern.source.includes('second') ? 60 : 0;
    expect(() => civilTime(hour, minute, second)).toThrow(pattern);
  });

  it.each(['6:45', '0645', 'six', ''])('refuses the written form %s', (text) => {
    expect(() => parseCivilTime(text, 'landedAt')).toThrow(/landedAt/);
  });

  it('counts seconds into the day', () => {
    expect(secondOfDay(MIDNIGHT)).toBe(0);
    expect(secondOfDay(civilTime(1, 1, 1))).toBe(3661);
    expect(secondOfDay(civilTime(23, 59, 59))).toBe(86399);
  });
});
