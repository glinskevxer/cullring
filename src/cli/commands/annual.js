/**
 * The annual command.
 */

import { annualReport, renderAnnual } from '../../report/annual.js';
import { loadCase } from '../context.js';
import { OK, REFUSED, asJson } from '../output.js';

export function annual(options, io) {
  const year = Number(options.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    io.warn(`refused: ${options.year} is not a year`);
    return REFUSED;
  }
  const loaded = loadCase(options.case, { zone: options.zone });
  const report = annualReport({
    year,
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    orders: loaded.orders,
    records: loaded.records,
    zone: loaded.zone,
  });
  if (options.json === true) {
    io.say(
      asJson({
        year,
        classified: report.classified,
        acres: report.acres,
        byClass: Object.fromEntries(report.byClass),
        closures: report.closures.length,
        closureHours: report.closureHours,
        orders: report.orders,
        landings: report.landings,
        containers: report.containers,
      }),
    );
    return OK;
  }
  io.say(renderAnnual(report));
  return OK;
}
