import { describe, expect, it } from 'vitest';

import {
  SAMPLE_SIZE,
  checkCull,
  describeCull,
  measuredDimension,
  minimumInches,
  toleranceFor,
  tolerancePerHundred,
} from '../../src/harvest/cull.js';
import { BAY_SCALLOP, HARD_CLAM, OYSTER, SPECIES } from '../../src/harvest/record.js';
import { DIVER, DREDGE, HAND, RAKE, TONGS } from '../../src/licence/harvester.js';

const measurements = (under, over, minimum = 3) => [
  ...Array.from({ length: under }, () => minimum - 0.2),
  ...Array.from({ length: over }, () => minimum + 0.4),
];

describe('the minimum size', () => {
  it('is three inches for an oyster and one for a hard clam', () => {
    expect(minimumInches(OYSTER)).toBe(3);
    expect(minimumInches(HARD_CLAM)).toBe(1);
    expect(minimumInches(BAY_SCALLOP)).toBe(1.5);
  });

  it('names what is measured, which is not the same on every species', () => {
    expect(measuredDimension(OYSTER)).toBe('longest dimension');
    expect(measuredDimension(HARD_CLAM)).toBe('thickness across the hinge');
  });

  it('gives every species a minimum and a dimension', () => {
    for (const species of SPECIES) {
      expect(minimumInches(species)).toBeGreaterThan(0);
      expect(measuredDimension(species).length).toBeGreaterThan(5);
    }
  });

  it('takes a variance where an area is worked under one', () => {
    expect(minimumInches(OYSTER, { variance: 2.5 })).toBe(2.5);
  });

  it('refuses a variance looser than nothing or tighter than the standard', () => {
    expect(() => minimumInches(OYSTER, { variance: -1 })).toThrow(/at least 0/);
    expect(() => minimumInches(OYSTER, { variance: 4 })).toThrow(/at most 3/);
  });

  it('refuses a species it does not handle', () => {
    expect(() => minimumInches('mussel')).toThrow(/not a species/);
  });
});

describe('the tolerance', () => {
  it('is looser on a dredge than on tongs, which is what the rule allows for', () => {
    expect(tolerancePerHundred(DREDGE)).toBeGreaterThan(tolerancePerHundred(TONGS));
  });

  it('is the same for every gear worked by hand', () => {
    expect(tolerancePerHundred(HAND)).toBe(tolerancePerHundred(RAKE));
    expect(tolerancePerHundred(TONGS)).toBe(tolerancePerHundred(HAND));
  });

  it('refuses gear that has no tolerance written for it', () => {
    expect(() => tolerancePerHundred(DIVER)).toThrow(/no culling tolerance/);
  });

  it('scales with the sample and rounds down rather than to the nearest', () => {
    expect(toleranceFor(TONGS, SAMPLE_SIZE)).toBe(5);
    expect(toleranceFor(TONGS, 50)).toBe(2);
    expect(toleranceFor(TONGS, 30)).toBe(1);
    expect(toleranceFor(DREDGE, 50)).toBe(5);
  });

  it('never gives a smaller sample a looser rule than a bigger one', () => {
    for (const size of [10, 25, 50, 75, 100]) {
      expect(toleranceFor(TONGS, size) / size).toBeLessThanOrEqual(
        tolerancePerHundred(TONGS) / SAMPLE_SIZE + 1e-9,
      );
    }
  });

  it('refuses a sample size that is not a whole number of shellfish', () => {
    expect(() => toleranceFor(TONGS, 0)).toThrow(/at least 1/);
    expect(() => toleranceFor(TONGS, 2.5)).toThrow(/whole number/);
  });
});

describe('checking a cull', () => {
  it('passes a sample inside the tolerance', () => {
    const answer = checkCull({ species: OYSTER, gear: TONGS, measurements: measurements(5, 95) });
    expect(answer.passes).toBe(true);
    expect(answer.undersize).toBe(5);
    expect(answer.allowed).toBe(5);
  });

  it('fails one over it', () => {
    const answer = checkCull({ species: OYSTER, gear: TONGS, measurements: measurements(6, 94) });
    expect(answer.passes).toBe(false);
    expect(answer.problems.has('cull.overTolerance')).toBe(true);
  });

  it('passes the same sample off a dredge', () => {
    const answer = checkCull({ species: OYSTER, gear: DREDGE, measurements: measurements(6, 94) });
    expect(answer.passes).toBe(true);
  });

  it('passes a sample that would fail without the variance', () => {
    const shorts = Array.from({ length: 100 }, () => 2.7);
    expect(checkCull({ species: OYSTER, gear: TONGS, measurements: shorts }).passes).toBe(false);
    expect(
      checkCull({ species: OYSTER, gear: TONGS, measurements: shorts, variance: 2.5 }).passes,
    ).toBe(true);
  });

  it('notes a sample smaller than a hundred rather than refusing it', () => {
    const answer = checkCull({
      species: OYSTER,
      gear: TONGS,
      measurements: measurements(1, 29),
    });
    expect(answer.problems.has('cull.smallSample')).toBe(true);
    expect(answer.passes).toBe(true);
  });

  it('says nothing of the kind about a full sample', () => {
    const answer = checkCull({ species: OYSTER, gear: TONGS, measurements: measurements(0, 100) });
    expect(answer.problems.has('cull.smallSample')).toBe(false);
    expect(answer.problems.isClean()).toBe(true);
  });

  it('refuses a sample with nothing in it, or a measurement that is not one', () => {
    expect(() => checkCull({ species: OYSTER, gear: TONGS, measurements: [] })).toThrow(
      /at least 1 entries/,
    );
    expect(() => checkCull({ species: OYSTER, gear: TONGS, measurements: ['small'] })).toThrow(
      /measurement/,
    );
  });

  it('carries the lot number through onto the finding', () => {
    const answer = checkCull({
      species: OYSTER,
      gear: TONGS,
      measurements: measurements(9, 91),
      lot: '20250814-B12-001',
    });
    expect(answer.problems.list()[0].detail.lot).toBe('20250814-B12-001');
  });

  it('describes itself the way the sheet reads', () => {
    const answer = checkCull({ species: OYSTER, gear: TONGS, measurements: measurements(3, 97) });
    expect(describeCull(answer)).toBe('3 of 100 under 3 in, tolerance 5');
  });
});
