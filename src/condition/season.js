/**
 * Open seasons, which are a rule about species rather than about water.
 *
 * Everything else in this programme shuts a piece of water. A season shuts a
 * species, and the difference shows up on a boat that takes clams and scallops
 * on the same trip out of the same approved water: one of those is lawful in
 * February and the other is not.
 *
 * A season is a pair of civil dates and it may wrap the turn of the year,
 * which is the whole difficulty. The scallop season runs from November into
 * March, so "from is before to" is not the test and a season written that way
 * would be shut for the ten months it is open and open for the two it is not.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { parseAreaId } from '../core/identity.js';
import { monthName, parseCivilDate } from '../time/civil.js';

export function season({ species, from, to, areas = null, note = null }) {
  requireString(species, 'species');
  const open = asDate(from, 'from');
  const shut = asDate(to, 'to');
  return Object.freeze({
    species,
    from: Object.freeze({ month: open.month, day: open.day }),
    to: Object.freeze({ month: shut.month, day: shut.day }),
    wraps: monthDay(open) > monthDay(shut),
    areas: areas === null ? null : Object.freeze(areas.map((one) => parseAreaId(one, 'areas').id)),
    note,
  });
}

function monthDay(date) {
  return date.month * 100 + date.day;
}

/**
 * Whether a season is open on a day. A season that wraps the year is open when
 * the day is at or after the start OR at or before the end, which is the union
 * rather than the intersection, and getting that backwards is the failure this
 * module exists to avoid.
 */
export function isOpen(one, date) {
  const at = monthDay(date);
  const from = one.from.month * 100 + one.from.day;
  const to = one.to.month * 100 + one.to.day;
  if (one.wraps) {
    return at >= from || at <= to;
  }
  return at >= from && at <= to;
}

export function coversArea(one, areaId) {
  if (one.areas === null) {
    return true;
  }
  return one.areas.includes(parseAreaId(areaId, 'area').id);
}

/** The season for a species in an area, or nothing where none is written. */
export function seasonFor(seasons, species, areaId) {
  const specific = seasons.find(
    (one) => one.species === species && one.areas !== null && coversArea(one, areaId),
  );
  if (specific !== undefined) {
    return specific;
  }
  return seasons.find((one) => one.species === species && one.areas === null) ?? null;
}

/**
 * Whether a species may be taken from an area on a day. A species with no
 * season written for it is open all year, which is the rule: a season is a
 * restriction somebody wrote down, not a permission.
 */
export function mayTake(seasons, species, areaId, date) {
  const one = seasonFor(seasons, species, areaId);
  if (one === null) {
    return Object.freeze({ open: true, season: null, reason: 'no season is written for it' });
  }
  return Object.freeze({
    open: isOpen(one, date),
    season: one,
    reason: describeSeason(one),
  });
}

export function describeSeason(one) {
  const from = `${monthName(one.from.month)} ${one.from.day}`;
  const to = `${monthName(one.to.month)} ${one.to.day}`;
  const where = one.areas === null ? 'everywhere' : one.areas.join(', ');
  return `${one.species} is open ${from} to ${to} in ${where}`;
}

/** How many days of the year a season is open, which the annual report counts. */
export function openDays(one, year) {
  let count = 0;
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      let date = null;
      try {
        date = parseCivilDate(`${year}-${pad(month)}-${pad(day)}`);
      } catch {
        continue;
      }
      if (isOpen(one, date)) {
        count += 1;
      }
    }
  }
  return count;
}

export function nextOpening(one, date) {
  if (isOpen(one, date)) {
    return null;
  }
  const year = monthDay(date) > one.from.month * 100 + one.from.day ? date.year + 1 : date.year;
  return parseCivilDate(`${year}-${pad(one.from.month)}-${pad(one.from.day)}`);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function asDate(value, field) {
  if (typeof value === 'string') {
    const text = value.length === 5 ? `2001-${value}` : value;
    return parseCivilDate(text, field);
  }
  if (value === undefined || value === null || value.month === undefined) {
    throw new InputError('season.date', `${field} is required`, { field });
  }
  return value;
}
