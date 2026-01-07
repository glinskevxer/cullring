/**
 * Seed shellfish, which is the one thing that may come out of prohibited water.
 *
 * A grower may take seed off dirty bottom under a permit and put it on a lease
 * to grow on, because a seed oyster is not going to be eaten: it is going to
 * spend two years in clean water first, which is a longer relay than any relay
 * in the rule book.
 *
 * Three things have to hold and each is read off a different module. What
 * comes out has to be seed, which is a size question and reads the same table
 * the culling rule reads, from the other end. Where it goes has to be water
 * good enough to grow it, which is the classification. And it may not be
 * harvested for a period afterwards, which is a clock. Getting any one of them
 * wrong turns a lawful transplant into taking shellfish out of prohibited
 * water, which is the thing the rule most wants not to happen.
 */

import { findings } from '../core/finding.js';
import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { APPROVED, CONDITIONALLY_APPROVED, classification } from '../area/classification.js';
import { parseAreaId, parseHarvesterId } from '../core/identity.js';
import { minimumInches } from './cull.js';
import { SPECIES } from './record.js';
import { addDays, compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';

/** Seed is anything under this share of the market minimum. */
export const SEED_SHARE = 0.5;

/** How long seed has to stay down before anything may be taken off it. */
export const GROW_ON_DAYS = 180;

/** The classes seed may be laid into. */
const RECEIVING = new Set([APPROVED, CONDITIONALLY_APPROVED]);

export function seedInches(species) {
  return Number((minimumInches(species) * SEED_SHARE).toFixed(3));
}

export function isSeed(species, inches) {
  if (!SPECIES.includes(species)) {
    throw new InputError('seed.species', `${species} is not a species this programme handles`, {
      species,
      known: SPECIES.slice(),
    });
  }
  return inches < seedInches(species);
}

export function seedPermit({ number, harvester, fromArea, toBed, species, issuedOn, expiresOn }) {
  requireString(number, 'number');
  requireString(toBed, 'toBed');
  return Object.freeze({
    number: number.trim().toUpperCase(),
    harvester: parseHarvesterId(harvester, 'harvester').id,
    fromArea: parseAreaId(fromArea, 'fromArea').id,
    toBed: toBed.trim().toUpperCase(),
    species,
    issuedOn: asDate(issuedOn, 'issuedOn'),
    expiresOn: asDate(expiresOn, 'expiresOn'),
  });
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('seed.date', `${field} is required`, { field });
  }
  return value;
}

/**
 * Check a transplant. The measurements are a sample of what went across, and
 * anything at or over the seed size is not seed: it is market shellfish coming
 * out of prohibited water, which is the whole reason the size is checked.
 */
export function checkTransplant({
  permit,
  fromArea,
  toBed,
  species,
  measurements,
  movedOn,
  receivingClassification,
  harvester,
}) {
  const problems = findings();
  const day = asDate(movedOn, 'movedOn');
  checkPermit({ permit, fromArea, toBed, harvester, day, problems });

  const limit = seedInches(species);
  const oversize = measurements.filter((one) => one >= limit);
  if (oversize.length > 0) {
    problems.error(
      'seed.oversize',
      `${oversize.length} of ${measurements.length} were at or over ${limit} inches, which is not seed`,
      { oversize: oversize.length, sampled: measurements.length, limit },
    );
  }

  const receiving = classification(receivingClassification, 'receivingClassification').name;
  if (!RECEIVING.has(receiving)) {
    problems.error(
      'seed.receivingWater',
      `${toBed} is in ${receiving} water, which seed may not be laid into`,
      { toBed, classification: receiving },
    );
  }

  return Object.freeze({
    permit: permit === null || permit === undefined ? null : permit.number,
    fromArea,
    toBed,
    species,
    movedOn: day,
    seedInches: limit,
    sampled: measurements.length,
    oversize: oversize.length,
    mayHarvestFrom: addDays(day, GROW_ON_DAYS),
    lawful: problems.isLawful(),
    problems,
  });
}

function checkPermit({ permit, fromArea, toBed, harvester, day, problems }) {
  if (permit === null || permit === undefined) {
    problems.error('seed.noPermit', 'seed was moved under no permit', { fromArea, toBed });
    return;
  }
  if (permit.fromArea !== parseAreaId(fromArea, 'fromArea').id) {
    problems.error('seed.wrongSource', `the permit names ${permit.fromArea}, not ${fromArea}`, {
      permit: permit.number,
      permitted: permit.fromArea,
      actual: fromArea,
    });
  }
  if (permit.toBed !== String(toBed).trim().toUpperCase()) {
    problems.error('seed.wrongDestination', `the permit names ${permit.toBed}, not ${toBed}`, {
      permit: permit.number,
      permitted: permit.toBed,
      actual: toBed,
    });
  }
  if (permit.harvester !== parseHarvesterId(harvester, 'harvester').id) {
    problems.error('seed.wrongHarvester', `the permit is held by ${permit.harvester}`, {
      permit: permit.number,
      holder: permit.harvester,
    });
  }
  if (compareCivilDate(day, permit.issuedOn) < 0 || compareCivilDate(day, permit.expiresOn) > 0) {
    problems.error('seed.permitLapsed', `the permit was not in force on ${formatCivilDate(day)}`, {
      permit: permit.number,
    });
  }
}

/** Whether anything may yet be taken off a bed the seed went onto. */
export function mayHarvestYet(transplant, on) {
  return compareCivilDate(on, transplant.mayHarvestFrom) >= 0;
}
