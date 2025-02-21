/**
 * The five classifications, and the table every other rule reads through.
 *
 * A classification is not a label on an area. It is the thing that decides
 * which bacteriological standard the area's samples are judged against, what
 * may be taken out of the water, and what has to happen to the product before
 * anybody eats it. Three separate rule modules ask this table a question, and
 * they ask it about the same five words.
 *
 * The order matters. Approved is the most permissive and prohibited the least,
 * and the reclassification walk needs to be able to say that one class is
 * below another without a chain of comparisons at every call site.
 */

import { InputError } from '../core/errors.js';

export const APPROVED = 'approved';
export const CONDITIONALLY_APPROVED = 'conditionally approved';
export const RESTRICTED = 'restricted';
export const CONDITIONALLY_RESTRICTED = 'conditionally restricted';
export const PROHIBITED = 'prohibited';

/** Most permissive first. The index is the rank. */
export const CLASSIFICATIONS = Object.freeze([
  APPROVED,
  CONDITIONALLY_APPROVED,
  RESTRICTED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
]);

const TABLE = new Map([
  [
    APPROVED,
    {
      name: APPROVED,
      rank: 0,
      conditional: false,
      harvestAllowed: true,
      treatment: null,
      shortName: 'APP',
      note: 'direct marketing',
    },
  ],
  [
    CONDITIONALLY_APPROVED,
    {
      name: CONDITIONALLY_APPROVED,
      rank: 1,
      conditional: true,
      harvestAllowed: true,
      treatment: null,
      shortName: 'CA',
      note: 'direct marketing while the plan says open',
    },
  ],
  [
    RESTRICTED,
    {
      name: RESTRICTED,
      rank: 2,
      conditional: false,
      harvestAllowed: true,
      treatment: 'relay or depuration',
      shortName: 'RES',
      note: 'no direct marketing',
    },
  ],
  [
    CONDITIONALLY_RESTRICTED,
    {
      name: CONDITIONALLY_RESTRICTED,
      rank: 3,
      conditional: true,
      harvestAllowed: true,
      treatment: 'relay or depuration',
      shortName: 'CR',
      note: 'no direct marketing, and only while the plan says open',
    },
  ],
  [
    PROHIBITED,
    {
      name: PROHIBITED,
      rank: 4,
      conditional: false,
      harvestAllowed: false,
      treatment: null,
      shortName: 'PRO',
      note: 'no harvest for any purpose but seed and relay under permit',
    },
  ],
]);

export function classification(name, field = 'classification') {
  if (typeof name !== 'string') {
    throw new InputError('class.type', `${field} must be one of the five classifications`, {
      field,
      saw: typeof name,
    });
  }
  const row = TABLE.get(name.trim().toLowerCase());
  if (row === undefined) {
    throw new InputError('class.unknown', `${field} ${name} is not a classification`, {
      field,
      value: name,
      known: CLASSIFICATIONS.slice(),
    });
  }
  return row;
}

export function rankOf(name) {
  return classification(name).rank;
}

/** Negative when the left class is more permissive than the right. */
export function compareClassification(left, right) {
  return rankOf(left) - rankOf(right);
}

export function isMorePermissive(left, right) {
  return rankOf(left) < rankOf(right);
}

/** The stricter of two, which is what a conjunction of rules always wants. */
export function stricter(left, right) {
  return rankOf(left) >= rankOf(right) ? classification(left).name : classification(right).name;
}

export function strictestOf(names) {
  if (names.length === 0) {
    throw new InputError('class.empty', 'the strictest of nothing is not a classification', {});
  }
  return names.reduce((worst, name) => stricter(worst, name));
}

export function isConditional(name) {
  return classification(name).conditional;
}

export function harvestAllowed(name) {
  return classification(name).harvestAllowed;
}

/** Null where the product may go straight to market. */
export function treatmentRequired(name) {
  return classification(name).treatment;
}

export function shortName(name) {
  return classification(name).shortName;
}

/**
 * The class an area falls to when its own conditional plan says closed. A
 * conditionally approved area in the closed state is not approved and it is
 * not restricted either: nothing may be taken. The same is true of a
 * conditionally restricted area, which is why both answers are prohibited and
 * why this is a lookup rather than a rank shift.
 */
export function whenPlanClosed(name) {
  const row = classification(name);
  if (!row.conditional) {
    throw new InputError('class.notConditional', `${row.name} carries no management plan`, {
      classification: row.name,
    });
  }
  return PROHIBITED;
}

/** The class in force while the plan says open, which is the unconditional twin. */
export function whenPlanOpen(name) {
  const row = classification(name);
  if (!row.conditional) {
    throw new InputError('class.notConditional', `${row.name} carries no management plan`, {
      classification: row.name,
    });
  }
  return row.name === CONDITIONALLY_APPROVED ? APPROVED : RESTRICTED;
}
