/**
 * When an area is next due to be looked at, and what kind of looking.
 *
 * Three clocks run over every classified area and they do not run at the same
 * rate. The annual review reads the year's samples against the standard. The
 * triennial reappraisal walks the shoreline again. And a conditional area's
 * plan has to be re-examined every year whether anything happened or not,
 * because a plan nobody has read in five years is a plan nobody is operating.
 *
 * What makes this more than three dates is that the clocks reset on different
 * events. The annual review resets when a review happens. The reappraisal
 * resets when a shoreline survey happens. A reclassification resets both,
 * because a reclassification is a review and a survey at once.
 *
 * A due date in the past is not an error and is not the same as a missed one:
 * an area three days over is due, an area three years over is a finding.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { isConditional } from './classification.js';
import { classificationOn, currentPeriod } from './growingArea.js';
import { addDays, compareCivilDate, daysBetween, formatCivilDate } from '../time/civil.js';

export const ANNUAL_REVIEW = 'annual review';
export const TRIENNIAL_REAPPRAISAL = 'triennial reappraisal';
export const PLAN_REVIEW = 'plan review';

export const REVIEW_KINDS = Object.freeze([ANNUAL_REVIEW, TRIENNIAL_REAPPRAISAL, PLAN_REVIEW]);

const INTERVAL_DAYS = Object.freeze({
  [ANNUAL_REVIEW]: 365,
  [TRIENNIAL_REAPPRAISAL]: 1095,
  [PLAN_REVIEW]: 365,
});

/** How far past due an area has to be before it stops being merely due. */
export const LATE_AFTER_DAYS = 90;

export function intervalDays(kind) {
  const days = INTERVAL_DAYS[kind];
  if (days === undefined) {
    throw new InputError('review.kind', `${kind} is not a kind of review`, {
      kind,
      known: REVIEW_KINDS.slice(),
    });
  }
  return days;
}

export function dueOn(kind, lastDone) {
  return addDays(lastDone, intervalDays(kind));
}

/**
 * The state of one clock on a day. It is a word rather than a boolean because
 * three states have to be told apart and a pair of booleans would let a caller
 * hold both at once.
 */
export function reviewState(kind, lastDone, on) {
  const due = dueOn(kind, lastDone);
  const over = daysBetween(due, on);
  if (over < 0) {
    return Object.freeze({ kind, lastDone, due, overdueDays: 0, state: 'current' });
  }
  return Object.freeze({
    kind,
    lastDone,
    due,
    overdueDays: over,
    state: over > LATE_AFTER_DAYS ? 'late' : 'due',
  });
}

/**
 * Every clock that applies to an area. A conditional area carries three and an
 * unconditional one carries two, which is the only place the classification
 * changes what is being asked rather than what the answer is.
 */
export function reviewsFor(area, { on, lastReview, lastSurvey, lastPlanReview = null }) {
  const held = classificationOn(area, on);
  if (held === null) {
    throw new InputError('review.unclassified', `${area.id} is not classified on that day`, {
      area: area.id,
      on: formatCivilDate(on),
    });
  }
  const out = [
    reviewState(ANNUAL_REVIEW, lastReview, on),
    reviewState(TRIENNIAL_REAPPRAISAL, lastSurvey, on),
  ];
  if (isConditional(held)) {
    out.push(reviewState(PLAN_REVIEW, lastPlanReview ?? lastReview, on));
  }
  return Object.freeze(out);
}

/** The findings a schedule produces, which is what the annual report prints. */
export function reviewFindings(area, states) {
  const problems = findings();
  for (const state of states) {
    if (state.state === 'late') {
      problems.error(
        'review.late',
        `${area.id} is ${state.overdueDays} days past its ${state.kind}`,
        { area: area.id, kind: state.kind, overdueDays: state.overdueDays },
      );
    } else if (state.state === 'due') {
      problems.warn('review.due', `${area.id} is due for its ${state.kind}`, {
        area: area.id,
        kind: state.kind,
        due: formatCivilDate(state.due),
      });
    }
  }
  return problems;
}

/**
 * A reclassification resets both the review and the survey clocks, because it
 * cannot happen without both having been done. This is read off the register
 * rather than recorded separately, which is the only way the two cannot drift.
 */
export function lastReclassification(area) {
  const period = currentPeriod(area);
  return period.from;
}

export function soonestDue(states) {
  if (states.length === 0) {
    return null;
  }
  return states.reduce((best, one) => (compareCivilDate(one.due, best.due) < 0 ? one : best));
}
