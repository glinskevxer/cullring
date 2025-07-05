import { describe, expect, it } from 'vitest';

import { renderRecall, renderTraceBack, renderTraceForward } from '../../src/report/trace.js';
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
];

describe('the backward trace', () => {
  const text = renderTraceBack(BOOK, '20250815-B12-101', { records: RECORDS });

  it('names the chain in the order the product moved', () => {
    expect(text).toMatch(/Chain:\s+20250814-B12-001 then 20250815-B12-101/);
  });

  it('names the water it came out of', () => {
    expect(text).toMatch(/Area:\s+B-12/);
    expect(text).toMatch(/Bed:\s+B12-BCK/);
    expect(text).toMatch(/Harvested:\s+2025-08-14/);
  });

  it('says it is complete when it reached the landing and the record', () => {
    expect(text).toMatch(/Stopped at: landing/);
    expect(text).toMatch(/Complete:\s+yes/);
  });

  it('lists every movement of every lot in the chain', () => {
    expect(text).toContain('shucked');
    expect(text).toContain('received');
    expect(text).toContain('Piedmont Fish House');
  });

  it('says not recoverable rather than leaving a blank', () => {
    const bare = renderTraceBack(BOOK, '20250814-C3-301');
    expect(bare).toMatch(/Area:\s+not recoverable/);
    expect(bare).toMatch(/Complete:\s+no/);
  });

  it('prints where the paper runs out, in a section of its own', () => {
    const bare = renderTraceBack(BOOK, '20250814-C3-301');
    expect(bare).toContain('Where the paper runs out');
    expect(bare).toContain('has no harvest record');
  });

  it('leaves that section off a complete trace', () => {
    expect(text).not.toContain('Where the paper runs out');
  });

  it('says plainly when there is no landing at all', () => {
    const book = ledger([
      movement({
        kind: REPACKED,
        lot: '20250812-C3-004',
        becomes: '20250813-C3-201',
        at: at('2025-08-13 09:00'),
        dealer: 'RP-007',
      }),
    ]);
    const broken = renderTraceBack(book, '20250813-C3-201');
    expect(broken).toMatch(/Stopped at: broken link/);
    expect(broken).toContain('has no landing in the ledger');
  });
});

describe('the forward trace', () => {
  const text = renderTraceForward(BOOK, '20250814-B12-001');

  it('names every lot it reached', () => {
    expect(text).toMatch(/Lots reached:\s+20250814-B12-001 then 20250815-B12-101/);
  });

  it('names the consignees and counts the shipments', () => {
    expect(text).toMatch(/Consignees:\s+Piedmont Fish House/);
    expect(text).toMatch(/Shipments:\s+1/);
  });

  it('follows two repacks to the last consignee', () => {
    const chain = renderTraceForward(BOOK, '20250812-C3-004');
    expect(chain).toContain('20250814-C3-301');
    expect(chain).toContain('Coastal Provisions');
  });

  it('says plainly when nothing was shipped', () => {
    const book = ledger([
      movement({ kind: LANDED, lot: '20250814-B12-009', at: at('2025-08-14 09:00') }),
    ]);
    const quiet = renderTraceForward(book, '20250814-B12-009');
    expect(quiet).toMatch(/Consignees:\s+none recorded/);
    expect(quiet).toContain('nothing was shipped');
  });
});

describe('the recall', () => {
  const august = window(at('2025-08-14 00:00'), at('2025-08-15 00:00'));
  const text = renderRecall(BOOK, { areaId: 'B-12', span: august });

  it('names the period and counts the lots', () => {
    expect(text).toMatch(/Lots landed: 1/);
    expect(text).toContain('2025-08-14 00:00 EDT');
  });

  it('names every consignee reached from the area', () => {
    expect(text).toMatch(/Consignees:\s+Piedmont Fish House/);
  });

  it('gives a line per lot with what it became and where it went', () => {
    expect(text).toContain('20250814-B12-001');
    expect(text).toContain('20250815-B12-101');
  });

  it('says plainly when nothing was landed in the period', () => {
    const quiet = renderRecall(BOOK, { areaId: 'C-3', span: august });
    expect(quiet).toContain('Nothing was landed out of this area in this period.');
  });

  it('is the same text twice', () => {
    expect(renderRecall(BOOK, { areaId: 'B-12', span: august })).toBe(text);
  });
});
