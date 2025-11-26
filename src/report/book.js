/**
 * The dealer book report, which is what an inspector takes into the office.
 *
 * It prints what the dealer may do, what their book says they did, and the
 * reconciliation, in that order, because that is the order the conversation
 * goes in. The certification comes first so that a movement the certification
 * does not permit is read against something rather than in the abstract.
 */

import { auditBook } from '../trace/audit.js';
import { OPERATIONS, describeDealer, findDealer, mayPerform } from '../licence/dealer.js';
import { findings } from '../core/finding.js';
import { formatCivilDate } from '../time/civil.js';
import { formatInstant } from '../time/instant.js';
import { joinWords, yesNo } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

const MOVEMENT_COLUMNS = [
  column('at', 'When', { width: 20 }),
  column('kind', 'What', { width: 10 }),
  column('lot', 'Lot', { width: 16 }),
  column('becomes', 'Became', { width: 16 }),
  column('containers', 'Count', { align: RIGHT, width: 5 }),
  column('toParty', 'To', { cap: 24 }),
];

const RECONCILIATION_COLUMNS = [
  column('lot', 'Lot', { width: 16 }),
  column('received', 'In', { align: RIGHT, width: 4 }),
  column('shipped', 'Out', { align: RIGHT, width: 4 }),
  column('holding', 'Held', { align: RIGHT, width: 5 }),
];

/** Which certified operation a movement needs, or nothing where it needs none. */
export function operationFor(kind) {
  switch (kind) {
    case 'received':
      return 'receive shellstock';
    case 'shipped':
      return 'ship shellstock';
    case 'shucked':
      return 'shuck';
    case 'repacked':
      return 'repack';
    case 'depurated':
      return 'depurate';
    default:
      return null;
  }
}

export function bookReport({ book, dealers, dealerId, on, zone = 'eastern' }) {
  const problems = findings();
  const dealer = findDealer(dealers, dealerId);
  if (dealer === null) {
    problems.error('book.unknownDealer', `${dealerId} is not in the register`, {
      dealer: dealerId,
    });
    return Object.freeze({ dealer: null, dealerId, problems, entries: [], audit: null });
  }
  const audit = auditBook(book, dealer.id, { zone });
  problems.absorb(audit.problems);
  const entries = book.byDealer(dealer.id);
  const allowed = OPERATIONS.filter((operation) => mayPerform(dealer, operation, on));
  for (const entry of entries) {
    const needed = operationFor(entry.kind);
    if (needed !== null && !allowed.includes(needed)) {
      problems.error(
        'book.operationNotPermitted',
        `${dealer.id} recorded a ${entry.kind} and may not ${needed}`,
        { dealer: dealer.id, kind: entry.kind, operation: needed, lot: entry.lot },
      );
    }
  }
  return Object.freeze({
    dealer,
    dealerId: dealer.id,
    on,
    zone,
    entries: Object.freeze(entries),
    allowed: Object.freeze(allowed),
    audit,
    problems,
  });
}

export function renderBook(report) {
  if (report.dealer === null) {
    return `${report.dealerId} is not in the register.`;
  }
  const out = [
    heading(describeDealer(report.dealer)),
    '',
    definitionList([
      ['On', formatCivilDate(report.on)],
      ['Certified from', formatCivilDate(report.dealer.certifiedOn)],
      ['Expires', formatCivilDate(report.dealer.expiresOn)],
      ['Allowed that day', report.allowed.length === 0 ? 'nothing' : joinWords(report.allowed)],
      ['Entries in the book', String(report.entries.length)],
      ['Book holds together', yesNo(report.audit.clean)],
    ]),
    '',
    heading('The book', { underline: '-' }),
    '',
    renderTable(
      MOVEMENT_COLUMNS,
      report.entries.map((one) => ({
        at: formatInstant(report.zone, one.at),
        kind: one.kind,
        lot: one.lot,
        becomes: one.becomes ?? '-',
        containers: one.containers === null ? '-' : String(one.containers),
        toParty: one.toParty ?? '-',
      })),
    ),
    '',
    heading('Reconciliation', { underline: '-' }),
    '',
    renderTable(
      RECONCILIATION_COLUMNS,
      report.audit.rows.map((one) => ({
        lot: one.lot,
        received: String(one.received),
        shipped: String(one.shipped),
        holding: String(one.holding),
      })),
    ),
  ];
  if (report.problems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}
