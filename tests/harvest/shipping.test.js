import { describe, expect, it } from 'vitest';

import {
  CONFORMING_STATES,
  checkShipment,
  describeShipment,
  isConforming,
  shippingDocument,
} from '../../src/harvest/shipping.js';
import { DEALERS } from '../support/people.js';
import { at } from '../support/water.js';

const document = (extra = {}) =>
  shippingDocument({
    number: 'sd-2025-0091',
    from: 'SS-042',
    to: 'SP-118',
    toState: 'NC',
    shippedAt: at('2025-08-14 16:00'),
    lots: ['20250814-B12-001', '20250814-B12-002'],
    ...extra,
  });

const check = (extra = {}) => checkShipment({ document: document(extra), dealers: DEALERS });

describe('the conforming states', () => {
  it('holds the ones that keep the agreement', () => {
    expect(isConforming('NC')).toBe(true);
    expect(isConforming(' va ')).toBe(true);
    expect(CONFORMING_STATES.length).toBeGreaterThan(10);
  });

  it('does not hold one that does not', () => {
    expect(isConforming('ZZ')).toBe(false);
    expect(isConforming(null)).toBe(false);
  });
});

describe('building a document', () => {
  it('normalises the numbers and the state', () => {
    const one = document({ toState: ' va ' });
    expect(one.number).toBe('SD-2025-0091');
    expect(one.toState).toBe('VA');
  });

  it('reads the shipper kind off the certification number', () => {
    expect(document().fromKind).toBe('shellstock shipper');
  });

  it('refuses a document with no lots on it', () => {
    expect(() => document({ lots: [] })).toThrow(/at least 1 entries/);
  });

  it('refuses a lot number that is not one', () => {
    expect(() => document({ lots: ['yesterday'] })).toThrow(/lot number/);
  });

  it('refuses a shipper number that is not a certification number', () => {
    expect(() => document({ from: 'Beaufort Oyster' })).toThrow(/certification number/);
  });

  it('refuses a departure that is not an instant', () => {
    expect(() => document({ shippedAt: '2025-08-14 16:00' })).toThrow(/leaves at an instant/);
  });

  it('describes itself in one line', () => {
    expect(describeShipment(document())).toBe('SD-2025-0091: 2 lots from SS-042 to SP-118 in NC');
  });
});

describe('a shipment inside the state', () => {
  it('passes where both dealers are certified', () => {
    const answer = check();
    expect(answer.lawful).toBe(true);
    expect(answer.interstate).toBe(false);
  });

  it('refuses a shipper that could not ship that day', () => {
    expect(check({ from: 'SS-099' }).problems.has('ship.shipperNotCertified')).toBe(true);
  });

  it('refuses a consignee that could not receive that day', () => {
    expect(check({ to: 'SS-099' }).problems.has('ship.consigneeNotCertified')).toBe(true);
  });

  it('refuses a consignee that is not in the register', () => {
    expect(check({ to: 'SP-999' }).problems.has('ship.unknownConsignee')).toBe(true);
  });

  it('refuses a consignee number that is not a certification number', () => {
    expect(check({ to: 'Core Sound Packing' }).problems.has('ship.consigneeNumber')).toBe(true);
  });

  it('refuses a shipper that is not in the register', () => {
    expect(check({ from: 'SS-777' }).problems.has('ship.unknownShipper')).toBe(true);
  });
});

describe('a shipment out of the state', () => {
  it('passes to a state that keeps the agreement, and says the trace ends', () => {
    const answer = check({ toState: 'VA', to: 'Chesapeake Wholesale' });
    expect(answer.lawful).toBe(true);
    expect(answer.interstate).toBe(true);
    expect(answer.problems.has('ship.interstate')).toBe(true);
  });

  it('does not look the consignee up, because it cannot be in this register', () => {
    const answer = check({ toState: 'VA', to: 'Chesapeake Wholesale' });
    expect(answer.problems.has('ship.unknownConsignee')).toBe(false);
  });

  it('refuses a state that does not keep the agreement', () => {
    const answer = check({ toState: 'ZZ', to: 'Somewhere Else' });
    expect(answer.problems.has('ship.stateNotConforming')).toBe(true);
    expect(answer.lawful).toBe(false);
  });
});

describe('the lots on the document', () => {
  it('refuses the same lot named twice', () => {
    const answer = check({ lots: ['20250814-B12-001', '20250814-B12-001'] });
    expect(answer.problems.has('ship.repeatedLot')).toBe(true);
  });

  it('carries every lot through to the answer', () => {
    expect(check().lots).toHaveLength(2);
  });
});
