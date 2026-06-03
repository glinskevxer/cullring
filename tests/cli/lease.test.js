import { describe, expect, it } from 'vitest';

import { leases } from '../../src/cli/commands/lease.js';
import { landings } from '../../src/cli/commands/landings.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const ask = (extra = {}) => {
  const io = recorder();
  const code = leases(base({ on: '2025-08-15', ...extra }), io);
  return { io, code };
};

describe('loading the leases', () => {
  const loaded = loadCase(CASE);

  it('reads all three out of the register', () => {
    expect(loaded.leases.map((one) => one.id)).toEqual(['SL-1104', 'SL-0871', 'SL-1163']);
  });

  it('keeps the two that follow each other on the same ground', () => {
    const turnagain = loaded.leases.filter((one) => one.bed === 'D2-TGB');
    expect(turnagain).toHaveLength(2);
    expect(turnagain[0].holder).not.toBe(turnagain[1].holder);
  });
});

describe('the leases command', () => {
  it('lists them with the standing on the day asked about', () => {
    const { io, code } = ask();
    expect(code).toBe(FOUND);
    expect(io.out).toContain('SL-1104');
    expect(io.out).toContain('expired');
    expect(io.out).toContain('In force:          2');
  });

  it('reads the register as at a day in the past, not as at today', () => {
    const { io } = ask({ on: '2020-08-15' });
    const rows = io.out.split('\n').filter((line) => line.startsWith('SL-'));
    expect(rows.find((line) => line.startsWith('SL-0871'))).toContain('in force');
    expect(rows.find((line) => line.startsWith('SL-1163'))).toContain('not yet begun');
  });

  it('narrows to one grower', () => {
    const { io } = ask({ holder: 'SH-2025-04412' });
    expect(io.out).toContain('Leases on file:    2');
    expect(io.out).not.toContain('SH-2024-01188');
  });

  it('refuses a grower who holds nothing that day', () => {
    const { io, code } = ask({ holder: 'SH-2024-01188' });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('holds nothing on 2025-08-15');
  });

  it('chases the rent', () => {
    expect(ask().io.err).toContain('lease.rentOwed: SL-1163');
  });

  it('prints them as JSON', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.leases).toHaveLength(3);
    expect(answer.leases[0].standing).toBe('in force');
  });
});

describe('the trespass rule, now that it reads the lease register', () => {
  it('leaves a landing by the grower who held the ground that day alone', () => {
    const io = recorder();
    landings(base({ on: '2025-08-14' }), io);
    expect(io.err).not.toContain('leaseTrespass');
  });

  it('names the holder on the day rather than the holder now', () => {
    const loaded = loadCase(CASE);
    const turnagain = loaded.leases.filter((one) => one.bed === 'D2-TGB');
    expect(turnagain[1].from.year).toBe(2025);
    expect(turnagain[1].holder).toBe('SH-2025-04412');
  });
});
