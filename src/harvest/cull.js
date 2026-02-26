/**
 * Culling, which is what the ring on the dredge is for and what this programme
 * is named after.
 *
 * A shellfish under the minimum size goes back. The rule is not "no undersize
 * in the container", because no two oysters grow alike and a bushel with three
 * small ones in it is not a violation anybody could work to. It is a tolerance
 * measured by count in a sample, and the sample size is fixed so that the
 * tolerance means the same thing in a bushel as in a boatload.
 *
 * Three things decide the answer and they are read in this order. The species
 * sets the minimum size. The area may set a smaller one, because a bed that
 * grows slowly is worked under a variance. And the count of undersize in the
 * sample is compared against a tolerance that depends on the gear, since a
 * dredge cannot cull as finely as a pair of tongs and the rule has always
 * allowed for that.
 *
 * The variance arrives as a number rather than as a register. This module has
 * no business knowing what a variance is or when it lapsed: it is handed the
 * size that applies and it applies it, which is what lets the same function
 * answer a hypothetical question about a size nobody has been granted.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireArray, requireNumber } from '../core/assert.js';
import { BAY_SCALLOP, HARD_CLAM, OYSTER, SPECIES } from './record.js';
import { DREDGE, HAND, RAKE, TONGS, requireGear } from '../licence/harvester.js';

/** The size a shellfish has to make, in inches, by species. */
const MINIMUM_INCHES = new Map([
  [OYSTER, 3],
  [HARD_CLAM, 1],
  [BAY_SCALLOP, 1.5],
]);

/** What is measured: the longest dimension for an oyster, the hinge width for a clam. */
const MEASURED = new Map([
  [OYSTER, 'longest dimension'],
  [HARD_CLAM, 'thickness across the hinge'],
  [BAY_SCALLOP, 'longest dimension'],
]);

/** How many undersize a sample of a hundred may hold, by gear. */
const TOLERANCE_PER_HUNDRED = new Map([
  [TONGS, 5],
  [HAND, 5],
  [RAKE, 5],
  [DREDGE, 10],
]);

/** The sample every tolerance is expressed against. */
export const SAMPLE_SIZE = 100;

export function minimumInches(species, { variance = null } = {}) {
  if (!SPECIES.includes(species)) {
    throw new InputError('cull.species', `${species} is not a species this programme handles`, {
      species,
      known: SPECIES.slice(),
    });
  }
  const standard = MINIMUM_INCHES.get(species);
  if (variance === null) {
    return standard;
  }
  requireNumber(variance, 'variance', { min: 0, max: standard });
  return variance;
}

export function measuredDimension(species) {
  minimumInches(species);
  return MEASURED.get(species);
}

export function tolerancePerHundred(gear) {
  requireGear(gear, 'gear');
  const allowed = TOLERANCE_PER_HUNDRED.get(gear);
  if (allowed === undefined) {
    throw new InputError('cull.gear', `${gear} has no culling tolerance`, { gear });
  }
  return allowed;
}

/**
 * The tolerance for a sample that is not a hundred. It is rounded down, not to
 * the nearest: rounding up would let a sample of fifty carry three undersize
 * where a hundred carries five, which is a looser rule for a smaller sample
 * and the wrong way round.
 */
export function toleranceFor(gear, sampleSize) {
  requireNumber(sampleSize, 'sampleSize', { min: 1, integer: true });
  return Math.floor((tolerancePerHundred(gear) * sampleSize) / SAMPLE_SIZE);
}

export function checkCull({ species, gear, measurements, variance = null, lot = null }) {
  const problems = findings();
  requireArray(measurements, 'measurements', { min: 1 });
  const minimum = minimumInches(species, { variance });
  const undersize = measurements.filter((one) => {
    requireNumber(one, 'measurement', { min: 0 });
    return one < minimum;
  });
  const allowed = toleranceFor(gear, measurements.length);
  if (undersize.length > allowed) {
    problems.error(
      'cull.overTolerance',
      `${undersize.length} of ${measurements.length} were under ${minimum} inches against a tolerance of ${allowed}`,
      {
        lot,
        undersize: undersize.length,
        sampled: measurements.length,
        minimum,
        allowed,
        gear,
      },
    );
  }
  if (measurements.length < SAMPLE_SIZE) {
    problems.note(
      'cull.smallSample',
      `${measurements.length} were measured against a sample of ${SAMPLE_SIZE}`,
      { lot, sampled: measurements.length },
    );
  }
  return Object.freeze({
    lot,
    species,
    gear,
    minimum,
    measured: measuredDimension(species),
    sampled: measurements.length,
    undersize: undersize.length,
    allowed,
    share: undersize.length / measurements.length,
    passes: problems.isLawful(),
    problems,
  });
}

export function describeCull(answer) {
  return `${answer.undersize} of ${answer.sampled} under ${answer.minimum} in, tolerance ${answer.allowed}`;
}
