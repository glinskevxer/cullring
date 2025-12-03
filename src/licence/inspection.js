/**
 * Dealer inspections, where the score decides the clock.
 *
 * An inspector walks a plant against a list. Most items are weighted and come
 * off a hundred; a few are critical and are not weighted at all, because a
 * plant with no potable water does not get eighty five out of a hundred, it
 * gets shut. So the score is not a single number: it is a number and a list of
 * critical failures, and the two are read together.
 *
 * What comes out is when the inspector is next due back, and that is the point
 * of the module. A clean plant is seen once a year. A plant that scored badly
 * is seen in thirty days. A plant that failed a critical item is not seen
 * again on a schedule at all: it is shut until it is re-inspected, and the
 * report says so rather than putting a date on it.
 */

import { InputError } from '../core/errors.js';
import { requireArray, requireNumber, requireString } from '../core/assert.js';
import { parseDealerId } from '../core/identity.js';
import { addDays, compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';

export const CRITICAL = 'critical';
export const WEIGHTED = 'weighted';

export const ITEM_KINDS = Object.freeze([CRITICAL, WEIGHTED]);

/** The items the inspection sheet carries, in the order it carries them. */
const SHEET = Object.freeze([
  { id: 'water', kind: CRITICAL, description: 'potable water under pressure' },
  { id: 'sewage', kind: CRITICAL, description: 'sewage disposal' },
  { id: 'temperature', kind: CRITICAL, description: 'product held at temperature' },
  { id: 'tags', kind: CRITICAL, description: 'tags kept and complete' },
  { id: 'floors', kind: WEIGHTED, weight: 10, description: 'floors, walls and ceilings' },
  { id: 'equipment', kind: WEIGHTED, weight: 14, description: 'equipment cleanable and clean' },
  { id: 'handwash', kind: WEIGHTED, weight: 12, description: 'handwashing facilities' },
  { id: 'toilets', kind: WEIGHTED, weight: 8, description: 'toilet facilities' },
  { id: 'vermin', kind: WEIGHTED, weight: 12, description: 'no evidence of vermin' },
  { id: 'storage', kind: WEIGHTED, weight: 10, description: 'storage off the floor and covered' },
  { id: 'ice', kind: WEIGHTED, weight: 8, description: 'ice made from potable water' },
  { id: 'records', kind: WEIGHTED, weight: 12, description: 'records kept for ninety days' },
  { id: 'clothing', kind: WEIGHTED, weight: 6, description: 'clean outer clothing' },
  { id: 'lighting', kind: WEIGHTED, weight: 8, description: 'lighting adequate and shielded' },
]);

export function sheet() {
  return SHEET.map((one) => Object.freeze({ ...one }));
}

export function itemById(id) {
  const found = SHEET.find((one) => one.id === id);
  if (found === undefined) {
    throw new InputError('inspection.item', `${id} is not on the inspection sheet`, {
      id,
      known: SHEET.map((one) => one.id),
    });
  }
  return Object.freeze({ ...found });
}

/** The weighted items add to a hundred, and a test says so rather than a comment. */
export function totalWeight() {
  return SHEET.filter((one) => one.kind === WEIGHTED).reduce((total, one) => total + one.weight, 0);
}

export function inspection({ dealer, on, failed = [], inspector = null, note = null }) {
  const certification = parseDealerId(dealer, 'dealer');
  const day = typeof on === 'string' ? parseCivilDate(on, 'on') : on;
  if (day === undefined || day === null || day.year === undefined) {
    throw new InputError('inspection.on', 'an inspection carries the day it was made', {
      dealer: certification.id,
    });
  }
  requireArray(failed, 'failed');
  const items = failed.map((id) => itemById(String(id)));
  if (inspector !== null) {
    requireString(inspector, 'inspector');
  }
  const critical = items.filter((one) => one.kind === CRITICAL);
  const deductions = items
    .filter((one) => one.kind === WEIGHTED)
    .reduce((total, one) => total + one.weight, 0);
  return Object.freeze({
    dealer: certification.id,
    on: day,
    failed: Object.freeze(items),
    critical: Object.freeze(critical),
    score: 100 - deductions,
    inspector,
    note,
  });
}

export const ROUTINE = 'routine';
export const FOLLOW_UP = 'follow up';
export const SHUT = 'shut until re-inspected';

export const OUTCOMES = Object.freeze([ROUTINE, FOLLOW_UP, SHUT]);

/** Under this the plant is seen again in thirty days rather than in a year. */
export const FOLLOW_UP_BELOW = 85;

export const ROUTINE_DAYS = 365;
export const FOLLOW_UP_DAYS = 30;

/**
 * What the score means. A critical failure is not a low score: it is a
 * different outcome, and it carries no next date because there is nothing to
 * schedule until the plant asks to be looked at again.
 */
export function outcomeOf(one) {
  if (one.critical.length > 0) {
    return Object.freeze({
      outcome: SHUT,
      nextDue: null,
      reason: `${one.critical.length} critical items failed`,
    });
  }
  if (one.score < FOLLOW_UP_BELOW) {
    return Object.freeze({
      outcome: FOLLOW_UP,
      nextDue: addDays(one.on, FOLLOW_UP_DAYS),
      reason: `scored ${one.score}`,
    });
  }
  return Object.freeze({
    outcome: ROUTINE,
    nextDue: addDays(one.on, ROUTINE_DAYS),
    reason: `scored ${one.score}`,
  });
}

export function latestFor(inspections, dealerId) {
  const wanted = parseDealerId(dealerId, 'dealer').id;
  const held = inspections
    .filter((one) => one.dealer === wanted)
    .sort((left, right) => compareCivilDate(left.on, right.on));
  return held.length === 0 ? null : held[held.length - 1];
}

export function describeInspection(one) {
  const outcome = outcomeOf(one);
  const when = outcome.nextDue === null ? 'no date set' : formatCivilDate(outcome.nextDue);
  return `${one.dealer} on ${formatCivilDate(one.on)}: ${outcome.outcome}, ${outcome.reason}, next ${when}`;
}

export function requireScore(value) {
  return requireNumber(value, 'score', { min: 0, max: 100 });
}
