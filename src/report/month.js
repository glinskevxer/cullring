/**
 * The monthly programme report, which is the one that goes to the shellfish
 * sanitation branch and eventually to the interstate conference.
 *
 * It is a count of things, and the counts have to add up in ways somebody
 * checks. Every lot landed is either lawful or carries findings and there is
 * no third bucket. Every closure either lifted inside the month or was still
 * in force at the end of it. The report is written so those two identities are
 * visible on the page rather than asserted in a footnote.
 */

import { closedSeconds, closureNotices } from './closure.js';
import { landingsReport, landingsSummary } from './landings.js';
import { standingSummary } from './standing.js';
import { planInForce } from '../condition/plan.js';
import { addDays, civilDate, daysInMonth, formatCivilDate, monthName } from '../time/civil.js';
import { formatInstant, instantFromCivil } from '../time/instant.js';
import { MIDNIGHT } from '../time/civil.js';
import { window } from '../time/window.js';
import { decimal } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

export function monthSpan(year, month, zone = 'eastern') {
  const first = civilDate(year, month, 1);
  const next = addDays(first, daysInMonth(year, month));
  return window(instantFromCivil(zone, first, MIDNIGHT), instantFromCivil(zone, next, MIDNIGHT));
}

export function monthReport({
  year,
  month,
  areas,
  plans = [],
  feed = {},
  records = [],
  beds = [],
  context = {},
  underControl = new Map(),
  zone = 'eastern',
}) {
  const span = monthSpan(year, month, zone);
  const landings = landingsReport({
    records: records.filter(
      (one) =>
        one.landedAt.epochSecond >= span.start.epochSecond &&
        one.landedAt.epochSecond < span.end.epochSecond,
    ),
    beds,
    context: { ...context, areas, plans, feed },
    underControl,
  });
  const closures = areas.flatMap((area) => {
    const plan = planInForce(plans, area.id, civilDate(year, month, 1));
    if (plan === null) {
      return [];
    }
    return closureNotices({ area, plan, feed, span }).map((notice) =>
      Object.freeze({
        area: area.id,
        notice,
        closedSeconds: closedSeconds({
          plan,
          feed,
          span: notice.closure.span ?? window(notice.closure.start, span.end),
        }),
      }),
    );
  });
  return Object.freeze({
    year,
    month,
    span,
    zone,
    landings,
    landingsSummary: landingsSummary(landings),
    closures: Object.freeze(closures),
    standing: standingSummary({ areas, plans, feed, at: span.end, from: span.start }),
  });
}

const CLOSURE_COLUMNS = [
  column('area', 'Area', { width: 6 }),
  column('from', 'Closed from', { width: 24 }),
  column('to', 'Reopened', { width: 24 }),
  column('hours', 'Hours', { align: RIGHT, width: 6 }),
];

export function renderMonth(report) {
  const summary = report.landingsSummary;
  const stillShut = report.closures.filter((one) => one.notice.open).length;
  const out = [
    heading(`Programme report for ${monthName(report.month)} ${report.year}`),
    '',
    definitionList([
      [
        'Period',
        `${formatCivilDate(civilDate(report.year, report.month, 1))} to ${formatCivilDate(addDays(civilDate(report.year, report.month, 1), daysInMonth(report.year, report.month) - 1))}`,
      ],
      ['Areas classified', String(report.standing.areas)],
      ['Lots landed', String(summary.lots)],
      ['Lots lawful', String(summary.lawful)],
      ['Lots with findings', String(summary.unlawful)],
      ['Closures', String(report.closures.length)],
      ['Still shut at month end', String(stillShut)],
    ]),
    '',
  ];
  out.push(heading('Closures', { underline: '-' }), '');
  if (report.closures.length === 0) {
    out.push('No area was shut under a management plan this month.');
  } else {
    out.push(
      renderTable(
        CLOSURE_COLUMNS,
        report.closures.map((one) => ({
          area: one.area,
          from: formatInstant(report.zone, one.notice.closure.start),
          to:
            one.notice.closure.end === null
              ? 'still shut'
              : formatInstant(report.zone, one.notice.closure.end),
          hours: decimal(one.closedSeconds / 3600, 1),
        })),
      ),
    );
  }
  out.push('', heading('Findings by code', { underline: '-' }), '');
  const codes = Object.entries(summary.codes);
  if (codes.length === 0) {
    out.push('Nothing was found this month.');
  } else {
    out.push(
      renderTable(
        [column('code', 'Code', { cap: 34 }), column('count', 'Count', { align: RIGHT, width: 5 })],
        codes.map(([code, count]) => ({ code, count: String(count) })),
      ),
    );
  }
  out.push(
    '',
    `Lawful and with findings sum to ${summary.lawful + summary.unlawful} of ${summary.lots}.`,
  );
  return out.join('\n');
}
