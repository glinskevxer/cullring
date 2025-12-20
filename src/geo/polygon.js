/**
 * Area boundaries, and whether a point is inside one.
 *
 * A growing area on the chart is a closed line drawn between named marks. The
 * programme needs one question answered about it: is this station, or this
 * bed, actually in the area the register says it is in. That question is asked
 * once a year and it catches a real thing, which is a station typed into the
 * wrong area and then sampled for a decade against the wrong standard.
 *
 * The ray casting rule is used because it is the one everybody can check. A
 * point on the boundary itself is a coin toss under any of these algorithms,
 * so the boundary is treated as inside and it is said out loud, rather than
 * left to whichever way the arithmetic falls.
 */

import { InputError } from '../core/errors.js';
import { requireArray, requireString } from '../core/assert.js';
import { distanceMetres, toPoint } from './point.js';

export function polygon(points, { name = null } = {}) {
  requireArray(points, 'points', { min: 3 });
  const vertices = points.map((one) => toPoint(one, 'points'));
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const closed =
    first.latitude === last.latitude && first.longitude === last.longitude
      ? vertices.slice(0, -1)
      : vertices;
  if (closed.length < 3) {
    throw new InputError('geo.polygon', 'a boundary needs three corners that are not the same', {
      corners: closed.length,
    });
  }
  return Object.freeze({ name, vertices: Object.freeze(closed) });
}

export function boundary({ areaId, points, name = null }) {
  requireString(areaId, 'areaId');
  return Object.freeze({ areaId: areaId.trim().toUpperCase(), ...polygon(points, { name }) });
}

/** How far a point is from the nearest corner, which is enough to spot a typo. */
export function nearestCornerMetres(shape, position) {
  const point = toPoint(position, 'position');
  return shape.vertices.reduce(
    (best, corner) => Math.min(best, distanceMetres(corner, point)),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Whether a point lies on an edge, within a tolerance in metres. This is asked
 * first, so that a point on the line gets a definite answer rather than the
 * one the ray happened to give.
 */
export function onEdge(shape, position, metres = 1) {
  const point = toPoint(position, 'position');
  const { vertices } = shape;
  for (let index = 0; index < vertices.length; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    if (distanceToSegment(point, from, to) <= metres) {
      return true;
    }
  }
  return false;
}

function distanceToSegment(point, from, to) {
  const scale = Math.cos((point.latitude * Math.PI) / 180);
  const px = point.longitude * scale;
  const py = point.latitude;
  const ax = from.longitude * scale;
  const ay = from.latitude;
  const bx = to.longitude * scale;
  const by = to.latitude;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distanceMetres(from, point);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const nearest = { latitude: ay + t * dy, longitude: (ax + t * dx) / scale };
  return distanceMetres(nearest, point);
}

/**
 * Ray casting, with the boundary counted as inside. The ray is cast east,
 * which matters only in that it has to be consistent.
 */
export function contains(shape, position, { edgeMetres = 1 } = {}) {
  if (onEdge(shape, position, edgeMetres)) {
    return true;
  }
  const point = toPoint(position, 'position');
  const { vertices } = shape;
  let inside = false;
  for (
    let index = 0, previous = vertices.length - 1;
    index < vertices.length;
    previous = index, index += 1
  ) {
    const one = vertices[index];
    const two = vertices[previous];
    const crosses = one.latitude > point.latitude !== two.latitude > point.latitude;
    if (!crosses) {
      continue;
    }
    const at =
      ((two.longitude - one.longitude) * (point.latitude - one.latitude)) /
        (two.latitude - one.latitude) +
      one.longitude;
    if (point.longitude < at) {
      inside = !inside;
    }
  }
  return inside;
}

/** The corners of the smallest box that holds the shape, for a quick reject. */
export function boundingBox(shape) {
  const latitudes = shape.vertices.map((one) => one.latitude);
  const longitudes = shape.vertices.map((one) => one.longitude);
  return Object.freeze({
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
  });
}

export function boundaryFor(boundaries, areaId) {
  const wanted = String(areaId).trim().toUpperCase();
  return boundaries.find((one) => one.areaId === wanted) ?? null;
}
