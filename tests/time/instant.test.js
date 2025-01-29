import { describe, expect, it } from 'vitest';

import { civilDate, civilTime, formatCivilDate, formatCivilTime } from '../../src/time/civil.js';
import {
  addHours,
  addSeconds,
  civilDateAt,
  civilPartsAt,
  compareInstant,
  earliest,
  formatInstant,
  formatOffset,
  hoursBetween,
  instant,
  instantFromCivil,
  isAfter,
  isBefore,
  isInstant,
  latest,
  parseInstant,
  requireInstant,
  secondsBetween,
  toStoredForm,
} from '../../src/time/instant.js';

const august = parseInstant('2025-08-14T09:30-04:00');

describe('building an instant', () => {
  it('wraps a whole number of seconds and freezes it', () => {
    const point = instant(1000);
    expect(point.epochSecond).toBe(1000);
    expect(Object.isFrozen(point)).toBe(true);
  });

  it('refuses a fractional second, because the register keeps whole ones', () => {
    expect(() => instant(1.5)).toThrow(/whole number of seconds/);
  });

  it('recognises its own kind and refuses a bare number', () => {
    expect(isInstant(instant(0))).toBe(true);
    expect(isInstant(0)).toBe(false);
    expect(isInstant(null)).toBe(false);
    expect(() => requireInstant(1755178200, 'harvestedAt')).toThrow(/harvestedAt must be/);
    expect(requireInstant(august, 'harvestedAt')).toBe(august);
  });
});

describe('arithmetic', () => {
  it('adds seconds and hours', () => {
    expect(addSeconds(instant(100), 50).epochSecond).toBe(150);
    expect(addHours(instant(0), 2).epochSecond).toBe(7200);
    expect(addHours(instant(0), 1.5).epochSecond).toBe(5400);
  });

  it('refuses a fractional second and a non finite hour', () => {
    expect(() => addSeconds(instant(0), 0.5)).toThrow(/whole/);
    expect(() => addHours(instant(0), Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('measures gaps in seconds and hours, signed', () => {
    expect(secondsBetween(instant(100), instant(400))).toBe(300);
    expect(hoursBetween(instant(0), instant(5400))).toBe(1.5);
    expect(hoursBetween(instant(5400), instant(0))).toBe(-1.5);
  });

  it('orders instants', () => {
    expect(compareInstant(instant(1), instant(2))).toBe(-1);
    expect(compareInstant(instant(2), instant(1))).toBe(1);
    expect(compareInstant(instant(2), instant(2))).toBe(0);
    expect(isBefore(instant(1), instant(2))).toBe(true);
    expect(isAfter(instant(1), instant(2))).toBe(false);
  });

  it('picks the ends of a list', () => {
    const points = [instant(50), instant(10), instant(90)];
    expect(earliest(points).epochSecond).toBe(10);
    expect(latest(points).epochSecond).toBe(90);
  });
});

describe('reading a written stamp', () => {
  it('takes the offset from the text when the text carries one', () => {
    expect(parseInstant('2025-08-14T09:30-04:00').epochSecond).toBe(1755178200);
    expect(parseInstant('2025-08-14T13:30Z').epochSecond).toBe(1755178200);
    expect(parseInstant('2025-08-14 09:30:00 -0400').epochSecond).toBe(1755178200);
  });

  it('falls back to the zone when the text carries no offset', () => {
    expect(parseInstant('2025-08-14 09:30', { zone: 'eastern' }).epochSecond).toBe(1755178200);
  });

  it('refuses a bare stamp when no zone was given', () => {
    try {
      parseInstant('2025-08-14 09:30', { field: 'landedAt' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('instant.zone');
      expect(error.message).toMatch(/landedAt/);
    }
  });

  it.each(['14/08/2025 09:30', '2025-08-14', 'yesterday morning', ''])('refuses %s', (text) => {
    expect(() => parseInstant(text, { zone: 'eastern' })).toThrow(/timestamp/);
  });

  it('refuses a date and a time that are out of range', () => {
    expect(() => parseInstant('2025-02-30 09:30', { zone: 'eastern' })).toThrow(/not a date/);
    expect(() => parseInstant('2025-02-28 25:30', { zone: 'eastern' })).toThrow(/not a time/);
  });

  it('refuses an offset no zone uses', () => {
    expect(() => parseInstant('2025-08-14T09:30+19:00')).toThrow(/no zone on earth/);
  });

  it('refuses something that is not text', () => {
    expect(() => parseInstant(1755178200)).toThrow(/written timestamp/);
  });
});

describe('the two awkward mornings', () => {
  it('refuses the hour that never happened', () => {
    try {
      instantFromCivil('eastern', civilDate(2025, 3, 9), civilTime(2, 30));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('instant.gap');
      expect(error.message).toMatch(/did not happen/);
    }
  });

  it('refuses the hour that happened twice unless told which one', () => {
    expect(() => instantFromCivil('eastern', civilDate(2025, 11, 2), civilTime(1, 30))).toThrow(
      /happened twice/,
    );
  });

  it('takes either reading when the caller names one', () => {
    const early = instantFromCivil('eastern', civilDate(2025, 11, 2), civilTime(1, 30), {
      ambiguous: 'earlier',
    });
    const late = instantFromCivil('eastern', civilDate(2025, 11, 2), civilTime(1, 30), {
      ambiguous: 'later',
    });
    expect(secondsBetween(early, late)).toBe(3600);
    expect(toStoredForm('eastern', early)).toBe('2025-11-02T01:30:00-04:00');
    expect(toStoredForm('eastern', late)).toBe('2025-11-02T01:30:00-05:00');
  });

  it('passes the reading through the written form as well', () => {
    const point = parseInstant('2025-11-02 01:30', { zone: 'eastern', ambiguous: 'earlier' });
    expect(toStoredForm('eastern', point)).toBe('2025-11-02T01:30:00-04:00');
  });
});

describe('rendering', () => {
  it('reads an instant back into civil parts in a zone', () => {
    const parts = civilPartsAt('eastern', august);
    expect(formatCivilDate(parts.date)).toBe('2025-08-14');
    expect(formatCivilTime(parts.time)).toBe('09:30');
    expect(parts.abbreviation).toBe('EDT');
    expect(parts.offset).toBe(-4 * 3600);
  });

  it('gives the same instant a different civil date in a different zone', () => {
    const small = parseInstant('2025-08-14T02:30Z');
    expect(formatCivilDate(civilDateAt('eastern', small))).toBe('2025-08-13');
    expect(formatCivilDate(civilDateAt('pacific', small))).toBe('2025-08-13');
    expect(formatCivilDate(civilDateAt('hawaii', small))).toBe('2025-08-13');
  });

  it('formats for a report and for the register', () => {
    expect(formatInstant('eastern', august)).toBe('2025-08-14 09:30 EDT');
    expect(formatInstant('eastern', august, { seconds: true, zoneLabel: false })).toBe(
      '2025-08-14 09:30:00',
    );
    expect(toStoredForm('eastern', august)).toBe('2025-08-14T09:30:00-04:00');
  });

  it('writes an offset the way the register does', () => {
    expect(formatOffset(-4 * 3600)).toBe('-04:00');
    expect(formatOffset(0)).toBe('+00:00');
    expect(formatOffset(5 * 3600 + 30 * 60)).toBe('+05:30');
  });

  it('round trips the stored form', () => {
    const stored = toStoredForm('eastern', august);
    expect(parseInstant(stored).epochSecond).toBe(august.epochSecond);
  });
});
