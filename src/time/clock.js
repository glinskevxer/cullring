/**
 * The clocks, and the fact that they do not convert.
 *
 * Five different things in this program are called a deadline and not one of
 * them is measured the way the others are.
 *
 *   hours       twelve hours from harvest, read off a watch
 *   days        thirty days from the survey, read off a calendar
 *   samples     two consecutive conforming results, read off a laboratory log
 *   tides       one tide cycle, read off a tide table for that station
 *   date        the fifteenth of April, which is not counted at all
 *
 * The office has been asked more than once to express a sample count in hours,
 * and the answer is that it cannot be done: two conforming samples might take
 * eight days or eight weeks depending on when the boat goes out. So a deadline
 * carries its unit and the program refuses to restate it in another one. That
 * refusal is the whole point of this module.
 */

import { InputError, RuleError } from '../core/errors.js';
import { compareCivilDate, daysBetween } from './civil.js';
import { hoursBetween } from './instant.js';

export const CLOCK_HOURS = 'hours';
export const CLOCK_DAYS = 'days';
export const CLOCK_SAMPLES = 'samples';
export const CLOCK_TIDES = 'tides';
export const CLOCK_DATE = 'date';

export const CLOCKS = Object.freeze([
  CLOCK_HOURS,
  CLOCK_DAYS,
  CLOCK_SAMPLES,
  CLOCK_TIDES,
  CLOCK_DATE,
]);

const UNIT_WORDS = Object.freeze({
  [CLOCK_HOURS]: ['hour', 'hours'],
  [CLOCK_DAYS]: ['day', 'days'],
  [CLOCK_SAMPLES]: ['conforming sample', 'conforming samples'],
  [CLOCK_TIDES]: ['tide cycle', 'tide cycles'],
  [CLOCK_DATE]: ['date', 'dates'],
});

/**
 * A deadline is a quantity in one unit. The counted clocks carry a number and
 * the fixed date clock carries a civil date instead, because there is nothing
 * to count.
 */
export function deadline(kind, quantity) {
  if (!CLOCKS.includes(kind)) {
    throw new InputError('clock.kind', `${kind} is not a clock this program keeps`, {
      kind,
      known: CLOCKS.slice(),
    });
  }
  if (kind === CLOCK_DATE) {
    if (typeof quantity !== 'object' || quantity === null || quantity.year === undefined) {
      throw new InputError('clock.quantity', 'a fixed deadline carries a civil date', { kind });
    }
    return Object.freeze({ kind, on: quantity });
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new InputError(
      'clock.quantity',
      `a deadline in ${kind} carries a count of at least zero`,
      {
        kind,
        quantity,
      },
    );
  }
  if (kind !== CLOCK_HOURS && !Number.isInteger(quantity)) {
    throw new InputError('clock.quantity', `a deadline in ${kind} is counted in whole units`, {
      kind,
      quantity,
    });
  }
  return Object.freeze({ kind, quantity });
}

export function unitWord(kind, count) {
  const words = UNIT_WORDS[kind];
  if (words === undefined) {
    throw new InputError('clock.kind', `${kind} is not a clock this program keeps`, { kind });
  }
  return count === 1 ? words[0] : words[1];
}

export function describeDeadline(target) {
  if (target.kind === CLOCK_DATE) {
    const { year, month, day } = target.on;
    return `by ${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  }
  return `${trimNumber(target.quantity)} ${unitWord(target.kind, target.quantity)}`;
}

/**
 * The refusal. It is a named export rather than a thrown string because the
 * command line prints it as a finding and the office has learned to recognise
 * the wording.
 */
export function refuseConversion(from, to) {
  throw new RuleError(
    'clock.incomparable',
    `a deadline counted in ${unitWord(from, 2)} cannot be restated in ${unitWord(to, 2)}`,
    { from, to },
  );
}

/**
 * Measure progress against a deadline. Each clock reads a different field of
 * the evidence, and a clock whose evidence is missing is refused rather than
 * treated as zero, because zero is the answer that quietly says compliant.
 */
export function measureDeadline(target, evidence = {}) {
  switch (target.kind) {
    case CLOCK_HOURS:
      return measureCounted(target, elapsedHours(evidence), CLOCK_HOURS);
    case CLOCK_DAYS:
      return measureCounted(target, elapsedDays(evidence), CLOCK_DAYS);
    case CLOCK_SAMPLES:
      return measureCounted(target, requireCount(evidence, 'conformingSamples'), CLOCK_SAMPLES);
    case CLOCK_TIDES:
      return measureCounted(target, requireCount(evidence, 'tideCycles'), CLOCK_TIDES);
    default:
      return measureDate(target, evidence);
  }
}

function measureCounted(target, elapsed, kind) {
  const remaining = target.quantity - elapsed;
  return Object.freeze({
    kind,
    elapsed,
    required: target.quantity,
    remaining: remaining > 0 ? remaining : 0,
    met: elapsed >= target.quantity,
  });
}

function measureDate(target, evidence) {
  const today = evidence.on;
  if (today === undefined || today === null) {
    throw new InputError('clock.evidence', 'a fixed deadline is measured against a date', {
      kind: CLOCK_DATE,
    });
  }
  const remaining = daysBetween(today, target.on);
  return Object.freeze({
    kind: CLOCK_DATE,
    on: target.on,
    remainingDays: remaining > 0 ? remaining : 0,
    met: compareCivilDate(today, target.on) >= 0,
  });
}

function elapsedHours(evidence) {
  if (evidence.from === undefined || evidence.at === undefined) {
    throw new InputError('clock.evidence', 'an hours deadline is measured between two instants', {
      kind: CLOCK_HOURS,
    });
  }
  return hoursBetween(evidence.from, evidence.at);
}

function elapsedDays(evidence) {
  if (evidence.from === undefined || evidence.on === undefined) {
    throw new InputError('clock.evidence', 'a days deadline is measured between two dates', {
      kind: CLOCK_DAYS,
    });
  }
  return daysBetween(evidence.from, evidence.on);
}

function requireCount(evidence, field) {
  const value = evidence[field];
  if (!Number.isInteger(value) || value < 0) {
    throw new InputError('clock.evidence', `this deadline is measured by ${field}`, { field });
  }
  return value;
}

function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function pad(value) {
  return String(value).padStart(2, '0');
}
