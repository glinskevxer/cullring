/**
 * Whether a lot got under temperature control in time.
 *
 * Three separate lookups have to agree before this question has an answer at
 * all: where the clock started, which the gear decides; which row of the table
 * applies, which the region and the month of that start decide; and which
 * column, which the ice decides. Then, and only then, is there a number of
 * hours to compare an elapsed time against.
 *
 * The month is taken from the moment the clock started rather than from the
 * landing. On the last morning of a control season the two can be different
 * months and the lot is judged by the water it was lying in, not by the hour
 * the boat reached the dock.
 */

import { findings } from '../core/finding.js';
import { parseAreaId } from '../core/identity.js';
import { civilDateAt, hoursBetween, isInstant } from '../time/instant.js';
import { formatCivilDate, monthName } from '../time/civil.js';
import { clockStart, describeClockStart, headStartSeconds } from './clock.js';
import { hoursAllowed, inControlSeason, temperatureRegion } from './table.js';

export function vibrioCheck({ record, bed, tides = [], underControlAt = null, zone = null }) {
  const problems = findings();
  const keptIn = zone ?? record.zone;
  const start = clockStart({ record, bed, tides });
  if (!start.known) {
    problems.error('vibrio.noClock', describeClockStart(start), {
      lot: record.lot,
      bed: bed.id,
      station: bed.tideStation,
    });
    return sealed({ record, bed, start, problems });
  }
  const day = civilDateAt(keptIn, start.at);
  const region = temperatureRegion(parseAreaId(record.areaId).region);
  if (!inControlSeason(region, day.month)) {
    problems.note(
      'vibrio.outOfSeason',
      `${monthName(day.month)} carries no limit in ${region} water`,
      {
        lot: record.lot,
        region,
        month: day.month,
      },
    );
    return sealed({ record, bed, start, region, day, problems, limitHours: null });
  }
  const limitHours = hoursAllowed(region, day.month, { iced: record.iced });
  if (underControlAt === null || !isInstant(underControlAt)) {
    problems.error(
      'vibrio.noControl',
      `${record.lot} has no record of going under temperature control`,
      {
        lot: record.lot,
        limitHours,
      },
    );
    return sealed({ record, bed, start, region, day, problems, limitHours });
  }
  const elapsed = hoursBetween(start.at, underControlAt);
  if (elapsed < 0) {
    problems.error(
      'vibrio.beforeClock',
      `${record.lot} went under control before its clock started`,
      {
        lot: record.lot,
      },
    );
    return sealed({ record, bed, start, region, day, problems, limitHours, elapsed });
  }
  if (elapsed > limitHours) {
    problems.error(
      'vibrio.overTime',
      `${record.lot} took ${round(elapsed)} hours against a limit of ${limitHours}`,
      { lot: record.lot, elapsed, limitHours, iced: record.iced, region, month: day.month },
    );
  }
  return sealed({ record, bed, start, region, day, problems, limitHours, elapsed, underControlAt });
}

function sealed({
  record,
  bed,
  start,
  region = null,
  day = null,
  problems,
  limitHours = null,
  elapsed = null,
  underControlAt = null,
}) {
  return Object.freeze({
    lot: record.lot,
    bed: bed.id,
    gear: record.gear,
    iced: record.iced,
    clockStart: start,
    headStartSeconds: start.known ? headStartSeconds(start, record) : null,
    region,
    on: day === null ? null : formatCivilDate(day),
    month: day === null ? null : day.month,
    limitHours,
    elapsedHours: elapsed,
    underControlAt,
    compliant: problems.isLawful(),
    problems,
  });
}

/** How much of the allowance a lot had already spent before anybody picked it up. */
export function spentBeforeHarvest(answer) {
  if (answer.headStartSeconds === null || answer.limitHours === null) {
    return null;
  }
  return answer.headStartSeconds / 3600 / answer.limitHours;
}

export function describeVibrio(answer) {
  if (answer.limitHours === null) {
    return `${answer.lot}: no limit applies`;
  }
  if (answer.elapsedHours === null) {
    return `${answer.lot}: limit ${answer.limitHours} hours, nothing recorded`;
  }
  return `${answer.lot}: ${round(answer.elapsedHours)} of ${answer.limitHours} hours`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
