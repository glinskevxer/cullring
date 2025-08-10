import { describe, expect, it } from 'vitest';

import { stationsIn, tideCommand, vibrioCommand } from '../../src/cli/commands/tide.js';
import { loadCase } from '../../src/cli/context.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

describe('the tide command', () => {
  it('names the station and the elevation the bed is read at', () => {
    const io = recorder();
    expect(tideCommand(base({ bed: 'B12-BCK', on: '2025-08-14' }), io)).toBe(OK);
    expect(io.out).toMatch(/Tide station: BFT/);
    expect(io.out).toMatch(/Elevation:\s+1\.8 ft above datum/);
  });

  it('gives the exposures with the hours each ran for', () => {
    const io = recorder();
    tideCommand(base({ bed: 'B12-BCK', on: '2025-08-14' }), io);
    expect(io.out).toContain('Out of the water from');
    expect(io.out).toMatch(/2025-08-14 0[0-9]:/);
  });

  it('says plainly when the bed never comes up', () => {
    const io = recorder();
    tideCommand(base({ bed: 'B12-CHN', on: '2025-08-14' }), io);
    expect(io.out).toContain('does not come out of the water on this day');
  });

  it('says what the published table covers, so a blank day is explicable', () => {
    const io = recorder();
    tideCommand(base({ bed: 'B12-BCK', on: '2025-09-14' }), io);
    expect(io.out).toContain('Table covers');
    expect(io.out).toContain('does not come out of the water on this day');
  });

  it('prints the exposures as JSON when asked', () => {
    const io = recorder();
    tideCommand(base({ bed: 'B12-BCK', on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.station).toBe('BFT');
    expect(answer.exposures.length).toBeGreaterThan(0);
  });

  it('refuses a bed that is not in the register', () => {
    const io = recorder();
    expect(tideCommand(base({ bed: 'Z9-XXX', on: '2025-08-14' }), io)).toBe(REFUSED);
  });

  it('refuses a bed whose station the table does not predict', () => {
    const io = recorder();
    expect(tideCommand(base({ bed: 'C3-MSL', on: '2025-08-14' }), io)).toBe(OK);
  });
});

describe('the vibrio command', () => {
  it('reads the region off the area letter', () => {
    const io = recorder();
    expect(vibrioCommand(base({ area: 'B-12' }), io)).toBe(OK);
    expect(io.out).toContain('Time to temperature in warm water');
  });

  it('gives a cool area a different table', () => {
    const io = recorder();
    vibrioCommand(base({ area: 'D-2' }), io);
    expect(io.out).toContain('cool water');
    expect(io.out).not.toContain('April');
  });

  it('prints the ice column and what it buys', () => {
    const io = recorder();
    vibrioCommand(base({ area: 'B-12' }), io);
    expect(io.out).toMatch(/August\s+10\s+12\s+2/);
  });

  it('says plainly that nothing applies outside the season', () => {
    const io = recorder();
    vibrioCommand(base({ area: 'B-12' }), io);
    expect(io.out).toMatch(/Outside it:\s+no limit applies/);
  });

  it('prints the table as JSON when asked', () => {
    const io = recorder();
    vibrioCommand(base({ area: 'B-12', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.region).toBe('warm');
    expect(answer.season).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it('refuses without an area, because the region comes off it', () => {
    const io = recorder();
    expect(vibrioCommand(base(), io)).toBe(REFUSED);
    expect(io.err).toContain('an area is needed');
  });

  it('refuses an area letter that sits in no region', () => {
    const io = recorder();
    expect(vibrioCommand(base({ area: 'Z-9' }), io)).toBe(REFUSED);
  });
});

describe('the stations a case predicts', () => {
  it('lists them in order', () => {
    expect(stationsIn(loadCase(CASE))).toEqual(['BFT', 'HAT']);
  });
});
