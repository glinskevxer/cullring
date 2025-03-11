import { describe, expect, it } from 'vitest';

import { AT_LIMIT, HALF_LOWER_LIMIT } from '../../src/survey/statistics.js';
import {
  ADVERSE_POLLUTION,
  CRITERION_GEOMETRIC_MEAN,
  CRITERION_HIGHEST,
  CRITERION_NINETIETH,
  STRATEGIES,
  SYSTEMATIC_RANDOM,
  appliesCriterion,
  censoringFor,
  criteriaFor,
  isSufficient,
  minimumPerStation,
  minimumSamples,
  shortNameOf,
  strategy,
  windowYears,
} from '../../src/survey/strategy.js';

describe('the strategy table', () => {
  it('holds the two programs the office runs', () => {
    expect(STRATEGIES).toEqual([SYSTEMATIC_RANDOM, ADVERSE_POLLUTION]);
  });

  it('reads a name whatever case it arrives in', () => {
    expect(strategy('Systematic Random').name).toBe(SYSTEMATIC_RANDOM);
  });

  it('refuses a name it does not hold and lists the ones it does', () => {
    try {
      strategy('whenever the boat is free', 'surveyStrategy');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('strategy.unknown');
      expect(error.detail.known).toEqual(STRATEGIES.slice());
      expect(error.message).toMatch(/surveyStrategy/);
    }
  });

  it('refuses something that is not a name', () => {
    expect(() => strategy(null)).toThrow(/must name a sampling strategy/);
  });

  it('gives each one a short name for the survey sheet', () => {
    expect(shortNameOf(SYSTEMATIC_RANDOM)).toBe('SRS');
    expect(shortNameOf(ADVERSE_POLLUTION)).toBe('APC');
  });
});

describe('the strategy chooses the censoring policy', () => {
  it('reads bounds at their face value on the routine program', () => {
    expect(censoringFor(SYSTEMATIC_RANDOM)).toBe(AT_LIMIT);
  });

  it('reads a lower bound at half on the adverse program', () => {
    expect(censoringFor(ADVERSE_POLLUTION)).toBe(HALF_LOWER_LIMIT);
  });

  it('does not give the two strategies the same policy', () => {
    expect(censoringFor(SYSTEMATIC_RANDOM)).not.toBe(censoringFor(ADVERSE_POLLUTION));
  });
});

describe('the strategy chooses the criteria', () => {
  it('scores the routine program on the mean and the estimated tail', () => {
    expect(criteriaFor(SYSTEMATIC_RANDOM)).toEqual([CRITERION_GEOMETRIC_MEAN, CRITERION_NINETIETH]);
  });

  it('scores the adverse program on the mean and the highest single result', () => {
    expect(criteriaFor(ADVERSE_POLLUTION)).toEqual([CRITERION_GEOMETRIC_MEAN, CRITERION_HIGHEST]);
  });

  it('does not estimate a tail from a set chosen for being the tail', () => {
    expect(appliesCriterion(ADVERSE_POLLUTION, CRITERION_NINETIETH)).toBe(false);
    expect(appliesCriterion(SYSTEMATIC_RANDOM, CRITERION_NINETIETH)).toBe(true);
  });

  it('applies the geometric mean under both', () => {
    for (const name of STRATEGIES) {
      expect(appliesCriterion(name, CRITERION_GEOMETRIC_MEAN)).toBe(true);
    }
  });

  it('hands back a copy, so a caller cannot edit the table', () => {
    const list = criteriaFor(SYSTEMATIC_RANDOM);
    list.push('made up');
    expect(criteriaFor(SYSTEMATIC_RANDOM)).toHaveLength(2);
  });
});

describe('how much data each strategy wants', () => {
  it('wants thirty routine samples and fifteen adverse ones', () => {
    expect(minimumSamples(SYSTEMATIC_RANDOM)).toBe(30);
    expect(minimumSamples(ADVERSE_POLLUTION)).toBe(15);
  });

  it('wants a floor at every station as well as an overall total', () => {
    expect(minimumPerStation(SYSTEMATIC_RANDOM)).toBe(5);
    expect(minimumPerStation(ADVERSE_POLLUTION)).toBe(3);
  });

  it('reaches back further on the adverse program, because bad days are rare', () => {
    expect(windowYears(ADVERSE_POLLUTION)).toBeGreaterThan(windowYears(SYSTEMATIC_RANDOM));
  });
});

describe('sufficiency is not the same question as compliance', () => {
  it('passes a set that clears both floors', () => {
    const answer = isSufficient(SYSTEMATIC_RANDOM, {
      total: 30,
      perStation: { 'B12-01': 10, 'B12-02': 10, 'B12-03': 10 },
    });
    expect(answer.sufficient).toBe(true);
    expect(answer.thinStations).toEqual([]);
  });

  it('fails a set that is big enough overall but thin at one station', () => {
    const answer = isSufficient(SYSTEMATIC_RANDOM, {
      total: 32,
      perStation: { 'B12-01': 27, 'B12-02': 5, 'B12-03': 0 },
    });
    expect(answer.sufficient).toBe(false);
    expect(answer.thinStations).toEqual(['B12-03']);
  });

  it('fails a set that is thin overall even with every station stocked', () => {
    const answer = isSufficient(SYSTEMATIC_RANDOM, {
      total: 20,
      perStation: { 'B12-01': 10, 'B12-02': 10 },
    });
    expect(answer.sufficient).toBe(false);
    expect(answer.required).toBe(30);
  });

  it('reports the thin stations in order so the report is stable', () => {
    const answer = isSufficient(ADVERSE_POLLUTION, {
      total: 15,
      perStation: { 'B12-03': 1, 'B12-01': 2, 'B12-02': 12 },
    });
    expect(answer.thinStations).toEqual(['B12-01', 'B12-03']);
  });

  it('is content with no station breakdown at all when the total clears', () => {
    expect(isSufficient(ADVERSE_POLLUTION, { total: 15 }).sufficient).toBe(true);
  });

  it('passes the same set under one strategy and fails it under the other', () => {
    const counts = { total: 20, perStation: { 'B12-01': 7, 'B12-02': 7, 'B12-03': 6 } };
    expect(isSufficient(ADVERSE_POLLUTION, counts).sufficient).toBe(true);
    expect(isSufficient(SYSTEMATIC_RANDOM, counts).sufficient).toBe(false);
  });
});
