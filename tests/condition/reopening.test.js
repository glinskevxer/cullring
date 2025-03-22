import { describe, expect, it } from 'vitest';

import {
  AFTER_HOURS,
  AFTER_SAMPLES,
  AFTER_TIDES,
  ON_DATE,
  REOPENING_KINDS,
  afterHours,
  afterSamples,
  afterTides,
  clockOf,
  describeReopening,
  evaluateReopening,
  isStricter,
  onDate,
} from '../../src/condition/reopening.js';
import { CLOCK_DATE, CLOCK_HOURS, CLOCK_SAMPLES, CLOCK_TIDES } from '../../src/time/clock.js';
import { civilDate } from '../../src/time/civil.js';
import { instant } from '../../src/time/instant.js';

const hour = (n) => instant(n * 3600);

describe('building a reopening rule', () => {
  it('names the four ways an area comes back', () => {
    expect(REOPENING_KINDS).toEqual([AFTER_HOURS, AFTER_SAMPLES, AFTER_TIDES, ON_DATE]);
  });

  it('binds each one to its own clock', () => {
    expect(clockOf(afterHours(72))).toBe(CLOCK_HOURS);
    expect(clockOf(afterSamples(2))).toBe(CLOCK_SAMPLES);
    expect(clockOf(afterTides(1))).toBe(CLOCK_TIDES);
    expect(clockOf(onDate('2025-09-16'))).toBe(CLOCK_DATE);
  });

  it('refuses a kind it does not hold', () => {
    expect(() => clockOf({ kind: 'when the water clears' })).toThrow(/not a way of reopening/);
  });

  it('refuses a fractional sample or tide count', () => {
    expect(() => afterSamples(1.5)).toThrow(/whole units/);
    expect(() => afterTides(0.5)).toThrow(/whole units/);
  });

  it('takes a date written or already civil', () => {
    expect(onDate('2025-09-16').target.on).toEqual(civilDate(2025, 9, 16));
    expect(onDate(civilDate(2025, 9, 16)).target.on).toEqual(civilDate(2025, 9, 16));
  });

  it('describes itself in its own unit', () => {
    expect(describeReopening(afterHours(72))).toBe('after 72 hours');
    expect(describeReopening(afterSamples(2))).toBe('after 2 conforming samples');
    expect(describeReopening(afterTides(1))).toBe('after 1 tide cycle');
    expect(describeReopening(onDate('2025-09-16'))).toBe('by 2025-09-16');
  });
});

describe('measuring a reopening rule', () => {
  it('reopens once the hours have run', () => {
    const rule = afterHours(72);
    expect(evaluateReopening(rule, { from: hour(0), at: hour(71) }).met).toBe(false);
    expect(evaluateReopening(rule, { from: hour(0), at: hour(72) }).met).toBe(true);
  });

  it('reopens once the samples are in', () => {
    const rule = afterSamples(2);
    expect(evaluateReopening(rule, { conformingSamples: 1 }).met).toBe(false);
    expect(evaluateReopening(rule, { conformingSamples: 2 }).met).toBe(true);
  });

  it('reopens once the tides have turned', () => {
    expect(evaluateReopening(afterTides(1), { tideCycles: 1 }).met).toBe(true);
  });

  it('reopens on the day named and not before', () => {
    const rule = onDate('2025-09-16');
    expect(evaluateReopening(rule, { on: civilDate(2025, 9, 15) }).met).toBe(false);
    expect(evaluateReopening(rule, { on: civilDate(2025, 9, 16) }).met).toBe(true);
  });

  it('carries its description along, so a notice can quote it', () => {
    const answer = evaluateReopening(afterHours(72), { from: hour(0), at: hour(80) });
    expect(answer.description).toBe('after 72 hours');
    expect(answer.clock).toBe(CLOCK_HOURS);
  });

  it('refuses evidence for the wrong clock rather than answering with it', () => {
    expect(() => evaluateReopening(afterSamples(2), { from: hour(0), at: hour(999) })).toThrow(
      /conformingSamples/,
    );
    expect(() => evaluateReopening(afterHours(72), { conformingSamples: 99 })).toThrow(
      /two instants/,
    );
  });

  it('does not treat missing evidence as a met deadline', () => {
    expect(() => evaluateReopening(afterTides(1), {})).toThrow(/tideCycles/);
  });
});

describe('comparing two reopening rules', () => {
  it('compares two rules on the same clock', () => {
    expect(isStricter(afterHours(96), afterHours(72))).toBe(true);
    expect(isStricter(afterHours(48), afterHours(72))).toBe(false);
    expect(isStricter(afterSamples(3), afterSamples(2))).toBe(true);
  });

  it('compares two dates the calendar way', () => {
    expect(isStricter(onDate('2025-10-01'), onDate('2025-09-16'))).toBe(true);
    expect(isStricter(onDate('2025-09-16'), onDate('2025-10-01'))).toBe(false);
    expect(isStricter(onDate('2026-01-01'), onDate('2025-12-31'))).toBe(true);
    expect(isStricter(onDate('2025-09-17'), onDate('2025-09-16'))).toBe(true);
  });

  it('answers with nothing when the two run on different clocks', () => {
    expect(isStricter(afterHours(72), afterSamples(2))).toBeNull();
    expect(isStricter(afterSamples(2), afterTides(1))).toBeNull();
    expect(isStricter(onDate('2025-09-16'), afterHours(72))).toBeNull();
  });

  it('calls two identical rules not stricter than each other', () => {
    expect(isStricter(afterHours(72), afterHours(72))).toBe(false);
    expect(isStricter(onDate('2025-09-16'), onDate('2025-09-16'))).toBe(false);
  });
});
