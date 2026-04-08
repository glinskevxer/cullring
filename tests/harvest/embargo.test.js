import { describe, expect, it } from 'vitest';

import {
  BY_DEALER,
  BY_LOT,
  BY_WATER,
  REVIEW_DAYS,
  checkMovements,
  embargo,
  findEmbargo,
  heldBy,
  lotsHeld,
  reviewFindings,
  standing,
  standsAt,
} from '../../src/harvest/embargo.js';
import { ledger, movement } from '../../src/trace/ledger.js';
import { parseInstant } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (stamp) => parseInstant(stamp, { zone: 'eastern' });

const ISSUED = at('2025-08-20 09:00');

const byLot = embargo({
  number: 'EMB-1',
  reach: BY_LOT,
  lots: ['20250814-D2-001'],
  issuedAt: ISSUED,
  reason: 'a case reported',
});

const byDealer = embargo({
  number: 'EMB-2',
  reach: BY_DEALER,
  dealers: ['SP-004'],
  issuedAt: ISSUED,
});

const byWater = embargo({
  number: 'EMB-3',
  reach: BY_WATER,
  area: 'D-2',
  span: window(at('2025-08-01 00:00'), at('2025-08-31 00:00')),
  issuedAt: ISSUED,
});

describe('building an embargo', () => {
  it('freezes what it names and squares up the case', () => {
    expect(byLot.lots).toEqual(['20250814-D2-001']);
    expect(byDealer.dealers).toEqual(['SP-004']);
    expect(byWater.area).toBe('D-2');
    expect(Object.isFrozen(byLot)).toBe(true);
  });

  it('refuses a reach it does not keep', () => {
    expect(() => embargo({ number: 'X', reach: 'by hunch', issuedAt: ISSUED })).toThrow(
      /is not a way of naming product/,
    );
  });

  it('refuses each reach with nothing to reach', () => {
    expect(() => embargo({ number: 'X', reach: BY_LOT, issuedAt: ISSUED })).toThrow(/at least 1/);
    expect(() => embargo({ number: 'X', reach: BY_DEALER, issuedAt: ISSUED })).toThrow(
      /at least 1/,
    );
    expect(() => embargo({ number: 'X', reach: BY_WATER, issuedAt: ISSUED })).toThrow(
      /names an area and a period/,
    );
  });

  it('refuses a release nobody signed, because that is the whole mechanism', () => {
    expect(() =>
      embargo({
        number: 'X',
        reach: BY_LOT,
        lots: ['20250814-D2-001'],
        issuedAt: ISSUED,
        releasedAt: at('2025-08-25 09:00'),
      }),
    ).toThrow(/carries the name of whoever signed it/);
  });

  it('refuses a release before the embargo', () => {
    expect(() =>
      embargo({
        number: 'X',
        reach: BY_LOT,
        lots: ['20250814-D2-001'],
        issuedAt: ISSUED,
        releasedAt: at('2025-08-01 09:00'),
        releasedBy: 'D Meekins',
      }),
    ).toThrow(/cannot be released before it is issued/);
  });
});

describe('standsAt', () => {
  const released = embargo({
    number: 'EMB-9',
    reach: BY_LOT,
    lots: ['20250814-D2-001'],
    issuedAt: ISSUED,
    releasedAt: at('2025-08-25 09:00'),
    releasedBy: 'D Meekins',
  });

  it('does not stand before it was issued', () => {
    expect(standsAt(byLot, at('2025-08-19 09:00'))).toBe(false);
  });

  it('stands from the moment it is issued', () => {
    expect(standsAt(byLot, ISSUED)).toBe(true);
  });

  it('stops at the release and not a second later', () => {
    expect(standsAt(released, at('2025-08-25 08:59'))).toBe(true);
    expect(standsAt(released, at('2025-08-25 09:00'))).toBe(false);
  });

  it('lists what stands, which is what the desk asks for', () => {
    expect(standing([byLot, released], at('2025-08-26 09:00')).map((one) => one.number)).toEqual([
      'EMB-1',
    ]);
  });

  it('finds one by number, whatever case it was typed in', () => {
    expect(findEmbargo([byLot], 'emb-1').number).toBe('EMB-1');
    expect(findEmbargo([byLot], 'EMB-7')).toBe(null);
  });
});

