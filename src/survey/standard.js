/**
 * The numbers, and the fact that they are indexed by two things at once.
 *
 * A standard is not attached to a classification alone. It is attached to a
 * classification and to the analysis the laboratory ran, and the office runs
 * two analyses because the older shellstock work is written in total coliform
 * and everything since is written in fecal coliform. The two scales are an
 * order of magnitude apart, so reading a fecal limit against a total coliform
 * set would pass an area that should close.
 *
 * The conditional classifications carry no numbers of their own. A
 * conditionally approved area meets the approved standard while its plan says
 * open, which is what makes it conditionally approved rather than approved,
 * and the standard it is scored against is therefore the approved one.
 */

import { InputError } from '../core/errors.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
  classification,
} from '../area/classification.js';

export const FECAL_COLIFORM = 'fecal coliform';
export const TOTAL_COLIFORM = 'total coliform';

export const ANALYSES = Object.freeze([FECAL_COLIFORM, TOTAL_COLIFORM]);

const LIMITS = new Map([
  [`${APPROVED}|${FECAL_COLIFORM}`, { geometricMean: 14, ninetieth: 43, highest: 43 }],
  [`${RESTRICTED}|${FECAL_COLIFORM}`, { geometricMean: 88, ninetieth: 260, highest: 260 }],
  [`${APPROVED}|${TOTAL_COLIFORM}`, { geometricMean: 70, ninetieth: 330, highest: 330 }],
  [`${RESTRICTED}|${TOTAL_COLIFORM}`, { geometricMean: 700, ninetieth: 3300, highest: 3300 }],
]);

export function analysis(name, field = 'analysis') {
  if (typeof name !== 'string') {
    throw new InputError('analysis.type', `${field} must name an analysis`, {
      field,
      saw: typeof name,
    });
  }
  const cleaned = name.trim().toLowerCase();
  if (!ANALYSES.includes(cleaned)) {
    throw new InputError(
      'analysis.unknown',
      `${field} ${name} is not an analysis this program reads`,
      {
        field,
        value: name,
        known: ANALYSES.slice(),
      },
    );
  }
  return cleaned;
}

/**
 * The class whose numbers a given class is scored against. A conditional class
 * borrows the numbers of its open twin, because that is the water it is
 * supposed to be while it is open.
 */
export function scoringClassFor(name) {
  const row = classification(name);
  if (row.name === CONDITIONALLY_APPROVED) {
    return APPROVED;
  }
  if (row.name === CONDITIONALLY_RESTRICTED) {
    return RESTRICTED;
  }
  return row.name;
}

/** Null for prohibited, which is not a standard anything can meet. */
export function limitsFor(classificationName, analysisName) {
  const scoring = scoringClassFor(classificationName);
  if (scoring === PROHIBITED) {
    return null;
  }
  const limits = LIMITS.get(`${scoring}|${analysis(analysisName)}`);
  if (limits === undefined) {
    throw new InputError(
      'standard.missing',
      `no standard is written for ${scoring} under ${analysisName}`,
      { classification: scoring, analysis: analysisName },
    );
  }
  return Object.freeze({ ...limits, classification: scoring, analysis: analysis(analysisName) });
}

/** The classes that have numbers, most permissive first. */
export function scorableClassifications() {
  return [APPROVED, RESTRICTED];
}

export function limitLabel(criterion) {
  return criterion;
}
