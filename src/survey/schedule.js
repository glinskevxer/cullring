/**
 * Which stations are due, and the loop that has to not run away.
 *
 * How often a station is sampled is decided by the classification of the area
 * it sits in. A conditionally approved area is sampled twice as often as a
 * plainly approved one, because the whole basis of the conditional class is
 * that somebody is watching it. A prohibited area is not sampled at all: there
 * is nothing to find out, and the boat time is better spent.
 *
 * That is a loop. The classification sets the sampling rate, the samples
 * decide the classification, and a programme that let the loop run would drop
 * an area to prohibited, stop sampling it, and then never have the data to
 * bring it back. So prohibited areas carry a reinstatement schedule instead:
 * no routine sampling, but a named survey somebody has to ask for, and the
 * report says so rather than leaving a blank.
 */

import { InputError } from '../core/errors.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
  classification,
} from '../area/classification.js';
import { addDays, compareCivilDate, daysBetween, formatCivilDate } from '../time/civil.js';

const PER_YEAR = new Map([
  [APPROVED, 6],
  [CONDITIONALLY_APPROVED, 12],
  [RESTRICTED, 6],
  [CONDITIONALLY_RESTRICTED, 12],
  [PROHIBITED, 0],
]);

/** How many samples a year each station in an area of this class should get. */
export function samplesPerYear(classificationName) {
  const row = classification(classificationName, 'classification');
  return PER_YEAR.get(row.name);
}

/** The nominal gap between visits, or nothing where the area is not sampled. */
export function intervalDays(classificationName) {
  const perYear = samplesPerYear(classificationName);
  if (perYear === 0) {
    return null;
  }
  return Math.round(365 / perYear);
}

export const REINSTATEMENT_SURVEY = 'reinstatement survey';

/**
 * When a station is next due. A prohibited area has no next visit and says so
 * by name, so nothing downstream reads a missing date as an overdue one.
 */
export function nextDue(classificationName, lastVisited) {
  const gap = intervalDays(classificationName);
  if (gap === null) {
    return Object.freeze({ due: null, reason: REINSTATEMENT_SURVEY });
  }
  if (lastVisited === null || lastVisited === undefined) {
    return Object.freeze({ due: null, reason: 'never visited' });
  }
  return Object.freeze({ due: addDays(lastVisited, gap), reason: null });
}

export function lastVisit(samples, stationId) {
  const visits = samples
    .filter((one) => one.station === stationId)
    .map((one) => one.collectedOn)
    .sort(compareCivilDate);
  return visits.length === 0 ? null : visits[visits.length - 1];
}

/**
 * The schedule for one area: a row per station in service, with when it was
 * last visited and whether it is due.
 */
export function scheduleFor({ area, classificationName, stations, samples, on }) {
  if (typeof classificationName !== 'string') {
    throw new InputError('schedule.classification', 'a schedule needs a classification', {
      area: area.id,
    });
  }
  const gap = intervalDays(classificationName);
  return stations.map((one) => {
    const last = lastVisit(samples, one.id);
    const next = nextDue(classificationName, last);
    const overdue = next.due === null ? 0 : Math.max(0, daysBetween(next.due, on));
    return Object.freeze({
      station: one.id,
      area: area.id,
      classification: classificationName,
      perYear: samplesPerYear(classificationName),
      intervalDays: gap,
      lastVisited: last,
      due: next.due,
      reason: next.reason,
      overdueDays: overdue,
      state: stateOf(next, overdue),
    });
  });
}

function stateOf(next, overdue) {
  if (next.reason === REINSTATEMENT_SURVEY) {
    return 'not sampled';
  }
  if (next.due === null) {
    return 'never visited';
  }
  return overdue > 0 ? 'due' : 'current';
}

/** How many visits a year the whole area costs, which is the boat time question. */
export function annualVisits(classificationName, stationCount) {
  return samplesPerYear(classificationName) * stationCount;
}

export function describeSchedule(row) {
  if (row.state === 'not sampled') {
    return `${row.station} is not on the routine round; it needs a ${REINSTATEMENT_SURVEY}`;
  }
  if (row.state === 'never visited') {
    return `${row.station} has never been visited`;
  }
  if (row.state === 'due') {
    return `${row.station} is ${row.overdueDays} days past due`;
  }
  return `${row.station} is next due ${formatCivilDate(row.due)}`;
}
