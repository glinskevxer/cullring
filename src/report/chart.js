/**
 * The area chart, which is one page about one piece of water.
 *
 * It is the sheet a new sanitarian is handed. Everything the programme knows
 * about one area, in the order somebody unfamiliar with it would ask: what it
 * is and has been, what shuts it, where the samples come from, what is on the
 * bank, and what ground is worked.
 *
 * There is no picture. A drawing of a boundary in a terminal would be a lie
 * about precision, and the corners are printed instead so that somebody can
 * put them into a real chart plotter.
 */

import { classificationOn } from '../area/growingArea.js';
import { stationsIn } from '../area/station.js';
import { bedsIn } from '../harvest/bed.js';
import { sourcesIn } from '../survey/shoreline.js';
import { boundaryFor, boundingBox } from '../geo/polygon.js';
import { describePlan, plansFor } from '../condition/plan.js';
import { ordersFor } from '../condition/emergency.js';
import { describePosition } from '../geo/point.js';
import { formatCivilDate } from '../time/civil.js';
import { formatInstant } from '../time/instant.js';
import { decimal, yesNo } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

const HISTORY_COLUMNS = [
  column('from', 'From', { width: 10 }),
  column('to', 'To', { width: 10 }),
  column('classification', 'Class', { cap: 24 }),
  column('basis', 'Basis', { width: 10 }),
];

const STATION_COLUMNS = [
  column('id', 'Station', { width: 8 }),
  column('position', 'Position', { width: 20 }),
  column('depth', 'Depth', { width: 7 }),
  column('opened', 'Opened', { width: 10 }),
  column('retired', 'Retired', { width: 10 }),
];

const BED_COLUMNS = [
  column('id', 'Bed', { width: 8 }),
  column('name', 'Name', { cap: 22 }),
  column('tide', 'Tide', { width: 5 }),
  column('elevation', 'Elev', { align: RIGHT, width: 6 }),
  column('tenure', 'Tenure', { width: 7 }),
];

const SOURCE_COLUMNS = [
  column('id', 'Source', { width: 8 }),
  column('kind', 'Kind', { cap: 20 }),
  column('position', 'Position', { width: 20 }),
  column('zone', 'Zone ft', { align: RIGHT, width: 7 }),
  column('cap', 'Caps at', { cap: 24 }),
];

export function chartFor({ area, stations, beds, sources, plans, orders, boundaries, on }) {
  const drawn = boundaryFor(boundaries, area.id);
  return Object.freeze({
    area,
    on,
    held: classificationOn(area, on),
    boundary: drawn,
    box: drawn === null ? null : boundingBox(drawn),
    stations: Object.freeze(stationsIn(stations, area.id)),
    beds: Object.freeze(bedsIn(beds, area.id)),
    sources: Object.freeze(sourcesIn(sources, area.id)),
    plans: Object.freeze(plansFor(plans, area.id)),
    orders: Object.freeze(ordersFor(orders, area.id)),
  });
}

export function renderChart(chart, { zone = 'eastern' } = {}) {
  const out = [
    heading(`${chart.area.id} ${chart.area.name}`),
    '',
    definitionList([
      ['As at', formatCivilDate(chart.on)],
      ['Classification', chart.held ?? 'not classified on that day'],
      ['Acres', chart.area.acres === null ? '-' : String(chart.area.acres)],
      ['Zone', chart.area.zone],
      ['Boundary drawn', yesNo(chart.boundary !== null)],
    ]),
  ];
  if (chart.box !== null) {
    out.push(
      '',
      definitionList([
        ['North', decimal(chart.box.north, 4)],
        ['South', decimal(chart.box.south, 4)],
        ['East', decimal(chart.box.east, 4)],
        ['West', decimal(chart.box.west, 4)],
        ['Corners', String(chart.boundary.vertices.length)],
      ]),
    );
  }
  out.push('', heading('Classification history', { underline: '-' }), '');
  out.push(
    renderTable(
      HISTORY_COLUMNS,
      chart.area.history.map((period) => ({
        from: formatCivilDate(period.from),
        to: period.to === null ? '-' : formatCivilDate(period.to),
        classification: period.classification,
        basis: period.basis,
      })),
    ),
  );
  out.push('', heading('Management plans', { underline: '-' }), '');
  out.push(
    chart.plans.length === 0
      ? 'No plan has ever been written for this area.'
      : chart.plans
          .map((plan) => `${formatCivilDate(plan.effectiveFrom)}  ${describePlan(plan)}`)
          .join('\n'),
  );
  out.push('', heading('Emergency orders', { underline: '-' }), '');
  out.push(
    chart.orders.length === 0
      ? 'No order has ever been signed over this area.'
      : chart.orders
          .map(
            (order) =>
              `${formatInstant(zone, order.issuedAt)}  ${order.number}, ${order.kind}${order.liftedAt === null ? ', in force' : ''}`,
          )
          .join('\n'),
  );
  out.push('', heading('Stations', { underline: '-' }), '');
  out.push(
    chart.stations.length === 0
      ? 'No station has ever been set in this area.'
      : renderTable(
          STATION_COLUMNS,
          chart.stations.map((one) => ({
            id: one.id,
            position: describePosition(one),
            depth: one.depth,
            opened: formatCivilDate(one.openedOn),
            retired: one.retiredOn === null ? '-' : formatCivilDate(one.retiredOn),
          })),
        ),
  );
  out.push('', heading('Beds', { underline: '-' }), '');
  out.push(
    chart.beds.length === 0
      ? 'No bed has been named in this area.'
      : renderTable(
          BED_COLUMNS,
          chart.beds.map((one) => ({
            id: one.id,
            name: one.name,
            tide: one.tideStation,
            elevation: decimal(one.elevation, 1),
            tenure: one.tenure,
          })),
        ),
  );
  out.push('', heading('On the bank', { underline: '-' }), '');
  out.push(
    chart.sources.length === 0
      ? 'The shoreline survey found nothing discharging into this area.'
      : renderTable(
          SOURCE_COLUMNS,
          chart.sources.map((one) => ({
            id: one.id,
            kind: one.kind,
            position: describePosition(one),
            zone: String(one.zoneFeet),
            cap: one.cap,
          })),
        ),
  );
  return out.join('\n');
}
