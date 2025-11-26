/**
 * The book command.
 */

import { bookReport, renderBook } from '../../report/book.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

export function bookCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const report = bookReport({
    book: loaded.book,
    dealers: loaded.dealers,
    dealerId: options.dealer,
    on,
    zone: loaded.zone,
  });
  if (report.dealer === null) {
    io.warn(`refused: ${options.dealer} is not in the register`);
    return REFUSED;
  }
  if (options.json === true) {
    io.say(
      asJson({
        dealer: report.dealerId,
        kind: report.dealer.kind,
        allowed: report.allowed,
        entries: report.entries.length,
        clean: report.audit.clean,
        reconciliation: report.audit.rows,
        findings: report.problems.list(),
      }),
    );
    return report.problems.hasError() ? FOUND : OK;
  }
  io.say(renderBook(report));
  return report.problems.hasError() ? FOUND : OK;
}
