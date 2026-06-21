import { describe, expect, it } from 'vitest';

import { exceptions } from '../../src/cli/commands/exception.js';
import { FOUND } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const ask = (extra = {}) => {
  const io = recorder();
  const code = exceptions(base({ on: '2025-08-31', ...extra }), io);
  return { io, code };
};

describe('the exceptions command', () => {
  it('runs every check and counts what it found', () => {
    const { io, code } = ask();
    expect(code).toBe(FOUND);
    expect(io.out).toContain('Exceptions as at 2025-08-31');
    expect(io.out).toMatch(/Findings:\s+\d+/);
  });

  it('prints the counts of what the case holds, so a small case is not read as a clean one', () => {
    const { io } = ask();
    expect(io.out).toContain('Areas:            5');
    expect(io.out).toContain('Landings:         11');
  });

  it('puts the family with the errors above the family with the notes', () => {
    const { io } = ask();
    const rows = io.out.split('\n');
    const harvest = rows.findIndex((line) => line.startsWith('harvest'));
    const locate = rows.findIndex((line) => line.startsWith('locate'));
    expect(harvest).toBeLessThan(locate);
  });

  it('reaches every register, not only the ones a single report reads', () => {
    const { io } = ask();
    for (const family of ['harvest', 'lease', 'renewal', 'locate']) {
      expect(io.out).toContain(family);
    }
  });

  it('shows fewer codes when asked', () => {
    const short = ask({ codes: '2' }).io.out;
    expect(short).toContain('more codes are not shown');
  });

  it('prints the whole thing as JSON', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.errors).toBeGreaterThan(0);
    expect(answer.families.length).toBeGreaterThan(3);
    expect(answer.codes[0].count).toBeGreaterThanOrEqual(answer.codes[1].count);
  });

  it('gives the same answer twice', () => {
    expect(ask().io.out).toBe(ask().io.out);
  });
});
