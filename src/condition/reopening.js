/**
 * What reopens an area, which is not the trigger running backwards.
 *
 * The instrument that closes an area and the instrument that reopens it are
 * different instruments, and this is the part of the plan people get wrong.
 * Rain over an inch closes B-12. What reopens it is not the rain stopping: it
 * is seventy two hours passing. On C-3 it is two conforming samples, which
 * might be a week and might be a month. On the marina area it is a date on the
 * calendar and nothing else, because the boats leave when they leave.
 *
 * So the closing side and the reopening side of one plan are written in
 * different units, and the clock module is the reason that cannot be quietly
 * papered over.
 */

import { InputError } from '../core/errors.js';
import {
  CLOCK_DATE,
  CLOCK_HOURS,
  CLOCK_SAMPLES,
  CLOCK_TIDES,
  deadline,
  describeDeadline,
  measureDeadline,
} from '../time/clock.js';
import { parseCivilDate } from '../time/civil.js';

export const AFTER_HOURS = 'after hours';
export const AFTER_SAMPLES = 'after samples';
export const AFTER_TIDES = 'after tides';
export const ON_DATE = 'on date';

export const REOPENING_KINDS = Object.freeze([AFTER_HOURS, AFTER_SAMPLES, AFTER_TIDES, ON_DATE]);

const CLOCK_OF = Object.freeze({
  [AFTER_HOURS]: CLOCK_HOURS,
  [AFTER_SAMPLES]: CLOCK_SAMPLES,
  [AFTER_TIDES]: CLOCK_TIDES,
  [ON_DATE]: CLOCK_DATE,
});

export function afterHours(hours) {
  return rule(AFTER_HOURS, deadline(CLOCK_HOURS, hours));
}

export function afterSamples(count) {
  return rule(AFTER_SAMPLES, deadline(CLOCK_SAMPLES, count));
}

export function afterTides(cycles) {
  return rule(AFTER_TIDES, deadline(CLOCK_TIDES, cycles));
}

export function onDate(date) {
  const on = typeof date === 'string' ? parseCivilDate(date, 'on') : date;
  return rule(ON_DATE, deadline(CLOCK_DATE, on));
}

function rule(kind, target) {
  return Object.freeze({ kind, clock: CLOCK_OF[kind], target });
}

export function clockOf(reopening) {
  const clock = CLOCK_OF[reopening.kind];
  if (clock === undefined) {
    throw new InputError('reopening.kind', `${reopening.kind} is not a way of reopening an area`, {
      kind: reopening.kind,
      known: REOPENING_KINDS.slice(),
    });
  }
  return clock;
}

export function describeReopening(reopening) {
  const words = describeDeadline(reopening.target);
  if (reopening.kind === ON_DATE) {
    return words;
  }
  return `after ${words}`;
}

/**
 * Ask whether the reopening test is met. The evidence bag is the same one the
 * clock module reads, so a plan whose reopening is counted in samples and whose
 * caller supplied only instants is refused by name rather than answered.
 */
export function evaluateReopening(reopening, evidence) {
  clockOf(reopening);
  const measured = measureDeadline(reopening.target, evidence);
  return Object.freeze({
    kind: reopening.kind,
    clock: reopening.clock,
    met: measured.met,
    measured,
    description: describeReopening(reopening),
  });
}

/**
 * Two reopening rules cannot be compared unless they run on the same clock.
 * This is asked when a plan is amended and somebody wants to know whether the
 * new rule is stricter, and the honest answer for two different clocks is that
 * the question does not have one.
 */
export function isStricter(left, right) {
  if (left.clock !== right.clock) {
    return null;
  }
  if (left.clock === CLOCK_DATE) {
    const a = left.target.on;
    const b = right.target.on;
    if (a.year !== b.year) {
      return a.year > b.year;
    }
    if (a.month !== b.month) {
      return a.month > b.month;
    }
    return a.day > b.day;
  }
  return left.target.quantity > right.target.quantity;
}
