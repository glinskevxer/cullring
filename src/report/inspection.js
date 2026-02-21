/**
 * The inspection round, which is the inspector's own diary.
 *
 * One line per certified dealer with what they scored last time, what that
 * meant, and when they are due back. The dealers with no inspection at all are
 * the interesting rows: a certified plant nobody has ever walked is a hole in
 * the programme, and it reads differently from one that is merely overdue.
 */

import { findings } from '../core/finding.js';
import { isCertified } from '../licence/dealer.js';
import { SHUT, latestFor, outcomeOf } from '../licence/inspection.js';
import { compareCivilDate, daysBetween, formatCivilDate } from '../time/civil.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

export const COLUMNS = [
  column('dealer', 'Dealer', { width: 7 }),
  column('name', 'Name', { cap: 26 }),
  column('last', 'Last seen', { width: 10 }),
  column('score', 'Score', { align: RIGHT, width: 5 }),
  column('outcome', 'Outcome', { cap: 24 }),
  column('due', 'Due', { width: 10 }),
  column('over', 'Days over', { align: RIGHT, width: 9 }),
];

export function inspectionRound({ dealers, inspections, on }) {
  const problems = findings();
  // A round asked about the first of May cannot know about a visit made in
  // June. Reading the whole list gave a plant an outcome from an inspection
  // that had not happened yet, which made every historical report wrong in a
  // direction nobody would question, because it looked more up to date.
  const soFar = inspections.filter((one) => compareCivilDate(one.on, on) <= 0);
  const rows = dealers
    .filter((one) => isCertified(one, on))
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map((dealer) => {
      const last = latestFor(soFar, dealer.id);
      if (last === null) {
        problems.error('inspection.neverSeen', `${dealer.id} has never been inspected`, {
          dealer: dealer.id,
        });
        return Object.freeze({
          dealer: dealer.id,
          name: dealer.name,
          last: '-',
          score: '-',
          outcome: 'never inspected',
          due: '-',
          over: '-',
          state: 'never inspected',
        });
      }
      const outcome = outcomeOf(last);
      if (outcome.outcome === SHUT) {
        problems.error('inspection.shut', `${dealer.id} is shut until it is re-inspected`, {
          dealer: dealer.id,
          critical: last.critical.map((item) => item.id),
        });
      }
      const over = outcome.nextDue === null ? 0 : Math.max(0, daysBetween(outcome.nextDue, on));
      if (over > 0) {
        problems.warn('inspection.overdue', `${dealer.id} is ${over} days past due`, {
          dealer: dealer.id,
          days: over,
        });
      }
      return Object.freeze({
        dealer: dealer.id,
        name: dealer.name,
        last: formatCivilDate(last.on),
        score: String(last.score),
        outcome: outcome.outcome,
        due: outcome.nextDue === null ? '-' : formatCivilDate(outcome.nextDue),
        over: outcome.nextDue === null ? '-' : String(over),
        state: over > 0 ? 'overdue' : 'current',
        inspection: last,
      });
    });
  return Object.freeze({
    on,
    rows: Object.freeze(rows),
    columns: COLUMNS,
    neverSeen: rows.filter((one) => one.state === 'never inspected').length,
    overdue: rows.filter((one) => one.state === 'overdue').length,
    problems,
  });
}

export function renderInspections(report) {
  const out = [
    heading('Inspection round'),
    '',
    definitionList([
      ['As at', formatCivilDate(report.on)],
      ['Certified dealers', String(report.rows.length)],
      ['Never inspected', String(report.neverSeen)],
      ['Overdue', String(report.overdue)],
    ]),
    '',
    renderTable(COLUMNS, report.rows),
  ];
  if (report.problems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}

/** The next plant the inspector should walk, which is the one longest overdue. */
export function nextToVisit(report) {
  const never = report.rows.filter((one) => one.state === 'never inspected');
  if (never.length > 0) {
    return never[0];
  }
  const overdue = report.rows.filter((one) => one.state === 'overdue');
  if (overdue.length === 0) {
    return null;
  }
  return overdue.reduce((worst, one) => (Number(one.over) > Number(worst.over) ? one : worst));
}

export function dueBefore(report, date) {
  return report.rows.filter(
    (one) => one.due !== '-' && compareCivilDate(parse(one.due), date) <= 0,
  );
}

function parse(text) {
  const [year, month, day] = text.split('-').map(Number);
  return { year, month, day };
}
