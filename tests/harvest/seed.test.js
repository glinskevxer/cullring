import { describe, expect, it } from 'vitest';

import {
  GROW_ON_DAYS,
  SEED_SHARE,
  checkTransplant,
  isSeed,
  mayHarvestYet,
  seedInches,
  seedPermit,
} from '../../src/harvest/seed.js';
import { minimumInches } from '../../src/harvest/cull.js';
import { BAY_SCALLOP, HARD_CLAM, OYSTER, SPECIES } from '../../src/harvest/record.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';

const permit = seedPermit({
  number: 'sd-2025-11',
  harvester: 'SH-2025-04412',
  fromArea: 'D-9',
  toBed: 'c3-msl',
  species: OYSTER,
  issuedOn: '2025-03-01',
  expiresOn: '2025-11-30',
});

const move = (extra = {}) =>
  checkTransplant({
    permit,
    fromArea: 'D-9',
    toBed: 'C3-MSL',
    species: OYSTER,
    measurements: [0.9, 1.1, 1.2, 0.8],
    movedOn: '2025-04-15',
    receivingClassification: APPROVED,
    harvester: 'SH-2025-04412',
    ...extra,
  });

describe('the seed size', () => {
  it('is half the market minimum, read off the same table', () => {
    expect(SEED_SHARE).toBe(0.5);
    for (const species of SPECIES) {
      expect(seedInches(species)).toBeCloseTo(minimumInches(species) / 2, 6);
    }
  });

  it('is an inch and a half for an oyster and half an inch for a clam', () => {
    expect(seedInches(OYSTER)).toBe(1.5);
    expect(seedInches(HARD_CLAM)).toBe(0.5);
    expect(seedInches(BAY_SCALLOP)).toBe(0.75);
  });

  it('calls something under it seed and something at it not', () => {
    expect(isSeed(OYSTER, 1.4)).toBe(true);
    expect(isSeed(OYSTER, 1.5)).toBe(false);
    expect(isSeed(OYSTER, 3.2)).toBe(false);
  });

  it('refuses a species it does not handle', () => {
    expect(() => isSeed('mussel', 1)).toThrow(/not a species/);
  });
});

describe('the permit', () => {
  it('normalises the numbers it was given', () => {
    expect(permit.number).toBe('SD-2025-11');
    expect(permit.toBed).toBe('C3-MSL');
  });

  it('refuses a permit with no number or no bed', () => {
    expect(() =>
      seedPermit({ harvester: 'SH-2025-04412', fromArea: 'D-9', toBed: 'C3-MSL' }),
    ).toThrow(/number/);
    expect(() => seedPermit({ number: 'X', harvester: 'SH-2025-04412', fromArea: 'D-9' })).toThrow(
      /toBed/,
    );
  });
});

describe('a lawful transplant', () => {
  it('passes', () => {
    const answer = move();
    expect(answer.lawful).toBe(true);
    expect(answer.oversize).toBe(0);
  });

  it('says when anything may be taken off the bed again', () => {
    expect(formatCivilDate(move().mayHarvestFrom)).toBe('2025-10-12');
    expect(GROW_ON_DAYS).toBe(180);
  });

  it('lets nothing be taken before that day and everything after it', () => {
    const answer = move();
    expect(mayHarvestYet(answer, civilDate(2025, 10, 11))).toBe(false);
    expect(mayHarvestYet(answer, civilDate(2025, 10, 12))).toBe(true);
  });

  it('takes seed out of prohibited water, which is the point of the permit', () => {
    expect(move({ fromArea: 'D-9' }).lawful).toBe(true);
  });
});

describe('what makes it unlawful', () => {
  it('refuses a move under no permit', () => {
    expect(move({ permit: null }).problems.has('seed.noPermit')).toBe(true);
  });

  it('refuses a move out of water the permit does not name', () => {
    expect(move({ fromArea: 'D-2' }).problems.has('seed.wrongSource')).toBe(true);
  });

  it('refuses a move onto a bed the permit does not name', () => {
    expect(move({ toBed: 'B12-BCK' }).problems.has('seed.wrongDestination')).toBe(true);
  });

  it('refuses a move by somebody who does not hold the permit', () => {
    expect(move({ harvester: 'SH-2025-00877' }).problems.has('seed.wrongHarvester')).toBe(true);
  });

  it('refuses a move outside the dates the permit runs between', () => {
    expect(move({ movedOn: '2025-01-15' }).problems.has('seed.permitLapsed')).toBe(true);
    expect(move({ movedOn: '2025-12-15' }).problems.has('seed.permitLapsed')).toBe(true);
  });

  it('refuses anything at or over the seed size, which is not seed', () => {
    const answer = move({ measurements: [0.9, 1.5, 3.2] });
    expect(answer.problems.has('seed.oversize')).toBe(true);
    expect(answer.oversize).toBe(2);
  });

  it('refuses laying seed into water that is not good enough to grow it', () => {
    for (const receiving of [RESTRICTED, PROHIBITED]) {
      expect(move({ receivingClassification: receiving }).problems.has('seed.receivingWater')).toBe(
        true,
      );
    }
  });

  it('allows a conditionally approved lease, which is still growable water', () => {
    expect(
      move({ receivingClassification: CONDITIONALLY_APPROVED }).problems.has('seed.receivingWater'),
    ).toBe(false);
  });

  it('reports everything wrong with it at once', () => {
    const answer = move({
      permit: null,
      measurements: [3.2],
      receivingClassification: PROHIBITED,
    });
    expect(answer.problems.of('error')).toHaveLength(3);
  });
});
