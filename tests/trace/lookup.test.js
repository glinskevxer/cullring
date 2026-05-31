import { describe, expect, it } from 'vitest';

import { forkedLots, indexLedger } from '../../src/trace/lookup.js';
import { ledger, movement } from '../../src/trace/ledger.js';
import { traceBack, traceForward } from '../../src/trace/trace.js';
import { parseInstant } from '../../src/time/instant.js';

const at = (stamp) => parseInstant(stamp, { zone: 'eastern' });

const BOOK = ledger([
  movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
  movement({
    kind: 'shucked',
    lot: '20250814-D2-001',
    at: at('2025-08-15 08:00'),
    dealer: 'SP-004',
    becomes: '20250815-D2-900',
  }),
  movement({
    kind: 'repacked',
    lot: '20250815-D2-900',
    at: at('2025-08-16 08:00'),
    dealer: 'RP-007',
    becomes: '20250816-D2-901',
  }),
]);

describe('indexLedger', () => {
  const index = indexLedger(BOOK);

  it('knows how big the book was when it was built', () => {
    expect(index.size).toBe(3);
    expect(index.lots).toBe(3);
  });

  it('answers what a lot number came from', () => {
    expect(index.parentOf('20250815-D2-900')).toBe('20250814-D2-001');
    expect(index.parentOf('20250814-D2-001')).toBe(null);
  });

  it('answers what a lot number turned into', () => {
    expect(index.childrenOf('20250814-D2-001')).toEqual(['20250815-D2-900']);
    expect(index.childrenOf('20250816-D2-901')).toEqual([]);
  });

  it('gives every movement touching a lot, both sides of a renumbering', () => {
    expect(index.forLot('20250815-D2-900')).toHaveLength(2);
  });

  it('says whether it has heard of a lot at all', () => {
    expect(index.has('20250814-D2-001')).toBe(true);
    expect(index.has('20250101-C3-001')).toBe(false);
  });

  it('refuses to be built over something that is not a ledger', () => {
    expect(() => indexLedger(null)).toThrow(/an index is built over a ledger/);
    expect(() => indexLedger([])).toThrow(/an index is built over a ledger/);
  });

  it('refuses to answer once the book has grown underneath it', () => {
    const growing = ledger(BOOK.all());
    const built = indexLedger(growing);
    growing.add(movement({ kind: 'landed', lot: '20250820-C3-001', at: at('2025-08-20 11:00') }));
    expect(() => built.parentOf('20250815-D2-900')).toThrow(/has been added to/);
  });
});

describe('forkedLots', () => {
  it('finds a lot number two movements both minted', () => {
    const messy = ledger([
      ...BOOK.all(),
      movement({
        kind: 'shucked',
        lot: '20250816-D2-901',
        at: at('2025-08-17 08:00'),
        dealer: 'SP-004',
        becomes: '20250815-D2-900',
      }),
    ]);
    const index = indexLedger(messy);
    expect(forkedLots(index, messy.lots())).toEqual(['20250815-D2-900']);
  });

  it('finds nothing in a clean book', () => {
    expect(forkedLots(indexLedger(BOOK), BOOK.lots())).toEqual([]);
  });
});

describe('the walks, over an index they were handed', () => {
  it('trace back gives the same answer either way', () => {
    const own = traceBack(BOOK, '20250816-D2-901');
    const shared = traceBack(BOOK, '20250816-D2-901', { index: indexLedger(BOOK) });
    expect(shared.chain).toEqual(own.chain);
  });

  it('trace forward gives the same answer either way', () => {
    const own = traceForward(BOOK, '20250814-D2-001');
    const shared = traceForward(BOOK, '20250814-D2-001', { index: indexLedger(BOOK) });
    expect(shared.reached).toEqual(own.reached);
  });
});

describe('a book big enough to notice', () => {
  const many = [];
  for (let i = 0; i < 999; i += 1) {
    const lot = `202508${String((i % 28) + 1).padStart(2, '0')}-C3-${String(i).padStart(3, '0')}`;
    many.push(movement({ kind: 'landed', lot, at: at('2025-08-14 11:00') }));
  }
  const big = ledger(many);

  it('indexes it once and answers from the maps', () => {
    const index = indexLedger(big);
    expect(index.size).toBe(999);
    expect(index.lots).toBe(999);
    expect(index.parentOf(many[10].lot)).toBe(null);
  });

  it('walks a deep chain without sorting the book at every step', () => {
    const chain = [
      movement({ kind: 'landed', lot: '20250801-C3-001', at: at('2025-08-01 11:00') }),
    ];
    for (let i = 1; i < 60; i += 1) {
      chain.push(
        movement({
          kind: 'repacked',
          lot: `20250801-C3-${String(i).padStart(3, '0')}`,
          at: at('2025-08-02 08:00'),
          dealer: 'RP-007',
          becomes: `20250801-C3-${String(i + 1).padStart(3, '0')}`,
        }),
      );
    }
    const deep = ledger([...many, ...chain]);
    const walk = traceBack(deep, '20250801-C3-060');
    expect(walk.chain).toHaveLength(60);
    expect(walk.chain[0]).toBe('20250801-C3-001');
    expect(walk.chain[walk.chain.length - 1]).toBe('20250801-C3-060');
  });
});
