/**
 * The day's landings, checked.
 *
 * This is the report the sanitarian reads over coffee. One line per lot with
 * the water it came out of, the licence, the temperature clock and a verdict,
 * and then the findings underneath in full because the one line version of a
 * finding is never enough to act on.
 *
 * The lots are printed in lot order rather than in the order the boats came
 * in, because the lot number sorts by day and area and that is how the office
 * files the paper.
 */

import { checkHarvest } from '../harvest/legality.js';
import { shortName } from '../area/classification.js';
import { describeClockStart } from '../vibrio/clock.js';
import { formatCivilDate } from '../time/civil.js';
import { decimal, hours, joinWords, yesNo } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

export const COLUMNS = [
  column('lot', 'Lot', { width: 16 }),
  column('bed', 'Bed', { width: 8 }),
  column('water', 'Water', { width: 5 }),
  column('gear', 'Gear', { width: 6 }),
  column('clock', 'Clock', { cap: 22 }),
  column('elapsed', 'Elapsed', { align: RIGHT, width: 7 }),
  column('limit', 'Limit', { align: RIGHT, width: 8 }),
  column('lawful', 'Ok', { width: 3 }),
];

export function landingsReport({ records, beds, context, underControl = new Map() }) {
  const checked = records.map((record) => {
    const bed = beds.find((one) => one.id === record.bed) ?? null;
    return checkHarvest({
      ...context,
      record,
      bed,
      underControlAt: underControl.get(record.lot) ?? null,
    });
  });
  const rows = checked
    .map((answer) => ({
      lot: answer.lot,
      bed: answer.temperature.bed,
      water: shortName(answer.effective),
      gear: answer.temperature.gear,
      clock: answer.temperature.clockStart.basis,
      elapsed: decimal(answer.temperature.elapsedHours, 1),
      limit: hours(answer.temperature.limitHours),
      lawful: yesNo(answer.lawful),
      answer,
    }))
    .sort((left, right) => (left.lot < right.lot ? -1 : 1));
  return Object.freeze({
    rows: Object.freeze(rows),
    columns: COLUMNS,
    lawful: checked.filter((one) => one.lawful).length,
    unlawful: checked.filter((one) => !one.lawful).length,
    checked: Object.freeze(checked),
  });
}

export function renderLandings(report, { on = null, zone = 'eastern' } = {}) {
  const out = [
    heading('Landings'),
    '',
    definitionList([
      ['Day', on === null ? '-' : formatCivilDate(on)],
      ['Zone', zone],
      ['Lots', String(report.rows.length)],
      ['Lawful', String(report.lawful)],
      ['With findings', String(report.unlawful)],
    ]),
    '',
    renderTable(COLUMNS, report.rows),
  ];
  const withProblems = report.rows.filter((row) => row.answer.problems.length > 0);
  if (withProblems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }));
    for (const row of withProblems) {
      out.push('', `${row.lot}  ${describeClockStart(row.answer.temperature.clockStart)}`);
      for (const finding of row.answer.problems.list()) {
        out.push(`  ${finding.severity}: ${finding.message}`);
      }
    }
  }
  return out.join('\n');
}

/** What the day looked like, for the monthly totals. */
export function landingsSummary(report) {
  const byCode = new Map();
  for (const answer of report.checked) {
    for (const finding of answer.problems.list()) {
      byCode.set(finding.code, (byCode.get(finding.code) ?? 0) + 1);
    }
  }
  return Object.freeze({
    lots: report.rows.length,
    lawful: report.lawful,
    unlawful: report.unlawful,
    containers: report.checked.length,
    codes: Object.freeze(Object.fromEntries(Array.from(byCode).sort())),
  });
}

/** The lots that broke a particular rule, which is how an enquiry starts. */
export function lotsWith(report, code) {
  return report.checked
    .filter((answer) => answer.problems.has(code))
    .map((answer) => answer.lot)
    .sort();
}

export function describeCodes(report) {
  return joinWords(Object.keys(landingsSummary(report).codes));
}
