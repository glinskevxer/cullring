import { describe, expect, it } from 'vitest';

import {
  BIOTOXIN,
  CLEARANCE_SAMPLES,
  ILLNESS,
  ORDER_KINDS,
  SPILL,
  STORM,
  classificationUnder,
  clearanceMet,
  coversArea,
  describeOrder,
  emergencyOrder,
  inForceAt,
  orderInForce,
  ordersFor,
} from '../../src/condition/emergency.js';
import { effectiveClassification } from '../../src/area/effective.js';
import { APPROVED, PROHIBITED } from '../../src/area/classification.js';
import { B12, C3, JUNE_FIRST, PLANS, STORM as STORM_FEED, at } from '../support/register.js';

const order = (extra = {}) =>
  emergencyOrder({
    number: 'eo-2025-04',
    kind: BIOTOXIN,
    areas: ['B-12', 'C-3'],
    issuedAt: at('2025-06-05 08:00'),
    reason: 'Karenia bloom offshore',
    ...extra,
  });

describe('building an order', () => {
  it('normalises the number and the areas', () => {
    const one = order({ areas: [' b-12 ', 'c-03'] });
    expect(one.number).toBe('EO-2025-04');
    expect(one.areas).toEqual(['B-12', 'C-3']);
  });

  it('marks a biotoxin order as needing clearance and the others as not', () => {
    expect(order().needsClearance).toBe(true);
    for (const kind of [SPILL, STORM, ILLNESS]) {
      expect(order({ kind }).needsClearance).toBe(false);
    }
  });

  it('refuses a kind it does not know and lists the four', () => {
    try {
      order({ kind: 'a bad feeling' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(ORDER_KINDS.slice());
    }
  });

  it('refuses an order over no areas, or with a bad area number', () => {
    expect(() => order({ areas: [] })).toThrow(/at least 1 entries/);
    expect(() => order({ areas: ['nowhere'] })).toThrow(/is not an area number/);
  });

  it('refuses an order that lifts before it is issued', () => {
    expect(() => order({ liftedAt: at('2025-06-01 08:00') })).toThrow(/cannot lift before/);
  });

  it('describes itself in one line', () => {
    expect(describeOrder(order())).toBe('EO-2025-04: biotoxin, in force, covering B-12, C-3');
    expect(describeOrder(order({ liftedAt: at('2025-06-20 08:00') }))).toMatch(/lifted/);
  });
});

describe('when an order is in force', () => {
  it('covers the areas it names and no others', () => {
    expect(coversArea(order(), 'B-12')).toBe(true);
    expect(coversArea(order(), 'D-2')).toBe(false);
  });

  it('starts at the instant it was issued', () => {
    expect(inForceAt(order(), at('2025-06-05 07:59'))).toBe(false);
    expect(inForceAt(order(), at('2025-06-05 08:00'))).toBe(true);
  });

  it('ends at the instant it lifts, which the closure does not include', () => {
    const lifted = order({ liftedAt: at('2025-06-20 08:00') });
    expect(inForceAt(lifted, at('2025-06-20 07:59'))).toBe(true);
    expect(inForceAt(lifted, at('2025-06-20 08:00'))).toBe(false);
  });

  it('runs on where nothing lifted it', () => {
    expect(inForceAt(order(), at('2030-01-01 00:00'))).toBe(true);
  });

  it('picks the one issued last where two cover the area', () => {
    const first = order({ number: 'EO-1', issuedAt: at('2025-06-05 08:00') });
    const second = order({ number: 'EO-2', kind: SPILL, issuedAt: at('2025-06-07 08:00') });
    expect(orderInForce([first, second], 'B-12', at('2025-06-10 08:00')).number).toBe('EO-2');
  });

  it('answers with nothing where none covers', () => {
    expect(orderInForce([order()], 'D-2', at('2025-06-10 08:00'))).toBeNull();
    expect(orderInForce([], 'B-12', at('2025-06-10 08:00'))).toBeNull();
  });

  it('lists the orders over an area in the order they were issued', () => {
    const first = order({ number: 'EO-1', issuedAt: at('2025-06-07 08:00') });
    const second = order({ number: 'EO-2', issuedAt: at('2025-06-05 08:00') });
    expect(ordersFor([first, second], 'B-12').map((one) => one.number)).toEqual(['EO-2', 'EO-1']);
  });
});

describe('what an order makes of an area', () => {
  it('is prohibited whatever the kind', () => {
    for (const kind of ORDER_KINDS) {
      expect(classificationUnder(order({ kind }))).toBe(PROHIBITED);
    }
  });

  it('is nothing where there is no order', () => {
    expect(classificationUnder(null)).toBeNull();
  });
});

describe('clearance', () => {
  const samples = [
    { at: at('2025-06-04 09:00'), conforming: true },
    { at: at('2025-06-08 09:00'), conforming: true },
    { at: at('2025-06-09 09:00'), conforming: false },
    { at: at('2025-06-12 09:00'), conforming: true },
  ];

  it('needs two conforming samples taken after the order', () => {
    expect(CLEARANCE_SAMPLES).toBe(2);
    expect(clearanceMet(order(), samples)).toBe(true);
  });

  it('does not count a sample taken before the order was issued', () => {
    const two = samples.filter((one) => one.at.epochSecond < at('2025-06-09 00:00').epochSecond);
    expect(clearanceMet(order(), two)).toBe(false);
  });

  it('does not count a sample that did not conform', () => {
    const failing = samples.filter((one) => one.conforming === false);
    expect(clearanceMet(order(), failing)).toBe(false);
  });

  it('answers with nothing for an order that does not need clearance', () => {
    expect(clearanceMet(order({ kind: SPILL }), samples)).toBeNull();
  });
});

describe('the order beats the plan and the register', () => {
  const ask = (area, orders, moment) =>
    effectiveClassification({
      area,
      plans: PLANS,
      feed: STORM_FEED,
      orders,
      at: at(moment),
      from: JUNE_FIRST,
    });

  it('shuts an approved area outright', () => {
    const answer = ask(C3, [order()], '2025-06-10 09:00');
    expect(answer.paper).toBe(APPROVED);
    expect(answer.effective).toBe(PROHIBITED);
    expect(answer.order.number).toBe('EO-2025-04');
  });

  it('cites the order rather than the plan on a conditional area', () => {
    const answer = ask(B12, [order()], '2025-06-11 09:00');
    expect(answer.order).not.toBeNull();
    expect(answer.plan).toBeNull();
    expect(answer.problems.has('area.underOrder')).toBe(true);
    expect(answer.problems.has('area.planClosed')).toBe(false);
  });

  it('hands the area back to the plan once the order lifts', () => {
    const lifted = [order({ liftedAt: at('2025-06-06 08:00') })];
    const answer = ask(B12, lifted, '2025-06-11 09:00');
    expect(answer.order).toBeNull();
    expect(answer.problems.has('area.planClosed')).toBe(true);
  });

  it('leaves an area the order does not name alone', () => {
    const answer = ask(C3, [order({ areas: ['D-2'] })], '2025-06-10 09:00');
    expect(answer.effective).toBe(APPROVED);
  });
});
