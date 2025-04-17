/**
 * Harvester licences, and the endorsements that decide what a licence is for.
 *
 * A licence on its own permits nothing. It permits gear, and the gear is what
 * decides which clock a lot runs on later, so the endorsement list is read
 * twice: once here to say whether the harvest was lawful, and once by the time
 * and temperature rules to say when the clock started.
 *
 * A suspension is not an expiry. An expired licence can be renewed and the
 * harvests before it lapsed stand. A suspension reaches back to the day it was
 * imposed and the harvests inside it do not, so the two are kept apart in the
 * record rather than collapsed into one date.
 */

import { InputError } from '../core/errors.js';
import { requireArray, requireString } from '../core/assert.js';
import { parseHarvesterId } from '../core/identity.js';
import { compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';

export const TONGS = 'tongs';
export const RAKE = 'rake';
export const DREDGE = 'dredge';
export const HAND = 'hand';
export const DIVER = 'diver';

export const GEARS = Object.freeze([TONGS, RAKE, DREDGE, HAND, DIVER]);

/**
 * Which gear works a bed that is out of the water at low tide. This is the
 * single fact the temperature clock reads off the gear, and it lives here
 * because the gear list lives here.
 */
const INTERTIDAL = new Set([HAND, RAKE]);

export function isIntertidalGear(gear) {
  requireGear(gear);
  return INTERTIDAL.has(gear);
}

export function requireGear(gear, field = 'gear') {
  if (!GEARS.includes(gear)) {
    throw new InputError('gear.unknown', `${field} ${gear} is not gear this program knows`, {
      field,
      value: gear,
      known: GEARS.slice(),
    });
  }
  return gear;
}

export function suspension({ from, to = null, reason = null }) {
  const start = asDate(from, 'from');
  const end = to === null ? null : asDate(to, 'to');
  if (end !== null && compareCivilDate(end, start) < 0) {
    throw new InputError('licence.suspension', 'a suspension cannot lift before it is imposed', {
      from: formatCivilDate(start),
    });
  }
  return Object.freeze({ from: start, to: end, reason });
}

export function harvester({ id, name, gears, issuedOn, expiresOn, suspensions = [] }) {
  const parsed = parseHarvesterId(id, 'harvester');
  requireString(name, 'name');
  requireArray(gears, 'gears', { min: 1 });
  for (const gear of gears) {
    requireGear(gear, 'gears');
  }
  const issued = asDate(issuedOn, 'issuedOn');
  const expires = asDate(expiresOn, 'expiresOn');
  if (compareCivilDate(expires, issued) < 0) {
    throw new InputError('licence.dates', 'a licence cannot expire before it is issued', {
      harvester: parsed.id,
    });
  }
  return Object.freeze({
    id: parsed.id,
    name,
    gears: Object.freeze(Array.from(new Set(gears)).sort()),
    issuedOn: issued,
    expiresOn: expires,
    suspensions: Object.freeze(suspensions.slice()),
  });
}

export function isCurrent(licence, date) {
  return (
    compareCivilDate(date, licence.issuedOn) >= 0 && compareCivilDate(date, licence.expiresOn) <= 0
  );
}

export function suspensionOn(licence, date) {
  return (
    licence.suspensions.find(
      (one) =>
        compareCivilDate(date, one.from) >= 0 &&
        (one.to === null || compareCivilDate(date, one.to) <= 0),
    ) ?? null
  );
}

export function isSuspended(licence, date) {
  return suspensionOn(licence, date) !== null;
}

/** Current, unsuspended, and endorsed for the gear that was actually used. */
export function mayHarvestWith(licence, gear, date) {
  requireGear(gear);
  return isCurrent(licence, date) && !isSuspended(licence, date) && licence.gears.includes(gear);
}

export function findHarvester(licences, id) {
  const wanted = parseHarvesterId(id, 'harvester').id;
  return licences.find((one) => one.id === wanted) ?? null;
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('licence.dates', `${field} is required`, { field });
  }
  return value;
}
