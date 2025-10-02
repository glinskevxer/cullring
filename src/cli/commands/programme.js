/**
 * The programme command, which is the one the office runs on itself.
 */

import { nextThingDue, programmeReport, renderProgramme } from '../../report/programme.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, asJson } from '../output.js';

export function programme(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const report = programmeReport({
    areas: loaded.areas,
    stations: loaded.stations,
    samples: loaded.samples,
    on,
    history: historyOf(loaded),
  });
  const next = nextThingDue(loaded.areas, on, historyOf(loaded));
  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(on),
        reviews: report.reviews,
        stationsTracked: report.schedule.length,
        boatVisits: report.boatVisits,
        next:
          next === null
            ? null
            : { area: next.area, kind: next.kind, due: formatCivilDate(next.due) },
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }
  io.say(renderProgramme(report));
  if (next !== null) {
    io.say('');
    io.say(`Next due anywhere: ${next.area} ${next.kind} on ${formatCivilDate(next.due)}.`);
  }
  return report.problems.hasError() ? FOUND : OK;
}

/**
 * The review dates a case carries. They are optional: an office that has never
 * written them down still gets a schedule, worked out from the last
 * reclassification, and the report says which it used by printing the date.
 */
export function historyOf(loaded) {
  return loaded.reviewHistory ?? {};
}
