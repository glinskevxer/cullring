import { describe, expect, it } from 'vitest';

import {
  describePlan,
  describeTrigger,
  isInForce,
  managementPlan,
  planInForce,
  plansFor,
} from '../../src/condition/plan.js';
import { afterHours, afterSamples, onDate } from '../../src/condition/reopening.js';
import {
  bypassTrigger,
  rainfallTrigger,
  seasonTrigger,
  stageTrigger,
} from '../../src/condition/trigger.js';
import { civilDate } from '../../src/time/civil.js';

const rain = rainfallTrigger({ gauge: 'BRD', inches: 1, overHours: 24 });

const B12 = managementPlan({
  area: 'B-12',
  trigger: rain,
  reopening: afterHours(72),
  effectiveFrom: '2024-01-01',
  effectiveTo: '2025-06-30',
});

const B12_NEW = managementPlan({
  area: 'B-12',
  trigger: rainfallTrigger({ gauge: 'BRD', inches: 0.75, overHours: 24 }),
  reopening: afterSamples(2),
  effectiveFrom: '2025-07-01',
});

const C3 = managementPlan({
  area: 'C-3',
  trigger: seasonTrigger({ from: '2025-05-15', to: '2025-09-15' }),
  reopening: onDate('2025-09-16'),
  effectiveFrom: '2025-01-01',
});

describe('building a plan', () => {
  it('holds one area, one trigger and one reopening rule', () => {
    expect(B12.area).toBe('B-12');
    expect(B12.trigger.kind).toBe('rainfall');
    expect(B12.reopening.kind).toBe('after hours');
  });

  it('normalises the area number', () => {
    const plan = managementPlan({
      area: ' b-07 ',
      trigger: rain,
      reopening: afterHours(72),
      effectiveFrom: '2025-01-01',
    });
    expect(plan.area).toBe('B-7');
  });

  it('refuses a plan with no trigger, or with something that is not one', () => {
    expect(() =>
      managementPlan({ area: 'B-12', reopening: afterHours(72), effectiveFrom: '2025-01-01' }),
    ).toThrow(/carries one trigger/);
    expect(() =>
      managementPlan({
        area: 'B-12',
        trigger: { kind: 'moon phase' },
        reopening: afterHours(72),
        effectiveFrom: '2025-01-01',
      }),
    ).toThrow(/carries one trigger/);
  });

  it('refuses a plan with no reopening rule', () => {
    expect(() =>
      managementPlan({ area: 'B-12', trigger: rain, effectiveFrom: '2025-01-01' }),
    ).toThrow(/not a way of reopening/);
  });

  it('refuses a plan that stops before it starts', () => {
    expect(() =>
      managementPlan({
        area: 'B-12',
        trigger: rain,
        reopening: afterHours(72),
        effectiveFrom: '2025-06-01',
        effectiveTo: '2025-01-01',
      }),
    ).toThrow(/stop being in force before it starts/);
  });

  it('allows a plan with no end, which is the ordinary case', () => {
    expect(B12_NEW.effectiveTo).toBeNull();
  });
});

describe('which plan is in force', () => {
  it('reads the ends as inclusive on both sides', () => {
    expect(isInForce(B12, civilDate(2024, 1, 1))).toBe(true);
    expect(isInForce(B12, civilDate(2025, 6, 30))).toBe(true);
    expect(isInForce(B12, civilDate(2023, 12, 31))).toBe(false);
    expect(isInForce(B12, civilDate(2025, 7, 1))).toBe(false);
  });

  it('treats an open ended plan as running forever forward', () => {
    expect(isInForce(B12_NEW, civilDate(2099, 1, 1))).toBe(true);
    expect(isInForce(B12_NEW, civilDate(2025, 6, 30))).toBe(false);
  });

  it('picks the plan in force on a day', () => {
    expect(planInForce([B12, B12_NEW, C3], 'B-12', civilDate(2025, 3, 1))).toBe(B12);
    expect(planInForce([B12, B12_NEW, C3], 'B-12', civilDate(2025, 8, 1))).toBe(B12_NEW);
  });

  it('answers with nothing where no plan covers the day', () => {
    expect(planInForce([B12, B12_NEW], 'B-12', civilDate(2023, 1, 1))).toBeNull();
    expect(planInForce([B12, B12_NEW], 'B-99', civilDate(2025, 3, 1))).toBeNull();
  });

  it('refuses two plans in force at once, which is a defect in the register', () => {
    const overlapping = managementPlan({
      area: 'B-12',
      trigger: rain,
      reopening: afterHours(24),
      effectiveFrom: '2025-01-01',
    });
    expect(() => planInForce([B12, overlapping], 'B-12', civilDate(2025, 3, 1))).toThrow(
      /more than one plan in force/,
    );
  });

  it('lists the plans for an area in date order', () => {
    expect(plansFor([B12_NEW, C3, B12], 'B-12').map((plan) => plan.reopening.kind)).toEqual([
      'after hours',
      'after samples',
    ]);
  });
});

describe('describing a plan', () => {
  it('names both instruments in one line', () => {
    expect(describePlan(B12)).toBe(
      'B-12: closes on 1 inches at BRD over 24 hours, reopens after 72 hours',
    );
  });

  it('describes each kind of trigger in its own terms', () => {
    expect(describeTrigger(rain)).toMatch(/inches at BRD/);
    expect(describeTrigger(stageTrigger({ gauge: 'PPR', feet: 8 }))).toBe('PPR reaching 8 feet');
    expect(describeTrigger(bypassTrigger({ facility: 'WWTP-3' }))).toBe(
      'a bypass reported at WWTP-3',
    );
    expect(describeTrigger(C3.trigger)).toBe('the season from 2025-05-15 to 2025-09-15');
  });
});
