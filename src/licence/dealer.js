/**
 * Dealer certifications, and the operations each kind may perform.
 *
 * The certification number carries its own kind, so a number on a shipping
 * document already says what that dealer is allowed to do. The office reads it
 * that way and this module follows.
 *
 * What makes this more than a lookup is where it gets asked from. Restricted
 * water produces product that is legal only after relay or depuration, so the
 * classification of the area a lot came out of decides which operation the lot
 * needs, and the operation decides which certifications may hold it. Three
 * facts about three different things have to line up, and a dealer holding a
 * lot they cannot lawfully treat is the case that costs somebody a season.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { DEALER_KINDS, parseDealerId } from '../core/identity.js';
import { compareCivilDate, parseCivilDate } from '../time/civil.js';

export const RECEIVE = 'receive shellstock';
export const SHIP = 'ship shellstock';
export const SHUCK = 'shuck';
export const REPACK = 'repack';
export const DEPURATE = 'depurate';
export const WET_STORE = 'wet store';

export const OPERATIONS = Object.freeze([RECEIVE, SHIP, SHUCK, REPACK, DEPURATE, WET_STORE]);

const PERMITTED = new Map([
  ['SS', Object.freeze([RECEIVE, SHIP, WET_STORE])],
  ['SP', Object.freeze([RECEIVE, SHIP, SHUCK])],
  ['RP', Object.freeze([RECEIVE, SHIP, REPACK])],
  ['DP', Object.freeze([RECEIVE, SHIP, DEPURATE, WET_STORE])],
]);

export function dealer({ id, name, address = null, certifiedOn, expiresOn, revokedOn = null }) {
  const parsed = parseDealerId(id, 'dealer');
  requireString(name, 'name');
  const certified = asDate(certifiedOn, 'certifiedOn');
  const expires = asDate(expiresOn, 'expiresOn');
  if (compareCivilDate(expires, certified) < 0) {
    throw new InputError('dealer.dates', 'a certification cannot expire before it is issued', {
      dealer: parsed.id,
    });
  }
  const revoked = revokedOn === null ? null : asDate(revokedOn, 'revokedOn');
  return Object.freeze({
    id: parsed.id,
    prefix: parsed.prefix,
    kind: parsed.kind,
    name,
    address,
    certifiedOn: certified,
    expiresOn: expires,
    revokedOn: revoked,
  });
}

export function permittedOperations(prefixOrDealer) {
  const prefix =
    typeof prefixOrDealer === 'string'
      ? prefixOrDealer.trim().toUpperCase()
      : prefixOrDealer.prefix;
  const list = PERMITTED.get(prefix);
  if (list === undefined) {
    throw new InputError('dealer.kind', `${prefix} is not a certification kind`, {
      prefix,
      known: Object.keys(DEALER_KINDS),
    });
  }
  return list.slice();
}

export function isCertified(one, date) {
  if (one.revokedOn !== null && compareCivilDate(date, one.revokedOn) >= 0) {
    return false;
  }
  return compareCivilDate(date, one.certifiedOn) >= 0 && compareCivilDate(date, one.expiresOn) <= 0;
}

export function mayPerform(one, operation, date) {
  if (!OPERATIONS.includes(operation)) {
    throw new InputError('dealer.operation', `${operation} is not an operation`, {
      operation,
      known: OPERATIONS.slice(),
    });
  }
  return isCertified(one, date) && permittedOperations(one).includes(operation);
}

/**
 * The dealers on a list that could lawfully take a lot needing a given
 * operation on a day. The office runs this when a boat lands restricted
 * product and the usual buyer cannot take it.
 */
export function dealersFor(dealers, operation, date) {
  return dealers
    .filter((one) => mayPerform(one, operation, date))
    .sort((left, right) => (left.id < right.id ? -1 : 1));
}

export function findDealer(dealers, id) {
  const wanted = parseDealerId(id, 'dealer').id;
  return dealers.find((one) => one.id === wanted) ?? null;
}

export function describeDealer(one) {
  return `${one.id} ${one.name} (${one.kind})`;
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('dealer.dates', `${field} is required`, { field });
  }
  return value;
}
