/**
 * Emergency closures, which are not a kind of management plan.
 *
 * A management plan is an arrangement the office made in advance with a piece
 * of water. An emergency closure is an order somebody signed this morning, and
 * the two are kept apart deliberately: an order overrides the classification
 * outright, it does not care what the plan says, and it does not lift because
 * seventy two hours went by.
 *
 * Precedence is the whole rule. While an order is in force the area is
 * prohibited and nothing else is consulted, which is why this is checked
 * before the plan rather than folded in with it. A programme that took the
 * stricter of the two would give the same answer today and the wrong reason,
 * and the reason is what goes on the notice.
 *
 * Biotoxin orders are the exception to lifting by date: they lift on
 * clearance samples, and that runs on the same clock machinery as everything
 * else, which is the point of having kept the clocks separate.
 */

import { InputError } from '../core/errors.js';
import { requireArray, requireString } from '../core/assert.js';
import { PROHIBITED } from '../area/classification.js';
import { parseAreaId } from '../core/identity.js';
import { isInstant } from '../time/instant.js';
import { afterSamples, evaluateReopening } from './reopening.js';

export const BIOTOXIN = 'biotoxin';
export const SPILL = 'spill';
export const STORM = 'storm';
export const ILLNESS = 'reported illness';

export const ORDER_KINDS = Object.freeze([BIOTOXIN, SPILL, STORM, ILLNESS]);

/** How many clearance samples a biotoxin order needs before it can lift. */
export const CLEARANCE_SAMPLES = 2;

export function emergencyOrder({ number, kind, areas, issuedAt, liftedAt = null, reason = null }) {
  requireString(number, 'number');
  if (!ORDER_KINDS.includes(kind)) {
    throw new InputError('order.kind', `${kind} is not a kind of emergency order`, {
      kind,
      known: ORDER_KINDS.slice(),
    });
  }
  requireArray(areas, 'areas', { min: 1 });
  if (!isInstant(issuedAt)) {
    throw new InputError('order.time', 'an order is issued at an instant', { number });
  }
  if (liftedAt !== null && !isInstant(liftedAt)) {
    throw new InputError('order.time', 'an order lifts at an instant', { number });
  }
  if (liftedAt !== null && liftedAt.epochSecond < issuedAt.epochSecond) {
    throw new InputError('order.time', 'an order cannot lift before it is issued', { number });
  }
  return Object.freeze({
    number: number.trim().toUpperCase(),
    kind,
    areas: Object.freeze(areas.map((one) => parseAreaId(one, 'areas').id)),
    issuedAt,
    liftedAt,
    reason,
    needsClearance: kind === BIOTOXIN,
  });
}

export function coversArea(order, areaId) {
  return order.areas.includes(parseAreaId(areaId, 'area').id);
}

export function inForceAt(order, at) {
  if (at.epochSecond < order.issuedAt.epochSecond) {
    return false;
  }
  return order.liftedAt === null || at.epochSecond < order.liftedAt.epochSecond;
}

/**
 * The order in force over an area at a moment, or nothing. Two orders over one
 * area is not a defect: a spill and a biotoxin bloom can happen in one week,
 * and the one that answers is the one issued last.
 */
export function orderInForce(orders, areaId, at) {
  const covering = orders.filter((one) => coversArea(one, areaId) && inForceAt(one, at));
  if (covering.length === 0) {
    return null;
  }
  return covering.reduce((latest, one) =>
    one.issuedAt.epochSecond > latest.issuedAt.epochSecond ? one : latest,
  );
}

/** What an order makes of an area, which is the same answer for all four kinds. */
export function classificationUnder(order) {
  if (order === null) {
    return null;
  }
  return PROHIBITED;
}

/**
 * Whether a biotoxin order could be lifted yet. Orders that do not need
 * clearance answer with nothing, because the question does not apply to them
 * and false would read as "not yet".
 */
export function clearanceMet(order, samples) {
  if (!order.needsClearance) {
    return null;
  }
  const after = samples.filter(
    (one) => one.conforming === true && one.at.epochSecond > order.issuedAt.epochSecond,
  );
  return evaluateReopening(afterSamples(CLEARANCE_SAMPLES), {
    conformingSamples: after.length,
  }).met;
}

export function describeOrder(order) {
  const state = order.liftedAt === null ? 'in force' : 'lifted';
  return `${order.number}: ${order.kind}, ${state}, covering ${order.areas.join(', ')}`;
}

export function ordersFor(orders, areaId) {
  return orders
    .filter((one) => coversArea(one, areaId))
    .sort((left, right) => left.issuedAt.epochSecond - right.issuedAt.epochSecond);
}
