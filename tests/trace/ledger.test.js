import { describe, expect, it } from 'vitest';

import {
  DESTROYED,
  LANDED,
  MOVEMENTS,
  RECEIVED,
  REPACKED,
  SHIPPED,
  SHUCKED,
  childrenOf,
  compareMovement,
  isRenumbering,
  ledger,
  movement,
  parentOf,
} from '../../src/trace/ledger.js';
import { BOOK, at } from '../support/ledger.js';

describe('building a movement', () => {
  it('holds what happened, to what, when and by whom', () => {
    const one = movement({
      kind: RECEIVED,
      lot: '20250814-B12-001',
      at: at('2025-08-14 11:00'),
      dealer: 'sp-118',
      containers: 12,
    });
    expect(one.kind).toBe(RECEIVED);
    expect(one.lot).toBe('20250814-B12-001');
    expect(one.dealer).toBe('SP-118');
    expect(one.containers).toBe(12);
  });

  it('refuses a movement it does not record, and lists the ones it does', () => {
    try {
      movement({ kind: 'frozen', lot: '20250814-B12-001', at: at('2025-08-14 11:00') });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(MOVEMENTS.slice());
    }
  });

  it('refuses a lot number that is not one, and a moment that is not an instant', () => {
    expect(() => movement({ kind: LANDED, lot: 'yesterday', at: at('2025-08-14 11:00') })).toThrow(
      /lot number/,
    );
    expect(() => movement({ kind: LANDED, lot: '20250814-B12-001', at: '11:00' })).toThrow(
      /at an instant/,
    );
  });

  it('knows which movements mint a new lot number', () => {
    expect(isRenumbering(SHUCKED)).toBe(true);
    expect(isRenumbering(REPACKED)).toBe(true);
    expect(isRenumbering(SHIPPED)).toBe(false);
    expect(isRenumbering(DESTROYED)).toBe(false);
  });

  it('insists a renumbering movement says what it became', () => {
    expect(() =>
      movement({ kind: SHUCKED, lot: '20250814-B12-001', at: at('2025-08-15 07:30') }),
    ).toThrow(/carries the lot it becomes/);
  });

  it('refuses a new lot number on a movement that does not mint one', () => {
    expect(() =>
      movement({
        kind: SHIPPED,
        lot: '20250814-B12-001',
        becomes: '20250815-B12-101',
        at: at('2025-08-15 07:30'),
      }),
    ).toThrow(/does not mint a new lot/);
  });

  it('refuses a container count that is not whole', () => {
    expect(() =>
      movement({
        kind: LANDED,
        lot: '20250814-B12-001',
        at: at('2025-08-14 11:00'),
        containers: 1.5,
      }),
    ).toThrow(/whole number/);
  });
});

describe('the ledger', () => {
  it('counts what it holds and lists every lot number it has seen', () => {
    expect(BOOK.length).toBe(13);
    expect(BOOK.lots()).toContain('20250815-B12-101');
    expect(BOOK.lots()).toContain('20250814-C3-301');
  });

  it('returns everything in time order', () => {
    const all = BOOK.all();
    for (let index = 1; index < all.length; index += 1) {
      expect(all[index].at.epochSecond).toBeGreaterThanOrEqual(all[index - 1].at.epochSecond);
    }
  });

  it('finds a lot as it was written and as it became', () => {
    expect(BOOK.forLot('20250814-B12-001')).toHaveLength(3);
    expect(BOOK.forLot('20250815-B12-101')).toHaveLength(2);
  });

  it('selects by dealer and by kind', () => {
    expect(BOOK.byDealer('RP-007')).toHaveLength(3);
    expect(BOOK.ofKind(LANDED)).toHaveLength(3);
  });

  it('takes new movements after it is built', () => {
    const book = ledger();
    expect(book.length).toBe(0);
    book.add(movement({ kind: LANDED, lot: '20250814-B12-009', at: at('2025-08-14 09:00') }));
    expect(book.length).toBe(1);
  });

  it('breaks a tie in time by lot and then by the order of the movements', () => {
    const left = movement({ kind: LANDED, lot: '20250814-B12-001', at: at('2025-08-14 09:00') });
    const right = movement({ kind: RECEIVED, lot: '20250814-B12-001', at: at('2025-08-14 09:00') });
    expect(compareMovement(left, right)).toBeLessThan(0);
    expect(compareMovement(left, left)).toBe(0);
  });
});

describe('one step of the chain', () => {
  it('finds where a lot number came from', () => {
    expect(parentOf(BOOK, '20250815-B12-101')).toBe('20250814-B12-001');
    expect(parentOf(BOOK, '20250814-C3-301')).toBe('20250813-C3-201');
  });

  it('answers with nothing for a lot that came off a boat', () => {
    expect(parentOf(BOOK, '20250814-B12-001')).toBeNull();
  });

  it('finds what a lot number turned into', () => {
    expect(childrenOf(BOOK, '20250814-B12-001')).toEqual(['20250815-B12-101']);
    expect(childrenOf(BOOK, '20250812-C3-004')).toEqual(['20250813-C3-201']);
  });

  it('answers with nothing for a lot that was never renumbered', () => {
    expect(childrenOf(BOOK, '20250814-D2-001')).toEqual([]);
  });
});
