/**
 * Sampling stations, and the reason they are not just points.
 *
 * A station is a fixed place the boat goes to. It belongs to one area, it has
 * a position, and it carries the depth the sample is drawn at, because a
 * surface sample and a bottom sample from the same buoy are different samples
 * and the survey has to be able to say which it holds.
 *
 * A station can be retired. Retired stations stay in the register because the
 * results they produced are still in the survey window, and dropping the
 * station would leave a set of results with nowhere to have come from.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { parseStationId, stationBelongsTo } from '../core/identity.js';
import { compareCivilDate, parseCivilDate } from '../time/civil.js';

export const SURFACE = 'surface';
export const BOTTOM = 'bottom';

export const DEPTHS = Object.freeze([SURFACE, BOTTOM]);

export function station({
  id,
  latitude,
  longitude,
  depth = SURFACE,
  description = null,
  openedOn,
  retiredOn = null,
}) {
  const parsed = parseStationId(id, 'station');
  requireNumber(latitude, 'latitude', { min: -90, max: 90 });
  requireNumber(longitude, 'longitude', { min: -180, max: 180 });
  if (!DEPTHS.includes(depth)) {
    throw new InputError('station.depth', `${depth} is not a depth a sample is drawn at`, {
      depth,
      known: DEPTHS.slice(),
    });
  }
  if (description !== null) {
    requireString(description, 'description');
  }
  const opened = asDate(openedOn, 'openedOn');
  const retired = retiredOn === null ? null : asDate(retiredOn, 'retiredOn');
  if (retired !== null && compareCivilDate(retired, opened) < 0) {
    throw new InputError('station.dates', 'a station cannot be retired before it opened', {
      station: parsed.id,
    });
  }
  return Object.freeze({
    id: parsed.id,
    areaId: parsed.areaId,
    ordinal: parsed.ordinal,
    latitude,
    longitude,
    depth,
    description,
    openedOn: opened,
    retiredOn: retired,
  });
}

export function isInService(one, date) {
  if (compareCivilDate(date, one.openedOn) < 0) {
    return false;
  }
  return one.retiredOn === null || compareCivilDate(date, one.retiredOn) <= 0;
}

export function stationsIn(stations, areaId) {
  return stations
    .filter((one) => stationBelongsTo(one.id, areaId))
    .sort((left, right) => left.ordinal - right.ordinal);
}

export function stationsInService(stations, areaId, date) {
  return stationsIn(stations, areaId).filter((one) => isInService(one, date));
}

export function findStation(stations, id) {
  const wanted = parseStationId(id, 'station').id;
  return stations.find((one) => one.id === wanted) ?? null;
}

/**
 * The stations a set of results actually came from, which is not the same list
 * as the stations in the area. A survey that never visited two of its five
 * stations is a survey with a hole in it, and the sufficiency check reads this.
 */
export function countsByStation(samples) {
  const counts = {};
  for (const one of samples) {
    counts[one.station] = (counts[one.station] ?? 0) + 1;
  }
  return counts;
}

export function unvisited(stations, areaId, samples, date) {
  const visited = new Set(samples.map((one) => one.station));
  return stationsInService(stations, areaId, date)
    .filter((one) => !visited.has(one.id))
    .map((one) => one.id);
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('station.dates', `${field} is required`, { field });
  }
  return value;
}
