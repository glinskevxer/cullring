/**
 * The consumer advisory, which is the document a recall actually produces.
 *
 * A recall walk gives lots and parties. An advisory is what gets sent out, and
 * it is a different shape for three reasons.
 *
 * The trace stops at the dealer, so the advisory cannot name a shop or a
 * restaurant. What it can name is every party a shipment went to, and it has
 * to say plainly that the list ends there, because a reader who assumes the
 * chain was followed further will not make the phone calls that it wasn't.
 *
 * The reason for the advisory decides how strongly it is worded, and the
 * reason is not a free text field: it comes from what shut the water. An
 * emergency order for biotoxin is a health advisory. Product taken out of a
 * conditionally approved area during an unreported closure is a compliance
 * matter. Those go to the same people and they do not say the same thing.
 *
 * And an advisory has a horizon. Shellstock has a shelf life, and an advisory
 * issued long enough after the harvest that none of it can still be in a cold
 * box is a different document again: it is written for the record rather than
 * for the public, and it says so.
 */

import { findings } from '../core/finding.js';
import { formatCivilDate } from '../time/civil.js';
import { civilDateAt, compareInstant } from '../time/instant.js';
import { recall } from './trace.js';

export const HEALTH = 'health advisory';
export const COMPLIANCE = 'compliance notice';
export const FOR_THE_RECORD = 'for the record';

export const GRADES = Object.freeze([HEALTH, COMPLIANCE, FOR_THE_RECORD]);

/** How long shellstock can still be somebody's dinner after it was landed. */
export const SHELF_LIFE_DAYS = 21;

/**
 * Which grade an advisory carries. The reason chooses between health and
 * compliance; the clock can only demote, never promote, because a stale
 * biotoxin advisory is still not something to word softly by accident.
 */
export function gradeOf({ reason, landedAt, issuedAt, shelfLifeDays = SHELF_LIFE_DAYS }) {
  const wanted = reason === 'biotoxin' || reason === 'illness' ? HEALTH : COMPLIANCE;
  if (landedAt === null || landedAt === undefined) {
    return wanted;
  }
  const age = (issuedAt.epochSecond - landedAt.epochSecond) / 86400;
  return age > shelfLifeDays ? FOR_THE_RECORD : wanted;
}

/**
 * Build the advisory. The recall walk is done here rather than handed in,
 * because the advisory has to be able to say what it was built from and a
 * walk somebody else ran is a walk nobody can check.
 */
export function advisory(book, { areaId, span, records = [], reason, issuedAt, zone = 'eastern' }) {
  const problems = findings();
  const walk = recall(book, { areaId, span, records });
  problems.absorb(walk.problems);

  const landings = book.all().filter((one) => one.kind === 'landed' && walk.lots.includes(one.lot));
  const latest = landings.reduce(
    (held, one) => (held === null || compareInstant(one.at, held) > 0 ? one.at : held),
    null,
  );
  const grade = gradeOf({ reason, landedAt: latest, issuedAt });

  if (walk.lots.length > 0 && walk.parties.length === 0) {
    problems.warn(
      'advisory.nowhereToSend',
      `${walk.lots.length} lots are named and the book shows nothing shipped anywhere`,
      { area: areaId, lots: walk.lots.length },
    );
  }
  if (grade === FOR_THE_RECORD && walk.lots.length > 0) {
    problems.note(
      'advisory.stale',
      'every lot named is past the shelf life, so this is written for the record',
      { area: areaId, days: SHELF_LIFE_DAYS },
    );
  }

  return Object.freeze({
    area: areaId,
    span,
    reason,
    issuedAt,
    on: civilDateAt(zone, issuedAt),
    grade,
    lots: walk.lots,
    parties: walk.parties,
    shipments: Object.freeze(walk.walks.flatMap((one) => one.shipments)),
    records: walk.records,
    walk,
    problems,
  });
}

const WORDING = Object.freeze({
  [HEALTH]: 'Do not eat this product. Return it or throw it out.',
  [COMPLIANCE]:
    'Hold this product and do not sell it. The division will contact you about its disposal.',
  [FOR_THE_RECORD]:
    'No action is asked for. This is filed so the movement of the product is on the record.',
});

/**
 * The text that goes out. It is deliberately short and it says what the reader
 * has to do in the first line, because the first line is all of it that gets
 * read on a Friday afternoon.
 */
export function renderAdvisory(one) {
  const out = [
    `${one.grade.toUpperCase()}: ${one.area}, ${formatCivilDate(one.on)}`,
    '',
    WORDING[one.grade],
    '',
  ];
  out.push(`Reason: ${one.reason}.`);
  out.push(
    `Product: everything landed out of ${one.area} between ${formatCivilDate(
      civilDateAt('eastern', one.span.start),
    )} and ${formatCivilDate(civilDateAt('eastern', one.span.end))}.`,
  );
  if (one.lots.length === 0) {
    out.push('', 'No lots were landed out of that water in that period.');
    return out.join('\n');
  }
  out.push('', `Lots (${one.lots.length}):`);
  for (const lot of one.lots) {
    out.push(`  ${lot}`);
  }
  if (one.parties.length === 0) {
    out.push('', 'The book shows none of it shipped anywhere.');
  } else {
    out.push('', `Sent to (${one.parties.length}):`);
    for (const party of one.parties) {
      out.push(`  ${party}`);
    }
  }
  out.push(
    '',
    'This list ends at the dealers the division licenses. Where any of them sold it on, they',
    'have to make that call themselves.',
  );
  return out.join('\n');
}

/**
 * Who has to be told, and how. The dealers come off the shipments rather than
 * the parties, because a dealer who shipped is a dealer who has records and a
 * party who received may be anybody.
 */
export function distributionList(one) {
  const dealers = new Set();
  for (const shipment of one.shipments) {
    if (shipment.dealer !== null && shipment.dealer !== undefined) {
      dealers.add(shipment.dealer);
    }
  }
  return Object.freeze({
    dealers: Object.freeze(Array.from(dealers).sort()),
    parties: one.parties,
    total: dealers.size + one.parties.length,
  });
}

/**
 * Whether one lot is named by an advisory. A lot that was renumbered is named
 * if the number it became is named, which is why this asks the walk rather
 * than the list.
 */
export function names(one, lot) {
  const wanted = String(lot).trim().toUpperCase();
  if (one.lots.includes(wanted)) {
    return true;
  }
  return one.walk.walks.some((walk) => walk.reached.includes(wanted));
}
