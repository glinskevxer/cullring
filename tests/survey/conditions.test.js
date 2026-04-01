import { describe, expect, it } from 'vitest';

import {
  NOT_MEASURED,
  NOT_QUALIFIED,
  NO_PLAN,
  QUALIFIED,
  conditionFindings,
  conditionedSet,
  dayOf,
  qualify,
  qualifiedSamples,
  qualifySet,
} from '../../src/survey/conditions.js';
import { ADVERSE_POLLUTION, SYSTEMATIC_RANDOM } from '../../src/survey/strategy.js';
import { managementPlan } from '../../src/condition/plan.js';
import { afterHours } from '../../src/condition/reopening.js';
import { rainfallTrigger } from '../../src/condition/trigger.js';
import { reading } from '../../src/weather/gauge.js';
import { sample } from '../../src/survey/result.js';
import { civilDate } from '../../src/time/civil.js';
import { formatInstant } from '../../src/time/instant.js';
import { lengthHours } from '../../src/time/window.js';

const PLAN = managementPlan({
  area: 'B-12',
  trigger: rainfallTrigger({ gauge: 'NEU', inches: 1.5, overHours: 24 }),
  reopening: afterHours(72),
  effectiveFrom: '2024-01-01',
});

const rain = (stamp, value) => reading({ gauge: 'NEU', at: stamp, value, zone: 'eastern' });

const FEED = {
  readings: [
    rain('2025-05-01 06:00', 0.1),
    rain('2025-05-01 18:00', 0.2),
    rain('2025-06-10 06:00', 1.0),
    rain('2025-06-10 12:00', 0.9),
  ],
  bypasses: [],
};

const wet = sample({ station: 'B12-01', collectedOn: '2025-06-10', result: 40 });
const dry = sample({ station: 'B12-01', collectedOn: '2025-05-01', result: 4 });
const blank = sample({ station: 'B12-01', collectedOn: '2025-07-04', result: 6 });

describe('dayOf', () => {
  it('runs midnight to midnight in the area zone', () => {
    const span = dayOf('eastern', civilDate(2025, 6, 10));
    expect(formatInstant('eastern', span.start)).toContain('2025-06-10 00:00');
    expect(lengthHours(span)).toBe(24);
  });

  it('is twenty five hours long on the day the clocks go back', () => {
    expect(lengthHours(dayOf('eastern', civilDate(2025, 11, 2)))).toBe(25);
  });
});

describe('qualify', () => {
  it('keeps a sample taken on a day the trigger was firing', () => {
    const verdict = qualify(wet, { plan: PLAN, feed: FEED });
    expect(verdict.verdict).toBe(QUALIFIED);
    expect(verdict.measured).toBeCloseTo(1.9, 5);
    expect(verdict.threshold).toBe(1.5);
    expect(verdict.at).not.toBe(null);
  });

  it('drops a sample taken on a quiet day', () => {
    expect(qualify(dry, { plan: PLAN, feed: FEED }).verdict).toBe(NOT_QUALIFIED);
  });

  it('says the instrument reported nothing rather than calling the day quiet', () => {
    expect(qualify(blank, { plan: PLAN, feed: FEED }).verdict).toBe(NOT_MEASURED);
  });

  it('says so when there is no plan to be adverse to', () => {
    expect(qualify(wet, { plan: null, feed: FEED }).verdict).toBe(NO_PLAN);
  });
});

describe('qualifySet', () => {
  it('reads the plan in force on each sample day, not the one in force now', () => {
    const older = managementPlan({
      area: 'B-12',
      trigger: rainfallTrigger({ gauge: 'NEU', inches: 0.2, overHours: 24 }),
      reopening: afterHours(72),
      effectiveFrom: '2024-01-01',
      effectiveTo: '2025-05-31',
    });
    const newer = managementPlan({
      area: 'B-12',
      trigger: rainfallTrigger({ gauge: 'NEU', inches: 1.5, overHours: 24 }),
      reopening: afterHours(72),
      effectiveFrom: '2025-06-01',
    });
    const verdicts = qualifySet([dry, wet], {
      plans: [older, newer],
      area: 'B-12',
      feed: FEED,
    });
    expect(verdicts.map((one) => one.verdict)).toEqual([QUALIFIED, QUALIFIED]);
  });

  it('hands back only the samples the standard may read', () => {
    const kept = qualifiedSamples([dry, wet, blank], {
      plans: [PLAN],
      area: 'B-12',
      feed: FEED,
    });
    expect(kept).toEqual([wet]);
  });
});

