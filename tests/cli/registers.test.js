import { describe, expect, it } from 'vitest';

import {
  bedsCommand,
  dealerCommand,
  harvesterCommand,
  tideClockGears,
} from '../../src/cli/commands/registers.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

describe('the dealer command', () => {
  it('names the kind the certification number carries', () => {
    const io = recorder();
    expect(dealerCommand(base({ dealer: 'SP-118', on: '2025-08-14' }), io)).toBe(OK);
    expect(io.out).toMatch(/Kind:\s+shucker packer/);
  });

  it('lists what that kind may do, and only that', () => {
    const io = recorder();
    dealerCommand(base({ dealer: 'SP-118', on: '2025-08-14' }), io);
    expect(io.out).toContain('shuck');
    expect(io.out).not.toContain('depurate');
  });

  it('lists depuration only for the depuration processor', () => {
    const io = recorder();
    dealerCommand(base({ dealer: 'DP-003', on: '2025-08-14' }), io);
    expect(io.out).toContain('depurate');
  });

  it('allows nothing on a day the certification had lapsed', () => {
    const io = recorder();
    dealerCommand(base({ dealer: 'SS-099', on: '2025-08-14' }), io);
    expect(io.out).toMatch(/Certified that day: no/);
    expect(io.out).toMatch(/Allowed that day:\s+nothing/);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    dealerCommand(base({ dealer: 'DP-003', on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.kind).toBe('depuration processor');
    expect(answer.allowedToday).toContain('depurate');
  });

  it('refuses a certification that is not in the register', () => {
    const io = recorder();
    expect(dealerCommand(base({ dealer: 'SP-999', on: '2025-08-14' }), io)).toBe(REFUSED);
  });
});

describe('the harvester command', () => {
  it('prints the endorsements and what they permit that day', () => {
    const io = recorder();
    expect(harvesterCommand(base({ harvester: 'SH-2025-04412', on: '2025-08-14' }), io)).toBe(OK);
    expect(io.out).toMatch(/Endorsed for:\s+hand and rake/);
    expect(io.out).toMatch(/May use that day: hand and rake/);
  });

  it('permits nothing inside a suspension, while the licence stays current', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-00877', on: '2025-07-14' }), io);
    expect(io.out).toMatch(/Current:\s+yes/);
    expect(io.out).toMatch(/Suspended:\s+yes/);
    expect(io.out).toMatch(/May use that day: nothing/);
  });

  it('permits the same gears again once the suspension has lifted', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-00877', on: '2025-08-14' }), io);
    expect(io.out).toMatch(/May use that day: dredge and tongs/);
  });

  it('permits nothing once the licence has expired', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2024-03310', on: '2025-08-14' }), io);
    expect(io.out).toMatch(/Current:\s+no/);
    expect(io.out).toMatch(/May use that day: nothing/);
  });

  it('names the lots that licence landed', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-00877', on: '2025-08-14' }), io);
    expect(io.out).toContain('20250814-B12-002');
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-04412', on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.endorsed).toEqual(['hand', 'rake']);
    expect(answer.lots.length).toBeGreaterThan(0);
  });

  it('refuses a licence that is not in the register', () => {
    const io = recorder();
    expect(harvesterCommand(base({ harvester: 'SH-2025-99999', on: '2025-08-14' }), io)).toBe(
      REFUSED,
    );
  });
});

describe('the beds command', () => {
  it('lists the beds in the area with the tide station each reads', () => {
    const io = recorder();
    expect(bedsCommand(base({ area: 'B-12' }), io)).toBe(OK);
    expect(io.out).toContain('B12-BCK');
    expect(io.out).toContain('BFT');
  });

  it('says which beds come out of the water', () => {
    const io = recorder();
    bedsCommand(base({ area: 'B-12' }), io);
    expect(io.out).toMatch(/B12-BCK.*yes/);
    expect(io.out).toMatch(/B12-CHN.*no/);
  });

  it('names the holder of a lease and a dash for public bottom', () => {
    const io = recorder();
    bedsCommand(base({ area: 'D-2' }), io);
    expect(io.out).toContain('SH-2025-04412');
  });

  it('prints the beds as JSON when asked', () => {
    const io = recorder();
    bedsCommand(base({ area: 'B-12', json: true }), io);
    expect(JSON.parse(io.out).beds).toHaveLength(2);
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(bedsCommand(base({ area: 'Z-9' }), io)).toBe(REFUSED);
  });
});

describe('which gears run the clock off the tide', () => {
  it('names the two that work on foot, on ground that dries', () => {
    expect(tideClockGears({ elevation: 1.8 })).toEqual(['rake', 'hand']);
  });

  it('names none on ground that never comes up', () => {
    expect(tideClockGears({ elevation: -1.2 })).toEqual([]);
  });
});

describe('the usable gear line reads the same way as the endorsement line', () => {
  it('is sorted, not left in the order of the gear table', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-04412', on: '2025-08-14' }), io);
    const endorsed = /Endorsed for:\s+(.*)/.exec(io.out)[1];
    const usable = /May use that day: (.*)/.exec(io.out)[1];
    expect(usable).toBe(endorsed);
  });

  it('is sorted in the JSON as well', () => {
    const io = recorder();
    harvesterCommand(base({ harvester: 'SH-2025-00877', on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.usableToday).toEqual(['dredge', 'tongs']);
  });
});
