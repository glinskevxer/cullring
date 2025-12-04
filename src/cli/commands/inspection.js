/**
 * The inspections command.
 */

import { inspectionRound, nextToVisit, renderInspections } from '../../report/inspection.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, asJson } from '../output.js';

export function inspections(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const report = inspectionRound({
    dealers: loaded.dealers,
    inspections: loaded.inspections,
    on,
  });
  const next = nextToVisit(report);
  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(on),
        dealers: report.rows.length,
        neverSeen: report.neverSeen,
        overdue: report.overdue,
        next: next === null ? null : next.dealer,
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }
  io.say(renderInspections(report));
  if (next !== null) {
    io.say('');
    io.say(`Next to visit: ${next.dealer} ${next.name}.`);
  }
  return report.problems.hasError() ? FOUND : OK;
}
