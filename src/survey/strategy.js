/**
 * The sampling strategy, which is the thing that chooses the criterion.
 *
 * The office runs two programs over the same water and they are not two ways
 * of doing the same job.
 *
 * Systematic random sampling goes out on days drawn without regard to the
 * weather, so the set is a fair picture of the area and the tail of it can be
 * estimated. That estimate is the second half of the standard.
 *
 * Adverse pollution condition sampling goes out on purpose when the river is
 * up and the plant is bypassing. The set is deliberately the worst of the
 * year, so estimating a ninetieth percentile from it would be estimating the
 * tail of a tail. The standard drops that criterion and reads the highest
 * single result instead, and it reads the bounds at half so that a set of
 * mostly clean results cannot hide one bad one behind a narrow spread.
 *
 * So the same thirty results have two verdicts, and which one counts is a
 * property of the survey rather than of the numbers.
 */

import { InputError } from '../core/errors.js';
import { AT_LIMIT, HALF_LOWER_LIMIT } from './statistics.js';

export const SYSTEMATIC_RANDOM = 'systematic random';
export const ADVERSE_POLLUTION = 'adverse pollution condition';

export const CRITERION_GEOMETRIC_MEAN = 'geometric mean';
export const CRITERION_NINETIETH = 'estimated ninetieth percentile';
export const CRITERION_HIGHEST = 'highest single result';

export const STRATEGIES = Object.freeze([SYSTEMATIC_RANDOM, ADVERSE_POLLUTION]);

const TABLE = new Map([
  [
    SYSTEMATIC_RANDOM,
    {
      name: SYSTEMATIC_RANDOM,
      shortName: 'SRS',
      censoring: AT_LIMIT,
      criteria: Object.freeze([CRITERION_GEOMETRIC_MEAN, CRITERION_NINETIETH]),
      minimumSamples: 30,
      minimumPerStation: 5,
      windowYears: 3,
      note: 'days drawn without regard to the weather',
    },
  ],
  [
    ADVERSE_POLLUTION,
    {
      name: ADVERSE_POLLUTION,
      shortName: 'APC',
      censoring: HALF_LOWER_LIMIT,
      criteria: Object.freeze([CRITERION_GEOMETRIC_MEAN, CRITERION_HIGHEST]),
      minimumSamples: 15,
      minimumPerStation: 3,
      windowYears: 5,
      note: 'days chosen because the conditions were bad',
    },
  ],
]);

export function strategy(name, field = 'strategy') {
  if (typeof name !== 'string') {
    throw new InputError('strategy.type', `${field} must name a sampling strategy`, {
      field,
      saw: typeof name,
    });
  }
  const row = TABLE.get(name.trim().toLowerCase());
  if (row === undefined) {
    throw new InputError('strategy.unknown', `${field} ${name} is not a sampling strategy`, {
      field,
      value: name,
      known: STRATEGIES.slice(),
    });
  }
  return row;
}

/** The censoring policy this strategy scores its bounds under. */
export function censoringFor(name) {
  return strategy(name).censoring;
}

/** The criteria this strategy applies, in the order the report prints them. */
export function criteriaFor(name) {
  return strategy(name).criteria.slice();
}

export function appliesCriterion(name, criterion) {
  return strategy(name).criteria.includes(criterion);
}

export function minimumSamples(name) {
  return strategy(name).minimumSamples;
}

export function minimumPerStation(name) {
  return strategy(name).minimumPerStation;
}

/** How far back the strategy is allowed to reach for results. */
export function windowYears(name) {
  return strategy(name).windowYears;
}

export function shortNameOf(name) {
  return strategy(name).shortName;
}

/**
 * Whether a set is big enough to be scored at all. An undersized set is not a
 * failing set: it is a set that cannot answer the question, and the two have
 * to read differently or an area with four samples would be reclassified on
 * the strength of four samples.
 */
export function isSufficient(name, { total, perStation = {} }) {
  const row = strategy(name);
  const stations = Object.keys(perStation);
  const thinStations = stations.filter((station) => perStation[station] < row.minimumPerStation);
  return Object.freeze({
    sufficient: total >= row.minimumSamples && thinStations.length === 0,
    total,
    required: row.minimumSamples,
    requiredPerStation: row.minimumPerStation,
    thinStations: Object.freeze(thinStations.sort()),
  });
}
