/**
 * The trace report, which is written to be read by somebody who is not in
 * this office.
 *
 * A trace goes to a health department, to a dealer's lawyer, and sometimes to
 * a newspaper. So it prints the chain in the order the product moved, names
 * every hand it passed through, and is explicit about the point at which the
 * paper ran out. The last of those is the one that matters: a trace that
 * quietly ended is worse than no trace, because it reads as a complete story.
 */

import { recall, traceBack, traceForward } from '../trace/trace.js';
import { formatInstant } from '../time/instant.js';
import { joinWords } from '../text/format.js';
import { column, definitionList, heading, renderTable } from '../text/table.js';

const MOVEMENT_COLUMNS = [
  column('at', 'When', { width: 20 }),
  column('kind', 'What', { width: 10 }),
  column('lot', 'Lot', { width: 16 }),
  column('becomes', 'Became', { width: 16 }),
  column('dealer', 'Dealer', { width: 7 }),
  column('toParty', 'To', { cap: 26 }),
];

export function renderTraceBack(book, lot, { records = [], zone = 'eastern' } = {}) {
  const walk = traceBack(book, lot, { records });
  const out = [
    heading(`Trace back from ${walk.lot}`),
    '',
    definitionList([
      ['Chain', joinWords(walk.chain, 'then')],
      ['Landed as', walk.origin],
      ['Area', walk.areaId ?? 'not recoverable'],
      ['Bed', walk.bed ?? 'not recoverable'],
      ['Harvested', walk.harvestedOn ?? 'not recoverable'],
      ['Stopped at', walk.stoppedAt],
      ['Complete', walk.complete ? 'yes' : 'no'],
    ]),
    '',
    renderTable(MOVEMENT_COLUMNS, movementRows(book, walk.chain, zone)),
  ];
  if (walk.problems.length > 0) {
    out.push('', heading('Where the paper runs out', { underline: '-' }), '');
    for (const finding of walk.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}

export function renderTraceForward(book, lot, { zone = 'eastern' } = {}) {
  const walk = traceForward(book, lot);
  const out = [
    heading(`Trace forward from ${walk.lot}`),
    '',
    definitionList([
      ['Lots reached', joinWords(walk.reached, 'then')],
      ['Consignees', walk.parties.length === 0 ? 'none recorded' : joinWords(walk.parties)],
      ['Shipments', String(walk.shipments.length)],
    ]),
    '',
    renderTable(MOVEMENT_COLUMNS, movementRows(book, walk.reached, zone)),
  ];
  if (walk.problems.length > 0) {
    out.push('', heading('Notes', { underline: '-' }), '');
    for (const finding of walk.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}

export function renderRecall(book, { areaId, span, records = [], zone = 'eastern' }) {
  const answer = recall(book, { areaId, span, records });
  const out = [
    heading(`Recall for ${areaId}`),
    '',
    definitionList([
      ['Period', `${formatInstant(zone, span.start)} to ${formatInstant(zone, span.end)}`],
      ['Lots landed', String(answer.lots.length)],
      ['Consignees', answer.parties.length === 0 ? 'none recorded' : joinWords(answer.parties)],
    ]),
    '',
  ];
  if (answer.lots.length === 0) {
    out.push('Nothing was landed out of this area in this period.');
    return out.join('\n');
  }
  out.push(
    renderTable(
      [
        column('lot', 'Lot', { width: 16 }),
        column('reached', 'Became', { cap: 36 }),
        column('parties', 'Went to', { cap: 30 }),
      ],
      answer.walks.map((walk) => ({
        lot: walk.lot,
        reached: joinWords(walk.reached.slice(1), 'then') || '-',
        parties: joinWords(walk.parties) || '-',
      })),
    ),
  );
  return out.join('\n');
}

function movementRows(book, lots, zone) {
  const wanted = new Set(lots);
  return book
    .all()
    .filter((one) => wanted.has(one.lot) || (one.becomes !== null && wanted.has(one.becomes)))
    .map((one) => ({
      at: formatInstant(zone, one.at),
      kind: one.kind,
      lot: one.lot,
      becomes: one.becomes ?? '-',
      dealer: one.dealer ?? '-',
      toParty: one.toParty ?? '-',
    }));
}
