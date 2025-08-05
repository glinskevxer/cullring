import { describe, expect, it } from 'vitest';

import { forward, periodOf, recallCommand, trace } from '../../src/cli/commands/trace.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { toStoredForm } from '../../src/time/instant.js';
import { base, recorder } from '../support/cli.js';

describe('the period a recall covers', () => {
  it('is the whole of the day named when no end is given', () => {
    const span = periodOf({ on: '2025-08-14' }, 'eastern');
    expect(toStoredForm('eastern', span.start)).toBe('2025-08-14T00:00:00-04:00');
    expect(toStoredForm('eastern', span.end)).toBe('2025-08-15T00:00:00-04:00');
  });

  it('runs to the end of the last day when one is given', () => {
    const span = periodOf({ on: '2025-08-14', to: '2025-08-16' }, 'eastern');
    expect(toStoredForm('eastern', span.end)).toBe('2025-08-17T00:00:00-04:00');
  });

  it('takes from as well as on', () => {
    const span = periodOf({ from: '2025-08-14' }, 'eastern');
    expect(toStoredForm('eastern', span.start)).toBe('2025-08-14T00:00:00-04:00');
  });
});

describe('the trace command', () => {
  it('walks a shucked lot back to the water', () => {
    const io = recorder();
    expect(trace(base({ lot: '20250815-C3-101' }), io)).toBe(OK);
    expect(io.out).toMatch(/Area:\s+C-3/);
    expect(io.out).toMatch(/Bed:\s+C3-MSL/);
    expect(io.out).toMatch(/Complete:\s+yes/);
  });

  it('names the chain in the order the product moved', () => {
    const io = recorder();
    trace(base({ lot: '20250815-C3-101' }), io);
    expect(io.out).toMatch(/Chain:\s+20250814-C3-001 then 20250815-C3-101/);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    trace(base({ lot: '20250815-C3-101', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.origin).toBe('20250814-C3-001');
    expect(answer.complete).toBe(true);
  });

  it('refuses a lot the ledger does not hold', () => {
    const io = recorder();
    expect(trace(base({ lot: '20250101-B12-999' }), io)).toBe(REFUSED);
    expect(io.err).toContain('is not in the ledger');
  });
});

describe('the forward command', () => {
  it('reaches the lot a shucking minted and the consignee', () => {
    const io = recorder();
    expect(forward(base({ lot: '20250814-C3-001' }), io)).toBe(OK);
    expect(io.out).toContain('20250815-C3-101');
    expect(io.out).toMatch(/Consignees:\s+Piedmont Fish House/);
  });

  it('says plainly where nothing was shipped', () => {
    const io = recorder();
    forward(base({ lot: '20250814-D2-001' }), io);
    expect(io.out).toMatch(/Consignees:\s+none recorded/);
  });

  it('prints the shipments as JSON when asked', () => {
    const io = recorder();
    forward(base({ lot: '20250814-C3-001', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.parties).toEqual(['Piedmont Fish House']);
    expect(answer.shipments[0].dealer).toBe('SP-118');
  });

  it('refuses a lot the ledger does not hold', () => {
    const io = recorder();
    expect(forward(base({ lot: '20250101-B12-999' }), io)).toBe(REFUSED);
  });
});

describe('the recall command', () => {
  it('names every lot out of the area in the period', () => {
    const io = recorder();
    expect(recallCommand(base({ area: 'C-3', on: '2025-08-14', to: '2025-08-19' }), io)).toBe(
      FOUND,
    );
    expect(io.out).toMatch(/Lots landed: 3/);
    expect(io.out).toContain('20250819-C3-001');
  });

  it('names every consignee reached', () => {
    const io = recorder();
    recallCommand(base({ area: 'C-3', on: '2025-08-14', to: '2025-08-19' }), io);
    expect(io.out).toMatch(/Consignees:\s+Piedmont Fish House/);
  });

  it('exits clean where nothing was landed, because there is nothing to recall', () => {
    const io = recorder();
    expect(recallCommand(base({ area: 'C-3', on: '2025-01-01' }), io)).toBe(OK);
    expect(io.out).toContain('Nothing was landed out of this area in this period.');
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    recallCommand(base({ area: 'C-3', on: '2025-08-14', to: '2025-08-19', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.lots).toHaveLength(3);
    expect(answer.area).toBe('C-3');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(recallCommand(base({ area: 'Z-9', on: '2025-08-14' }), io)).toBe(REFUSED);
  });
});
