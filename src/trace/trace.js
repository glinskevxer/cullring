/**
 * The trace, run in both directions.
 *
 * Backwards is the question a reported case asks: this pint came from that
 * shop, which lot is it, and what water did it come out of. It walks the
 * ledger from a lot number back through every renumbering to the landing, and
 * then reads the harvest record to name the bed and the day.
 *
 * Forwards is the question a closure asks: this area should not have been open
 * on the eleventh, so what went out of it and where is it now. It walks the
 * other way and ends at every party the product was shipped to.
 *
 * Both directions have to be honest about where they stop. A chain that runs
 * out because nobody recorded the receipt is not the same as a chain that ends
 * at a landing, and a report that showed them the same way would let a broken
 * book read as a complete story. So every walk carries the reason it ended.
 */

import { findings } from '../core/finding.js';
import { parseLotId } from '../core/identity.js';
import { LANDED, SHIPPED, childrenOf, parentOf } from './ledger.js';
import { formatCivilDate } from '../time/civil.js';

export const AT_LANDING = 'landing';
export const AT_BROKEN_LINK = 'broken link';
export const AT_LOOP = 'loop';

/**
 * Walk back to the landing. The chain is returned oldest first, the way the
 * story reads, and the stop reason names why the walk ended.
 */
export function traceBack(book, lot, { records = [] } = {}) {
  const problems = findings();
  const start = parseLotId(lot, 'lot').id;
  const chain = [start];
  const seen = new Set([start]);
  let cursor = start;
  let stoppedAt = AT_LANDING;

  for (;;) {
    const parent = parentOf(book, cursor);
    if (parent === null) {
      break;
    }
    if (seen.has(parent)) {
      stoppedAt = AT_LOOP;
      problems.error('trace.loop', `the ledger sends ${parent} back to itself`, { lot: parent });
      break;
    }
    seen.add(parent);
    chain.push(parent);
    cursor = parent;
  }

  const origin = chain[chain.length - 1];
  const landing = book.forLot(origin).find((one) => one.kind === LANDED) ?? null;
  if (landing === null && stoppedAt === AT_LANDING) {
    stoppedAt = AT_BROKEN_LINK;
    problems.error(
      'trace.noLanding',
      `${origin} has no landing in the ledger, so the trace stops there`,
      { lot: origin },
    );
  }
  const record = records.find((one) => one.lot === origin) ?? null;
  if (record === null) {
    problems.warn('trace.noRecord', `${origin} has no harvest record`, { lot: origin });
  }
  return Object.freeze({
    lot: start,
    chain: Object.freeze(chain.slice().reverse()),
    origin,
    landing,
    record,
    areaId: record === null ? null : record.areaId,
    bed: record === null ? null : record.bed,
    harvestedOn: record === null ? null : formatCivilDate(record.landedOn),
    stoppedAt,
    complete: stoppedAt === AT_LANDING && record !== null,
    problems,
  });
}

/**
 * Walk forwards to everywhere the product went. A lot that was shucked and
 * then repacked appears once in the chain and its shipments appear under the
 * number they went out on, because that is the number the consignee has.
 */
export function traceForward(book, lot) {
  const problems = findings();
  const start = parseLotId(lot, 'lot').id;
  const reached = [];
  const seen = new Set();
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) {
      problems.error('trace.loop', `the ledger sends ${current} back to itself`, { lot: current });
      continue;
    }
    seen.add(current);
    reached.push(current);
    for (const child of childrenOf(book, current)) {
      queue.push(child);
    }
  }

  const shipments = book
    .all()
    .filter((one) => one.kind === SHIPPED && seen.has(one.lot))
    .map((one) =>
      Object.freeze({ lot: one.lot, at: one.at, dealer: one.dealer, toParty: one.toParty }),
    );
  if (shipments.length === 0) {
    problems.note('trace.noShipment', `nothing was shipped under ${start} or anything it became`, {
      lot: start,
    });
  }
  return Object.freeze({
    lot: start,
    reached: Object.freeze(reached),
    shipments: Object.freeze(shipments),
    parties: Object.freeze(
      Array.from(new Set(shipments.map((one) => one.toParty).filter(Boolean))).sort(),
    ),
    problems,
  });
}

/**
 * The recall question. Everything landed out of an area inside a window, and
 * everywhere all of it went.
 */
export function recall(book, { areaId, span, records = [] }) {
  const problems = findings();
  const landings = book
    .all()
    .filter(
      (one) =>
        one.kind === LANDED &&
        parseLotId(one.lot).areaId === areaId &&
        one.at.epochSecond >= span.start.epochSecond &&
        one.at.epochSecond < span.end.epochSecond,
    );
  const forward = landings.map((one) => traceForward(book, one.lot));
  for (const walk of forward) {
    problems.absorb(walk.problems.of('error'));
  }
  const parties = Array.from(new Set(forward.flatMap((walk) => walk.parties))).sort();
  const lots = landings.map((one) => one.lot).sort();
  if (lots.length === 0) {
    problems.note('trace.nothingLanded', `nothing was landed from ${areaId} in that period`, {
      areaId,
    });
  }
  return Object.freeze({
    areaId,
    span,
    lots: Object.freeze(lots),
    walks: Object.freeze(forward),
    parties: Object.freeze(parties),
    records: Object.freeze(records.filter((one) => lots.includes(one.lot))),
    problems,
  });
}
