/**
 * The shipping document, which is what travels with the product.
 *
 * A tag is on the bag. A shipping document is on the pallet, and it is the one
 * the receiving state reads. It has to name both dealers by certification
 * number, say what is in the shipment, and carry the tag information for every
 * lot in it, which is where most of the work is: a pallet holding four lots
 * carries four sets of tag information and the document has to be able to say
 * so rather than averaging them into one.
 *
 * Interstate is the part with teeth. A dealer may only ship to a certified
 * dealer in a state that keeps the same agreement, and the programme holds a
 * list of those. Shipping out of it is not a paperwork problem: it is product
 * leaving the system entirely, and the trace ends at the state line.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireArray, requireString } from '../core/assert.js';
import { parseDealerId, parseLotId } from '../core/identity.js';
import { RECEIVE, SHIP, mayPerform } from '../licence/dealer.js';
import { civilDateAt, isInstant } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';

/** The states that keep the same agreement, so product may cross into them. */
export const CONFORMING_STATES = Object.freeze([
  'AL',
  'CT',
  'DE',
  'FL',
  'GA',
  'LA',
  'MA',
  'MD',
  'ME',
  'MS',
  'NC',
  'NH',
  'NJ',
  'NY',
  'RI',
  'SC',
  'TX',
  'VA',
  'WA',
]);

export function isConforming(state) {
  if (typeof state !== 'string') {
    return false;
  }
  return CONFORMING_STATES.includes(state.trim().toUpperCase());
}

export function shippingDocument({
  number,
  from,
  to,
  toState,
  shippedAt,
  lots,
  carrier = null,
  temperature = null,
}) {
  requireString(number, 'number');
  const shipper = parseDealerId(from, 'from');
  requireString(to, 'to');
  requireString(toState, 'toState');
  if (!isInstant(shippedAt)) {
    throw new InputError('shipping.time', 'a shipment leaves at an instant', {});
  }
  requireArray(lots, 'lots', { min: 1 });
  return Object.freeze({
    number: number.trim().toUpperCase(),
    from: shipper.id,
    fromKind: shipper.kind,
    to: to.trim().toUpperCase(),
    toState: toState.trim().toUpperCase(),
    shippedAt,
    lots: Object.freeze(lots.map((one) => parseLotId(one, 'lots').id)),
    carrier,
    temperature,
  });
}

/**
 * Check a document. The consignee is looked up only where it is one of ours;
 * an out of state number cannot be in this register and its absence is not a
 * finding, which is the difference between a shipment we cannot check and one
 * that is wrong.
 */
export function checkShipment({ document, dealers = [], zone = 'eastern', ourState = 'NC' }) {
  const problems = findings();
  const day = civilDateAt(zone, document.shippedAt);

  const shipper = dealers.find((one) => one.id === document.from) ?? null;
  if (shipper === null) {
    problems.error('ship.unknownShipper', `${document.from} is not in the register`, {
      document: document.number,
      dealer: document.from,
    });
  } else if (!mayPerform(shipper, SHIP, day)) {
    problems.error('ship.shipperNotCertified', `${document.from} could not ship on that day`, {
      document: document.number,
      dealer: document.from,
      on: formatCivilDate(day),
    });
  }

  if (document.toState === ourState.toUpperCase()) {
    checkOurConsignee(document, dealers, day, problems);
  } else if (!isConforming(document.toState)) {
    problems.error(
      'ship.stateNotConforming',
      `${document.toState} does not keep the agreement, so the product may not go there`,
      { document: document.number, state: document.toState },
    );
  } else {
    problems.note(
      'ship.interstate',
      `the trace ends at the state line; ${document.to} is in ${document.toState}`,
      { document: document.number, state: document.toState },
    );
  }

  if (new Set(document.lots).size !== document.lots.length) {
    problems.error('ship.repeatedLot', `${document.number} names a lot twice`, {
      document: document.number,
    });
  }

  return Object.freeze({
    document: document.number,
    on: formatCivilDate(day),
    interstate: document.toState !== ourState.toUpperCase(),
    lots: document.lots,
    lawful: problems.isLawful(),
    problems,
  });
}

function checkOurConsignee(document, dealers, day, problems) {
  let consignee = null;
  try {
    consignee = dealers.find((one) => one.id === parseDealerId(document.to, 'to').id) ?? null;
  } catch (error) {
    problems.error('ship.consigneeNumber', error.message, { document: document.number });
    return;
  }
  if (consignee === null) {
    problems.error('ship.unknownConsignee', `${document.to} is not in the register`, {
      document: document.number,
      dealer: document.to,
    });
    return;
  }
  if (!mayPerform(consignee, RECEIVE, day)) {
    problems.error('ship.consigneeNotCertified', `${document.to} could not receive on that day`, {
      document: document.number,
      dealer: document.to,
    });
  }
}

export function describeShipment(document) {
  return `${document.number}: ${document.lots.length} lots from ${document.from} to ${document.to} in ${document.toState}`;
}
