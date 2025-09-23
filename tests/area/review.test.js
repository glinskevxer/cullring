import { describe, expect, it } from 'vitest';

import {
  ANNUAL_REVIEW,
  LATE_AFTER_DAYS,
  PLAN_REVIEW,
  REVIEW_KINDS,
  TRIENNIAL_REAPPRAISAL,
  dueOn,
  intervalDays,
  lastReclassification,
  reviewFindings,
  reviewState,
  reviewsFor,
  soonestDue,
} from '../../src/area/review.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';
import { B12, C3, D9 } from '../support/register.js';

const on = civilDate(2025, 9, 30);

describe('the three clocks', () => {
  it('runs the annual review yearly and the reappraisal every three years', () => {
    expect(intervalDays(ANNUAL_REVIEW)).toBe(365);
    expect(intervalDays(TRIENNIAL_REAPPRAISAL)).toBe(1095);
    expect(intervalDays(PLAN_REVIEW)).toBe(365);
  });

  it('refuses a kind it does not keep and lists the ones it does', () => {
    try {
      intervalDays('whenever somebody asks');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(REVIEW_KINDS.slice());
    }
  });

  it('works the due date out from when it was last done', () => {
    expect(formatCivilDate(dueOn(ANNUAL_REVIEW, civilDate(2024, 6, 1)))).toBe('2025-06-01');
    expect(formatCivilDate(dueOn(TRIENNIAL_REAPPRAISAL, civilDate(2022, 6, 1)))).toBe('2025-05-31');
  });
});

describe('the state of one clock', () => {
  it('is current before the due date', () => {
    const state = reviewState(ANNUAL_REVIEW, civilDate(2025, 6, 1), on);
    expect(state.state).toBe('current');
    expect(state.overdueDays).toBe(0);
  });

  it('is due on the due date itself', () => {
    const state = reviewState(ANNUAL_REVIEW, civilDate(2024, 9, 30), on);
    expect(state.state).toBe('due');
    expect(state.overdueDays).toBe(0);
  });

  it('stays due for the grace period and then goes late', () => {
    const justDue = reviewState(ANNUAL_REVIEW, civilDate(2024, 9, 30 - 0), civilDate(2025, 12, 29));
    expect(justDue.overdueDays).toBe(LATE_AFTER_DAYS);
    expect(justDue.state).toBe('due');
    const late = reviewState(ANNUAL_REVIEW, civilDate(2024, 9, 30), civilDate(2025, 12, 30));
    expect(late.state).toBe('late');
  });

  it('counts how far past due it is', () => {
    const state = reviewState(ANNUAL_REVIEW, civilDate(2023, 1, 1), on);
    expect(state.overdueDays).toBeGreaterThan(600);
    expect(state.state).toBe('late');
  });
});

describe('which clocks apply to an area', () => {
  const dates = {
    on,
    lastReview: civilDate(2025, 6, 1),
    lastSurvey: civilDate(2023, 6, 1),
  };

  it('gives an unconditional area two clocks', () => {
    expect(reviewsFor(C3, dates).map((one) => one.kind)).toEqual([
      ANNUAL_REVIEW,
      TRIENNIAL_REAPPRAISAL,
    ]);
  });

  it('gives a conditional area three', () => {
    expect(reviewsFor(B12, dates).map((one) => one.kind)).toEqual([
      ANNUAL_REVIEW,
      TRIENNIAL_REAPPRAISAL,
      PLAN_REVIEW,
    ]);
  });

  it('falls back to the review date where no plan review was recorded', () => {
    const states = reviewsFor(B12, dates);
    const plan = states.find((one) => one.kind === PLAN_REVIEW);
    expect(plan.lastDone).toEqual(dates.lastReview);
  });

  it('takes a plan review date when one is given', () => {
    const states = reviewsFor(B12, { ...dates, lastPlanReview: civilDate(2024, 1, 1) });
    const plan = states.find((one) => one.kind === PLAN_REVIEW);
    expect(plan.state).toBe('late');
  });

  it('refuses an area with no classification on that day', () => {
    expect(() => reviewsFor(C3, { ...dates, on: civilDate(2000, 1, 1) })).toThrow(
      /is not classified on that day/,
    );
  });
});

describe('the findings a schedule produces', () => {
  const dates = { on, lastReview: civilDate(2025, 6, 1), lastSurvey: civilDate(2023, 6, 1) };

  it('says nothing about a clock that is current', () => {
    const states = reviewsFor(C3, { ...dates, lastSurvey: civilDate(2025, 6, 1) });
    expect(reviewFindings(C3, states).isClean()).toBe(true);
  });

  it('warns about a clock that is merely due', () => {
    const states = [reviewState(ANNUAL_REVIEW, civilDate(2024, 9, 1), on)];
    const problems = reviewFindings(C3, states);
    expect(problems.has('review.due')).toBe(true);
    expect(problems.hasError()).toBe(false);
  });

  it('raises an error for a clock that is late', () => {
    const states = [reviewState(ANNUAL_REVIEW, civilDate(2022, 9, 1), on)];
    const problems = reviewFindings(C3, states);
    expect(problems.has('review.late')).toBe(true);
    expect(problems.hasError()).toBe(true);
  });

  it('names the area and the kind on every finding', () => {
    const states = [reviewState(TRIENNIAL_REAPPRAISAL, civilDate(2018, 9, 1), on)];
    const finding = reviewFindings(D9, states).list()[0];
    expect(finding.detail.area).toBe('D-9');
    expect(finding.detail.kind).toBe(TRIENNIAL_REAPPRAISAL);
  });
});

describe('the clocks a reclassification resets', () => {
  it('reads the reset date off the register rather than off a separate record', () => {
    expect(lastReclassification(B12)).toEqual(civilDate(2022, 1, 1));
    expect(lastReclassification(C3)).toEqual(civilDate(2015, 1, 1));
  });
});

describe('which clock comes round first', () => {
  it('picks the earliest due date', () => {
    const states = reviewsFor(B12, {
      on,
      lastReview: civilDate(2025, 6, 1),
      lastSurvey: civilDate(2023, 6, 1),
    });
    expect(soonestDue(states).kind).toBe(TRIENNIAL_REAPPRAISAL);
  });

  it('answers with nothing where there are no clocks', () => {
    expect(soonestDue([])).toBeNull();
  });
});
