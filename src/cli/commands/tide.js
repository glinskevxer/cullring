/**
 * The tide and temperature commands.
 *
 * These two are asked together often enough to be written together. A crew
 * leader planning a week wants to know when the flat will be dry, and the
 * sanitarian wants to know what that does to the clock. Printing the exposure
 * windows next to the limit makes the answer one thing rather than two.
 */

import { exposureWindows, predictedSpan, tideStations } from '../../tide/table.js';
import { findBed } from '../../harvest/bed.js';
import { parseAreaId } from '../../core/identity.js';
import {
  controlSeason,
  describeLimit,
  hoursAllowed,
  iceCredit,
  temperatureRegion,
} from '../../vibrio/table.js';
import { MIDNIGHT, addDays, formatCivilDate, monthName, parseCivilDate } from '../../time/civil.js';
import { formatInstant, instantFromCivil } from '../../time/instant.js';
import { lengthHours, window } from '../../time/window.js';
import { loadCase } from '../context.js';
import { OK, REFUSED, asJson } from '../output.js';
import { decimal } from '../../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../../text/table.js';

const EXPOSURE_COLUMNS = [
  column('from', 'Out of the water from', { width: 22 }),
  column('to', 'Until', { width: 22 }),
  column('hours', 'Hours', { align: RIGHT, width: 6 }),
];

export function tideCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const bed = findBed(loaded.beds, options.bed);
  if (bed === null) {
    io.warn(`refused: ${options.bed} is not in the register`);
    return REFUSED;
  }
  const covered = predictedSpan(loaded.tides, bed.tideStation);
  if (covered === null) {
    io.warn(`refused: nothing is predicted for ${bed.tideStation}`);
    return REFUSED;
  }
  const on = parseCivilDate(options.on, 'on');
  const span = window(
    instantFromCivil(loaded.zone, on, MIDNIGHT),
    instantFromCivil(loaded.zone, addDays(on, 1), MIDNIGHT),
  );
  const windows = exposureWindows(loaded.tides, bed.tideStation, bed.elevation, span);
  const rows = windows.map((one) => ({
    from: formatInstant(loaded.zone, one.start),
    to: formatInstant(loaded.zone, one.end),
    hours: decimal(lengthHours(one), 1),
  }));
  if (options.json === true) {
    io.say(
      asJson({
        bed: bed.id,
        station: bed.tideStation,
        elevation: bed.elevation,
        on: formatCivilDate(on),
        exposures: rows,
      }),
    );
    return OK;
  }
  const out = [
    heading(`Exposure of ${bed.id} ${bed.name}`),
    '',
    definitionList([
      ['Tide station', bed.tideStation],
      ['Elevation', `${decimal(bed.elevation, 1)} ft above datum`],
      ['Day', formatCivilDate(on)],
      [
        'Table covers',
        `${formatInstant(loaded.zone, covered.start)} to ${formatInstant(loaded.zone, covered.end)}`,
      ],
    ]),
    '',
  ];
  if (rows.length === 0) {
    out.push('The bed does not come out of the water on this day.');
  } else {
    out.push(renderTable(EXPOSURE_COLUMNS, rows));
  }
  io.say(out.join('\n'));
  return OK;
}

const LIMIT_COLUMNS = [
  column('month', 'Month', { width: 10 }),
  column('plain', 'No ice', { align: RIGHT, width: 7 }),
  column('iced', 'With ice', { align: RIGHT, width: 8 }),
  column('credit', 'Ice buys', { align: RIGHT, width: 8 }),
];

export function vibrioCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const region = regionFor(options, loaded, io);
  if (region === null) {
    return REFUSED;
  }
  const months = controlSeason(region);
  const rows = months.map((month) => ({
    month: monthName(month),
    plain: String(hoursAllowed(region, month)),
    iced: String(hoursAllowed(region, month, { iced: true })),
    credit: String(iceCredit(region, month)),
  }));
  if (options.json === true) {
    io.say(asJson({ region, season: months, limits: rows }));
    return OK;
  }
  io.say(
    [
      heading(`Time to temperature in ${region} water`),
      '',
      definitionList([
        ['Region', region],
        ['Control season', months.map((month) => monthName(month)).join(', ')],
        ['Outside it', 'no limit applies'],
      ]),
      '',
      renderTable(LIMIT_COLUMNS, rows),
      '',
      describeLimit(region, months[Math.floor(months.length / 2)]),
    ].join('\n'),
  );
  return OK;
}

function regionFor(options, loaded, io) {
  if (options.area === undefined || options.area === null) {
    io.warn('refused: an area is needed, so the region can be read off it');
    return null;
  }
  try {
    return temperatureRegion(parseAreaId(options.area, 'area').region);
  } catch (error) {
    io.warn(`refused: ${error.message}`);
    return null;
  }
}

/** The stations the loaded tide table predicts, for a help message. */
export function stationsIn(loaded) {
  return tideStations(loaded.tides);
}
