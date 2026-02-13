/**
 * The forecast command, which is asked on a Friday afternoon.
 */

import { describeForecast, momentsOf, whatWouldClose } from '../../condition/forecast.js';
import { formatInstant } from '../../time/instant.js';
import { loadCase } from '../context.js';
import { FOUND, OK, asJson } from '../output.js';
import { decimal, yesNo } from '../../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../../text/table.js';

const COLUMNS = [
  column('area', 'Area', { width: 6 }),
  column('name', 'Name', { cap: 20 }),
  column('gauge', 'Gauge', { width: 6 }),
  column('would', 'Shuts', { width: 5 }),
  column('at', 'When', { width: 20 }),
  column('reads', 'Reads', { align: RIGHT, width: 6 }),
  column('threshold', 'Trigger', { align: RIGHT, width: 7 }),
];

export function forecastCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const moments = momentsOf(loaded.forecast);
  const rows = whatWouldClose({
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    forecasts: loaded.forecast,
    moments,
    zone: loaded.zone,
  });
  if (options.json === true) {
    io.say(
      asJson({
        readings: loaded.forecast.length,
        moments: moments.length,
        areas: rows.map((one) => ({
          area: one.area,
          wouldClose: one.wouldClose,
          at: one.at === null ? null : one.at.epochSecond,
        })),
      }),
    );
    return rows.some((one) => one.wouldClose) ? FOUND : OK;
  }
  const out = [
    heading('What the forecast would close'),
    '',
    definitionList([
      ['Forecast readings', String(loaded.forecast.length)],
      ['Moments checked', String(moments.length)],
      ['Areas with a plan', String(rows.length)],
      ['Would shut', String(rows.filter((one) => one.wouldClose).length)],
    ]),
    '',
  ];
  if (rows.length === 0) {
    out.push('There is no forecast loaded, so nothing can be said.');
    io.say(out.join('\n'));
    return OK;
  }
  out.push(
    renderTable(
      COLUMNS,
      rows.map((one) => ({
        area: one.area,
        name: one.name,
        gauge: one.plan.trigger.gauge ?? '-',
        would: yesNo(one.wouldClose),
        at: one.at === null ? '-' : formatInstant(loaded.zone, one.at),
        reads: one.cited === null ? '-' : decimal(one.cited.measured, 2),
        threshold: one.cited === null ? '-' : String(one.cited.threshold),
      })),
    ),
  );
  out.push('');
  for (const row of rows) {
    out.push(describeForecast(row));
  }
  io.say(out.join('\n'));
  return rows.some((one) => one.wouldClose) ? FOUND : OK;
}
