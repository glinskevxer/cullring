/**
 * Beds, which are the piece of ground a harvest actually came off.
 *
 * An area is water. A bed is a named patch inside it, and the difference
 * matters because the two facts the temperature clock needs are properties of
 * the bed and not of the area: which tide station predicts it, and how high it
 * stands above the datum. Two beds three hundred yards apart in the same area
 * come out of the water forty minutes apart, and on an August morning forty
 * minutes is the whole margin.
 *
 * A bed is either public bottom or a lease. A lease has a holder and the
 * holder is the only person who may work it, which is a rule about who rather
 * than about water and is therefore checked separately from everything else.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { parseAreaId, parseHarvesterId } from '../core/identity.js';

export const PUBLIC = 'public';
export const LEASE = 'lease';

export const TENURES = Object.freeze([PUBLIC, LEASE]);

const BED_PATTERN = /^([A-Z])(\d{1,2})-([A-Z]{2,4})$/;

export function parseBedId(text, field = 'bed') {
  if (typeof text !== 'string') {
    throw new InputError('bed.type', `${field} must be written as B12-BCK`, {
      field,
      saw: typeof text,
    });
  }
  const match = BED_PATTERN.exec(text.trim().toUpperCase());
  if (!match) {
    throw new InputError('bed.format', `${field} ${text} is not a bed number`, {
      field,
      value: text,
    });
  }
  return Object.freeze({
    id: `${match[1]}${Number(match[2])}-${match[3]}`,
    areaId: `${match[1]}-${Number(match[2])}`,
    tag: match[3],
  });
}

export function bed({
  id,
  name,
  tideStation,
  elevation,
  tenure = PUBLIC,
  holder = null,
  acres = null,
}) {
  const parsed = parseBedId(id, 'bed');
  requireString(name, 'name');
  requireString(tideStation, 'tideStation');
  requireNumber(elevation, 'elevation', { min: -20, max: 20 });
  if (!TENURES.includes(tenure)) {
    throw new InputError('bed.tenure', `${tenure} is not a tenure`, {
      tenure,
      known: TENURES.slice(),
    });
  }
  if (tenure === LEASE && holder === null) {
    throw new InputError('bed.holder', `${parsed.id} is a lease and carries no holder`, {
      bed: parsed.id,
    });
  }
  if (tenure === PUBLIC && holder !== null) {
    throw new InputError('bed.holder', `${parsed.id} is public bottom and cannot have a holder`, {
      bed: parsed.id,
    });
  }
  if (acres !== null) {
    requireNumber(acres, 'acres', { min: 0 });
  }
  return Object.freeze({
    id: parsed.id,
    areaId: parsed.areaId,
    name,
    tideStation: tideStation.trim().toUpperCase(),
    elevation,
    tenure,
    holder: holder === null ? null : parseHarvesterId(holder, 'holder').id,
    acres,
  });
}

export function bedsIn(beds, areaId) {
  const wanted = parseAreaId(areaId, 'area');
  const key = `${wanted.region}-${wanted.number}`;
  return beds
    .filter((one) => one.areaId === key)
    .sort((left, right) => (left.id < right.id ? -1 : 1));
}

export function findBed(beds, id) {
  const wanted = parseBedId(id, 'bed').id;
  return beds.find((one) => one.id === wanted) ?? null;
}

/** Whether this licence may work this ground at all, before any water question. */
export function mayWork(one, harvesterId) {
  if (one.tenure === PUBLIC) {
    return true;
  }
  return one.holder === parseHarvesterId(harvesterId, 'harvester').id;
}
