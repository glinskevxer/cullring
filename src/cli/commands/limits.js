/**
 * The take command.
 */

import { renderTake, takeReport } from '../../report/limits.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, asJson } from '../output.js';

export function take(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const day = dayOf(options, loaded.zone);
  const report = takeReport({
    records: loaded.records,
    harvesters: loaded.harvesters,
    limits: loaded.limits,
    day,
  });
  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(day),
        licences: report.licences,
        over: report.over,
        rows: report.rows,
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }
  io.say(renderTake(report));
  return report.problems.hasError() ? FOUND : OK;
}
