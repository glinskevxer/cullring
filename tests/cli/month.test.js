import { describe, expect, it } from 'vitest';

import { month, readMonth, walk } from '../../src/cli/commands/month.js';
import { OK } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

describe('reading the month off a day', () => {
  it('takes the year and the month and ignores the day', () => {
    expect(readMonth({ on: '2025-08-14' })).toEqual({ year: 2025, month: 8 });
    expect(readMonth({ on: '2025-08-01' })).toEqual({ year: 2025, month: 8 });
  });

  it('refuses a day that is not a day', () => {
    expect(() => readMonth({ on: 'August' })).toThrow(/on must be written/);
  });
});

describe('the month command', () => {
  it('names the month and counts the lots', () => {
    const io = recorder();
    expect(month(base({ on: '2025-08-14' }), io)).toBe(OK);
    expect(io.out).toContain('Programme report for August 2025');
    expect(io.out).toMatch(/Lots landed:\s+10/);
  });

  it('counts the lots three ways and shows they add up', () => {
    const io = recorder();
    month(base({ on: '2025-08-14' }), io);
    expect(io.out).toContain('Lawful and with findings sum to 10 of 10.');
  });

  it('counts the closures a month with a storm in it held', () => {
    const io = recorder();
    month(base({ on: '2025-06-14' }), io);
    expect(io.out).toMatch(/Closures:\s+2/);
  });

  it('prints the counts as JSON when asked', () => {
    const io = recorder();
    month(base({ on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.month).toBe(8);
    expect(answer.landings.lots).toBe(10);
  });

  it('prints an empty month without falling over', () => {
    const io = recorder();
    expect(month(base({ on: '2025-01-14' }), io)).toBe(OK);
    expect(io.out).toMatch(/Lots landed:\s+0/);
  });
});

describe('the walk', () => {
  it('runs every report over the case', () => {
    const io = recorder();
    expect(walk(base({ on: '2025-08-31' }), io)).toBe(OK);
    expect(io.out).toContain('Growing area standing');
    expect(io.out).toContain('Survey of B-12 Broad Creek');
    expect(io.out).toContain('Programme report for August 2025');
  });

  it('seals what it printed', () => {
    const io = recorder();
    walk(base({ on: '2025-08-31' }), io);
    expect(io.out).toMatch(/sha256 [0-9a-f]{64}/);
  });

  it('seals to the same digest twice, which is the cheapest determinism test', () => {
    const first = recorder();
    const second = recorder();
    walk(base({ on: '2025-08-31', digestOnly: true }), first);
    walk(base({ on: '2025-08-31', digestOnly: true }), second);
    expect(first.out).toBe(second.out);
    expect(first.out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('seals differently for a different day, so the seal is not a constant', () => {
    const august = recorder();
    const june = recorder();
    walk(base({ on: '2025-08-31', digestOnly: true }), august);
    walk(base({ on: '2025-06-30', digestOnly: true }), june);
    expect(august.out).not.toBe(june.out);
  });

  it('prints only the seal when asked for only the seal', () => {
    const io = recorder();
    walk(base({ on: '2025-08-31', digestOnly: true }), io);
    expect(io.lines).toHaveLength(1);
  });

  it('skips an area the register does not reach on that day', () => {
    const io = recorder();
    walk(base({ on: '2019-08-31' }), io);
    expect(io.out).toContain('Survey of D-9 Outfall Reach');
    expect(io.out).not.toContain('Survey of D-2 Turnagain Bight');
  });
});
