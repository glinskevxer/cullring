/**
 * The arithmetic the standards are written in.
 *
 * Coliform densities are log normal, so the average that means anything is the
 * geometric one and the upper tail is estimated from the spread of the logs
 * rather than counted. Both numbers come out of the same three sums, which is
 * why they are computed together and why nothing else in the program is
 * allowed to take a plain mean of a column of results.
 *
 * The censored results are the interesting part. A set that is mostly <1.8 has
 * almost no spread if the bounds are read at their face value, and quite a lot
 * of spread if they are read at half of it. The estimated ninetieth percentile
 * moves with the spread, so the choice changes the verdict. It is a policy
 * argument here and the caller is required to name one.
 */

import { InputError } from '../core/errors.js';
import { ABOVE, BELOW } from './result.js';

/** Read a bound as the number written next to the sign. */
export const AT_LIMIT = 'at limit';

/** Read a lower bound as half of it, which widens the spread. */
export const HALF_LOWER_LIMIT = 'half lower limit';

/** Refuse to average a set that carries a bound at all. */
export const REFUSE_CENSORED = 'refuse censored';

export const CENSORING_POLICIES = Object.freeze([AT_LIMIT, HALF_LOWER_LIMIT, REFUSE_CENSORED]);

/** The multiplier the standard names for a one sided ninetieth percentile. */
export const NINETIETH_FACTOR = 1.28;

export function valueUnderPolicy(result, policy) {
  if (!CENSORING_POLICIES.includes(policy)) {
    throw new InputError('statistics.policy', `${policy} is not a censoring policy`, {
      policy,
      known: CENSORING_POLICIES.slice(),
    });
  }
  if (!result.censored) {
    return result.value;
  }
  if (policy === REFUSE_CENSORED) {
    throw new InputError(
      'statistics.censored',
      'this standard cannot be applied to a set holding a bounded result',
      { kind: result.kind, value: result.value },
    );
  }
  if (policy === HALF_LOWER_LIMIT && result.kind === BELOW) {
    return result.value / 2;
  }
  return result.value;
}

/**
 * The three sums every statistic here is built from, computed once so that a
 * caller asking for both the mean and the percentile does not walk the set
 * twice and does not risk the two disagreeing.
 */
export function logSummary(results, policy) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new InputError('statistics.empty', 'a summary needs at least one result', {
      count: Array.isArray(results) ? 0 : null,
    });
  }
  let sum = 0;
  let sumSquares = 0;
  let censored = 0;
  let atUpper = 0;
  for (const result of results) {
    const value = valueUnderPolicy(result, policy);
    const logged = Math.log10(value);
    sum += logged;
    sumSquares += logged * logged;
    if (result.censored) {
      censored += 1;
    }
    if (result.kind === ABOVE) {
      atUpper += 1;
    }
  }
  const count = results.length;
  const mean = sum / count;
  const variance = count > 1 ? (sumSquares - count * mean * mean) / (count - 1) : 0;
  return Object.freeze({
    count,
    censored,
    atUpper,
    policy,
    logMean: mean,
    logStandardDeviation: Math.sqrt(variance < 0 ? 0 : variance),
  });
}

export function geometricMean(results, policy) {
  return Math.pow(10, logSummary(results, policy).logMean);
}

/**
 * The estimated ninetieth percentile. It is an estimate rather than an order
 * statistic on purpose: the standard is written that way because a set of
 * fifteen samples has no thirteen and a half.
 */
export function estimatedNinetieth(results, policy) {
  const summary = logSummary(results, policy);
  return Math.pow(10, summary.logMean + NINETIETH_FACTOR * summary.logStandardDeviation);
}

/** Everything a standard reads, in one pass. */
export function describeSet(results, policy) {
  const summary = logSummary(results, policy);
  return Object.freeze({
    ...summary,
    geometricMean: Math.pow(10, summary.logMean),
    estimatedNinetieth: Math.pow(
      10,
      summary.logMean + NINETIETH_FACTOR * summary.logStandardDeviation,
    ),
    highest: results.reduce((worst, result) => (result.value > worst ? result.value : worst), 0),
  });
}

/** The share of a set at or above a threshold, which one standard reads. */
export function shareAtOrAbove(results, threshold) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new InputError('statistics.empty', 'a share needs at least one result', {});
  }
  const hits = results.filter((result) => result.value >= threshold).length;
  return hits / results.length;
}

export function roundTo(value, places = 1) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}
