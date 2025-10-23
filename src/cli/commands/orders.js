/**
 * The orders command.
 */

import { ordersReport, renderOrders } from '../../report/orders.js';
import { findArea } from '../../area/growingArea.js';
import { conformingSamples, loadCase } from '../context.js';
import { momentOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

export function orders(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const at = momentOf(options, loaded.zone);
  let areaId = null;
  if (options.area !== undefined && options.area !== null) {
    const area = findArea(loaded.areas, options.area);
    if (area === null) {
      io.warn(`refused: ${options.area} is not in the register`);
      return REFUSED;
    }
    areaId = area.id;
  }
  const report = ordersReport({
    orders: loaded.orders,
    at,
    samples: conformingSamples(loaded.samples, loaded.zone),
    zone: loaded.zone,
    areaId,
  });
  if (options.json === true) {
    io.say(
      asJson({
        at: at.epochSecond,
        area: areaId,
        inForce: report.inForce,
        orders: report.rows.map((one) => ({
          number: one.number,
          kind: one.kind,
          areas: one.order.areas,
          state: one.state,
          clearance: one.clearance,
        })),
      }),
    );
    return report.inForce > 0 ? FOUND : OK;
  }
  io.say(renderOrders(report));
  return report.inForce > 0 ? FOUND : OK;
}
