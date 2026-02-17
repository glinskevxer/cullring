/**
 * Split samples, and whether the laboratory is repeatable.
 *
 * One sample in ten is split and both halves are run. The two answers will not
 * agree, because the method does not work that way, and the question is not
 * whether they agree but whether they disagree by more than they usually do.
 *
 * That is a control chart on the range of the logs. Take the difference of the
 * logs for every pair, average them, and any pair whose difference is more
 * than the control factor times that average is out of control. The factor
 * comes from the statistics of a range of two and is not ours to choose.
 *
 * The thing worth saying out loud is what an out of control pair means. It
 * does not void the result: it says the run it came from cannot be relied on,
 * and the office decides whether to re-run the batch. So this reports on a run
 * and never on a sample.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireArray } from '../core/assert.js';
import { AT_LIMIT, valueUnderPolicy } from './statistics.js';

/** The control factor for the range of a pair. It is a constant, not a choice. */
export const CONTROL_FACTOR = 3.27;

/** Fewer pairs than this and the average range means nothing. */
export const MINIMUM_PAIRS = 5;

export function pair({ station, collectedOn, first, second }) {
  if (first === undefined || second === undefined) {
    throw new InputError('duplicate.pair', 'a split sample carries two results', { station });
  }
  const a = valueUnderPolicy(first, AT_LIMIT);
  const b = valueUnderPolicy(second, AT_LIMIT);
  return Object.freeze({
    station,
    collectedOn,
    first,
    second,
    range: Math.abs(Math.log10(a) - Math.log10(b)),
  });
}

/** The average range over a run, which is what every pair is judged against. */
export function meanRange(pairs) {
  requireArray(pairs, 'pairs', { min: 1 });
  return pairs.reduce((total, one) => total + one.range, 0) / pairs.length;
}

export function controlLimit(pairs) {
  return CONTROL_FACTOR * meanRange(pairs);
}

/**
 * Check a run. A run with too few pairs is not passing and not failing: the
 * control limit is an average of too little to be an average, and saying so is
 * more use than a verdict computed off three numbers.
 */
export function checkRun(pairs, { label = null } = {}) {
  const problems = findings();
  if (pairs.length < MINIMUM_PAIRS) {
    problems.warn(
      'duplicate.thin',
      `the run holds ${pairs.length} pairs against ${MINIMUM_PAIRS}`,
      { pairs: pairs.length, needed: MINIMUM_PAIRS, label },
    );
    return Object.freeze({
      label,
      pairs: Object.freeze(pairs),
      mean: pairs.length === 0 ? null : meanRange(pairs),
      limit: null,
      outOfControl: Object.freeze([]),
      inControl: null,
      problems,
    });
  }
  const limit = controlLimit(pairs);
  const outOfControl = pairs.filter((one) => one.range > limit);
  for (const one of outOfControl) {
    problems.error(
      'duplicate.outOfControl',
      `${one.station} split by ${round(one.range)} against a limit of ${round(limit)}`,
      { station: one.station, range: one.range, limit, label },
    );
  }
  return Object.freeze({
    label,
    pairs: Object.freeze(pairs),
    mean: meanRange(pairs),
    limit,
    outOfControl: Object.freeze(outOfControl),
    inControl: outOfControl.length === 0,
    problems,
  });
}

/**
 * How repeatable the run is, as a share. It is the average range expressed
 * against a tenfold difference, so a tenth means the two halves typically
 * disagree by about twenty five per cent, which is what this method does.
 */
export function repeatability(run) {
  if (run.mean === null) {
    return null;
  }
  return run.mean;
}

export function describeRun(run) {
  if (run.limit === null) {
    return `${run.pairs.length} pairs, too few to set a limit`;
  }
  if (run.inControl) {
    return `${run.pairs.length} pairs, mean range ${round(run.mean)}, all in control`;
  }
  return `${run.pairs.length} pairs, ${run.outOfControl.length} out of control`;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
