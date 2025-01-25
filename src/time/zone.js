/**
 * Zones, and the two hours of the year that make them worth a module.
 *
 * The program stores instants. The rules are written in civil time. Turning
 * one into the other is a lookup for eight thousand seven hundred and fifty
 * eight hours of the year and a decision for the other two.
 *
 * On the morning the clocks go forward there is a local time that never
 * happened. On the morning they go back there is a local time that happened
 * twice. A harvest record carrying either is not something to guess at: the
 * bag has a tag on it and the tag says half past one, and half past one that
 * morning is two different instants an hour apart. So the conversion refuses
 * both cases by default and the caller has to say which reading it wants.
 */

import { InputError } from '../core/errors.js';
import { civilDate, dayOfWeek, toEpochDay } from './civil.js';

const SECONDS_PER_DAY = 86400;

/**
 * The zones the program knows. Every one of them is a United States zone with
 * the post-2007 rule, because the shellfish program is a state program and its
 * water does not leave the state.
 */
const ZONES = new Map([
  [
    'eastern',
    { name: 'eastern', standard: -5 * 3600, daylight: -4 * 3600, abbreviations: ['EST', 'EDT'] },
  ],
  [
    'central',
    { name: 'central', standard: -6 * 3600, daylight: -5 * 3600, abbreviations: ['CST', 'CDT'] },
  ],
  [
    'mountain',
    { name: 'mountain', standard: -7 * 3600, daylight: -6 * 3600, abbreviations: ['MST', 'MDT'] },
  ],
  [
    'pacific',
    { name: 'pacific', standard: -8 * 3600, daylight: -7 * 3600, abbreviations: ['PST', 'PDT'] },
  ],
  [
    'alaska',
    { name: 'alaska', standard: -9 * 3600, daylight: -8 * 3600, abbreviations: ['AKST', 'AKDT'] },
  ],
  [
    'hawaii',
    { name: 'hawaii', standard: -10 * 3600, daylight: -10 * 3600, abbreviations: ['HST', 'HST'] },
  ],
]);

export function zoneNames() {
  return Array.from(ZONES.keys());
}

export function lookupZone(name, field = 'zone') {
  if (typeof name !== 'string') {
    throw new InputError('zone.type', `${field} must be the name of a zone`, {
      field,
      saw: typeof name,
    });
  }
  const zone = ZONES.get(name.trim().toLowerCase());
  if (!zone) {
    throw new InputError('zone.unknown', `${field} ${name} is not a zone this program knows`, {
      field,
      value: name,
      known: zoneNames(),
    });
  }
  return zone;
}

/** True when the zone never shifts, which is how Hawaii falls out of the rest. */
export function observesDaylightTime(zone) {
  return zone.standard !== zone.daylight;
}

/**
 * The date of the nth given weekday in a month. n counts from one, and a
 * request for a fifth Sunday in a month that has four is a mistake rather than
 * a roll into the next month.
 */
export function nthWeekdayOfMonth(year, month, weekday, n) {
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new InputError('zone.rule', 'a weekday rule counts from one to five', { n });
  }
  const first = civilDate(year, month, 1);
  const shift = (weekday - dayOfWeek(first) + 7) % 7;
  const day = 1 + shift + (n - 1) * 7;
  return civilDate(year, month, day);
}

/** The instant daylight time starts: the second Sunday in March at 02:00 standard. */
export function daylightStart(zone, year) {
  const date = nthWeekdayOfMonth(year, 3, 0, 2);
  return toEpochDay(date) * SECONDS_PER_DAY + 2 * 3600 - zone.standard;
}

/** The instant it ends: the first Sunday in November at 02:00 daylight. */
export function daylightEnd(zone, year) {
  const date = nthWeekdayOfMonth(year, 11, 0, 1);
  return toEpochDay(date) * SECONDS_PER_DAY + 2 * 3600 - zone.daylight;
}

/** The offset in force at an instant, in seconds east of UTC. */
export function offsetAt(zone, epochSecond) {
  if (!observesDaylightTime(zone)) {
    return zone.standard;
  }
  const year = yearOfInstant(zone, epochSecond);
  for (const candidate of [year - 1, year, year + 1]) {
    const start = daylightStart(zone, candidate);
    const end = daylightEnd(zone, candidate);
    if (epochSecond >= start && epochSecond < end) {
      return zone.daylight;
    }
  }
  return zone.standard;
}

export function abbreviationAt(zone, epochSecond) {
  return offsetAt(zone, epochSecond) === zone.daylight
    ? zone.abbreviations[1]
    : zone.abbreviations[0];
}

function yearOfInstant(zone, epochSecond) {
  const approximate = Math.floor((epochSecond + zone.standard) / SECONDS_PER_DAY);
  return 1970 + Math.floor(approximate / 365.2425);
}

export const CIVIL_GAP = 'gap';
export const CIVIL_AMBIGUOUS = 'ambiguous';
export const CIVIL_PLAIN = 'plain';

/**
 * Resolve a civil date and time in a zone. The answer names its own kind, so a
 * caller can decide what to do about the two awkward mornings rather than
 * discovering later that a number was chosen for it.
 */
export function resolveCivil(zone, date, time) {
  const local =
    toEpochDay(date) * SECONDS_PER_DAY + time.hour * 3600 + time.minute * 60 + time.second;
  const candidates = [];
  for (const offset of new Set([zone.standard, zone.daylight])) {
    const instant = local - offset;
    if (offsetAt(zone, instant) === offset) {
      candidates.push(instant);
    }
  }
  if (candidates.length === 0) {
    return { kind: CIVIL_GAP, instants: [] };
  }
  if (candidates.length === 1) {
    return { kind: CIVIL_PLAIN, instants: candidates };
  }
  candidates.sort((a, b) => a - b);
  return { kind: CIVIL_AMBIGUOUS, instants: candidates };
}
