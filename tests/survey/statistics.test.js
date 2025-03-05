import { describe, expect, it } from 'vitest';

import { mpn, parseMpn } from '../../src/survey/result.js';
import {
  AT_LIMIT,
  CENSORING_POLICIES,
  HALF_LOWER_LIMIT,
  NINETIETH_FACTOR,
  REFUSE_CENSORED,
  describeSet,
  estimatedNinetieth,
  geometricMean,
  logSummary,
  roundTo,
  shareAtOrAbove,
  valueUnderPolicy,
} from '../../src/survey/statistics.js';

const read = (list) => list.map((text) => parseMpn(text));
const CLEAN = read([
  '<1.8',
  '<1.8',
  '4.5',
  '23',
  '7.8',
  '<1.8',
  '13',
  '2',
  '49',
  '<1.8',
  '7.8',
  '23',
  '4.5',
  '<1.8',
  '9.2',
]);

describe('reading a censored result under a policy', () => {
  it('leaves an exact result alone whatever the policy', () => {
    for (const policy of CENSORING_POLICIES) {
      expect(valueUnderPolicy(mpn(23), policy)).toBe(23);
    }
  });

  it('reads a lower bound at its face value or at half of it', () => {
    expect(valueUnderPolicy(parseMpn('<1.8'), AT_LIMIT)).toBe(1.8);
    expect(valueUnderPolicy(parseMpn('<1.8'), HALF_LOWER_LIMIT)).toBe(0.9);
  });

  it('reads an upper bound at its face value under both counting policies', () => {
    expect(valueUnderPolicy(parseMpn('>1600'), AT_LIMIT)).toBe(1600);
    expect(valueUnderPolicy(parseMpn('>1600'), HALF_LOWER_LIMIT)).toBe(1600);
  });

  it('refuses a bound outright under the strict policy', () => {
    expect(() => valueUnderPolicy(parseMpn('<1.8'), REFUSE_CENSORED)).toThrow(/bounded result/);
    expect(() => valueUnderPolicy(parseMpn('>1600'), REFUSE_CENSORED)).toThrow(/bounded result/);
    expect(valueUnderPolicy(mpn(23), REFUSE_CENSORED)).toBe(23);
  });

  it('refuses a policy it does not hold, and lists the ones it does', () => {
    try {
      valueUnderPolicy(mpn(23), 'guess');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(CENSORING_POLICIES.slice());
    }
  });
});

describe('the log summary', () => {
  it('counts what it read and how much of it was bounded', () => {
    const summary = logSummary(CLEAN, AT_LIMIT);
    expect(summary.count).toBe(15);
    expect(summary.censored).toBe(5);
    expect(summary.atUpper).toBe(0);
    expect(summary.policy).toBe(AT_LIMIT);
  });

  it('gives a single result no spread at all', () => {
    const summary = logSummary([mpn(100)], AT_LIMIT);
    expect(summary.logMean).toBeCloseTo(2, 10);
    expect(summary.logStandardDeviation).toBe(0);
  });

  it('gives a set of identical results no spread either', () => {
    expect(logSummary([mpn(10), mpn(10), mpn(10)], AT_LIMIT).logStandardDeviation).toBeCloseTo(
      0,
      9,
    );
  });

  it('refuses an empty set, because there is no average of nothing', () => {
    expect(() => logSummary([], AT_LIMIT)).toThrow(/at least one result/);
    expect(() => logSummary(null, AT_LIMIT)).toThrow(/at least one result/);
  });

  it('counts results at the upper bound separately', () => {
    expect(logSummary(read(['>1600', '23']), AT_LIMIT).atUpper).toBe(1);
  });
});

describe('the geometric mean', () => {
  it('is the middle of a symmetric log spread', () => {
    expect(geometricMean([mpn(10), mpn(1000)], AT_LIMIT)).toBeCloseTo(100, 6);
  });

  it('is not the arithmetic mean, which is the whole reason it is used', () => {
    const set = [mpn(2), mpn(2), mpn(2), mpn(1600)];
    expect(geometricMean(set, AT_LIMIT)).toBeLessThan(20);
  });

  it('falls when the lower bounds are read at half', () => {
    expect(geometricMean(CLEAN, HALF_LOWER_LIMIT)).toBeLessThan(geometricMean(CLEAN, AT_LIMIT));
  });
});

describe('the estimated ninetieth percentile', () => {
  it('sits above the geometric mean whenever there is any spread', () => {
    expect(estimatedNinetieth(CLEAN, AT_LIMIT)).toBeGreaterThan(geometricMean(CLEAN, AT_LIMIT));
  });

  it('equals the mean when every result is the same', () => {
    const flat = [mpn(10), mpn(10), mpn(10)];
    expect(estimatedNinetieth(flat, AT_LIMIT)).toBeCloseTo(geometricMean(flat, AT_LIMIT), 6);
  });

  it('is built from the factor the standard names', () => {
    const summary = logSummary(CLEAN, AT_LIMIT);
    const byHand = Math.pow(10, summary.logMean + NINETIETH_FACTOR * summary.logStandardDeviation);
    expect(estimatedNinetieth(CLEAN, AT_LIMIT)).toBeCloseTo(byHand, 9);
  });

  it('RISES when the lower bounds are read at half, while the mean falls', () => {
    expect(estimatedNinetieth(CLEAN, HALF_LOWER_LIMIT)).toBeGreaterThan(
      estimatedNinetieth(CLEAN, AT_LIMIT),
    );
  });
});

describe('describeSet', () => {
  it('reports the numbers a standard reads, in one pass', () => {
    const described = describeSet(CLEAN, AT_LIMIT);
    expect(roundTo(described.geometricMean, 2)).toBe(5.55);
    expect(roundTo(described.estimatedNinetieth, 1)).toBe(23.2);
    expect(described.highest).toBe(49);
    expect(described.count).toBe(15);
  });

  it('reports the highest as the number written, bound or not', () => {
    expect(describeSet(read(['>1600', '23']), AT_LIMIT).highest).toBe(1600);
  });
});

describe('shareAtOrAbove', () => {
  it('counts at the threshold as well as above it', () => {
    expect(shareAtOrAbove([mpn(10), mpn(20), mpn(30)], 20)).toBeCloseTo(2 / 3, 9);
  });

  it('is zero when nothing reaches it and one when everything does', () => {
    expect(shareAtOrAbove([mpn(1), mpn(2)], 100)).toBe(0);
    expect(shareAtOrAbove([mpn(100), mpn(200)], 10)).toBe(1);
  });

  it('refuses an empty set', () => {
    expect(() => shareAtOrAbove([], 10)).toThrow(/at least one result/);
  });
});

describe('roundTo', () => {
  it('rounds to the places the report prints', () => {
    expect(roundTo(5.5512, 2)).toBe(5.55);
    expect(roundTo(23.24, 1)).toBe(23.2);
    expect(roundTo(23.25, 1)).toBe(23.3);
    expect(roundTo(23.6, 0)).toBe(24);
  });
});
