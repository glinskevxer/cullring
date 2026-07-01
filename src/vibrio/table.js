/**
 * The time to temperature table, which is read by three things at once.
 *
 * How long a lot may sit before it is under refrigeration is not one number.
 * It comes out of a table with a row for the month and a column for whether
 * there was ice on the boat, and the row is chosen by the region as well,
 * because the sounds behind the banks run several degrees warmer than the open
 * coast through the same August.
 *
 * The ice column is the part people misread. Ice does not stop the clock. It
 * moves the reading to a longer limit, and only while it is actually on the
 * product: a boat that ices at the dock has not iced on board and is read in
 * the first column.
 *
 * Outside the control season there is no limit at all, and that is a real
 * answer rather than a missing one. A December harvest has no time to
 * temperature requirement and the report should say so rather than leave a
 * blank somebody fills in with a guess.
 */

import { InputError } from '../core/errors.js';
import { monthName } from '../time/civil.js';

export const WARM = 'warm';
export const COOL = 'cool';

/** The two temperature regions the program keeps, which are not the area regions. */
export const REGIONS = Object.freeze([WARM, COOL]);

/**
 * The temperature region of each area region the register can hold. Every
 * letter the area id parser accepts has to be in here, because an area in a
 * region this table does not cover cannot be given a limit at all, and the
 * programme would refuse a lawful harvest for a reason that is really a hole
 * in a table. The second worked example found exactly that: the White Oak
 * areas are in F, and F was not here.
 */
const REGION_OF = new Map([
  ['A', COOL],
  ['B', WARM],
  ['C', WARM],
  ['D', COOL],
  ['E', COOL],
  ['F', WARM],
  ['G', WARM],
]);

/** The area region letters this table covers, for a check that it covers them all. */
export function coveredRegions() {
  return Array.from(REGION_OF.keys()).sort();
}

const LIMITS = new Map([
  [`${WARM}|5`, { plain: 10, iced: 12 }],
  [`${WARM}|6`, { plain: 10, iced: 12 }],
  [`${WARM}|7`, { plain: 10, iced: 12 }],
  [`${WARM}|8`, { plain: 10, iced: 12 }],
  [`${WARM}|9`, { plain: 10, iced: 12 }],
  [`${WARM}|4`, { plain: 12, iced: 14 }],
  [`${WARM}|10`, { plain: 12, iced: 14 }],
  [`${COOL}|6`, { plain: 12, iced: 14 }],
  [`${COOL}|7`, { plain: 12, iced: 14 }],
  [`${COOL}|8`, { plain: 12, iced: 14 }],
  [`${COOL}|9`, { plain: 12, iced: 14 }],
  [`${COOL}|5`, { plain: 14, iced: 18 }],
  [`${COOL}|10`, { plain: 14, iced: 18 }],
]);

/** The temperature region an area sits in, read off its area letter. */
export function temperatureRegion(areaRegionLetter, field = 'region') {
  if (typeof areaRegionLetter !== 'string') {
    throw new InputError('vibrio.region', `${field} must be an area region letter`, {
      field,
      saw: typeof areaRegionLetter,
    });
  }
  const found = REGION_OF.get(areaRegionLetter.trim().toUpperCase());
  if (found === undefined) {
    throw new InputError(
      'vibrio.region',
      `${field} ${areaRegionLetter} sits in no temperature region`,
      {
        field,
        value: areaRegionLetter,
        known: Array.from(REGION_OF.keys()),
      },
    );
  }
  return found;
}

/** True where the month carries a limit at all. */
export function inControlSeason(region, month) {
  requireMonth(month);
  return LIMITS.has(`${requireRegion(region)}|${month}`);
}

/**
 * The hours a lot may sit before it must be under temperature control, or
 * nothing outside the control season. The ice argument chooses the column.
 */
export function hoursAllowed(region, month, { iced = false } = {}) {
  const row = LIMITS.get(`${requireRegion(region)}|${requireMonth(month)}`);
  if (row === undefined) {
    return null;
  }
  return iced ? row.iced : row.plain;
}

export function describeLimit(region, month, { iced = false } = {}) {
  const hours = hoursAllowed(region, month, { iced });
  if (hours === null) {
    return `${monthName(month)} carries no time to temperature limit in ${region} water`;
  }
  const column = iced ? 'with ice on board' : 'without ice on board';
  return `${hours} hours in ${monthName(month)}, ${column}`;
}

/** The months that carry a limit, in calendar order, for the chart on the wall. */
export function controlSeason(region) {
  const wanted = requireRegion(region);
  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    if (LIMITS.has(`${wanted}|${month}`)) {
      months.push(month);
    }
  }
  return months;
}

/** How much longer ice buys in a month, which is nothing outside the season. */
export function iceCredit(region, month) {
  const plain = hoursAllowed(region, month);
  if (plain === null) {
    return 0;
  }
  return hoursAllowed(region, month, { iced: true }) - plain;
}

function requireRegion(region) {
  if (!REGIONS.includes(region)) {
    throw new InputError('vibrio.region', `${region} is not a temperature region`, {
      region,
      known: REGIONS.slice(),
    });
  }
  return region;
}

function requireMonth(month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new InputError('vibrio.month', `${month} is not a month`, { month });
  }
  return month;
}
