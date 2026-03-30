/**
 * Whether a sample was taken under the conditions its survey claims for it.
 *
 * An adverse pollution condition survey is only worth anything if the samples
 * were actually collected under the adverse condition. A set of thirty bottles
 * drawn on quiet blue days and filed as an adverse survey is not a strict
 * reading of the water. It is the most generous reading there is, dressed up
 * as the strictest, and it will hold an area at conditionally approved that
 * ought to have been restricted years ago.
 *
 * What counts as the adverse condition is not a property of the survey. It is
 * whatever the area's own management plan closes on: two inches at the Neuse
 * gauge for one area, a river stage for the next, a plant bypass for the third.
 * So the plan's trigger decides which samples the standard is allowed to read,
 * the standard decides the classification, and the classification is what
 * decided the plan. That loop is the point of this module, and it settles
 * because the qualification is done once, against the plan in force on the day
 * the sample was collected.
 *
 * A sample carries a civil date and a trigger fires at an instant, so the two
 * do not line up on their own. The day is treated as qualifying when the
 * trigger was firing at any moment the trigger's own instrument reported that
 * day. That is stated rather than assumed: a day with no reading at all is
 * unqualified and is reported as unqualified, not quietly dropped.
 */

import { findings } from '../core/finding.js';
import { firingMoments } from '../condition/closure.js';
import { evaluateTrigger } from '../condition/trigger.js';
import { planInForce } from '../condition/plan.js';
import { MIDNIGHT, addDays, formatCivilDate } from '../time/civil.js';
import { instantFromCivil } from '../time/instant.js';
import { window } from '../time/window.js';
import { ADVERSE_POLLUTION } from './strategy.js';

export const QUALIFIED = 'taken under the condition';
export const NOT_QUALIFIED = 'taken on a quiet day';
export const NOT_MEASURED = 'nothing was reported that day';
export const NO_PLAN = 'the area carries no plan to be adverse to';

/** The day a sample was collected, as a span in the area's own zone. */
export function dayOf(zone, date) {
  return window(
    instantFromCivil(zone, date, MIDNIGHT),
    instantFromCivil(zone, addDays(date, 1), MIDNIGHT),
  );
}

/**
 * Whether one sample was collected on a day the plan's trigger was firing.
 * The verdict carries the moment it fired at, because a sanitarian asked to
 * throw a bottle out wants to see the reading that kept it or lost it.
 */
export function qualify(sample, { plan, feed = {}, zone = 'eastern' }) {
  if (plan === null || plan === undefined) {
    return Object.freeze({
      station: sample.station,
      on: sample.collectedOn,
      verdict: NO_PLAN,
      at: null,
    });
  }
  const span = dayOf(zone, sample.collectedOn);
  const moments = firingMoments(plan, feed, span);
  if (moments.length === 0) {
    return Object.freeze({
      station: sample.station,
      on: sample.collectedOn,
      verdict: NOT_MEASURED,
      at: null,
      trigger: plan.trigger.kind,
    });
  }
  for (const at of moments) {
    const reading = evaluateTrigger(plan.trigger, {
      at,
      readings: feed.readings ?? [],
      bypasses: feed.bypasses ?? [],
      zone,
    });
    if (reading.fired) {
      return Object.freeze({
        station: sample.station,
        on: sample.collectedOn,
        verdict: QUALIFIED,
        at,
        trigger: plan.trigger.kind,
        measured: reading.measured,
        threshold: reading.threshold,
      });
    }
  }
  return Object.freeze({
    station: sample.station,
    on: sample.collectedOn,
    verdict: NOT_QUALIFIED,
    at: null,
    trigger: plan.trigger.kind,
  });
}

/**
 * Qualify a whole set. The plan looked up is the one in force on the day of
 * each sample rather than the one in force today, because a survey window is
 * three years long and plans get rewritten inside it.
 */
export function qualifySet(samples, { plans = [], area, feed = {}, zone = 'eastern' }) {
  return samples.map((one) =>
    qualify(one, { plan: planInForce(plans, area, one.collectedOn), feed, zone }),
  );
}

/** The samples the standard may read, in the order they were handed in. */
export function qualifiedSamples(samples, options) {
  const verdicts = qualifySet(samples, options);
  return samples.filter((unused, index) => verdicts[index].verdict === QUALIFIED);
}

/**
 * What a survey looks like once the condition is enforced. A systematic random
 * survey is returned untouched and says so: its whole basis is that the
 * weather had no say in when the boat went out, so qualifying it against a
 * trigger would be the wrong test rather than a lenient one.
 */
export function conditionedSet(
  samples,
  { strategy: name, plans = [], area, feed = {}, zone = 'eastern' },
) {
  if (name !== ADVERSE_POLLUTION) {
    return Object.freeze({
      strategy: name,
      enforced: false,
      kept: Object.freeze(samples.slice()),
      dropped: Object.freeze([]),
      verdicts: Object.freeze([]),
      because: 'the weather has no say in when a systematic survey goes out',
    });
  }
  const verdicts = qualifySet(samples, { plans, area, feed, zone });
  const kept = [];
  const dropped = [];
  samples.forEach((one, index) => {
    if (verdicts[index].verdict === QUALIFIED) {
      kept.push(one);
    } else {
      dropped.push(Object.freeze({ sample: one, why: verdicts[index] }));
    }
  });
  return Object.freeze({
    strategy: name,
    enforced: true,
    kept: Object.freeze(kept),
    dropped: Object.freeze(dropped),
    verdicts: Object.freeze(verdicts),
    because: 'an adverse survey is only adverse if the condition was there',
  });
}

/**
 * The findings a conditioned set raises. Dropping bottles is not free: a
 * survey that loses a third of its samples to the condition may no longer hold
 * enough of them to be scored at all, and that has to be said here rather than
 * discovered as a quiet pass downstream.
 */
export function conditionFindings(conditioned, { area }) {
  const problems = findings();
  if (!conditioned.enforced) {
    return problems;
  }
  const total = conditioned.kept.length + conditioned.dropped.length;
  if (total === 0) {
    return problems;
  }
  const quiet = conditioned.dropped.filter((one) => one.why.verdict === NOT_QUALIFIED);
  const unmeasured = conditioned.dropped.filter((one) => one.why.verdict === NOT_MEASURED);
  const planless = conditioned.dropped.filter((one) => one.why.verdict === NO_PLAN);

  if (planless.length > 0) {
    problems.error(
      'conditions.noPlan',
      `${area} is surveyed as adverse and has no plan saying what adverse means`,
      { area, samples: planless.length },
    );
  }
  if (quiet.length > 0) {
    problems.warn(
      'conditions.quietDay',
      `${quiet.length} of ${total} samples for ${area} were taken on days the trigger was not firing`,
      { area, dropped: quiet.length, total, days: daysOf(quiet) },
    );
  }
  if (unmeasured.length > 0) {
    problems.note(
      'conditions.unmeasured',
      `${unmeasured.length} of ${total} samples for ${area} fall on days the instrument reported nothing`,
      { area, dropped: unmeasured.length, total, days: daysOf(unmeasured) },
    );
  }
  if (conditioned.kept.length === 0) {
    problems.error(
      'conditions.noneQualified',
      `not one of the ${total} samples for ${area} was taken under the condition`,
      { area, total },
    );
  }
  return problems;
}

function daysOf(dropped) {
  return Array.from(new Set(dropped.map((one) => formatCivilDate(one.why.on)))).sort();
}
