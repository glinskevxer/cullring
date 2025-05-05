/**
 * Where the clock starts, which is the question the gear answers.
 *
 * For gear that works from a boat the clock starts when the shellfish come out
 * of the water, and that is the moment the harvest started.
 *
 * For gear that works a flat on foot the shellfish were already out of the
 * water before anybody picked them up. The bed came up on the falling tide and
 * has been warming in the sun since, so the clock starts at the moment the
 * tide uncovered it, which can be three hours before the first bag went in the
 * basket. A programme that started both clocks at the harvest would pass a lot
 * that had been on a hot flat since dawn.
 *
 * The awkward part is what to do when there is no tide prediction for that
 * bed. The safe reading is not the harvest time, because that is the generous
 * answer and it is generous exactly where the risk is worst. The honest answer
 * is that the clock cannot be started, and the caller is told so rather than
 * handed a number.
 */

import { isIntertidalGear } from '../licence/harvester.js';
import { lastExposureStart } from '../tide/table.js';
import { isBefore } from '../time/instant.js';

export const FROM_HARVEST = 'harvest';
export const FROM_EXPOSURE = 'first tide exposure';

/**
 * The moment the clock starts for a harvest, and why. An intertidal harvest
 * whose bed was still under water at the start is read from the harvest, since
 * there is no exposure to run from.
 */
export function clockStart({ record, bed, tides = [] }) {
  if (!isIntertidalGear(record.gear)) {
    return Object.freeze({
      at: record.startedAt,
      basis: FROM_HARVEST,
      reason: `${record.gear} works from a boat`,
      known: true,
    });
  }
  const uncovered = lastExposureStart(tides, bed.tideStation, bed.elevation, record.startedAt);
  if (uncovered === null) {
    const covered = wasPredictable(tides, bed, record);
    if (!covered) {
      return Object.freeze({
        at: null,
        basis: FROM_EXPOSURE,
        reason: `no tide is predicted for ${bed.tideStation} at that moment`,
        known: false,
      });
    }
    return Object.freeze({
      at: record.startedAt,
      basis: FROM_HARVEST,
      reason: `${bed.id} was under water when the harvest started`,
      known: true,
    });
  }
  if (!isBefore(uncovered, record.startedAt)) {
    return Object.freeze({
      at: record.startedAt,
      basis: FROM_HARVEST,
      reason: `${bed.id} came up no earlier than the harvest`,
      known: true,
    });
  }
  return Object.freeze({
    at: uncovered,
    basis: FROM_EXPOSURE,
    reason: `${bed.id} came out of the water before the harvest started`,
    known: true,
  });
}

function wasPredictable(tides, bed, record) {
  const wanted = bed.tideStation;
  const forStation = tides.filter((one) => one.station === wanted);
  if (forStation.length < 2) {
    return false;
  }
  const first = forStation.reduce((best, one) =>
    one.at.epochSecond < best.at.epochSecond ? one : best,
  );
  const last = forStation.reduce((best, one) =>
    one.at.epochSecond > best.at.epochSecond ? one : best,
  );
  return (
    record.startedAt.epochSecond >= first.at.epochSecond &&
    record.startedAt.epochSecond <= last.at.epochSecond
  );
}

/** How long the lot had already been out of the water when the harvest began. */
export function headStartSeconds(start, record) {
  if (start.at === null) {
    return null;
  }
  return record.startedAt.epochSecond - start.at.epochSecond;
}

export function describeClockStart(start) {
  if (!start.known) {
    return `the clock cannot be started: ${start.reason}`;
  }
  return `the clock runs from ${start.basis}, because ${start.reason}`;
}
