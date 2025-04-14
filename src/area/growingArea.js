/**
 * The growing area register.
 *
 * An area is not a row with a classification in it. It is a row with a history
 * of classifications, because the question the office is asked is almost never
 * about today: it is about the eleventh of August, when this lot was landed,
 * and the answer has to be what the area was that day rather than what it is
 * now. A register that overwrote the classification could not answer it at all.
 *
 * Each period in the history carries the basis it was set on, so a
 * reclassification made off a survey and one made off a shoreline finding read
 * differently a year later.
 */

import { InputError } from '../core/errors.js';
import { requireArray, requireNumber, requireString } from '../core/assert.js';
import { parseAreaId } from '../core/identity.js';
import { compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';
import { classification } from './classification.js';

export const BY_SURVEY = 'survey';
export const BY_SHORELINE = 'shoreline';
export const BY_EMERGENCY = 'emergency';
export const BY_ORDER = 'order';

export const BASES = Object.freeze([BY_SURVEY, BY_SHORELINE, BY_EMERGENCY, BY_ORDER]);

export function classificationPeriod({
  classification: name,
  from,
  to = null,
  basis = BY_SURVEY,
  note = null,
}) {
  const held = classification(name, 'classification').name;
  if (!BASES.includes(basis)) {
    throw new InputError('area.basis', `${basis} is not a basis for a classification`, {
      basis,
      known: BASES.slice(),
    });
  }
  const start = asDate(from, 'from');
  const end = to === null ? null : asDate(to, 'to');
  if (end !== null && compareCivilDate(end, start) < 0) {
    throw new InputError('area.period', 'a classification cannot end before it starts', {
      from: formatCivilDate(start),
      to: formatCivilDate(end),
    });
  }
  return Object.freeze({ classification: held, from: start, to: end, basis, note });
}

export function growingArea({ id, name, zone = 'eastern', acres = null, history }) {
  const parsed = parseAreaId(id, 'area');
  requireString(name, 'name');
  if (acres !== null) {
    requireNumber(acres, 'acres', { min: 0 });
  }
  requireArray(history, 'history', { min: 1 });
  const periods = history.slice().sort((left, right) => compareCivilDate(left.from, right.from));
  assertNoOverlap(parsed.id, periods);
  return Object.freeze({
    id: parsed.id,
    region: parsed.region,
    number: parsed.number,
    subarea: parsed.subarea,
    name,
    zone,
    acres,
    history: Object.freeze(periods),
  });
}

function assertNoOverlap(areaId, periods) {
  for (let index = 1; index < periods.length; index += 1) {
    const earlier = periods[index - 1];
    const later = periods[index];
    if (earlier.to === null || compareCivilDate(earlier.to, later.from) >= 0) {
      throw new InputError('area.overlap', `${areaId} holds two classifications at once`, {
        area: areaId,
        first: formatCivilDate(earlier.from),
        second: formatCivilDate(later.from),
      });
    }
  }
}

/** The period in force on a day, or nothing where the register does not reach. */
export function periodOn(area, date) {
  return (
    area.history.find(
      (period) =>
        compareCivilDate(date, period.from) >= 0 &&
        (period.to === null || compareCivilDate(date, period.to) <= 0),
    ) ?? null
  );
}

/**
 * The classification of record on a day. This is the paper classification and
 * not the answer to whether anybody may harvest, because a conditional area's
 * plan has not been consulted yet.
 */
export function classificationOn(area, date) {
  const period = periodOn(area, date);
  return period === null ? null : period.classification;
}

export function basisOn(area, date) {
  const period = periodOn(area, date);
  return period === null ? null : period.basis;
}

export function currentPeriod(area) {
  return area.history[area.history.length - 1];
}

export function reclassifiedOn(area) {
  return area.history.slice(1).map((period) => period.from);
}

export function findArea(areas, id) {
  const wanted = parseAreaId(id, 'area').id;
  return areas.find((area) => area.id === wanted) ?? null;
}

export function areasInRegion(areas, region) {
  const wanted = String(region).trim().toUpperCase();
  return areas
    .filter((area) => area.region === wanted)
    .sort((left, right) => left.number - right.number);
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('area.period', `${field} is required`, { field });
  }
  return value;
}
