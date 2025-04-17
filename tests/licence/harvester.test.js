import { describe, expect, it } from 'vitest';

import {
  DIVER,
  DREDGE,
  GEARS,
  HAND,
  RAKE,
  TONGS,
  findHarvester,
  harvester,
  isCurrent,
  isIntertidalGear,
  isSuspended,
  mayHarvestWith,
  requireGear,
  suspension,
  suspensionOn,
} from '../../src/licence/harvester.js';
import { civilDate } from '../../src/time/civil.js';

const wade = harvester({
  id: 'SH-2025-04412',
  name: 'Wade Ollis',
  gears: [HAND, RAKE],
  issuedOn: '2025-01-01',
  expiresOn: '2025-12-31',
});

const boat = harvester({
  id: 'SH-2025-00877',
  name: 'Della Pruitt',
  gears: [TONGS, DREDGE],
  issuedOn: '2025-01-01',
  expiresOn: '2025-12-31',
  suspensions: [suspension({ from: '2025-07-01', to: '2025-07-31', reason: 'untagged lot' })],
});

describe('gear', () => {
  it('knows the five kinds', () => {
    expect(GEARS).toEqual([TONGS, RAKE, DREDGE, HAND, DIVER]);
  });

  it('refuses gear it does not know and lists what it does', () => {
    try {
      requireGear('trawl');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(GEARS.slice());
    }
  });

  it('separates the gear that works water out at low tide from the gear that does not', () => {
    expect(isIntertidalGear(HAND)).toBe(true);
    expect(isIntertidalGear(RAKE)).toBe(true);
    expect(isIntertidalGear(TONGS)).toBe(false);
    expect(isIntertidalGear(DREDGE)).toBe(false);
    expect(isIntertidalGear(DIVER)).toBe(false);
  });
});

describe('building a licence', () => {
  it('sorts and deduplicates the endorsements', () => {
    const one = harvester({
      id: 'SH-2025-00001',
      name: 'Test',
      gears: [TONGS, HAND, TONGS],
      issuedOn: '2025-01-01',
      expiresOn: '2025-12-31',
    });
    expect(one.gears).toEqual([HAND, TONGS]);
  });

  it('refuses a licence with no endorsement at all', () => {
    expect(() =>
      harvester({
        id: 'SH-2025-00001',
        name: 'Test',
        gears: [],
        issuedOn: '2025-01-01',
        expiresOn: '2025-12-31',
      }),
    ).toThrow(/at least 1 entries/);
  });

  it('refuses gear it does not know', () => {
    expect(() =>
      harvester({
        id: 'SH-2025-00001',
        name: 'Test',
        gears: ['trawl'],
        issuedOn: '2025-01-01',
        expiresOn: '2025-12-31',
      }),
    ).toThrow(/not gear this program knows/);
  });

  it('refuses a licence that expires before it was issued', () => {
    expect(() =>
      harvester({
        id: 'SH-2025-00001',
        name: 'Test',
        gears: [HAND],
        issuedOn: '2025-12-31',
        expiresOn: '2025-01-01',
      }),
    ).toThrow(/expire before it is issued/);
  });

  it('refuses a licence number that is not one', () => {
    expect(() =>
      harvester({
        id: 'SP-118',
        name: 'Test',
        gears: [HAND],
        issuedOn: '2025-01-01',
        expiresOn: '2025-12-31',
      }),
    ).toThrow(/harvester licence number/);
  });
});

describe('currency', () => {
  it('reads both ends of the licence year as inclusive', () => {
    expect(isCurrent(wade, civilDate(2025, 1, 1))).toBe(true);
    expect(isCurrent(wade, civilDate(2025, 12, 31))).toBe(true);
    expect(isCurrent(wade, civilDate(2024, 12, 31))).toBe(false);
    expect(isCurrent(wade, civilDate(2026, 1, 1))).toBe(false);
  });
});

describe('suspension is not expiry', () => {
  it('finds the suspension covering a day, both ends inclusive', () => {
    expect(isSuspended(boat, civilDate(2025, 7, 1))).toBe(true);
    expect(isSuspended(boat, civilDate(2025, 7, 31))).toBe(true);
    expect(isSuspended(boat, civilDate(2025, 6, 30))).toBe(false);
    expect(isSuspended(boat, civilDate(2025, 8, 1))).toBe(false);
  });

  it('names the reason, which the notice has to carry', () => {
    expect(suspensionOn(boat, civilDate(2025, 7, 15)).reason).toBe('untagged lot');
    expect(suspensionOn(boat, civilDate(2025, 8, 15))).toBeNull();
  });

  it('treats an open suspension as running on', () => {
    const held = harvester({
      id: 'SH-2025-00002',
      name: 'Test',
      gears: [HAND],
      issuedOn: '2025-01-01',
      expiresOn: '2025-12-31',
      suspensions: [suspension({ from: '2025-03-01' })],
    });
    expect(isSuspended(held, civilDate(2025, 12, 30))).toBe(true);
  });

  it('refuses a suspension that lifts before it is imposed', () => {
    expect(() => suspension({ from: '2025-07-31', to: '2025-07-01' })).toThrow(
      /lift before it is imposed/,
    );
  });

  it('leaves the licence current through a suspension, which are different questions', () => {
    expect(isCurrent(boat, civilDate(2025, 7, 15))).toBe(true);
    expect(isSuspended(boat, civilDate(2025, 7, 15))).toBe(true);
  });
});

describe('what a licence permits', () => {
  it('permits gear it is endorsed for, on a day it is current and unsuspended', () => {
    expect(mayHarvestWith(wade, HAND, civilDate(2025, 6, 10))).toBe(true);
    expect(mayHarvestWith(wade, RAKE, civilDate(2025, 6, 10))).toBe(true);
  });

  it('refuses gear it is not endorsed for', () => {
    expect(mayHarvestWith(wade, DREDGE, civilDate(2025, 6, 10))).toBe(false);
  });

  it('refuses everything on a day the licence had expired', () => {
    expect(mayHarvestWith(wade, HAND, civilDate(2026, 1, 2))).toBe(false);
  });

  it('refuses everything on a day the licence was suspended', () => {
    expect(mayHarvestWith(boat, TONGS, civilDate(2025, 7, 15))).toBe(false);
    expect(mayHarvestWith(boat, TONGS, civilDate(2025, 8, 15))).toBe(true);
  });

  it('refuses gear that is not gear', () => {
    expect(() => mayHarvestWith(wade, 'trawl', civilDate(2025, 6, 10))).toThrow(/not gear/);
  });
});

describe('finding a licence', () => {
  it('finds one by number and answers with nothing where there is none', () => {
    expect(findHarvester([wade, boat], 'SH-2025-00877').name).toBe('Della Pruitt');
    expect(findHarvester([wade, boat], 'SH-2025-99999')).toBeNull();
  });
});
