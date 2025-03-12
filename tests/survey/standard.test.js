import { describe, expect, it } from 'vitest';

import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import {
  ANALYSES,
  FECAL_COLIFORM,
  TOTAL_COLIFORM,
  analysis,
  limitsFor,
  scorableClassifications,
  scoringClassFor,
} from '../../src/survey/standard.js';

describe('naming an analysis', () => {
  it('reads either of the two the office runs', () => {
    expect(analysis('Fecal Coliform')).toBe(FECAL_COLIFORM);
    expect(analysis(' total coliform ')).toBe(TOTAL_COLIFORM);
  });

  it('refuses one it does not read and lists both', () => {
    try {
      analysis('enterococcus', 'labAnalysis');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(ANALYSES.slice());
      expect(error.message).toMatch(/labAnalysis/);
    }
  });

  it('refuses something that is not a name', () => {
    expect(() => analysis(3)).toThrow(/must name an analysis/);
  });
});

describe('which class supplies the numbers', () => {
  it('leaves an unconditional class alone', () => {
    expect(scoringClassFor(APPROVED)).toBe(APPROVED);
    expect(scoringClassFor(RESTRICTED)).toBe(RESTRICTED);
    expect(scoringClassFor(PROHIBITED)).toBe(PROHIBITED);
  });

  it('scores a conditional class against its open twin', () => {
    expect(scoringClassFor(CONDITIONALLY_APPROVED)).toBe(APPROVED);
    expect(scoringClassFor(CONDITIONALLY_RESTRICTED)).toBe(RESTRICTED);
  });
});

describe('the limits', () => {
  it('reads the fecal coliform numbers for approved water', () => {
    expect(limitsFor(APPROVED, FECAL_COLIFORM)).toMatchObject({
      geometricMean: 14,
      ninetieth: 43,
      highest: 43,
    });
  });

  it('reads the fecal coliform numbers for restricted water', () => {
    expect(limitsFor(RESTRICTED, FECAL_COLIFORM)).toMatchObject({
      geometricMean: 88,
      ninetieth: 260,
    });
  });

  it('reads a different scale entirely for total coliform', () => {
    const fecal = limitsFor(APPROVED, FECAL_COLIFORM);
    const total = limitsFor(APPROVED, TOTAL_COLIFORM);
    expect(total.geometricMean).toBe(70);
    expect(total.geometricMean).toBeGreaterThan(fecal.geometricMean * 4);
  });

  it('is looser for restricted than for approved under both analyses', () => {
    for (const kind of ANALYSES) {
      expect(limitsFor(RESTRICTED, kind).geometricMean).toBeGreaterThan(
        limitsFor(APPROVED, kind).geometricMean,
      );
      expect(limitsFor(RESTRICTED, kind).ninetieth).toBeGreaterThan(
        limitsFor(APPROVED, kind).ninetieth,
      );
    }
  });

  it('gives a conditional class the numbers of its twin', () => {
    expect(limitsFor(CONDITIONALLY_APPROVED, FECAL_COLIFORM)).toEqual(
      limitsFor(APPROVED, FECAL_COLIFORM),
    );
    expect(limitsFor(CONDITIONALLY_RESTRICTED, FECAL_COLIFORM)).toEqual(
      limitsFor(RESTRICTED, FECAL_COLIFORM),
    );
  });

  it('has no numbers at all for prohibited', () => {
    expect(limitsFor(PROHIBITED, FECAL_COLIFORM)).toBeNull();
  });

  it('reports which class and analysis the numbers came from', () => {
    const limits = limitsFor(CONDITIONALLY_APPROVED, FECAL_COLIFORM);
    expect(limits.classification).toBe(APPROVED);
    expect(limits.analysis).toBe(FECAL_COLIFORM);
  });

  it('refuses an analysis it cannot score', () => {
    expect(() => limitsFor(APPROVED, 'enterococcus')).toThrow(/not an analysis/);
  });

  it('names the two classes that carry numbers, most permissive first', () => {
    expect(scorableClassifications()).toEqual([APPROVED, RESTRICTED]);
  });
});
