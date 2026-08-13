/**
 * Embargoes, which hold product where it stands.
 *
 * An emergency order shuts water. An embargo does not touch the water at all:
 * it names product that has already been taken and says nobody may move it.
 * The two get confused constantly, and the difference matters because they end
 * differently. An order is lifted when the thing that caused it goes away. An
 * embargo is lifted by a person putting their name on a release, and until
 * somebody does that it stands, whatever the water is doing.
 *
 * There are three ways to name product, and they reach it through different
 * registers, which is the whole reason this is a module rather than a flag.
 *
 * - By lot. The list is the list.
 * - By dealer. Whatever that dealer is holding is held, and what they hold is
 *   a fact about the movement ledger, so the answer changes as the book fills
 *   in even though the embargo has not been rewritten.
 * - By water and period. Whatever came out of that area between those dates,
 *   which is a fact about the landings register instead.
 *
 * A lot can be caught by all three at once, and lifting one of them does not
 * release it. That is deliberate. The alternative is a release signed by
 * somebody who was only ever looking at one register.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireArray, requireString } from '../core/assert.js';
import { compareInstant, isInstant } from '../time/instant.js';
import { DESTROYED, LANDED } from '../trace/ledger.js';
import { parseAreaId } from '../core/identity.js';
import { parseBedId } from './bed.js';

export const BY_LOT = 'by lot';
export const BY_DEALER = 'by dealer';
export const BY_WATER = 'by water';

export const REACHES = Object.freeze([BY_LOT, BY_DEALER, BY_WATER]);

/** How long an embargo may stand before somebody has to say why it still does. */
export const REVIEW_DAYS = 30;

export function embargo({
  number,
  reach,
  lots = [],
  dealers = [],
  area = null,
  span = null,
  issuedAt,
  releasedAt = null,
  releasedBy = null,
  reason = null,
}) {
  requireString(number, 'number');
  if (!REACHES.includes(reach)) {
    throw new InputError('embargo.reach', `${reach} is not a way of naming product`, {
      reach,
      known: REACHES.slice(),
    });
  }
  if (!isInstant(issuedAt)) {
    throw new InputError('embargo.time', 'an embargo is issued at an instant', { number });
  }
  if (releasedAt !== null && !isInstant(releasedAt)) {
    throw new InputError('embargo.time', 'an embargo is released at an instant', { number });
  }
  if (releasedAt !== null && compareInstant(releasedAt, issuedAt) < 0) {
    throw new InputError('embargo.time', 'an embargo cannot be released before it is issued', {
      number,
    });
  }
  if (releasedAt !== null && (releasedBy === null || releasedBy === undefined)) {
    throw new InputError('embargo.release', 'a release carries the name of whoever signed it', {
      number,
    });
  }
  const held = shapeOf(reach, { number, lots, dealers, area, span });
  return Object.freeze({
    number: number.trim().toUpperCase(),
    reach,
    ...held,
    issuedAt,
    releasedAt,
    releasedBy: releasedBy === null ? null : String(releasedBy).trim(),
    reason,
  });
}

function shapeOf(reach, { number, lots, dealers, area, span }) {
  if (reach === BY_LOT) {
    requireArray(lots, 'lots', { min: 1 });
    return {
      lots: Object.freeze(lots.map((one) => requireString(one, 'lot').trim().toUpperCase())),
      dealers: Object.freeze([]),
      area: null,
      span: null,
    };
  }
  if (reach === BY_DEALER) {
    requireArray(dealers, 'dealers', { min: 1 });
    return {
      lots: Object.freeze([]),
      dealers: Object.freeze(
        dealers.map((one) => requireString(one, 'dealer').trim().toUpperCase()),
      ),
      area: null,
      span: null,
    };
  }
  if (area === null || span === null) {
    throw new InputError('embargo.water', 'an embargo on water names an area and a period', {
      number,
    });
  }
  return {
    lots: Object.freeze([]),
    dealers: Object.freeze([]),
    area: parseAreaId(area, 'area').id,
    span,
  };
}

/** Standing at a moment, which is not the same question as ever having stood. */
export function standsAt(one, at) {
  if (compareInstant(at, one.issuedAt) < 0) {
    return false;
  }
  return one.releasedAt === null || compareInstant(at, one.releasedAt) < 0;
}

