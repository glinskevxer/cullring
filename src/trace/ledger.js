/**
 * The movement ledger, which is every hand a lot passed through.
 *
 * Each entry is one dealer writing down one thing they did. Nothing here
 * judges any of it: the ledger is the record and the trace is the reading of
 * it, and keeping those apart is what lets the office load six dealers' books
 * and then ask questions the dealers did not know they were answering.
 *
 * A movement that creates a new lot number carries both, the one it came from
 * and the one it became. That is how a trace crosses a shucking or a repack,
 * which is the point at which most traces in this trade stop dead.
 */

import { InputError } from '../core/errors.js';
import { requireNumber } from '../core/assert.js';
import { parseDealerId, parseLotId } from '../core/identity.js';
import { compareInstant, isInstant } from '../time/instant.js';

export const LANDED = 'landed';
export const RECEIVED = 'received';
export const SHIPPED = 'shipped';
export const SHUCKED = 'shucked';
export const REPACKED = 'repacked';
export const DEPURATED = 'depurated';
export const RELAYED = 'relayed';
export const DESTROYED = 'destroyed';

export const MOVEMENTS = Object.freeze([
  LANDED,
  RECEIVED,
  SHIPPED,
  SHUCKED,
  REPACKED,
  DEPURATED,
  RELAYED,
  DESTROYED,
]);

/** The movements that mint a new lot number out of an old one. */
const RENUMBERING = new Set([SHUCKED, REPACKED]);

export function isRenumbering(kind) {
  return RENUMBERING.has(kind);
}

export function movement({
  kind,
  lot,
  at,
  dealer = null,
  becomes = null,
  containers = null,
  toParty = null,
  note = null,
}) {
  if (!MOVEMENTS.includes(kind)) {
    throw new InputError('movement.kind', `${kind} is not a movement this ledger records`, {
      kind,
      known: MOVEMENTS.slice(),
    });
  }
  const from = parseLotId(lot, 'lot').id;
  if (!isInstant(at)) {
    throw new InputError('movement.at', 'a movement happens at an instant', { kind });
  }
  if (isRenumbering(kind) && becomes === null) {
    throw new InputError('movement.becomes', `a ${kind} movement carries the lot it becomes`, {
      kind,
      lot: from,
    });
  }
  if (!isRenumbering(kind) && becomes !== null) {
    throw new InputError('movement.becomes', `a ${kind} movement does not mint a new lot`, {
      kind,
      lot: from,
    });
  }
  if (containers !== null) {
    requireNumber(containers, 'containers', { min: 0, integer: true });
  }
  return Object.freeze({
    kind,
    lot: from,
    becomes: becomes === null ? null : parseLotId(becomes, 'becomes').id,
    at,
    dealer: dealer === null ? null : parseDealerId(dealer, 'dealer').id,
    containers,
    toParty,
    note,
  });
}

export function ledger(movements = []) {
  const held = movements.slice();
  const api = {
    add(one) {
      held.push(one);
      return api;
    },
    all() {
      return held.slice().sort(compareMovement);
    },
    forLot(lot) {
      const wanted = parseLotId(lot, 'lot').id;
      return api.all().filter((one) => one.lot === wanted || one.becomes === wanted);
    },
    byDealer(dealer) {
      const wanted = parseDealerId(dealer, 'dealer').id;
      return api.all().filter((one) => one.dealer === wanted);
    },
    ofKind(kind) {
      return api.all().filter((one) => one.kind === kind);
    },
    lots() {
      const seen = new Set();
      for (const one of held) {
        seen.add(one.lot);
        if (one.becomes !== null) {
          seen.add(one.becomes);
        }
      }
      return Array.from(seen).sort();
    },
    get length() {
      return held.length;
    },
  };
  return api;
}

export function compareMovement(left, right) {
  const byTime = compareInstant(left.at, right.at);
  if (byTime !== 0) {
    return byTime;
  }
  if (left.lot !== right.lot) {
    return left.lot < right.lot ? -1 : 1;
  }
  return MOVEMENTS.indexOf(left.kind) - MOVEMENTS.indexOf(right.kind);
}

/** Where a lot number came from, one step back. */
export function parentOf(book, lot) {
  const wanted = parseLotId(lot, 'lot').id;
  const minting = book.all().find((one) => one.becomes === wanted);
  return minting === undefined ? null : minting.lot;
}

/** The lot numbers this one turned into, one step on. */
export function childrenOf(book, lot) {
  const wanted = parseLotId(lot, 'lot').id;
  return book
    .all()
    .filter((one) => one.lot === wanted && one.becomes !== null)
    .map((one) => one.becomes);
}
