/**
 * The annual report, which is the one the conference reads.
 *
 * It is a set of counts that have to be defensible a year later, so every one
 * of them is worked out from the registers rather than kept as a running
 * total. A running total is a number nobody can reconstruct, and the first
 * question at the conference is always how a number was arrived at.
 *
 * The acres are the part that catches people. An area classified for part of
 * the year counts in the class it was in at the year end, not in both, and the
 * report says which convention it used rather than leaving the reader to work
 * it out from the fact that the columns add up.
 */

import { CLASSIFICATIONS, shortName } from '../area/classification.js';
import { classificationOn } from '../area/growingArea.js';
import { closureHistory } from '../condition/closure.js';
import { planInForce } from '../condition/plan.js';
import { inForceAt } from '../condition/emergency.js';
import {
  addDays,
  civilDate,
  compareCivilDate,
  daysInMonth,
  formatCivilDate,
} from '../time/civil.js';
import { MIDNIGHT } from '../time/civil.js';
import { instantFromCivil } from '../time/instant.js';
import { window } from '../time/window.js';
import { decimal } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

export const AT_YEAR_END = 'the class each area was in at the year end';

const CLASS_COLUMNS = [
  column('classification', 'Class', { cap: 24 }),
  column('short', 'Code', { width: 5 }),
  column('areas', 'Areas', { align: RIGHT, width: 5 }),
  column('acres', 'Acres', { align: RIGHT, width: 8 }),
  column('share', 'Share', { align: RIGHT, width: 6 }),
];

export function yearSpan(year, zone = 'eastern') {
  const first = civilDate(year, 1, 1);
  const next = civilDate(year + 1, 1, 1);
  return window(instantFromCivil(zone, first, MIDNIGHT), instantFromCivil(zone, next, MIDNIGHT));
}

export function annualReport({
  year,
  areas,
  plans = [],
  feed = {},
  orders = [],
  records = [],
  zone = 'eastern',
}) {
  const span = yearSpan(year, zone);
  const yearEnd = civilDate(year, 12, 31);
  const byClass = new Map(CLASSIFICATIONS.map((name) => [name, { areas: 0, acres: 0 }]));
  let classified = 0;
  let acres = 0;

  for (const area of areas) {
    const held = classificationOn(area, yearEnd);
    if (held === null) {
      continue;
    }
    classified += 1;
    acres += area.acres ?? 0;
    const row = byClass.get(held);
    row.areas += 1;
    row.acres += area.acres ?? 0;
  }

  const closures = [];
  for (const area of areas) {
    const plan = planInForce(plans, area.id, civilDate(year, 7, 1));
    if (plan === null) {
      continue;
    }
    for (const closure of closureHistory(plan, feed, span)) {
      const end = closure.end === null ? span.end : closure.end;
      closures.push({
        area: area.id,
        hours: (end.epochSecond - closure.start.epochSecond) / 3600,
        restarts: closure.restarts,
      });
    }
  }

  const landed = records.filter(
    (one) =>
      one.landedAt.epochSecond >= span.start.epochSecond &&
      one.landedAt.epochSecond < span.end.epochSecond,
  );

  return Object.freeze({
    year,
    span,
    convention: AT_YEAR_END,
    classified,
    acres,
    byClass,
    closures: Object.freeze(closures),
    closureHours: closures.reduce((total, one) => total + one.hours, 0),
    orders: orders.filter((one) => inForceAt(one, span.end) || wasInYear(one, span)).length,
    landings: landed.length,
    containers: landed.reduce((total, one) => total + one.containers, 0),
  });
}

function wasInYear(order, span) {
  return (
    order.issuedAt.epochSecond < span.end.epochSecond &&
    (order.liftedAt === null || order.liftedAt.epochSecond >= span.start.epochSecond)
  );
}

export function renderAnnual(report) {
  const rows = CLASSIFICATIONS.map((name) => {
    const row = report.byClass.get(name);
    return {
      classification: name,
      short: shortName(name),
      areas: String(row.areas),
      acres: String(row.acres),
      share: report.acres === 0 ? '-' : `${decimal((row.acres / report.acres) * 100, 1)}%`,
    };
  });
  return [
    heading(`Annual report for ${report.year}`),
    '',
    definitionList([
      [
        'Period',
        `${formatCivilDate(civilDate(report.year, 1, 1))} to ${formatCivilDate(civilDate(report.year, 12, 31))}`,
      ],
      ['Counted by', report.convention],
      ['Areas classified', String(report.classified)],
      ['Acres classified', String(report.acres)],
      ['Closures under a plan', String(report.closures.length)],
      ['Hours shut', decimal(report.closureHours, 1)],
      ['Emergency orders touching the year', String(report.orders)],
      ['Lots landed', String(report.landings)],
      ['Bushels landed', String(report.containers)],
    ]),
    '',
    heading('Acres by classification', { underline: '-' }),
    '',
    renderTable(CLASS_COLUMNS, rows),
    '',
    `The acres add to ${report.acres}, which is every classified acre counted once.`,
  ].join('\n');
}

/** The last day of a month, which the quarterly cut of this report needs. */
export function endOfMonth(year, month) {
  return addDays(civilDate(year, month, 1), daysInMonth(year, month) - 1);
}

export function isInYear(date, year) {
  return (
    compareCivilDate(date, civilDate(year, 1, 1)) >= 0 &&
    compareCivilDate(date, civilDate(year, 12, 31)) <= 0
  );
}
