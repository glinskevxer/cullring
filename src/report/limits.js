/**
 * The take report, which is the patrol's day sheet.
 *
 * One line per licence that landed anything, with what they took out of each
 * area and whether it added past a limit. It is printed by licence rather than
 * by lot because that is the unit the limit is written in, and a report laid
 * out by lot would make the arithmetic invisible.
 */

import { findings } from '../core/finding.js';
import { checkTake, limitFor } from '../harvest/limit.js';
import { formatCivilDate, sameCivilDate } from '../time/civil.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

const COLUMNS = [
  column('harvester', 'Licence', { width: 14 }),
  column('name', 'Name', { cap: 20 }),
  column('species', 'Species', { width: 12 }),
  column('area', 'Area', { width: 6 }),
  column('took', 'Took', { align: RIGHT, width: 5 }),
  column('limit', 'Limit', { align: RIGHT, width: 5 }),
  column('ok', 'Ok', { width: 3 }),
];

function compareRow(left, right) {
  if (left.harvester !== right.harvester) {
    return left.harvester < right.harvester ? -1 : 1;
  }
  if (left.species !== right.species) {
    return left.species < right.species ? -1 : 1;
  }
  return left.area < right.area ? -1 : 1;
}

export function takeReport({ records, harvesters, limits, day }) {
  const problems = findings();
  const landed = records.filter((one) => sameCivilDate(one.landedOn, day));
  const holders = Array.from(new Set(landed.map((one) => one.harvester))).sort();
  const rows = [];
  for (const harvester of holders) {
    const answer = checkTake({ records: landed, harvester, day, limits });
    problems.absorb(answer.problems);
    const found = harvesters.find((one) => one.id === harvester);
    const name = found === undefined ? '-' : found.name;
    for (const [key, took] of answer.took.byArea) {
      const [species, areaId] = key.split('|');
      const limit = limitFor(limits, species, areaId);
      rows.push({
        harvester,
        name,
        species,
        area: areaId,
        took: String(took),
        limit: limit === null ? '-' : String(limit.bushels),
        ok: limit === null || took <= limit.bushels ? 'yes' : 'no',
      });
    }
  }
  return Object.freeze({
    day,
    rows: Object.freeze(rows.sort(compareRow)),
    licences: holders.length,
    over: rows.filter((one) => one.ok === 'no').length,
    problems,
  });
}

export function renderTake(report) {
  const out = [
    heading('Take against the limits'),
    '',
    definitionList([
      ['Day', formatCivilDate(report.day)],
      ['Licences that landed', String(report.licences)],
      ['Over an area limit', String(report.over)],
    ]),
    '',
  ];
  if (report.rows.length === 0) {
    out.push('Nothing was landed on this day.');
    return out.join('\n');
  }
  out.push(renderTable(COLUMNS, report.rows));
  if (report.problems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}
