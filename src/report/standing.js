/**
 * The standing chart, which is what goes on the wall every morning.
 *
 * One line per area, saying what it is, whether the plan has it shut, and if
 * so what shut it and what will lift it. The reason the closing and the
 * reopening are printed as separate columns is that they are separate
 * instruments and the office has been asked to explain the difference often
 * enough to want it in front of them.
 */

import { standingAt } from '../area/effective.js';
import { describeReopening } from '../condition/reopening.js';
import { describeTrigger } from '../condition/plan.js';
import { shortName } from '../area/classification.js';
import { formatInstant } from '../time/instant.js';
import { decimal } from '../text/format.js';
import { column, definitionList, heading, renderTable } from '../text/table.js';

const COLUMNS = [
  column('area', 'Area'),
  column('name', 'Name', { cap: 22 }),
  column('paper', 'Class', { width: 5 }),
  column('effective', 'In force', { width: 8 }),
  column('shut', 'Shut', { width: 4 }),
  column('cause', 'Closed by', { cap: 34 }),
  column('lifts', 'Reopens on', { cap: 26 }),
];

export function standingRows({ areas, plans, feed, orders = [], at, from = null }) {
  return standingAt({ areas, plans, feed, orders, at, from }).map((entry) => {
    const closed = entry.closed;
    return Object.freeze({
      area: entry.area,
      name: nameOf(areas, entry.area),
      paper: entry.paper === null ? '-' : shortName(entry.paper),
      effective: shortName(entry.effective),
      shut: closed || entry.order !== null ? 'yes' : 'no',
      cause: closed || entry.order !== null ? causeOf(entry) : '-',
      lifts: liftsOf(entry, closed),
      standing: entry,
    });
  });
}

function causeOf(entry) {
  if (entry.order !== null) {
    return `${entry.order.number}, ${entry.order.kind}`;
  }
  const fired = entry.closure === null ? null : entry.closure.firedBy;
  if (fired === null) {
    return 'plan';
  }
  if (fired.measured === null || typeof fired.measured !== 'number') {
    return describeTrigger(entry.plan.trigger);
  }
  return `${decimal(fired.measured, 2)} against ${fired.threshold} ${fired.unit}`;
}

function liftsOf(entry, closed) {
  if (entry.order !== null) {
    return entry.order.needsClearance ? 'on clearance samples' : 'when the order is lifted';
  }
  return closed && entry.plan !== null ? describeReopening(entry.plan.reopening) : '-';
}

function nameOf(areas, id) {
  const area = areas.find((one) => one.id === id);
  return area === undefined ? '-' : area.name;
}

export function renderStanding({
  areas,
  plans,
  feed,
  orders = [],
  at,
  zone = 'eastern',
  from = null,
}) {
  const rows = standingRows({ areas, plans, feed, orders, at, from });
  const shut = rows.filter((row) => row.shut === 'yes');
  const problems = rows.flatMap((row) => row.standing.problems.list());
  const out = [
    heading('Growing area standing'),
    '',
    definitionList([
      ['As at', formatInstant(zone, at)],
      ['Areas', String(rows.length)],
      ['Shut by a plan or an order', String(shut.length)],
    ]),
    '',
    renderTable(COLUMNS, rows),
  ];
  if (problems.length > 0) {
    out.push('', heading('Register findings', { underline: '-' }), '');
    out.push(
      renderTable(
        [column('code', 'Code'), column('message', 'Finding', { cap: 60 })],
        problems.map((one) => ({ code: one.code, message: one.message })),
      ),
    );
  }
  return out.join('\n');
}

/** The same thing as data, for anything that has to count rather than read. */
export function standingSummary({ areas, plans, feed, orders = [], at, from = null }) {
  const rows = standingRows({ areas, plans, feed, orders, at, from });
  const byClass = new Map();
  for (const row of rows) {
    byClass.set(row.effective, (byClass.get(row.effective) ?? 0) + 1);
  }
  return Object.freeze({
    areas: rows.length,
    closed: rows.filter((row) => row.shut === 'yes').length,
    byClass: Object.freeze(Object.fromEntries(Array.from(byClass).sort())),
    findings: rows.reduce((total, row) => total + row.standing.problems.length, 0),
  });
}
