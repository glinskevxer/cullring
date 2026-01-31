/**
 * Daily take limits, which are counted over a day rather than over a trip.
 *
 * A limit is bushels a day, and the day is the licence holder's day: two trips
 * out of two areas both count against it. That is the part worth being careful
 * about, because a limit checked per landing would let a boat take the limit
 * three times before lunch and every record would look lawful on its own.
 *
 * A limit may be written for a species everywhere, or for a species in one
 * area, and the area one wins where both apply. Where two areas each have a
 * limit and a boat worked both, each area's take is checked against its own
 * limit and the total against the general one, which is three sums rather than
 * one and is the reason this is a module rather than a comparison.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireNumber, requireString } from '../core/assert.js';
import { parseAreaId } from '../core/identity.js';
import { sameCivilDate } from '../time/civil.js';

export function takeLimit({ species, bushels, areas = null, note = null }) {
  requireString(species, 'species');
  requireNumber(bushels, 'bushels', { min: 0 });
  return Object.freeze({
    species,
    bushels,
    areas: areas === null ? null : Object.freeze(areas.map((one) => parseAreaId(one, 'areas').id)),
    note,
  });
}

/** The limit for a species in an area, with the area one winning. */
export function limitFor(limits, species, areaId) {
  const wanted = parseAreaId(areaId, 'area').id;
  const specific = limits.find(
    (one) => one.species === species && one.areas !== null && one.areas.includes(wanted),
  );
  if (specific !== undefined) {
    return specific;
  }
  return limits.find((one) => one.species === species && one.areas === null) ?? null;
}

/**
 * What one licence took on one day, split by area and species. The containers
 * on a record are bushels, which is the unit every limit in the rule book is
 * written in.
 */
export function takeOn(records, harvesterId, day) {
  const mine = records.filter(
    (one) => one.harvester === harvesterId && sameCivilDate(one.landedOn, day),
  );
  const byArea = new Map();
  const bySpecies = new Map();
  for (const one of mine) {
    const key = `${one.species}|${one.areaId}`;
    byArea.set(key, (byArea.get(key) ?? 0) + one.containers);
    bySpecies.set(one.species, (bySpecies.get(one.species) ?? 0) + one.containers);
  }
  return Object.freeze({
    harvester: harvesterId,
    day,
    records: Object.freeze(mine),
    byArea,
    bySpecies,
    total: mine.reduce((sum, one) => sum + one.containers, 0),
  });
}

/**
 * Check a day's take against every limit that applies to it. Both sums are
 * checked: the area one because it is the tighter rule, and the general one
 * because a boat working three areas could otherwise take three limits.
 */
export function checkTake({ records, harvester, day, limits }) {
  const problems = findings();
  const took = takeOn(records, harvester, day);

  for (const [key, bushels] of took.byArea) {
    const [species, areaId] = key.split('|');
    const limit = limitFor(limits, species, areaId);
    if (limit === null || limit.areas === null) {
      continue;
    }
    if (bushels > limit.bushels) {
      problems.error(
        'limit.overArea',
        `${harvester} took ${bushels} bushels of ${species} out of ${areaId} against ${limit.bushels}`,
        { harvester, species, area: areaId, took: bushels, limit: limit.bushels },
      );
    }
  }

  for (const [species, bushels] of took.bySpecies) {
    const general = limits.find((one) => one.species === species && one.areas === null) ?? null;
    if (general === null) {
      continue;
    }
    if (bushels > general.bushels) {
      problems.error(
        'limit.overDay',
        `${harvester} took ${bushels} bushels of ${species} in the day against ${general.bushels}`,
        { harvester, species, took: bushels, limit: general.bushels },
      );
    }
  }

  return Object.freeze({
    harvester,
    day,
    took,
    lawful: problems.isLawful(),
    problems,
  });
}

/** Everybody who went over on a day, which is the list the patrol reads. */
export function overOn(records, day, limits) {
  const holders = Array.from(new Set(records.map((one) => one.harvester))).sort();
  return holders
    .map((harvester) => checkTake({ records, harvester, day, limits }))
    .filter((one) => !one.lawful);
}

export function describeTake(answer) {
  const parts = Array.from(answer.took.bySpecies).map(
    ([species, bushels]) => `${bushels} of ${species}`,
  );
  if (parts.length === 0) {
    return `${answer.harvester} landed nothing that day`;
  }
  return `${answer.harvester} landed ${parts.join(', ')}`;
}

export function requireBushels(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new InputError('limit.bushels', 'a take is a whole number of bushels', { value });
  }
  return value;
}
