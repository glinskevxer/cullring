/**
 * The chart command.
 */

import { chartFor, renderChart } from '../../report/chart.js';
import { findArea } from '../../area/growingArea.js';
import { describePosition } from '../../geo/point.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { OK, REFUSED, asJson } from '../output.js';

export function chart(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return REFUSED;
  }
  const on = dayOf(options, loaded.zone);
  const sheet = chartFor({
    area,
    stations: loaded.stations,
    beds: loaded.beds,
    sources: loaded.sources,
    plans: loaded.plans,
    orders: loaded.orders,
    boundaries: loaded.boundaries,
    on,
  });
  if (options.json === true) {
    io.say(
      asJson({
        area: area.id,
        name: area.name,
        on: formatCivilDate(on),
        classification: sheet.held,
        box: sheet.box,
        stations: sheet.stations.map((one) => ({ id: one.id, at: describePosition(one) })),
        beds: sheet.beds.map((one) => one.id),
        sources: sheet.sources.map((one) => ({ id: one.id, kind: one.kind, cap: one.cap })),
        plans: sheet.plans.length,
        orders: sheet.orders.map((one) => one.number),
      }),
    );
    return OK;
  }
  io.say(renderChart(sheet, { zone: loaded.zone }));
  return OK;
}
