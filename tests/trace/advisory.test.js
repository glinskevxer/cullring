import { describe, expect, it } from 'vitest';

import {
  COMPLIANCE,
  FOR_THE_RECORD,
  HEALTH,
  SHELF_LIFE_DAYS,
  advisory,
  distributionList,
  gradeOf,
  names,
  renderAdvisory,
} from '../../src/trace/advisory.js';
import { ledger, movement } from '../../src/trace/ledger.js';
import { parseInstant } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (stamp) => parseInstant(stamp, { zone: 'eastern' });

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
    kind: 'shucked',
    lot: '20250814-D2-001',
    at: at('2025-08-15 08:00'),
    dealer: 'SP-004',
    becomes: '20250815-D2-900',
  }),
  movement({
    kind: 'shipped',
    lot: '20250815-D2-900',
    at: at('2025-08-15 16:00'),
    dealer: 'SP-004',
    toParty: 'Neuse Seafood',
    containers: 12,
  }),
  movement({ kind: 'landed', lot: '20250816-D2-002', at: at('2025-08-16 11:00') }),
  movement({
    kind: 'received',
    lot: '20250816-D2-002',
    at: at('2025-08-16 15:00'),
    dealer: 'SP-009',
    containers: 6,
  }),
]);

const SPAN = window(at('2025-08-14 00:00'), at('2025-08-17 00:00'));

const build = (extra = {}) =>
  advisory(BOOK, {
    areaId: 'D-2',
    span: SPAN,
    reason: 'biotoxin',
    issuedAt: at('2025-08-18 09:00'),
    ...extra,
  });

describe('gradeOf', () => {
  it('reads a health reason as a health advisory', () => {
    expect(gradeOf({ reason: 'biotoxin', issuedAt: at('2025-08-18 09:00') })).toBe(HEALTH);
    expect(gradeOf({ reason: 'illness', issuedAt: at('2025-08-18 09:00') })).toBe(HEALTH);
  });

  it('reads anything else as a compliance matter', () => {
    expect(gradeOf({ reason: 'closed water', issuedAt: at('2025-08-18 09:00') })).toBe(COMPLIANCE);
  });

  it('demotes once nothing named can still be in a cold box', () => {
    expect(
      gradeOf({
        reason: 'biotoxin',
        landedAt: at('2025-08-14 11:00'),
        issuedAt: at('2025-10-01 09:00'),
      }),
    ).toBe(FOR_THE_RECORD);
  });

  it('does not demote on the last day of the shelf life', () => {
    expect(
      gradeOf({
        reason: 'biotoxin',
        landedAt: at('2025-08-14 11:00'),
        issuedAt: at('2025-09-04 11:00'),
        shelfLifeDays: SHELF_LIFE_DAYS,
      }),
    ).toBe(HEALTH);
  });
});

describe('building an advisory', () => {
  it('names every lot landed in the period', () => {
    expect(build().lots).toEqual(['20250814-D2-001', '20250816-D2-002']);
  });

  it('names every party the product reached, through the renumbering', () => {
    expect(build().parties).toEqual(['Neuse Seafood']);
  });

  it('carries the grade it was worked out to be', () => {
    expect(build().grade).toBe(HEALTH);
    expect(build({ reason: 'closed water' }).grade).toBe(COMPLIANCE);
  });

  it('warns when the book shows nothing shipped anywhere at all', () => {
    const quiet = ledger([
      movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
    ]);
    const one = advisory(quiet, {
      areaId: 'D-2',
      span: SPAN,
      reason: 'biotoxin',
      issuedAt: at('2025-08-18 09:00'),
    });
    expect(one.problems.codes()).toContain('advisory.nowhereToSend');
  });

  it('notes when it is only for the record', () => {
    expect(build({ issuedAt: at('2025-10-01 09:00') }).problems.codes()).toContain(
      'advisory.stale',
    );
  });

  it('says nothing was landed rather than producing a blank advisory', () => {
    const one = build({ span: window(at('2025-01-01 00:00'), at('2025-01-02 00:00')) });
    expect(one.lots).toEqual([]);
    expect(one.problems.codes()).toContain('trace.nothingLanded');
  });
});

describe('the rendered advisory', () => {
  const text = renderAdvisory(build());

  it('says what to do in the first three lines', () => {
    expect(text.split('\n')[0]).toBe('HEALTH ADVISORY: D-2, 2025-08-18');
    expect(text).toContain('Do not eat this product.');
  });

  it('words a compliance notice differently', () => {
    const other = renderAdvisory(build({ reason: 'closed water' }));
    expect(other).toContain('Hold this product and do not sell it.');
    expect(other).not.toContain('Do not eat');
  });

  it('lists the lots and the parties', () => {
    expect(text).toContain('Lots (2):');
    expect(text).toContain('  20250814-D2-001');
    expect(text).toContain('Sent to (1):');
    expect(text).toContain('  Neuse Seafood');
  });

  it('says where the chain stops, so nobody assumes it was followed further', () => {
    expect(text).toContain('This list ends at the dealers the division licenses.');
  });

  it('says plainly when nothing was landed', () => {
    const empty = renderAdvisory(
      build({ span: window(at('2025-01-01 00:00'), at('2025-01-02 00:00')) }),
    );
    expect(empty).toContain('No lots were landed out of that water in that period.');
  });

  it('says when the book shows none of it shipped', () => {
    const quiet = ledger([
      movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
    ]);
    const one = advisory(quiet, {
      areaId: 'D-2',
      span: SPAN,
      reason: 'biotoxin',
      issuedAt: at('2025-08-18 09:00'),
    });
    expect(renderAdvisory(one)).toContain('The book shows none of it shipped anywhere.');
  });

  it('is the same text twice', () => {
    expect(renderAdvisory(build())).toBe(text);
  });
});

describe('distributionList', () => {
  it('takes the dealers off the shipments and the parties off the walk', () => {
    const list = distributionList(build());
    expect(list.dealers).toEqual(['SP-004']);
    expect(list.parties).toEqual(['Neuse Seafood']);
    expect(list.total).toBe(2);
  });

  it('is empty when nothing shipped', () => {
    const quiet = ledger([
      movement({ kind: 'landed', lot: '20250814-D2-001', at: at('2025-08-14 11:00') }),
    ]);
    const list = distributionList(
      advisory(quiet, {
        areaId: 'D-2',
        span: SPAN,
        reason: 'biotoxin',
        issuedAt: at('2025-08-18 09:00'),
      }),
    );
    expect(list.total).toBe(0);
  });
});

describe('names', () => {
  it('names a lot that was landed', () => {
    expect(names(build(), '20250814-D2-001')).toBe(true);
  });

  it('names the number a lot became, which is what is on the box', () => {
    expect(names(build(), '20250815-D2-900')).toBe(true);
  });

  it('does not name a lot from other water', () => {
    expect(names(build(), '20250815-C3-101')).toBe(false);
  });
});
