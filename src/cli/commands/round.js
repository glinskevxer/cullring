/**
 * The round command: what the boat does next, out of everything that is due.
 */

import { renderRound, roundReport } from '../../report/round.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

export function round(options, io) {
  const capacity = readCount(options.boat);
  if (capacity === false) {
    io.warn('refused: a boat works a whole number of stations in a day');
    return REFUSED;
  }
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const report = roundReport({
    areas: loaded.areas,
    stations: loaded.stations,
    samples: loaded.samples,
    on,
    ...(capacity === null ? {} : { capacity }),
  });

  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(on),
        due: report.due,
        capacity: report.trip.capacity,
        perArea: report.trip.perArea,
        waiting: report.trip.waiting,
        round: report.rows.map((row) => ({
          station: row.station,
          area: row.area,
          lastWorked: row.row.lastVisited === null ? null : formatCivilDate(row.row.lastVisited),
          overdueDays: row.row.overdueDays,
          why: row.why,
        })),
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }

  io.say(renderRound(report));
  return report.problems.hasError() ? FOUND : OK;
}

/** Nothing given is not a refusal; it means the standard boat. */
function readCount(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 ? count : false;
}