describe('conditionedSet', () => {
  const built = (strategy, samples) =>
    conditionedSet(samples, { strategy, plans: [PLAN], area: 'B-12', feed: FEED });

  it('leaves a systematic survey alone and says why', () => {
    const answer = built(SYSTEMATIC_RANDOM, [dry, wet, blank]);
    expect(answer.enforced).toBe(false);
    expect(answer.kept).toHaveLength(3);
    expect(answer.because).toContain('the weather has no say');
  });

  it('enforces the condition on an adverse survey', () => {
    const answer = built(ADVERSE_POLLUTION, [dry, wet, blank]);
    expect(answer.enforced).toBe(true);
    expect(answer.kept).toEqual([wet]);
    expect(answer.dropped.map((one) => one.why.verdict)).toEqual([NOT_QUALIFIED, NOT_MEASURED]);
  });

  it('keeps a verdict for every sample so nothing goes missing quietly', () => {
    const answer = built(ADVERSE_POLLUTION, [dry, wet, blank]);
    expect(answer.verdicts).toHaveLength(3);
    expect(answer.kept.length + answer.dropped.length).toBe(3);
  });
});

describe('conditionFindings', () => {
  const findingsFor = (strategy, samples, plans = [PLAN], extra = {}) =>
    conditionFindings(
      conditionedSet(samples, { strategy, plans, area: 'B-12', feed: FEED, ...extra }),
      { area: 'B-12' },
    );

  it('says nothing at all about a systematic survey', () => {
    expect(findingsFor(SYSTEMATIC_RANDOM, [dry, blank]).isClean()).toBe(true);
  });

  it('says nothing about an adverse survey that qualifies whole', () => {
    expect(findingsFor(ADVERSE_POLLUTION, [wet]).isClean()).toBe(true);
  });

  it('warns about the quiet days and names them', () => {
    const problems = findingsFor(ADVERSE_POLLUTION, [dry, wet]);
    expect(problems.codes()).toEqual(['conditions.quietDay']);
    expect(problems.list()[0].detail.days).toEqual(['2025-05-01']);
  });

  it('keeps the unmeasured days apart from the quiet ones', () => {
    const problems = findingsFor(ADVERSE_POLLUTION, [blank, wet]);
    expect(problems.codes()).toEqual(['conditions.unmeasured']);
  });

  it('calls a survey with nothing qualifying an error, not a thin pass', () => {
    const problems = findingsFor(ADVERSE_POLLUTION, [dry, blank]);
    expect(problems.codes()).toContain('conditions.noneQualified');
    expect(problems.hasError()).toBe(true);
  });

  it('refuses an adverse survey of an area with no plan in force that day', () => {
    const problems = findingsFor(ADVERSE_POLLUTION, [wet], [], { enforce: true });
    expect(problems.codes()).toContain('conditions.noPlan');
  });

  it('says the condition was never checked rather than passing it quietly', () => {
    const problems = findingsFor(ADVERSE_POLLUTION, [dry, wet], []);
    expect(problems.codes()).toEqual(['conditions.notChecked']);
    expect(problems.hasError()).toBe(false);
  });

  it('has nothing to say about an empty set', () => {
    expect(findingsFor(ADVERSE_POLLUTION, []).isClean()).toBe(true);
  });
});

describe('whether the condition is checked at all', () => {
  it('does not check what it was given no plan to check against', () => {
    const answer = conditionedSet([dry, wet], {
      strategy: ADVERSE_POLLUTION,
      plans: [],
      area: 'B-12',
      feed: FEED,
    });
    expect(answer.checked).toBe(false);
    expect(answer.applicable).toBe(true);
    expect(answer.kept).toHaveLength(2);
    expect(answer.because).toContain('nothing was supplied');
  });

  it('checks when a caller insists, and then drops what does not qualify', () => {
    const answer = conditionedSet([dry, wet], {
      strategy: ADVERSE_POLLUTION,
      plans: [PLAN],
      area: 'B-12',
      feed: FEED,
      enforce: true,
    });
    expect(answer.checked).toBe(true);
    expect(answer.kept).toEqual([wet]);
  });

  it('never calls a systematic survey applicable, which is a different thing from unchecked', () => {
    const answer = conditionedSet([dry], {
      strategy: SYSTEMATIC_RANDOM,
      plans: [PLAN],
      area: 'B-12',
      feed: FEED,
    });
    expect(answer.applicable).toBe(false);
    expect(answer.checked).toBe(false);
  });
});
