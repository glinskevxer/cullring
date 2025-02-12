import { describe, expect, it } from 'vitest';

import { civilDate } from '../../src/time/civil.js';
import {
  CLOCKS,
  CLOCK_DATE,
  CLOCK_DAYS,
  CLOCK_HOURS,
  CLOCK_SAMPLES,
  CLOCK_TIDES,
  deadline,
  describeDeadline,
  measureDeadline,
  refuseConversion,
  unitWord,
} from '../../src/time/clock.js';
import { instant } from '../../src/time/instant.js';

const hour = (n) => instant(n * 3600);

describe('building a deadline', () => {
  it('keeps its unit', () => {
    expect(deadline(CLOCK_HOURS, 12)).toEqual({ kind: 'hours', quantity: 12 });
    expect(deadline(CLOCK_SAMPLES, 2)).toEqual({ kind: 'samples', quantity: 2 });
  });

  it('allows a fractional hour but not a fractional sample', () => {
    expect(deadline(CLOCK_HOURS, 1.5).quantity).toBe(1.5);
    expect(() => deadline(CLOCK_SAMPLES, 1.5)).toThrow(/whole units/);
    expect(() => deadline(CLOCK_TIDES, 0.5)).toThrow(/whole units/);
  });

  it('refuses a negative count', () => {
    expect(() => deadline(CLOCK_DAYS, -1)).toThrow(/at least zero/);
  });

  it('refuses a clock it does not keep, and lists the ones it does', () => {
    try {
      deadline('fortnights', 1);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('clock.kind');
      expect(error.detail.known).toEqual(CLOCKS.slice());
    }
  });

  it('carries a date rather than a count on the fixed clock', () => {
    expect(deadline(CLOCK_DATE, civilDate(2025, 4, 15)).on).toEqual(civilDate(2025, 4, 15));
    expect(() => deadline(CLOCK_DATE, 15)).toThrow(/carries a civil date/);
  });
});

describe('naming the unit', () => {
  it.each([
    [CLOCK_HOURS, 1, 'hour'],
    [CLOCK_HOURS, 2, 'hours'],
    [CLOCK_SAMPLES, 1, 'conforming sample'],
    [CLOCK_SAMPLES, 3, 'conforming samples'],
    [CLOCK_TIDES, 1, 'tide cycle'],
  ])('reads %s at %i as %s', (kind, count, word) => {
    expect(unitWord(kind, count)).toBe(word);
  });

  it('refuses to name a clock it does not keep', () => {
    expect(() => unitWord('fortnights', 1)).toThrow(/not a clock/);
  });

  it('describes a deadline in its own words', () => {
    expect(describeDeadline(deadline(CLOCK_HOURS, 12))).toBe('12 hours');
    expect(describeDeadline(deadline(CLOCK_HOURS, 1))).toBe('1 hour');
    expect(describeDeadline(deadline(CLOCK_SAMPLES, 2))).toBe('2 conforming samples');
    expect(describeDeadline(deadline(CLOCK_DATE, civilDate(2025, 4, 5)))).toBe('by 2025-04-05');
  });
});

describe('the refusal to convert', () => {
  it('names both units and raises a rule error', () => {
    try {
      refuseConversion(CLOCK_SAMPLES, CLOCK_HOURS);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('clock.incomparable');
      expect(error.message).toBe(
        'a deadline counted in conforming samples cannot be restated in hours',
      );
      expect(error.detail).toEqual({ from: CLOCK_SAMPLES, to: CLOCK_HOURS });
    }
  });

  it('refuses in both directions, because neither is the privileged one', () => {
    expect(() => refuseConversion(CLOCK_HOURS, CLOCK_TIDES)).toThrow(/cannot be restated/);
    expect(() => refuseConversion(CLOCK_TIDES, CLOCK_HOURS)).toThrow(/cannot be restated/);
  });
});

describe('measuring against a deadline', () => {
  it('counts hours between two instants', () => {
    const answer = measureDeadline(deadline(CLOCK_HOURS, 12), { from: hour(0), at: hour(10) });
    expect(answer).toMatchObject({ elapsed: 10, required: 12, remaining: 2, met: false });
  });

  it('calls the deadline met exactly on the boundary', () => {
    expect(measureDeadline(deadline(CLOCK_HOURS, 12), { from: hour(0), at: hour(12) }).met).toBe(
      true,
    );
  });

  it('counts days between two dates', () => {
    const answer = measureDeadline(deadline(CLOCK_DAYS, 30), {
      from: civilDate(2025, 1, 1),
      on: civilDate(2025, 1, 20),
    });
    expect(answer).toMatchObject({ elapsed: 19, remaining: 11, met: false });
  });

  it('counts conforming samples off the laboratory log', () => {
    expect(measureDeadline(deadline(CLOCK_SAMPLES, 2), { conformingSamples: 2 }).met).toBe(true);
    expect(measureDeadline(deadline(CLOCK_SAMPLES, 2), { conformingSamples: 1 }).remaining).toBe(1);
  });

  it('counts tide cycles off the tide table', () => {
    expect(measureDeadline(deadline(CLOCK_TIDES, 1), { tideCycles: 1 }).met).toBe(true);
  });

  it('reads a fixed date against the day being asked about', () => {
    const target = deadline(CLOCK_DATE, civilDate(2025, 4, 15));
    expect(measureDeadline(target, { on: civilDate(2025, 4, 14) })).toMatchObject({
      remainingDays: 1,
      met: false,
    });
    expect(measureDeadline(target, { on: civilDate(2025, 4, 15) }).met).toBe(true);
    expect(measureDeadline(target, { on: civilDate(2025, 5, 1) }).remainingDays).toBe(0);
  });

  it('never reports a negative remainder', () => {
    expect(
      measureDeadline(deadline(CLOCK_HOURS, 4), { from: hour(0), at: hour(9) }).remaining,
    ).toBe(0);
  });
});

describe('missing evidence is refused rather than counted as zero', () => {
  it.each([
    [deadline(CLOCK_HOURS, 12), {}, /between two instants/],
    [deadline(CLOCK_HOURS, 12), { from: hour(0) }, /between two instants/],
    [deadline(CLOCK_DAYS, 30), { from: civilDate(2025, 1, 1) }, /between two dates/],
    [deadline(CLOCK_SAMPLES, 2), {}, /measured by conformingSamples/],
    [deadline(CLOCK_TIDES, 1), {}, /measured by tideCycles/],
    [deadline(CLOCK_DATE, civilDate(2025, 1, 1)), {}, /measured against a date/],
  ])('refuses %o with %o', (target, evidence, pattern) => {
    expect(() => measureDeadline(target, evidence)).toThrow(pattern);
  });

  it('refuses a sample count that is not a whole number of samples', () => {
    expect(() => measureDeadline(deadline(CLOCK_SAMPLES, 2), { conformingSamples: 1.5 })).toThrow(
      /conformingSamples/,
    );
    expect(() => measureDeadline(deadline(CLOCK_SAMPLES, 2), { conformingSamples: -1 })).toThrow(
      /conformingSamples/,
    );
  });

  it('measures with no evidence bag at all by refusing, not by defaulting', () => {
    expect(() => measureDeadline(deadline(CLOCK_HOURS, 12))).toThrow(/two instants/);
  });
});
