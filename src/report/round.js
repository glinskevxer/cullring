/**
 * The sampling round, which is the programme report turned into a day's work.
 *
 * The programme report answers "what is behind". This one answers "so what do
 * we do on Monday", and the two disagree on purpose. Everything overdue is
 * behind; only nine of it fits in the boat. Printing both together is what
 * stops the round quietly becoming the definition of what was due.
 */

import { LEFT, RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';
import { classificationOn } from '../area/growingArea.js';
import { formatCivilDate } from '../time/civil.js';
import { shortName } from '../area/classification.js';
import { stationsInService } from '../area/station.js';
import { nextTrip, rotation, rotationFindings } from '../survey/rotation.js';
import { decimal } from '../text/format.js';

const ROUND_COLUMNS = [
  column('order', 'No', { align: RIGHT, width: 3 }),
  column('station', 'Station', { width: 10 }),
  column('area', 'Area', { width: 6 }),
  column('class', 'Class', { width: 8 }),
  column('last', 'Last worked', { width: 12 }),
  column('over', 'Days over', { align: RIGHT, width: 10 }),
  column('why', 'Why now', { align: LEFT, cap: 26 }),
];

export function roundReport({
  areas,
  stations,
  samples,
  on,
  capacity = undefined,
  share = undefined,
}) {
  const standing = new Map();
  const inService = [];
  for (const area of areas) {
    const held = classificationOn(area, on);
    if (held === null) {
      continue;
    }
    standing.set(area.id, held);
    inService.push(...stationsInService(stations, area.id, on));
  }

  const queue = rotation({ areas, standing, stations: inService, samples, on });
  const trip = nextTrip({
    areas,
    standing,
    stations: inService,
    samples,
    on,
    ...(capacity === undefined ? {} : { capacity }),
    ...(share === undefined ? {} : { share }),
  });
  const problems = rotationFindings(trip, queue);

  const rows = trip.stations.map((row, index) => ({
    order: String(index + 1),
    station: row.station,
    area: row.area,
    class: shortName(row.classification),
    last: row.lastVisited === null ? 'never' : formatCivilDate(row.lastVisited),
    over: row.state === 'never visited' ? '-' : String(row.overdueDays),
    why: whyNow(row),
    row,
  }));

  return Object.freeze({
    on,
    rows: Object.freeze(rows),
    trip,
    due: queue.length,
    tracked: inService.length,
    problems,
  });
}

/** The one reason a station is on this list, which is what gets argued with. */
export function whyNow(row) {
  if (row.state === 'never visited') {
    return 'never sampled';
  }
  if (row.overdueDays >= 365) {
    return 'over a year behind';
  }
  return `${row.perYear} a year, ${row.overdueDays} days over`;
}

export function renderRound(report) {
  const out = [
    heading(`Sampling round for ${formatCivilDate(report.on)}`),
    '',
    definitionList([
      ['Stations in service', String(report.tracked)],
      ['Due today', String(report.due)],
      ['On this round', String(report.rows.length)],
      ['Left waiting', String(report.trip.waiting)],
      ['Most from any one area', String(report.trip.perArea)],
      [
        'Share of what is due',
        report.due === 0
          ? 'nothing is due'
          : `${decimal((report.rows.length / report.due) * 100, 1)}%`,
      ],
    ]),
  ];
  if (report.rows.length === 0) {
    out.push('', 'Nothing is due. The boat can go somewhere else.');
    return out.join('\n');
  }
  out.push(
    '',
    heading('The round', { underline: '-' }),
    '',
    renderTable(ROUND_COLUMNS, report.rows),
  );
  if (report.problems.length > 0) {
    out.push('', heading('Left behind', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}
