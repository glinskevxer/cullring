/**
 * A management plan, which is one area, one trigger and one reopening rule.
 *
 * The plan is the document the area is conditionally classified under, and it
 * is the only place in the program where a trigger and a reopening rule are
 * bound together. Keeping them apart until here matters: the two are written
 * in different units and nothing before this point has any reason to believe
 * they are comparable.
 *
 * A plan carries the dates it is in force between, because plans are amended
 * and a closure has to be judged under the plan that was in force on the day,
 * not the one in force when somebody asks.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { parseAreaId } from '../core/identity.js';
import { compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';
import { clockOf, describeReopening } from './reopening.js';
import { TRIGGER_KINDS } from './trigger.js';

export function managementPlan({
  area,
  trigger,
  reopening,
  effectiveFrom,
  effectiveTo = null,
  zone = 'eastern',
  reference = null,
}) {
  const areaId = parseAreaId(area, 'area').id;
  if (trigger === undefined || trigger === null || !TRIGGER_KINDS.includes(trigger.kind)) {
    throw new InputError('plan.trigger', 'a plan carries one trigger', {
      area: areaId,
      kind: trigger === undefined || trigger === null ? null : trigger.kind,
    });
  }
  clockOf(reopening ?? {});
  const from = asDate(effectiveFrom, 'effectiveFrom');
  const to = effectiveTo === null ? null : asDate(effectiveTo, 'effectiveTo');
  if (to !== null && compareCivilDate(to, from) < 0) {
    throw new InputError('plan.dates', 'a plan cannot stop being in force before it starts', {
      area: areaId,
      from: formatCivilDate(from),
      to: formatCivilDate(to),
    });
  }
  if (reference !== null) {
    requireString(reference, 'reference');
  }
  return Object.freeze({
    area: areaId,
    trigger,
    reopening,
    effectiveFrom: from,
    effectiveTo: to,
    zone,
    reference,
  });
}

export function isInForce(plan, date) {
  if (compareCivilDate(date, plan.effectiveFrom) < 0) {
    return false;
  }
  return plan.effectiveTo === null || compareCivilDate(date, plan.effectiveTo) <= 0;
}

/**
 * The plan in force on a day. Plans for one area are not allowed to overlap,
 * so an overlap is a defect in the register rather than a choice to make here.
 */
export function planInForce(plans, area, date) {
  const areaId = parseAreaId(area, 'area').id;
  const matching = plans.filter((plan) => plan.area === areaId && isInForce(plan, date));
  if (matching.length === 0) {
    return null;
  }
  if (matching.length > 1) {
    throw new InputError('plan.overlap', `${areaId} has more than one plan in force`, {
      area: areaId,
      on: formatCivilDate(date),
      count: matching.length,
    });
  }
  return matching[0];
}

export function plansFor(plans, area) {
  const areaId = parseAreaId(area, 'area').id;
  return plans
    .filter((plan) => plan.area === areaId)
    .sort((left, right) => compareCivilDate(left.effectiveFrom, right.effectiveFrom));
}

/** One line for the chart, naming both instruments, since they are not the same one. */
export function describePlan(plan) {
  return `${plan.area}: closes on ${describeTrigger(plan.trigger)}, reopens ${describeReopening(plan.reopening)}`;
}

export function describeTrigger(trigger) {
  switch (trigger.kind) {
    case 'rainfall':
      return `${trigger.inches} inches at ${trigger.gauge} over ${trigger.overHours} hours`;
    case 'stage crossing':
      return `${trigger.gauge} reaching ${trigger.feet} feet`;
    case 'bypass':
      return `a bypass reported at ${trigger.facility}`;
    default:
      return `the season from ${formatCivilDate(trigger.from)} to ${formatCivilDate(trigger.to)}`;
  }
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('plan.dates', `${field} is required`, { field });
  }
  return value;
}
