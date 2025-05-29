import { describe, expect, it } from 'vitest';

import {
  AT_BROKEN_LINK,
  AT_LANDING,
  AT_LOOP,
  recall,
  traceBack,
  traceForward,
} from '../../src/trace/trace.js';
import { LANDED, REPACKED, ledger, movement } from '../../src/trace/ledger.js';
import { BOOK, at } from '../support/ledger.js';
import { harvestRecord } from '../../src/harvest/record.js';
import { window } from '../../src/time/window.js';

const RECORDS = [
  harvestRecord({
    harvester: 'SH-2025-04412',
    bed: 'B12-BCK',
    gear: 'hand',
    startedAt: at('2025-08-14 07:00'),
    landedAt: at('2025-08-14 09:45'),
    containers: 12,
    lot: '20250814-B12-001',
  }),
  harvestRecord({
    harvester: 'SH-2025-04412',
    bed: 'D2-TGB',
    gear: 'rake',
    startedAt: at('2025-08-14 08:00'),
    landedAt: at('2025-08-14 10:15'),
    containers: 8,
    lot: '20250814-D2-001',
  }),
];

describe('tracing back to the water', () => {
  it('follows a shucking back to the lot that came off the boat', () => {
    const walk = traceBack(BOOK, '20250815-B12-101', { records: RECORDS });
    expect(walk.chain).toEqual(['20250814-B12-001', '20250815-B12-101']);
    expect(walk.origin).toBe('20250814-B12-001');
    expect(walk.stoppedAt).toBe(AT_LANDING);
    expect(walk.complete).toBe(true);
  });

  it('names the bed, the area and the day off the harvest record', () => {
    const walk = traceBack(BOOK, '20250815-B12-101', { records: RECORDS });
    expect(walk.areaId).toBe('B-12');
    expect(walk.bed).toBe('B12-BCK');
    expect(walk.harvestedOn).toBe('2025-08-14');
  });

  it('follows two repacks in a row, which is where a trace usually stops', () => {
    const walk = traceBack(BOOK, '20250814-C3-301');
    expect(walk.chain).toEqual(['20250812-C3-004', '20250813-C3-201', '20250814-C3-301']);
  });

  it('returns the chain oldest first, the way the story reads', () => {
    const walk = traceBack(BOOK, '20250814-C3-301');
    expect(walk.chain[0]).toBe(walk.origin);
  });

  it('is a chain of one for a lot that was never renumbered', () => {
    const walk = traceBack(BOOK, '20250814-D2-001', { records: RECORDS });
    expect(walk.chain).toEqual(['20250814-D2-001']);
    expect(walk.complete).toBe(true);
  });

  it('warns when there is no harvest record, and is not complete', () => {
    const walk = traceBack(BOOK, '20250814-C3-301');
    expect(walk.problems.has('trace.noRecord')).toBe(true);
    expect(walk.complete).toBe(false);
    expect(walk.record).toBeNull();
  });
});

describe('when the trace cannot get there', () => {
  it('says plainly when the ledger has no landing to stop at', () => {
    const book = ledger([
      movement({
        kind: REPACKED,
        lot: '20250812-C3-004',
        becomes: '20250813-C3-201',
        at: at('2025-08-13 09:00'),
        dealer: 'RP-007',
      }),
    ]);
    const walk = traceBack(book, '20250813-C3-201');
    expect(walk.stoppedAt).toBe(AT_BROKEN_LINK);
    expect(walk.problems.has('trace.noLanding')).toBe(true);
  });

  it('stops on a loop rather than walking it forever', () => {
    const book = ledger([
      movement({
        kind: REPACKED,
        lot: '20250812-C3-004',
        becomes: '20250813-C3-201',
        at: at('2025-08-13 09:00'),
        dealer: 'RP-007',
      }),
      movement({
        kind: REPACKED,
        lot: '20250813-C3-201',
        becomes: '20250812-C3-004',
        at: at('2025-08-14 09:00'),
        dealer: 'RP-007',
      }),
    ]);
    const walk = traceBack(book, '20250813-C3-201');
    expect(walk.stoppedAt).toBe(AT_LOOP);
    expect(walk.problems.has('trace.loop')).toBe(true);
  });
});

describe('tracing forward to the consignees', () => {
  it('reaches the lot a shucking minted and the shipment that went out on it', () => {
    const walk = traceForward(BOOK, '20250814-B12-001');
    expect(walk.reached).toEqual(['20250814-B12-001', '20250815-B12-101']);
    expect(walk.parties).toEqual(['Piedmont Fish House']);
  });

  it('follows two repacks and lands on the last consignee', () => {
    const walk = traceForward(BOOK, '20250812-C3-004');
    expect(walk.reached).toHaveLength(3);
    expect(walk.parties).toEqual(['Coastal Provisions']);
  });

  it('names the shipment under the number the consignee actually has', () => {
    const walk = traceForward(BOOK, '20250814-B12-001');
    expect(walk.shipments[0].lot).toBe('20250815-B12-101');
  });

  it('finds a shipment made under the landing number itself', () => {
    const walk = traceForward(BOOK, '20250814-D2-001');
    expect(walk.parties).toEqual(['Chesapeake Wholesale']);
  });

  it('says plainly when nothing was shipped', () => {
    const book = ledger([
      movement({ kind: LANDED, lot: '20250814-B12-009', at: at('2025-08-14 09:00') }),
    ]);
    const walk = traceForward(book, '20250814-B12-009');
    expect(walk.parties).toEqual([]);
    expect(walk.problems.has('trace.noShipment')).toBe(true);
  });
});

describe('the recall question', () => {
  const august = window(at('2025-08-14 00:00'), at('2025-08-15 00:00'));

  it('names every lot landed out of the area in the window', () => {
    expect(recall(BOOK, { areaId: 'B-12', span: august }).lots).toEqual(['20250814-B12-001']);
  });

  it('names everywhere all of it went', () => {
    expect(recall(BOOK, { areaId: 'B-12', span: august }).parties).toEqual(['Piedmont Fish House']);
  });

  it('does not reach a lot landed outside the window', () => {
    const answer = recall(BOOK, { areaId: 'C-3', span: august });
    expect(answer.lots).toEqual([]);
    expect(answer.problems.has('trace.nothingLanded')).toBe(true);
  });

  it('carries the harvest records for the lots it named', () => {
    const answer = recall(BOOK, { areaId: 'D-2', span: august, records: RECORDS });
    expect(answer.records).toHaveLength(1);
    expect(answer.records[0].bed).toBe('D2-TGB');
  });

  it('walks each lot separately, so one broken chain does not hide the rest', () => {
    const answer = recall(BOOK, { areaId: 'B-12', span: august });
    expect(answer.walks).toHaveLength(1);
    expect(answer.walks[0].reached).toContain('20250815-B12-101');
  });
});
