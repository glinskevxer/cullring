/**
 * Whether a result may be used at all, which is asked before it is scored.
 *
 * A sample that sat in the back of a truck for a day is not a bad result: it
 * is not a result. The laboratory records when it was collected and when it
 * went on the bench, and a gap longer than the holding time voids it. So does
 * a temperature outside the range on the way, and so does a method the
 * programme does not recognise.
 *
 * This matters more than it looks because it moves the count. A survey of
 * thirty samples of which four are void is a survey of twenty six, and twenty
 * six is under the floor for the routine programme. The area is then not
 * failing: it is unscoreable, which is a different finding and a different
 * thing to do about it.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireNumber } from '../core/assert.js';
import { hoursBetween, isInstant } from '../time/instant.js';
import { FECAL_COLIFORM, TOTAL_COLIFORM } from './standard.js';

/** The hours between collection and the bench that the method allows. */
export const HOLDING_HOURS = 24;

/** The range the sample has to be carried in, in degrees. */
export const CARRIAGE_LOW = 0;
export const CARRIAGE_HIGH = 10;

export const FIVE_TUBE = 'five tube decimal dilution';
export const THREE_TUBE = 'three tube decimal dilution';
export const MEMBRANE = 'membrane filtration';

export const METHODS = Object.freeze([FIVE_TUBE, THREE_TUBE, MEMBRANE]);

/** Which analyses each method is accepted for. */
const ACCEPTED_FOR = new Map([
  [FIVE_TUBE, [FECAL_COLIFORM, TOTAL_COLIFORM]],
  [THREE_TUBE, [TOTAL_COLIFORM]],
  [MEMBRANE, [FECAL_COLIFORM]],
]);

export function acceptedFor(method) {
  const list = ACCEPTED_FOR.get(method);
  if (list === undefined) {
    throw new InputError('laboratory.method', `${method} is not a method this programme reads`, {
      method,
      known: METHODS.slice(),
    });
  }
  return list.slice();
}

/**
 * Check one submission. Everything that can void a result is checked, not just
 * the first: a sample that was both late and warm is two problems with the run
 * that carried it, and the laboratory would rather hear both.
 */
export function checkSubmission({
  station,
  analysis,
  method,
  collectedAt,
  benchedAt,
  carriageDegrees = null,
}) {
  const problems = findings();
  if (!isInstant(collectedAt) || !isInstant(benchedAt)) {
    problems.error('laboratory.time', 'a submission carries two instants', { station });
    return sealed({ station, method, analysis, problems });
  }
  const held = hoursBetween(collectedAt, benchedAt);
  if (held < 0) {
    problems.error('laboratory.order', `${station} went on the bench before it was collected`, {
      station,
    });
  } else if (held > HOLDING_HOURS) {
    problems.error(
      'laboratory.overHeld',
      `${station} was held ${round(held)} hours against ${HOLDING_HOURS}`,
      { station, held, limit: HOLDING_HOURS },
    );
  }
  if (carriageDegrees !== null) {
    requireNumber(carriageDegrees, 'carriageDegrees');
    if (carriageDegrees < CARRIAGE_LOW || carriageDegrees > CARRIAGE_HIGH) {
      problems.error(
        'laboratory.carriage',
        `${station} was carried at ${carriageDegrees} degrees, outside ${CARRIAGE_LOW} to ${CARRIAGE_HIGH}`,
        { station, degrees: carriageDegrees },
      );
    }
  } else {
    problems.warn('laboratory.noCarriage', `${station} carries no carriage temperature`, {
      station,
    });
  }
  let accepted = [];
  try {
    accepted = acceptedFor(method);
  } catch (error) {
    problems.error('laboratory.method', error.message, { station, method });
    return sealed({ station, method, analysis, problems, heldHours: held });
  }
  if (!accepted.includes(analysis)) {
    problems.error('laboratory.methodMismatch', `${method} is not accepted for ${analysis}`, {
      station,
      method,
      analysis,
      accepted,
    });
  }
  return sealed({ station, method, analysis, problems, heldHours: held });
}

function sealed({ station, method, analysis, problems, heldHours = null }) {
  return Object.freeze({
    station,
    method,
    analysis,
    heldHours,
    usable: problems.isLawful(),
    problems,
  });
}

/**
 * Split a set of submissions into what may be scored and what may not. The
 * void ones are returned rather than dropped, because a survey that cannot be
 * scored has to be able to say why.
 */
export function partition(submissions) {
  const usable = [];
  const void_ = [];
  for (const one of submissions) {
    (one.usable ? usable : void_).push(one);
  }
  return Object.freeze({ usable: Object.freeze(usable), voided: Object.freeze(void_) });
}

function round(value) {
  return Math.round(value * 10) / 10;
}
