import { describe, expect, it } from 'vitest';

import { auditAll, auditBook, dealersInBook, describeAudit } from '../../src/trace/audit.js';
import { LANDED, RECEIVED, SHIPPED, SHUCKED, ledger, movement } from '../../src/trace/ledger.js';
import { loadCase } from '../../src/cli/context.js';
import { CASE } from '../support/cli.js';
import { at } from '../support/ledger.js';

const loaded = loadCase(CASE);

describe('the worked example books', () => {
  it('names every dealer the ledger holds', () => {
    expect(dealersInBook(loaded.book)).toEqual(['DP-003', 'RP-007', 'SP-118', 'SS-042']);
  });

  it('finds nothing wrong with any of them', () => {
    for (const answer of auditAll(loaded.book)) {
      expect(answer.clean).toBe(true);
    }
  });

  it('notes what each is still holding, which is not a finding', () => {
    for (const answer of auditAll(loaded.book)) {
      expect(answer.problems.hasError()).toBe(false);
      expect(answer.holding).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts the entries it read for each', () => {
    expect(auditBook(loaded.book, 'SP-118').entries).toBe(7);
  });

  it('describes a clean book in one line', () => {
    expect(describeAudit(auditBook(loaded.book, 'SS-042'))).toMatch(/nothing to report/);
  });
});

describe('a lot minted by the dealer themselves', () => {
  const book = ledger([
    movement({ kind: LANDED, lot: '20250814-C3-001', at: at('2025-08-14 09:00'), containers: 9 }),
    movement({
      kind: RECEIVED,
      lot: '20250814-C3-001',
      at: at('2025-08-14 11:00'),
      dealer: 'SP-118',
      containers: 9,
    }),
    movement({
      kind: SHUCKED,
      lot: '20250814-C3-001',
      becomes: '20250815-C3-101',
      at: at('2025-08-15 07:00'),
      dealer: 'SP-118',
    }),
    movement({
      kind: SHIPPED,
      lot: '20250815-C3-101',
      at: at('2025-08-15 14:00'),
      dealer: 'SP-118',
      toParty: 'Piedmont Fish House',
    }),
  ]);

  it('is not a discrepancy, because nobody sent it to them', () => {
    expect(auditBook(book, 'SP-118').clean).toBe(true);
  });

  it('appears in the reconciliation all the same', () => {
    const rows = auditBook(book, 'SP-118').rows;
    expect(rows.map((one) => one.lot)).toContain('20250815-C3-101');
  });
});

describe('what the audit does find', () => {
  it('finds a lot shipped that was never received or minted', () => {
    const book = ledger([
      movement({
        kind: SHIPPED,
        lot: '20250814-C3-001',
        at: at('2025-08-15 14:00'),
        dealer: 'SP-118',
        toParty: 'Piedmont Fish House',
      }),
    ]);
    expect(auditBook(book, 'SP-118').problems.has('audit.shippedUnreceived')).toBe(true);
  });

  it('finds a lot received with no landing anywhere in the ledger', () => {
    const book = ledger([
      movement({
        kind: RECEIVED,
        lot: '20250814-C3-001',
        at: at('2025-08-14 11:00'),
        dealer: 'SP-118',
        containers: 9,
      }),
    ]);
    expect(auditBook(book, 'SP-118').problems.has('audit.receivedUnlanded')).toBe(true);
  });

  it('does not blame a dealer for their supplier having shipped it to them', () => {
    const book = ledger([
      movement({
        kind: SHIPPED,
        lot: '20250814-C3-001',
        at: at('2025-08-14 10:00'),
        dealer: 'SS-042',
        toParty: 'Core Sound Packing',
      }),
      movement({
        kind: RECEIVED,
        lot: '20250814-C3-001',
        at: at('2025-08-14 11:00'),
        dealer: 'SP-118',
        containers: 9,
      }),
    ]);
    expect(auditBook(book, 'SP-118').problems.has('audit.receivedUnlanded')).toBe(false);
  });

  it('finds more containers leaving than ever arrived', () => {
    const book = ledger([
      movement({ kind: LANDED, lot: '20250814-C3-001', at: at('2025-08-14 09:00'), containers: 9 }),
      movement({
        kind: RECEIVED,
        lot: '20250814-C3-001',
        at: at('2025-08-14 11:00'),
        dealer: 'SP-118',
        containers: 9,
      }),
      movement({
        kind: SHIPPED,
        lot: '20250814-C3-001',
        at: at('2025-08-15 14:00'),
        dealer: 'SP-118',
        containers: 14,
      }),
    ]);
    const answer = auditBook(book, 'SP-118');
    expect(answer.problems.has('audit.overShipped')).toBe(true);
    expect(answer.rows[0].holding).toBe(-5);
  });

  it('does not call an unshipped remainder a discrepancy', () => {
    const book = ledger([
      movement({ kind: LANDED, lot: '20250814-C3-001', at: at('2025-08-14 09:00'), containers: 9 }),
      movement({
        kind: RECEIVED,
        lot: '20250814-C3-001',
        at: at('2025-08-14 11:00'),
        dealer: 'SP-118',
        containers: 9,
      }),
      movement({
        kind: SHIPPED,
        lot: '20250814-C3-001',
        at: at('2025-08-15 14:00'),
        dealer: 'SP-118',
        containers: 4,
      }),
    ]);
    const answer = auditBook(book, 'SP-118');
    expect(answer.clean).toBe(true);
    expect(answer.rows[0].holding).toBe(5);
    expect(answer.problems.has('audit.holding')).toBe(true);
  });

  it('refuses a dealer number that is not one', () => {
    expect(() => auditBook(loaded.book, 'Core Sound Packing')).toThrow(/certification number/);
  });
});
