/**
 * The coverage command, which is the first thing to run against a case
 * somebody has just handed you.
 *
 * It answers a question nothing else does: not whether the case is right, but
 * whether it is complete enough for the answers to mean what they look like
 * they mean. A case with no tide table produces a perfectly clean month of
 * landings, and every intertidal clock in it is the generous reading.
 */

import { caveat, coverageReport, renderCoverage } from '../../report/coverage.js';
import { loadCase } from '../context.js';
import { FOUND, OK, asJson } from '../output.js';

export function coverage(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const report = coverageReport(loaded);

  if (options.json === true) {
    io.say(
      asJson({
        case: loaded.directory,
        registers: report.registers.length,
        present: report.present,
        complete: report.complete,
        caveat: caveat(report),
        reports: report.rows.map((one) => ({
          report: one.report,
          state: one.state,
          missing: one.absent,
          because: one.because,
        })),
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }

  io.say(renderCoverage(report));
  const sentence = caveat(report);
  if (sentence !== null) {
    io.say('');
    io.say(sentence);
  }
  for (const problem of report.problems.list()) {
    io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
  }
  return report.problems.hasError() ? FOUND : OK;
}
