/**
 * The class in force at a moment, which is where the register meets the plan.
 *
 * Two things decide what a piece of water is at ten past nine on a Tuesday.
 * The register says what it is classified as, and that is a fact about paper.
 * The management plan says whether the plan has it shut, and that is a fact
 * about rain. Neither one is the answer on its own, and everything downstream
 * that asks whether a harvest was lawful asks this function rather than either
 * of them.
 *
 * The awkward cases are the ones worth naming.
 *
 * A conditional area with no plan in force is not an open area. It is a
 * register defect, and the safe reading of a register defect is that nothing
 * may be taken, because the whole basis of the conditional classification is a
 * plan somebody is operating.
 *
 * A plan attached to an area that is not conditionally classified is also a
 * defect, but a harmless one: the class already says what may be taken and the
 * plan has nothing to add. It is reported and ignored.
 *
 * An emergency order beats both. It is consulted first and it stops the
 * function: while an order is in force the area is prohibited and neither the
 * register nor the plan has anything left to say. Taking the stricter of the
 * order and the plan would give the same answer today and cite the wrong
 * reason, and the reason is what goes on the notice.
 */

import { findings } from '../core/finding.js';
import { PROHIBITED, isConditional, whenPlanClosed, whenPlanOpen } from './classification.js';
import { classificationOn, periodOn } from './growingArea.js';
import { planInForce } from '../condition/plan.js';
import { stateAt } from '../condition/closure.js';
import { classificationUnder, orderInForce } from '../condition/emergency.js';
import { civilDateAt } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';

export function effectiveClassification({
  area,
  plans = [],
  feed = {},
  orders = [],
  at,
  from = null,
}) {
  const problems = findings();
  const day = civilDateAt(area.zone, at);
  const paper = classificationOn(area, day);
  if (paper === null) {
    problems.error(
      'area.unclassified',
      `${area.id} has no classification of record on ${formatCivilDate(day)}`,
      {
        area: area.id,
        on: formatCivilDate(day),
      },
    );
    return sealed({ area, at, day, paper: null, effective: PROHIBITED, problems });
  }
  const order = orderInForce(orders, area.id, at);
  if (order !== null) {
    problems.note('area.underOrder', `${area.id} is shut under ${order.number}`, {
      area: area.id,
      order: order.number,
      kind: order.kind,
    });
    return sealed({
      area,
      at,
      day,
      paper,
      effective: classificationUnder(order),
      order,
      problems,
    });
  }
  const plan = planInForce(plans, area.id, day);
  if (!isConditional(paper)) {
    if (plan !== null) {
      problems.warn(
        'area.planWithoutCondition',
        `${area.id} carries a plan but is not conditionally classified`,
        {
          area: area.id,
          classification: paper,
        },
      );
    }
    return sealed({ area, at, day, paper, effective: paper, plan: null, problems });
  }
  if (plan === null) {
    problems.error(
      'area.planMissing',
      `${area.id} is ${paper} and has no management plan in force`,
      {
        area: area.id,
        classification: paper,
        on: formatCivilDate(day),
      },
    );
    return sealed({ area, at, day, paper, effective: PROHIBITED, problems });
  }
  const state = stateAt(plan, feed, at, { from });
  const effective = state.closed ? whenPlanClosed(paper) : whenPlanOpen(paper);
  if (state.closed) {
    problems.note('area.planClosed', `${area.id} is shut under its management plan`, {
      area: area.id,
      since: state.closure.start.epochSecond,
    });
  }
  return sealed({ area, at, day, paper, effective, plan, state, problems });
}

function sealed({
  area,
  at,
  day,
  paper,
  effective,
  plan = null,
  state = null,
  order = null,
  problems,
}) {
  const period = paper === null ? null : periodOn(area, day);
  return Object.freeze({
    area: area.id,
    at,
    on: day,
    paper,
    effective,
    basis: period === null ? null : period.basis,
    plan,
    order,
    closed: state === null ? false : state.closed,
    closure: state === null ? null : state.closure,
    problems,
  });
}

/** Every area's standing at one moment, in area order. */
export function standingAt({ areas, plans = [], feed = {}, orders = [], at, from = null }) {
  return areas
    .slice()
    .sort((left, right) =>
      left.region === right.region
        ? left.number - right.number
        : left.region < right.region
          ? -1
          : 1,
    )
    .map((area) => effectiveClassification({ area, plans, feed, orders, at, from }));
}

/** True when anything at all may lawfully be taken from the water at that moment. */
export function anyHarvestAllowed(standing) {
  return standing.effective !== PROHIBITED;
}
