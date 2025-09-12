/**
 * The shoreline survey, which caps a classification from the land.
 *
 * The bacteriological data says what the water reads like. The shoreline
 * survey says what is on the bank, and the two are not the same evidence. An
 * area whose samples all come back clean can still not be approved if a
 * treatment plant outfall discharges into it, because the water is clean until
 * the day the plant fails and the sampling programme would find that out
 * afterwards.
 *
 * So each kind of source carries a zone, and a station inside a zone is capped
 * at what that zone allows however good its numbers are. The cap is the
 * stricter of the two answers, which is the same fold the rest of the
 * programme uses for a conjunction of rules.
 *
 * The zone radius for an outfall is not a constant. It comes out of the design
 * flow, because a plant treating two million gallons a day needs a bigger
 * circle than one treating fifty thousand.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { PROHIBITED, RESTRICTED, stricter } from '../area/classification.js';
import { CONDITIONALLY_APPROVED } from '../area/classification.js';
import { feetToMetres, toPoint, within } from '../geo/point.js';
import { parseCivilDate } from '../time/civil.js';

export const OUTFALL = 'wastewater outfall';
export const MARINA = 'marina';
export const BOATYARD = 'boatyard';
export const SEPTIC = 'failing septic';
export const STORMWATER = 'stormwater outfall';

export const SOURCE_KINDS = Object.freeze([OUTFALL, MARINA, BOATYARD, SEPTIC, STORMWATER]);

const CAPS = Object.freeze({
  [OUTFALL]: PROHIBITED,
  [MARINA]: PROHIBITED,
  [BOATYARD]: RESTRICTED,
  [SEPTIC]: RESTRICTED,
  [STORMWATER]: CONDITIONALLY_APPROVED,
});

/** The zone a source projects, in feet, given what it is and how big it is. */
export function zoneFeet(kind, size) {
  switch (kind) {
    case OUTFALL:
      return outfallZone(size);
    case MARINA:
      return marinaZone(size);
    case BOATYARD:
      return 500;
    case SEPTIC:
      return 300;
    case STORMWATER:
      return 500;
    default:
      throw new InputError('source.kind', `${kind} is not a kind of source`, {
        kind,
        known: SOURCE_KINDS.slice(),
      });
  }
}

/**
 * The outfall zone is stepped rather than continuous, because that is how the
 * rule is written and a continuous formula would put two plants of nearly the
 * same size in different circles for no reason anybody could defend.
 */
function outfallZone(gallonsPerDay) {
  requireNumber(gallonsPerDay, 'size', { min: 0 });
  if (gallonsPerDay <= 10000) {
    return 1500;
  }
  if (gallonsPerDay <= 100000) {
    return 3000;
  }
  if (gallonsPerDay <= 1000000) {
    return 6000;
  }
  return 10000;
}

function marinaZone(slips) {
  requireNumber(slips, 'size', { min: 0 });
  if (slips <= 10) {
    return 300;
  }
  if (slips <= 50) {
    return 750;
  }
  return 1500;
}

export function pollutionSource({
  id,
  kind,
  areaId,
  latitude,
  longitude,
  size = 0,
  surveyedOn,
  note = null,
}) {
  requireString(id, 'id');
  if (!SOURCE_KINDS.includes(kind)) {
    throw new InputError('source.kind', `${kind} is not a kind of source`, {
      kind,
      known: SOURCE_KINDS.slice(),
    });
  }
  requireString(areaId, 'areaId');
  const position = toPoint({ latitude, longitude }, 'position');
  const feet = zoneFeet(kind, size);
  return Object.freeze({
    id: id.trim().toUpperCase(),
    kind,
    areaId,
    ...position,
    size,
    zoneFeet: feet,
    zoneMetres: feetToMetres(feet),
    cap: CAPS[kind],
    surveyedOn:
      typeof surveyedOn === 'string' ? parseCivilDate(surveyedOn, 'surveyedOn') : surveyedOn,
    note,
  });
}

/** The sources whose zone covers a position. */
export function sourcesReaching(sources, position) {
  return sources
    .filter((one) => within(one, position, one.zoneMetres))
    .sort((left, right) => (left.id < right.id ? -1 : 1));
}

/**
 * The best class the shoreline allows at a position. Nothing reaching it means
 * no cap at all, which is reported as null rather than as approved: the
 * shoreline survey does not have an opinion about clean water, it only ever
 * takes one away.
 */
export function shorelineCap(sources, position) {
  const reaching = sourcesReaching(sources, position);
  if (reaching.length === 0) {
    return null;
  }
  return reaching.map((one) => one.cap).reduce((worst, cap) => stricter(worst, cap));
}

/** The cap over a whole area, which is the strictest cap at any of its stations. */
export function areaCap(sources, stations) {
  const caps = stations.map((one) => shorelineCap(sources, one)).filter((one) => one !== null);
  if (caps.length === 0) {
    return null;
  }
  return caps.reduce((worst, cap) => stricter(worst, cap));
}

/**
 * The classification the two kinds of evidence agree on. This is the whole
 * point of the module: the bacteriological answer and the shoreline answer are
 * folded with the same rule as any other conjunction, and the stricter wins.
 */
export function capped(supported, cap) {
  if (cap === null) {
    return supported;
  }
  return stricter(supported, cap);
}

export function sourcesIn(sources, areaId) {
  return sources
    .filter((one) => one.areaId === areaId)
    .sort((left, right) => (left.id < right.id ? -1 : 1));
}

export function describeSource(one) {
  return `${one.id}: ${one.kind}, zone ${one.zoneFeet} ft, caps at ${one.cap}`;
}
