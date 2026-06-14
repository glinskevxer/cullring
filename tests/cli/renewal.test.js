import { describe, expect, it } from 'vitest';

import { renewals } from '../../src/cli/commands/renewal.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const ask = (extra = {}) => {
  const io = recorder();
  const code = renewals(base({ on: '2025-12-01', ...extra }), io);
  return { io, code };
};

describe('the renewals round', () => {
  it('writes to everybody inside the notice period', () => {
    const { io, code } = ask();
    expect(code).toBe(FOUND);
    expect(io.out).toContain('Letters to write:      4');
    expect(io.out).toContain('SH-2025-00877');
  });

  it('names the grower who is past the grace period', () => {
    const { io } = ask();
    expect(io.out).toContain('lapsed beyond the grace period');
    expect(io.err).toContain('renewal.lapsed: SH-2024-03310');
  });

  it('writes only about the lapsed one in the middle of the year', () => {
    const { io, code } = ask({ on: '2025-06-01' });
    expect(code).toBe(OK);
    expect(io.out).toContain('Letters to write:      1');
    expect(io.out).toContain('In the grace period:   1');
  });

  it('takes a longer notice period when the office keeps one', () => {
    const short = ask({ on: '2025-11-01' }).io.out;
    const long = ask({ on: '2025-11-01', notice: '90' }).io.out;
    expect(short).toContain('Letters to write:      1');
    expect(long).toContain('Letters to write:      4');
  });

  it('prints the round as JSON', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.letters).toBe(4);
    expect(answer.rows.every((one) => typeof one.mayRenew === 'boolean')).toBe(true);
  });
});

describe('one grower', () => {
  it('says where the licence stands and whether it can be renewed', () => {
    const { io, code } = ask({ harvester: 'SH-2025-00877' });
    expect(code).toBe(OK);
    expect(io.out).toContain('Licence stands: current');
    expect(io.out).toContain('May renew:      yes');
  });

  it('says why not, and names both problems where there are two', () => {
    const { io, code } = ask({ harvester: 'SH-2024-03310' });
    expect(code).toBe(FOUND);
    expect(io.out).toContain('May renew:      no:');
    expect(io.out).toContain('grace period has run out');
  });

  it('prints the grace date so the counter can answer the question', () => {
    const { io } = ask({ harvester: 'SH-2025-00877' });
    expect(io.out).toMatch(/Grace runs to:\s+2026-03-31/);
  });

  it('answers as JSON', () => {
    const { io } = ask({ harvester: 'SH-2025-00877', json: true });
    const answer = JSON.parse(io.out);
    expect(answer.mayRenew).toBe(true);
    expect(answer.education).toBe('current');
  });

  it('refuses a licence the register does not hold', () => {
    const { io, code } = ask({ harvester: 'SH-1999-00001' });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('is not in the register');
  });
});
