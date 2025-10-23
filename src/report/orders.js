/**
 * The orders report, which is the register of what has been signed.
 *
 * An order is a document with a number on it, and the office is asked about it
 * in three ways: what is in force right now, what was in force on a day last
 * August, and whether the one on the desk can be lifted yet. The third is the
 * only one that needs arithmetic, and only for the biotoxin orders.
 */

import { findings } from '../core/finding.js';
import { clearanceMet, coversArea, inForceAt, ordersFor } from '../condition/emergency.js';
import { formatInstant } from '../time/instant.js';
import { joinWords, yesNo } from '../text/format.js';
import { column, definitionList, heading, renderTable } from '../text/table.js';

const COLUMNS = [
  column('number', 'Order', { width: 12 }),
  column('kind', 'Kind', { width: 16 }),
  column('areas', 'Areas', { cap: 24 }),
  column('issued', 'Issued', { width: 20 }),
  column('lifted', 'Lifted', { width: 20 }),
  column('state', 'State', { width: 8 }),
];

export function ordersReport({ orders, at, samples = [], zone = 'eastern', areaId = null }) {
  const problems = findings();
  const chosen = areaId === null ? orders : orders.filter((one) => coversArea(one, areaId));
  const rows = chosen
    .slice()
    .sort((left, right) => right.issuedAt.epochSecond - left.issuedAt.epochSecond)
    .map((one) => {
      const live = inForceAt(one, at);
      const cleared = clearanceMet(one, samples);
      if (live && cleared === true) {
        problems.warn(
          'order.clearanceMet',
          `${one.number} has its clearance samples and could be lifted`,
          { order: one.number },
        );
      }
      return {
        number: one.number,
        kind: one.kind,
        areas: joinWords(one.areas),
        issued: formatInstant(zone, one.issuedAt),
        lifted: one.liftedAt === null ? '-' : formatInstant(zone, one.liftedAt),
        state: live ? 'in force' : 'lifted',
        clearance: cleared === null ? '-' : yesNo(cleared),
        order: one,
      };
    });
  return Object.freeze({
    at,
    zone,
    areaId,
    rows: Object.freeze(rows),
    inForce: rows.filter((one) => one.state === 'in force').length,
    problems,
  });
}

export function renderOrders(report) {
  const out = [
    heading(report.areaId === null ? 'Emergency orders' : `Emergency orders over ${report.areaId}`),
    '',
    definitionList([
      ['As at', formatInstant(report.zone, report.at)],
      ['Orders', String(report.rows.length)],
      ['In force', String(report.inForce)],
    ]),
    '',
  ];
  if (report.rows.length === 0) {
    out.push('No order has ever been signed over this water.');
    return out.join('\n');
  }
  out.push(renderTable(COLUMNS, report.rows));
  const biotoxin = report.rows.filter((one) => one.order.needsClearance);
  if (biotoxin.length > 0) {
    out.push('', heading('Clearance', { underline: '-' }), '');
    out.push(
      renderTable(
        [
          column('number', 'Order', { width: 12 }),
          column('clearance', 'Cleared', { width: 8 }),
          column('reason', 'Reason', { cap: 40 }),
        ],
        biotoxin.map((one) => ({
          number: one.number,
          clearance: one.clearance,
          reason: one.order.reason ?? '-',
        })),
      ),
    );
  }
  if (report.problems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}

/** The orders over one area, oldest first, which is how a history reads. */
export function historyOver(orders, areaId) {
  return ordersFor(orders, areaId);
}
