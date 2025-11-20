/**
 * Auditing a dealer's book, which is a conservation question.
 *
 * Every movement in the ledger is a record somebody wrote on their own. The
 * audit is the fold over them that asks whether they hold together: that
 * nothing was shipped that was never received, that nothing was received that
 * was never landed or shipped to them, and that the containers add up.
 *
 * A lot the dealer minted themselves, by shucking or repacking something they
 * did receive, is in their hands without a receipt. That is not a gap in the
 * book and the audit says so, because a check that fires on every packing
 * house in the state is a check nobody reads.
 *
 * The containers are the part worth being careful about. A dealer receives
 * twelve and ships eight, and the four that are left are not a discrepancy:
 * they are still in the cooler. A discrepancy is shipping more than was ever
 * received, and the audit says which of the two it found rather than
 * flattening both into "the numbers do not match".
 */

import { findings } from '../core/finding.js';
import { parseDealerId } from '../core/identity.js';
import { DESTROYED, LANDED, RECEIVED, RELAYED, REPACKED, SHIPPED, SHUCKED } from './ledger.js';
import { formatInstant } from '../time/instant.js';

/** The movements that put product into a dealer's hands. */
const INBOUND = new Set([RECEIVED]);

/** The movements that take it out again. */
const OUTBOUND = new Set([SHIPPED, DESTROYED, SHUCKED, REPACKED, RELAYED]);

export function auditBook(book, dealerId, { zone = 'eastern' } = {}) {
  const wanted = parseDealerId(dealerId, 'dealer').id;
  const problems = findings();
  const entries = book.byDealer(wanted);
  const landed = new Set(book.ofKind(LANDED).map((one) => one.lot));
  const received = new Map();
  const shipped = new Map();

  // A lot this dealer minted by shucking or repacking is in their hands
  // without ever having been received: nobody sent it to them, they made it.
  // Counting it as unreceived read every packing house in the state as a
  // discrepancy, which is how a check that fires on everything gets ignored.
  for (const entry of entries) {
    if (entry.becomes !== null) {
      received.set(entry.becomes, (received.get(entry.becomes) ?? 0) + 0);
    }
  }

  for (const entry of entries) {
    if (INBOUND.has(entry.kind)) {
      received.set(entry.lot, (received.get(entry.lot) ?? 0) + (entry.containers ?? 0));
      if (!landed.has(entry.lot) && !wasShippedToUs(book, entry)) {
        problems.error(
          'audit.receivedUnlanded',
          `${entry.lot} was received and the ledger holds no landing for it`,
          { dealer: wanted, lot: entry.lot, at: formatInstant(zone, entry.at) },
        );
      }
    }
    if (OUTBOUND.has(entry.kind)) {
      shipped.set(entry.lot, (shipped.get(entry.lot) ?? 0) + (entry.containers ?? 0));
      if (!received.has(entry.lot)) {
        problems.error(
          'audit.shippedUnreceived',
          `${entry.lot} left under ${entry.kind} and was never received`,
          { dealer: wanted, lot: entry.lot, kind: entry.kind },
        );
      }
    }
  }

  const lots = Array.from(new Set([...received.keys(), ...shipped.keys()])).sort();
  const rows = lots.map((lot) => {
    const inCount = received.get(lot) ?? 0;
    const outCount = shipped.get(lot) ?? 0;
    const holding = inCount - outCount;
    if (holding < 0 && inCount > 0) {
      problems.error(
        'audit.overShipped',
        `${lot} shipped ${outCount} containers against ${inCount} received`,
        { dealer: wanted, lot, received: inCount, shipped: outCount },
      );
    }
    return Object.freeze({ lot, received: inCount, shipped: outCount, holding });
  });

  const stillHeld = rows.filter((one) => one.holding > 0);
  if (stillHeld.length > 0) {
    problems.note('audit.holding', `${wanted} is still holding ${stillHeld.length} lots`, {
      dealer: wanted,
      lots: stillHeld.map((one) => one.lot),
    });
  }

  return Object.freeze({
    dealer: wanted,
    entries: entries.length,
    rows: Object.freeze(rows),
    holding: stillHeld.length,
    clean: problems.isLawful(),
    problems,
  });
}

/**
 * Whether somebody else shipped this lot to us. A lot minted by a shucking
 * upstream never had a landing of its own, and holding the receiving dealer
 * responsible for that would be blaming them for their supplier's paperwork.
 */
function wasShippedToUs(book, entry) {
  return book
    .forLot(entry.lot)
    .some((one) => one.kind === SHIPPED && one.at.epochSecond <= entry.at.epochSecond);
}

/** Every dealer the book names, so an audit can be run over all of them. */
export function dealersInBook(book) {
  return Array.from(
    new Set(
      book
        .all()
        .map((one) => one.dealer)
        .filter(Boolean),
    ),
  ).sort();
}

export function auditAll(book, options = {}) {
  return dealersInBook(book).map((dealer) => auditBook(book, dealer, options));
}

export function describeAudit(answer) {
  if (answer.clean) {
    return `${answer.dealer}: ${answer.entries} entries, nothing to report`;
  }
  return `${answer.dealer}: ${answer.entries} entries, ${answer.problems.of('error').length} findings`;
}