describe('what an embargo reaches', () => {
  const BOOK = ledger([
    movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
    movement({
      kind: 'received',
      lot: '20250814-D2-001',
      at: at('2025-08-14 15:00'),
      dealer: 'SP-004',
      containers: 12,
    }),
    movement({
      kind: 'received',
      lot: '20250815-C3-101',
      at: at('2025-08-15 15:00'),
      dealer: 'SP-004',
      containers: 8,
    }),
    movement({
      kind: 'received',
      lot: '20250816-B12-007',
      at: at('2025-08-16 15:00'),
      dealer: 'SP-009',
      containers: 4,
    }),
  ]);

  const BEDS = [{ id: 'D2-TBT' }, { id: 'C3-MID' }];

  const RECORDS = [
    { lot: '20250814-D2-001', bed: 'D2-TBT', startedAt: at('2025-08-14 07:00') },
    { lot: '20250701-D2-014', bed: 'D2-TBT', startedAt: at('2025-07-01 07:00') },
    { lot: '20250815-C3-101', bed: 'C3-MID', startedAt: at('2025-08-15 07:00') },
  ];

  const context = (stamp) => ({ book: BOOK, records: RECORDS, beds: BEDS, at: at(stamp) });

  it('reaches exactly the lots a lot embargo names', () => {
    expect(lotsHeld(byLot, context('2025-08-21 09:00'))).toEqual(['20250814-D2-001']);
  });

  it('reaches whatever the dealer is holding, which the book decides', () => {
    expect(lotsHeld(byDealer, context('2025-08-21 09:00'))).toEqual([
      '20250814-D2-001',
      '20250815-C3-101',
    ]);
  });

  it('does not reach a movement that has not happened yet at the moment asked about', () => {
    const early = embargo({
      number: 'EMB-4',
      reach: BY_DEALER,
      dealers: ['SP-004'],
      issuedAt: at('2025-08-14 16:00'),
    });
    expect(lotsHeld(early, context('2025-08-14 16:00'))).toEqual(['20250814-D2-001']);
  });

  it('reaches whatever came out of the water in the period, which the landings decide', () => {
    expect(lotsHeld(byWater, context('2025-08-21 09:00'))).toEqual(['20250814-D2-001']);
  });

  it('reaches nothing at all before it is issued', () => {
    expect(lotsHeld(byWater, context('2025-08-01 09:00'))).toEqual([]);
  });

  it('hands back an honest empty list rather than a confident wrong one', () => {
    expect(
      lotsHeld(byDealer, { records: RECORDS, beds: BEDS, at: at('2025-08-21 09:00') }),
    ).toEqual([]);
  });

  it('catches one lot in more than one embargo, and each needs its own release', () => {
    const both = heldBy([byLot, byDealer, byWater], '20250814-D2-001', context('2025-08-21 09:00'));
    expect(both.map((one) => one.number)).toEqual(['EMB-1', 'EMB-2', 'EMB-3']);
  });

  it('leaves a lot alone that none of the three reach', () => {
    expect(
      heldBy([byLot, byDealer, byWater], '20250816-B12-007', context('2025-08-21 09:00')),
    ).toEqual([]);
  });
});

describe('checkMovements', () => {
  const BEDS = [{ id: 'D2-TBT' }];
  const RECORDS = [{ lot: '20250814-D2-001', bed: 'D2-TBT', startedAt: at('2025-08-14 07:00') }];

  const bookWith = (extra) =>
    ledger([
      movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
      movement({
        kind: 'received',
        lot: '20250814-D2-001',
        at: at('2025-08-14 15:00'),
        dealer: 'SP-004',
        containers: 12,
      }),
      ...extra,
    ]);

  it('says nothing when nothing moved after the embargo', () => {
    const problems = checkMovements([byLot], {
      book: bookWith([]),
      records: RECORDS,
      beds: BEDS,
    });
    expect(problems.isClean()).toBe(true);
  });

  it('catches a shipment out from under an embargo', () => {
    const problems = checkMovements([byLot], {
      book: bookWith([
        movement({
          kind: 'shipped',
          lot: '20250814-D2-001',
          at: at('2025-08-22 08:00'),
          dealer: 'SP-004',
          toParty: 'Neuse Seafood',
          containers: 12,
        }),
      ]),
      records: RECORDS,
      beds: BEDS,
    });
    expect(problems.codes()).toEqual(['embargo.moved']);
    expect(problems.list()[0].detail).toMatchObject({ embargo: 'EMB-1', kind: 'shipped' });
  });

  it('lets the product be destroyed, which is the point of holding it', () => {
    const problems = checkMovements([byLot], {
      book: bookWith([
        movement({ kind: 'destroyed', lot: '20250814-D2-001', at: at('2025-08-22 08:00') }),
      ]),
      records: RECORDS,
      beds: BEDS,
    });
    expect(problems.isClean()).toBe(true);
  });

  it('raises one finding per embargo the movement broke', () => {
    const problems = checkMovements([byLot, byWater], {
      book: bookWith([
        movement({
          kind: 'shucked',
          lot: '20250814-D2-001',
          at: at('2025-08-22 08:00'),
          dealer: 'SP-004',
          becomes: '20250822-D2-901',
        }),
      ]),
      records: RECORDS,
      beds: BEDS,
    });
    expect(problems.list().map((one) => one.detail.embargo)).toEqual(['EMB-1', 'EMB-3']);
  });

  it('has nothing to say without a book', () => {
    expect(checkMovements([byLot], { book: null }).isClean()).toBe(true);
  });
});

describe('reviewFindings', () => {
  it('says nothing about an embargo issued yesterday', () => {
    expect(reviewFindings([byLot], at('2025-08-21 09:00')).isClean()).toBe(true);
  });

  it('warns once an embargo has stood the review period', () => {
    const problems = reviewFindings([byLot], at('2025-09-19 09:00'));
    expect(problems.codes()).toEqual(['embargo.stale']);
    expect(problems.list()[0].detail.days).toBe(REVIEW_DAYS);
  });

  it('says nothing about one that was released', () => {
    const released = embargo({
      number: 'EMB-8',
      reach: BY_LOT,
      lots: ['20250814-D2-001'],
      issuedAt: ISSUED,
      releasedAt: at('2025-08-25 09:00'),
      releasedBy: 'D Meekins',
    });
    expect(reviewFindings([released], at('2025-12-01 09:00')).isClean()).toBe(true);
  });

  it('takes a shorter review period when the office keeps one', () => {
    expect(reviewFindings([byLot], at('2025-08-27 09:00'), { reviewDays: 7 }).codes()).toEqual([
      'embargo.stale',
    ]);
  });
});
