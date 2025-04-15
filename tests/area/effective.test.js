import { describe, expect, it } from 'vitest';

import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import {
  anyHarvestAllowed,
  effectiveClassification,
  standingAt,
} from '../../src/area/effective.js';
import { classificationPeriod, growingArea } from '../../src/area/growingArea.js';
import {
  AREAS,
  B12,
  B12_PLAN,
  B14,
  C3,
  D2,
  D9,
  JUNE_FIRST,
  PLANS,
  STORM,
  at,
} from '../support/register.js';

const ask = (area, moment, extra = {}) =>
  effectiveClassification({
    area,
    plans: PLANS,
    feed: STORM,
    at: at(moment),
    from: JUNE_FIRST,
    ...extra,
  });

describe('an area with no plan of its own', () => {
  it('reads an approved area as approved', () => {
    const answer = ask(C3, '2025-06-11 09:00');
    expect(answer.paper).toBe(APPROVED);
    expect(answer.effective).toBe(APPROVED);
    expect(answer.closed).toBe(false);
    expect(answer.problems.isClean()).toBe(true);
  });

  it('reads a restricted area as restricted, storm or no storm', () => {
    expect(ask(D2, '2025-06-11 09:00').effective).toBe(RESTRICTED);
    expect(ask(D2, '2025-06-20 09:00').effective).toBe(RESTRICTED);
  });

  it('reads a prohibited area as prohibited and allows nothing', () => {
    const answer = ask(D9, '2025-06-11 09:00');
    expect(answer.effective).toBe(PROHIBITED);
    expect(anyHarvestAllowed(answer)).toBe(false);
  });

  it('carries the basis the register recorded', () => {
    expect(ask(C3, '2025-06-11 09:00').basis).toBe('survey');
  });
});

describe('a conditionally approved area', () => {
  it('reads as approved while the plan says open', () => {
    const answer = ask(B12, '2025-06-09 09:00');
    expect(answer.paper).toBe(CONDITIONALLY_APPROVED);
    expect(answer.effective).toBe(APPROVED);
    expect(answer.closed).toBe(false);
  });

  it('reads as prohibited while the plan says closed', () => {
    const answer = ask(B12, '2025-06-11 09:00');
    expect(answer.paper).toBe(CONDITIONALLY_APPROVED);
    expect(answer.effective).toBe(PROHIBITED);
    expect(answer.closed).toBe(true);
    expect(answer.problems.has('area.planClosed')).toBe(true);
  });

  it('comes back to approved once the closure lifts', () => {
    expect(ask(B12, '2025-06-13 09:00').effective).toBe(APPROVED);
  });

  it('names the closure so a notice can cite the rain that caused it', () => {
    const answer = ask(B12, '2025-06-11 09:00');
    expect(answer.closure.firedBy.measured).toBeCloseTo(1.2, 9);
    expect(answer.plan.reference).toBe('15A NCAC 18A .0910');
  });

  it('is not closed by rain on a gauge its plan does not read', () => {
    expect(ask(B14, '2025-06-11 09:00').closed).toBe(false);
  });
});

describe('a conditionally restricted area falls to restricted, not to approved', () => {
  it('reads as restricted while its plan says open', () => {
    expect(ask(B14, '2025-06-11 09:00').effective).toBe(RESTRICTED);
  });

  it('reads as prohibited while its plan says closed', () => {
    const heavy = {
      readings: [...STORM.readings, { gauge: 'MLC', at: at('2025-06-10 03:00'), value: 0.8 }],
    };
    const answer = effectiveClassification({
      area: B14,
      plans: PLANS,
      feed: heavy,
      at: at('2025-06-11 09:00'),
      from: JUNE_FIRST,
    });
    expect(answer.effective).toBe(PROHIBITED);
  });
});

describe('the register defects', () => {
  it('reads a conditional area with no plan as prohibited and says why', () => {
    const answer = effectiveClassification({
      area: B12,
      plans: [],
      feed: STORM,
      at: at('2025-06-09 09:00'),
      from: JUNE_FIRST,
    });
    expect(answer.effective).toBe(PROHIBITED);
    expect(answer.problems.has('area.planMissing')).toBe(true);
    expect(answer.problems.hasError()).toBe(true);
  });

  it('warns about a plan on an area that is not conditional, and ignores it', () => {
    const answer = effectiveClassification({
      area: C3,
      plans: [{ ...B12_PLAN, area: 'C-3' }],
      feed: STORM,
      at: at('2025-06-11 09:00'),
      from: JUNE_FIRST,
    });
    expect(answer.effective).toBe(APPROVED);
    expect(answer.problems.has('area.planWithoutCondition')).toBe(true);
    expect(answer.problems.hasError()).toBe(false);
  });

  it('reads a day the register does not reach as prohibited, and says so', () => {
    const late = growingArea({
      id: 'E-1',
      name: 'New Ground',
      history: [classificationPeriod({ classification: APPROVED, from: '2026-01-01' })],
    });
    const answer = effectiveClassification({
      area: late,
      plans: [],
      feed: {},
      at: at('2025-06-11 09:00'),
      from: JUNE_FIRST,
    });
    expect(answer.paper).toBeNull();
    expect(answer.effective).toBe(PROHIBITED);
    expect(answer.problems.has('area.unclassified')).toBe(true);
  });
});

describe('the standing of every area at one moment', () => {
  it('reports each area once, in register order', () => {
    const standing = standingAt({
      areas: AREAS,
      plans: PLANS,
      feed: STORM,
      at: at('2025-06-11 09:00'),
      from: JUNE_FIRST,
    });
    expect(standing.map((entry) => entry.area)).toEqual(['B-12', 'B-14', 'C-3', 'D-2', 'D-9']);
  });

  it('has the storm shut one area and left the rest alone', () => {
    const standing = standingAt({
      areas: AREAS,
      plans: PLANS,
      feed: STORM,
      at: at('2025-06-11 09:00'),
      from: JUNE_FIRST,
    });
    expect(standing.filter((entry) => entry.closed).map((entry) => entry.area)).toEqual(['B-12']);
  });

  it('reads the same areas differently two days later', () => {
    const later = standingAt({
      areas: AREAS,
      plans: PLANS,
      feed: STORM,
      at: at('2025-06-14 09:00'),
      from: JUNE_FIRST,
    });
    expect(later.filter((entry) => entry.closed)).toEqual([]);
  });
});
