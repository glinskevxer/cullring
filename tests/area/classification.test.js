import { describe, expect, it } from 'vitest';

import {
  APPROVED,
  CLASSIFICATIONS,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
  classification,
  compareClassification,
  harvestAllowed,
  isConditional,
  isMorePermissive,
  rankOf,
  shortName,
  stricter,
  strictestOf,
  treatmentRequired,
  whenPlanClosed,
  whenPlanOpen,
} from '../../src/area/classification.js';

describe('the table', () => {
  it('holds five classifications in order of permissiveness', () => {
    expect(CLASSIFICATIONS).toHaveLength(5);
    expect(CLASSIFICATIONS[0]).toBe(APPROVED);
    expect(CLASSIFICATIONS[4]).toBe(PROHIBITED);
    expect(CLASSIFICATIONS.map(rankOf)).toEqual([0, 1, 2, 3, 4]);
  });

  it('reads a name whatever case and spacing it arrives in', () => {
    expect(classification('  Approved ').name).toBe(APPROVED);
    expect(classification('CONDITIONALLY APPROVED').name).toBe(CONDITIONALLY_APPROVED);
  });

  it('refuses a word that is not a classification and lists the five', () => {
    try {
      classification('open', 'areaClass');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('class.unknown');
      expect(error.detail.known).toEqual(CLASSIFICATIONS.slice());
      expect(error.message).toMatch(/areaClass/);
    }
  });

  it('refuses something that is not written text', () => {
    expect(() => classification(1)).toThrow(/must be one of the five/);
  });

  it('gives each one a short name for the chart', () => {
    expect(CLASSIFICATIONS.map(shortName)).toEqual(['APP', 'CA', 'RES', 'CR', 'PRO']);
  });
});

describe('ordering', () => {
  it('reads approved as more permissive than everything else', () => {
    for (const name of CLASSIFICATIONS.slice(1)) {
      expect(isMorePermissive(APPROVED, name)).toBe(true);
      expect(compareClassification(APPROVED, name)).toBeLessThan(0);
    }
  });

  it('does not call a class more permissive than itself', () => {
    expect(isMorePermissive(RESTRICTED, RESTRICTED)).toBe(false);
    expect(compareClassification(RESTRICTED, RESTRICTED)).toBe(0);
  });

  it('takes the stricter of two in either order', () => {
    expect(stricter(APPROVED, RESTRICTED)).toBe(RESTRICTED);
    expect(stricter(RESTRICTED, APPROVED)).toBe(RESTRICTED);
    expect(stricter(RESTRICTED, RESTRICTED)).toBe(RESTRICTED);
  });

  it('folds a list down to the strictest', () => {
    expect(strictestOf([APPROVED, RESTRICTED, CONDITIONALLY_APPROVED])).toBe(RESTRICTED);
    expect(strictestOf([APPROVED])).toBe(APPROVED);
    expect(strictestOf(CLASSIFICATIONS.slice())).toBe(PROHIBITED);
  });

  it('refuses to fold an empty list, because there is no answer', () => {
    expect(() => strictestOf([])).toThrow(/strictest of nothing/);
  });
});

describe('what each class allows', () => {
  it.each([
    [APPROVED, true, null],
    [CONDITIONALLY_APPROVED, true, null],
    [RESTRICTED, true, 'relay or depuration'],
    [CONDITIONALLY_RESTRICTED, true, 'relay or depuration'],
    [PROHIBITED, false, null],
  ])('reads %s', (name, allowed, treatment) => {
    expect(harvestAllowed(name)).toBe(allowed);
    expect(treatmentRequired(name)).toBe(treatment);
  });

  it('knows which two carry a management plan', () => {
    expect(CLASSIFICATIONS.filter(isConditional)).toEqual([
      CONDITIONALLY_APPROVED,
      CONDITIONALLY_RESTRICTED,
    ]);
  });
});

describe('what a conditional class becomes', () => {
  it('drops to prohibited when the plan says closed, from either conditional class', () => {
    expect(whenPlanClosed(CONDITIONALLY_APPROVED)).toBe(PROHIBITED);
    expect(whenPlanClosed(CONDITIONALLY_RESTRICTED)).toBe(PROHIBITED);
  });

  it('rises to its unconditional twin when the plan says open', () => {
    expect(whenPlanOpen(CONDITIONALLY_APPROVED)).toBe(APPROVED);
    expect(whenPlanOpen(CONDITIONALLY_RESTRICTED)).toBe(RESTRICTED);
  });

  it('refuses to ask the question of a class with no plan', () => {
    for (const name of [APPROVED, RESTRICTED, PROHIBITED]) {
      expect(() => whenPlanClosed(name)).toThrow(/carries no management plan/);
      expect(() => whenPlanOpen(name)).toThrow(/carries no management plan/);
    }
  });

  it('is stricter closed than open in both cases, which is the point of the plan', () => {
    for (const name of [CONDITIONALLY_APPROVED, CONDITIONALLY_RESTRICTED]) {
      expect(compareClassification(whenPlanOpen(name), whenPlanClosed(name))).toBeLessThan(0);
    }
  });
});
