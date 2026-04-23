import { describe, expect, it } from 'vitest';

import { REASONS, advisoryCommand, grades } from '../../src/cli/commands/advisory.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const ask = (extra = {}) => {
  const io = recorder();
  const code = advisoryCommand(
    base({
      area: 'C-3',
      from: '2025-08-14',
      to: '2025-08-18',
      reason: 'illness',
      at: '2025-08-19 09:00',
      ...extra,
    }),
    io,
  );
  return { io, code };
};

describe('the advisory command', () => {
  it('writes the notice', () => {
    const { io, code } = ask();
    expect(code).toBe(FOUND);
    expect(io.out).toContain('HEALTH ADVISORY: C-3, 2025-08-19');
    expect(io.out).toContain('20250814-C3-001');
    expect(io.out).toContain('Piedmont Fish House');
  });

  it('words a compliance matter differently from a health one', () => {
    expect(ask({ reason: 'closed water' }).io.out).toContain('COMPLIANCE NOTICE');
    expect(ask({ reason: 'closed water' }).io.out).toContain('Hold this product');
  });

  it('demotes an advisory issued long after anything could still be eaten', () => {
    expect(ask({ at: '2025-11-01 09:00' }).io.out).toContain('FOR THE RECORD');
  });

  it('prints who has to be told when asked', () => {
    const { io } = ask({ list: true });
    expect(io.out).toContain('Dealers:       SP-118');
    expect(io.out).toContain('Calls to make: 2');
  });

  it('leaves that off when not asked', () => {
    expect(ask().io.out).not.toContain('Who has to be told');
  });

  it('returns nothing to report when the period is empty', () => {
    const { io, code } = ask({ from: '2025-01-01', to: '2025-01-02' });
    expect(code).toBe(OK);
    expect(io.out).toContain('No lots were landed out of that water in that period.');
  });

  it('refuses an area the register does not hold', () => {
    const { io, code } = ask({ area: 'Z-9' });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('is not in the register');
  });

  it('refuses a reason nobody signs advisories with', () => {
    const { io, code } = ask({ reason: 'a hunch' });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('a reason is one of');
  });

  it('refuses no reason at all rather than picking one', () => {
    expect(ask({ reason: undefined }).code).toBe(REFUSED);
  });

  it('prints it as JSON with the distribution list', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.grade).toBe('health advisory');
    expect(answer.dealers).toEqual(['SP-118']);
    expect(answer.lots).toHaveLength(2);
  });

  it('keeps the reasons and the grades where a caller can check them', () => {
    expect(REASONS).toContain('biotoxin');
    expect(grades()).toContain('compliance notice');
  });
});
