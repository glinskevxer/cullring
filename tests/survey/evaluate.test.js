import { describe, expect, it } from 'vitest';

import { APPROVED, PROHIBITED, RESTRICTED } from '../../src/area/classification.js';
import {
  evaluateSurvey,
  scoreAgainst,
  supportedClassification,
} from '../../src/survey/evaluate.js';
import { FECAL_COLIFORM, TOTAL_COLIFORM } from '../../src/survey/standard.js';
import { ADVERSE_POLLUTION, SYSTEMATIC_RANDOM } from '../../src/survey/strategy.js';
import {
  CLEAN_THIRTY,
  EVEN_STATIONS,
  FOUL_THIRTY,
  MIDDLING_THIRTY,
  flat,
  read,
} from '../support/sets.js';

const routine = { analysis: FECAL_COLIFORM, strategy: SYSTEMATIC_RANDOM };
const adverse = { analysis: FECAL_COLIFORM, strategy: ADVERSE_POLLUTION };

describe('scoring one set against one class', () => {
  it('passes clean water against the approved standard', () => {
    const score = scoreAgainst(CLEAN_THIRTY, { ...routine, classification: APPROVED });
    expect(score.met).toBe(true);
    expect(score.criteria).toHaveLength(2);
    expect(score.criteria.every((entry) => entry.met)).toBe(true);
  });

  it('fails middling water against approved and passes it against restricted', () => {
    expect(scoreAgainst(MIDDLING_THIRTY, { ...routine, classification: APPROVED }).met).toBe(false);
    expect(scoreAgainst(MIDDLING_THIRTY, { ...routine, classification: RESTRICTED }).met).toBe(
      true,
    );
  });

  it('names the criterion, the value and the limit for each test it ran', () => {
    const score = scoreAgainst(MIDDLING_THIRTY, { ...routine, classification: APPROVED });
    const failed = score.criteria.filter((entry) => !entry.met);
    expect(failed.length).toBeGreaterThan(0);
    for (const entry of failed) {
      expect(entry.value).toBeGreaterThan(entry.limit);
    }
  });

  it('scores prohibited water against nothing at all', () => {
    const score = scoreAgainst(CLEAN_THIRTY, { ...routine, classification: PROHIBITED });
    expect(score.met).toBe(false);
    expect(score.criteria).toEqual([]);
    expect(score.reason).toMatch(/not scored against a standard/);
  });

  it('applies the criteria the strategy names and no others', () => {
    const one = scoreAgainst(CLEAN_THIRTY, { ...routine, classification: APPROVED });
    const two = scoreAgainst(CLEAN_THIRTY, { ...adverse, classification: APPROVED });
    expect(one.criteria.map((entry) => entry.criterion)).toEqual([
      'geometric mean',
      'estimated ninetieth percentile',
    ]);
    expect(two.criteria.map((entry) => entry.criterion)).toEqual([
      'geometric mean',
      'highest single result',
    ]);
  });

  it('reads the set through the strategy censoring policy, so the numbers differ', () => {
    const one = scoreAgainst(CLEAN_THIRTY, { ...routine, classification: APPROVED });
    const two = scoreAgainst(CLEAN_THIRTY, { ...adverse, classification: APPROVED });
    expect(two.described.geometricMean).toBeLessThan(one.described.geometricMean);
  });

  it('scores the same set differently under the two analyses', () => {
    const fecal = scoreAgainst(MIDDLING_THIRTY, { ...routine, classification: APPROVED });
    const total = scoreAgainst(MIDDLING_THIRTY, {
      ...routine,
      analysis: TOTAL_COLIFORM,
      classification: APPROVED,
    });
    expect(fecal.met).toBe(false);
    expect(total.met).toBe(true);
  });
});

describe('the walk down the table', () => {
  it('stops at approved for clean water', () => {
    const walk = supportedClassification(CLEAN_THIRTY, routine);
    expect(walk.supported).toBe(APPROVED);
    expect(walk.steps).toHaveLength(1);
  });

  it('walks past approved to restricted for middling water', () => {
    const walk = supportedClassification(MIDDLING_THIRTY, routine);
    expect(walk.supported).toBe(RESTRICTED);
    expect(walk.steps).toHaveLength(2);
    expect(walk.steps[0].met).toBe(false);
    expect(walk.steps[1].met).toBe(true);
  });

  it('falls off the end to prohibited when nothing is met', () => {
    const walk = supportedClassification(FOUL_THIRTY, routine);
    expect(walk.supported).toBe(PROHIBITED);
    expect(walk.score).toBeNull();
    expect(walk.steps.every((step) => !step.met)).toBe(true);
  });

  it('gives the same answer whatever class the area is currently held to', () => {
    const first = supportedClassification(MIDDLING_THIRTY, routine).supported;
    for (const heldTo of [APPROVED, RESTRICTED, PROHIBITED]) {
      const answer = evaluateSurvey({
        results: MIDDLING_THIRTY,
        heldTo,
        perStation: EVEN_STATIONS,
        ...routine,
      });
      expect(answer.supported).toBe(first);
    }
  });

  it('settles in one pass, because the walk never revisits a class', () => {
    for (const set of [CLEAN_THIRTY, MIDDLING_THIRTY, FOUL_THIRTY]) {
      const walk = supportedClassification(set, routine);
      const seen = walk.steps.map((step) => step.classification);
      expect(new Set(seen).size).toBe(seen.length);
    }
  });
});

describe('the survey verdict', () => {
  it('reports an area that meets what it is held to', () => {
    const answer = evaluateSurvey({
      results: CLEAN_THIRTY,
      heldTo: APPROVED,
      perStation: EVEN_STATIONS,
      ...routine,
    });
    expect(answer.meetsHeld).toBe(true);
    expect(answer.supported).toBe(APPROVED);
    expect(answer.problems.isClean()).toBe(true);
  });

  it('reports an area held to a class its water no longer supports', () => {
    const answer = evaluateSurvey({
      results: MIDDLING_THIRTY,
      heldTo: APPROVED,
      perStation: EVEN_STATIONS,
      ...routine,
    });
    expect(answer.meetsHeld).toBe(false);
    expect(answer.supported).toBe(RESTRICTED);
    expect(answer.problems.hasError()).toBe(true);
    expect(answer.problems.has('survey.overLimit')).toBe(true);
  });

  it('says nothing about a class when the set is too thin to say anything', () => {
    const answer = evaluateSurvey({
      results: flat('<1.8', 10),
      heldTo: APPROVED,
      perStation: { 'B12-01': 10 },
      ...routine,
    });
    expect(answer.supported).toBeNull();
    expect(answer.meetsHeld).toBeNull();
    expect(answer.problems.has('survey.thin')).toBe(true);
    expect(answer.problems.hasError()).toBe(false);
  });

  it('treats a thin set as a warning rather than a failure, which are different things', () => {
    const thin = evaluateSurvey({
      results: read(['1600', '1600', '1600']),
      heldTo: APPROVED,
      perStation: { 'B12-01': 3 },
      ...routine,
    });
    expect(thin.problems.isLawful()).toBe(true);
    expect(thin.supported).toBeNull();
  });

  it('raises one finding per criterion that went over', () => {
    const answer = evaluateSurvey({
      results: FOUL_THIRTY,
      heldTo: APPROVED,
      perStation: EVEN_STATIONS,
      ...routine,
    });
    expect(answer.problems.of('error')).toHaveLength(2);
  });
});