export function findEmbargo(list, number) {
  const wanted = String(number).trim().toUpperCase();
  return list.find((one) => one.number === wanted) ?? null;
}

/**
 * Which lots one embargo reaches, at a moment. The registers are handed in
 * rather than reached for, because the answer for a dealer embargo is a fact
 * about the book and the answer for a water embargo is a fact about the
 * landings, and a caller who has only one of them should get an honest empty
 * list rather than a confident wrong one.
 */
export function lotsHeld(one, { book = null, records = [], beds = [], at }) {
  if (!standsAt(one, at)) {
    return Object.freeze([]);
  }
  if (one.reach === BY_LOT) {
    return Object.freeze(one.lots.slice());
  }
  if (one.reach === BY_DEALER) {
    if (book === null) {
      return Object.freeze([]);
    }
    const reached = new Set();
    for (const dealer of one.dealers) {
      for (const move of book.byDealer(dealer)) {
        if (compareInstant(move.at, at) > 0) {
          continue;
        }
        reached.add(move.becomes === null ? move.lot : move.becomes);
      }
    }
    return Object.freeze(Array.from(reached).sort());
  }
  const inArea = new Set(beds.filter((bed) => areaOfBed(bed) === one.area).map((bed) => bed.id));
  return Object.freeze(
    records
      .filter(
        (record) =>
          inArea.has(record.bed) &&
          compareInstant(record.startedAt, one.span.start) >= 0 &&
          compareInstant(record.startedAt, one.span.end) < 0,
      )
      .map((record) => record.lot)
      .filter((lot) => lot !== null)
      .sort(),
  );
}

/** A bed id carries its area in its first half, which the bed register parses out. */
function areaOfBed(bed) {
  if (bed.areaId !== undefined && bed.areaId !== null) {
    return bed.areaId;
  }
  return parseBedId(bed.id, 'bed').areaId;
}

/**
 * Every embargo standing over one lot at a moment. More than one is normal and
 * is the case worth printing: a lot caught by water and by dealer needs two
 * releases, and a release is signed against a number rather than against a lot.
 */
export function heldBy(embargoes, lot, context) {
  const wanted = String(lot).trim().toUpperCase();
  return embargoes.filter((one) => lotsHeld(one, context).includes(wanted));
}

/**
 * Whether a movement was lawful. Nothing under embargo moves, with one
 * exception written into the rule rather than left to judgement: it may be
 * destroyed, because the point of the embargo is that the product does not
 * reach anybody, and destroying it is the strongest way of achieving that.
 */
export function checkMovements(embargoes, { book, records = [], beds = [] }) {
  const problems = findings();
  if (book === null || book === undefined) {
    return problems;
  }
  for (const move of book.all()) {
    if (move.kind === DESTROYED || move.kind === LANDED) {
      continue;
    }
    const context = { book, records, beds, at: move.at };
    for (const one of heldBy(embargoes, move.lot, context)) {
      problems.error(
        'embargo.moved',
        `${move.lot} was ${move.kind} while ${one.number} stood over it`,
        { lot: move.lot, embargo: one.number, kind: move.kind, reach: one.reach },
      );
    }
  }
  return problems;
}

/**
 * Embargoes nobody has looked at. An embargo has no clock of its own, which is
 * exactly why it needs one here: product held for a year by an office that
 * forgot is a worse outcome than a release somebody had to justify.
 */
export function reviewFindings(embargoes, at, { reviewDays = REVIEW_DAYS } = {}) {
  const problems = findings();
  const seconds = reviewDays * 86400;
  for (const one of embargoes) {
    if (!standsAt(one, at)) {
      continue;
    }
    const standing = at.epochSecond - one.issuedAt.epochSecond;
    if (standing >= seconds) {
      problems.warn(
        'embargo.stale',
        `${one.number} has stood ${Math.floor(standing / 86400)} days with nobody releasing it`,
        { embargo: one.number, days: Math.floor(standing / 86400), reach: one.reach },
      );
    }
  }
  return problems;
}

export function standing(embargoes, at) {
  return embargoes.filter((one) => standsAt(one, at));
}
