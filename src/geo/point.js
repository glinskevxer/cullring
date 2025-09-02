/**
 * Positions and the distance between them.
 *
 * The programme needs one geometric fact: how far a station or a bed is from a
 * pollution source. Over the few miles that ever matters, the earth is a
 * sphere and the great circle distance is right to well inside the accuracy of
 * the position anybody wrote on the survey sheet.
 *
 * Distances are kept in metres and converted at the edge, because the rule
 * book is written in feet and yards and the arithmetic is not.
 */

import { InputError } from '../core/errors.js';
import { requireNumber } from '../core/assert.js';

export const EARTH_RADIUS_METRES = 6371008.8;
export const METRES_PER_FOOT = 0.3048;
export const METRES_PER_NAUTICAL_MILE = 1852;

export function point(latitude, longitude) {
  requireNumber(latitude, 'latitude', { min: -90, max: 90 });
  requireNumber(longitude, 'longitude', { min: -180, max: 180 });
  return Object.freeze({ latitude, longitude });
}

export function toPoint(value, field = 'position') {
  if (value === undefined || value === null) {
    throw new InputError('geo.point', `${field} is required`, { field });
  }
  if (Array.isArray(value)) {
    return point(value[0], value[1]);
  }
  return point(value.latitude, value.longitude);
}

const RADIANS = Math.PI / 180;

/** Great circle distance in metres. */
export function distanceMetres(from, to) {
  const one = toPoint(from, 'from');
  const two = toPoint(to, 'to');
  const dLat = (two.latitude - one.latitude) * RADIANS;
  const dLon = (two.longitude - one.longitude) * RADIANS;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(one.latitude * RADIANS) *
      Math.cos(two.latitude * RADIANS) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function distanceFeet(from, to) {
  return distanceMetres(from, to) / METRES_PER_FOOT;
}

export function distanceNauticalMiles(from, to) {
  return distanceMetres(from, to) / METRES_PER_NAUTICAL_MILE;
}

export function feetToMetres(feet) {
  requireNumber(feet, 'feet', { min: 0 });
  return feet * METRES_PER_FOOT;
}

export function metresToFeet(metres) {
  requireNumber(metres, 'metres', { min: 0 });
  return metres / METRES_PER_FOOT;
}

/** True when the second point is inside a circle of that many metres. */
export function within(from, to, metres) {
  requireNumber(metres, 'metres', { min: 0 });
  return distanceMetres(from, to) <= metres;
}

/** The nearest of a list, with its distance, or nothing where the list is empty. */
export function nearest(from, candidates, positionOf = (one) => one) {
  if (candidates.length === 0) {
    return null;
  }
  let best = null;
  for (const candidate of candidates) {
    const metres = distanceMetres(from, positionOf(candidate));
    if (best === null || metres < best.metres) {
      best = { candidate, metres };
    }
  }
  return Object.freeze(best);
}

export function describePosition(value) {
  const one = toPoint(value);
  const ns = one.latitude >= 0 ? 'N' : 'S';
  const ew = one.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(one.latitude).toFixed(4)}${ns} ${Math.abs(one.longitude).toFixed(4)}${ew}`;
}
