/**
 * Scoring a set of results, and the walk that finds the class it supports.
 *
 * Two questions live here and they are not the same question.
 *
 * The first is whether an area meets the standard it is currently held to.
 * That is a yes or a no and it is what the annual review asks.
 *
 * The second is which class the water actually supports. That is a walk down
 * the table from the most permissive class until one of them is met, and it is
 * what a reclassification proposal is built from. The two disagree exactly
 * when an area is held to a class its water no longer supports, which is the
 * case the whole program exists to catch.
 *
 * The walk terminates because the table is finite and because what a set
 * supports is a property of the set, not of where the walk started. There is a
 * test that says so rather than a comment claiming it.
 */

import { findings } from '../core/finding.js';
import { PROHIBITED } from '../area/classification.js';
import { describeSet } from './statistics.js';
import { limitsFor, scorableClassifications } from './standard.js';
import {
  CRITERION_GEOMETRIC_MEAN,
  CRITERION_HIGHEST,
  CRITERION_NINETIETH,
  censoringFor,
  criteriaFor,
  isSufficient,
} from './strategy.js';

const READERS = Object.freeze({
  [CRITERION_GEOMETRIC_MEAN]: (described) => described.geometricMean,
  [CRITERION_NINETIETH]: (described) => described.estimatedNinetieth,
  [CRITERION_HIGHEST]: (described) => described.highest,
});

const LIMIT_KEYS = Object.freeze({
  [CRITERION_GEOMETRIC_MEAN]: 'geometricMean',
  [CRITERION_NINETIETH]: 'ninetieth',
  [CRITERION_HIGHEST]: 'highest',
});

/**
 * Score one set against one class. The description is computed under the
 * strategy's censoring policy, so the same results scored under the other
 * strategy are a different set of numbers before any limit is looked at.
 */
export function scoreAgainst(results, { classification, analysis, strategy }) {
  const limits = limitsFor(classification, analysis);
  const described = describeSet(results, censoringFor(strategy));
  if (limits === null) {
    return Object.freeze({
      classification,
      analysis,
      strategy,
      described,
      criteria: Object.freeze([]),
      met: false,
      reason: 'prohibited water is not scored against a standard',
    });
  }
  const criteria = criteriaFor(strategy).map((criterion) => {
    const value = READERS[criterion](described);
    const limit = limits[LIMIT_KEYS[criterion]];
    return Object.freeze({ criterion, value, limit, met: value <= limit });
  });
  return Object.freeze({
    classification,
    analysis,
    strategy,
    described,
    criteria: Object.freeze(criteria),
    met: criteria.every((entry) => entry.met),
    reason: null,
  });
}

/**
 * The walk. It starts at the most permissive class and stops at the first one
 * the set meets, so the answer is the best class the water supports rather
 * than the first one somebody thought to test.
 */
export function supportedClassification(results, { analysis, strategy }) {
  const steps = [];
  for (const candidate of scorableClassifications()) {
    const score = scoreAgainst(results, { classification: candidate, analysis, strategy });
    steps.push(score);
    if (score.met) {
      return Object.freeze({ supported: candidate, steps: Object.freeze(steps), score });
    }
  }
  return Object.freeze({ supported: PROHIBITED, steps: Object.freeze(steps), score: null });
}

/**
 * The full survey verdict: whether there is enough data, whether the area
 * meets what it is held to, and what its water supports. An insufficient set
 * produces no supported class at all, because four samples do not support
 * anything.
 */
export function evaluateSurvey({ results, heldTo, analysis, strategy, perStation = {} }) {
  const problems = findings();
  const sufficiency = isSufficient(strategy, { total: results.length, perStation });
  if (!sufficiency.sufficient) {
    problems.warn(
      'survey.thin',
      `the set holds ${sufficiency.total} results against a floor of ${sufficiency.required}`,
      { ...sufficiency, thinStations: sufficiency.thinStations.slice() },
    );
    return Object.freeze({
      sufficiency,
      held: null,
      supported: null,
      meetsHeld: null,
      problems,
    });
  }
  const held = scoreAgainst(results, { classification: heldTo, analysis, strategy });
  const walk = supportedClassification(results, { analysis, strategy });
  if (!held.met) {
    for (const entry of held.criteria.filter((item) => !item.met)) {
      problems.error(
        'survey.overLimit',
        `the ${entry.criterion} of ${round(entry.value)} is over the ${heldTo} limit of ${entry.limit}`,
        { criterion: entry.criterion, value: entry.value, limit: entry.limit },
      );
    }
  }
  return Object.freeze({
    sufficiency,
    held,
    supported: walk.supported,
    walk,
    meetsHeld: held.met,
    problems,
  });
}

function round(value) {
  return Math.round(value * 10) / 10;
}
