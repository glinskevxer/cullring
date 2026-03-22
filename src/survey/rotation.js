/**
 * Which stations the boat works next, out of all the ones that are due.
 *
 * The schedule says whether a station is due. It does not say what to do when
 * forty of them are due and the boat can work nine in a day, which is the
 * actual question every Monday morning.
 *
 * Ordering by how overdue a station is looks obviously right and is wrong on
 * its own, because it starves an area whose stations are all barely due while
 * one neglected area soaks up every trip. So the round is built area by area:
 * the area with the worst station goes first, and it brings its other due
 * stations with it, up to a share of the trip. A boat that is out there anyway
 * should not come back with one bottle.
 *
 * Two things are deliberately not skipped. A station in an area under an
 * emergency order stays in the round, because the order is what has to be
 * lifted and lifting it needs samples. A station that has never been visited
 * sorts as the most overdue there is, because a station nobody has ever been
 * to is the one most likely to be in the wrong place.
 */

import { findings } from '../core/finding.js';
import { requireNumber } from '../core/assert.js';
import { formatCivilDate } from '../time/civil.js';
import { REINSTATEMENT_SURVEY, scheduleFor } from './schedule.js';

/** How many stations one day on the water is worth. */
export const TRIP_STATIONS = 9;

/** The most of one trip any single area may take, so the round keeps moving. */
export const AREA_SHARE = 0.5;

export const NEVER_VISITED = 100000;

/**
 * Every station that could be worked, ordered by the area that needs it most.
 * The rows carry their own reason, because a round somebody disagrees with is
 * a round they have to be able to argue with.
 */
export function rotation({ areas, standing, stations, samples, on }) {
  const rows = [];
  for (const area of areas) {
    const held = standing.get(area.id);
    if (held === undefined || held === null) {
      continue;
    }
    const inArea = stations.filter((one) => one.areaId === area.id);
    for (const row of scheduleFor({
      area,
      classificationName: held,
      stations: inArea,
      samples,
      on,
    })) {
      if (row.reason === REINSTATEMENT_SURVEY) {
        continue;
      }
      rows.push(Object.freeze({ ...row, weight: weightOf(row) }));
    }
  }
  return rows.filter((row) => row.weight > 0).sort(byNeed);
}

/** How badly a station wants working. A station never visited outranks any delay. */
export function weightOf(row) {
  if (row.state === 'never visited') {
    return NEVER_VISITED;
  }
  return row.overdueDays;
}

function byNeed(left, right) {
  if (left.weight !== right.weight) {
    return right.weight - left.weight;
  }
  if (left.area !== right.area) {
    return left.area < right.area ? -1 : 1;
  }
  return left.station < right.station ? -1 : 1;
}

/**
 * One day's work: the worst area first, with its own due stations behind it,
 * then the next area, until the boat is full. The share cap is applied per
 * area rather than per trip, so an area with eleven overdue stations does not
 * take the whole week. It is a rule about order rather than about seats: once
 * every area has had its share, anything still empty is filled from the queue.
 */
export function nextTrip({
  areas,
  standing,
  stations,
  samples,
  on,
  capacity = TRIP_STATIONS,
  share = AREA_SHARE,
}) {
  requireNumber(capacity, 'capacity', { min: 1, integer: true });
  requireNumber(share, 'share', { min: 0.1, max: 1 });
  const perArea = Math.max(1, Math.floor(capacity * share));
  const queue = rotation({ areas, standing, stations, samples, on });
  const order = [];
  const seen = new Set();
  const taken = new Map();

  for (const row of queue) {
    if (order.length >= capacity) {
      break;
    }
    if (seen.has(row.station)) {
      continue;
    }
    const already = taken.get(row.area) ?? 0;
    if (already >= perArea) {
      continue;
    }
    seen.add(row.station);
    taken.set(row.area, already + 1);
    order.push(row);
    for (const mate of queue) {
      if (order.length >= capacity || (taken.get(row.area) ?? 0) >= perArea) {
        break;
      }
      if (mate.area !== row.area || seen.has(mate.station)) {
        continue;
      }
      seen.add(mate.station);
      taken.set(row.area, (taken.get(row.area) ?? 0) + 1);
      order.push(mate);
    }
  }

  // The share cap decides the order, not how many seats stay empty. A boat that
  // can work nine stations and has eight due should not come back with six
  // because two areas each hit their share, so whatever is left over is filled
  // from the queue in plain need order.
  for (const row of queue) {
    if (order.length >= capacity) {
      break;
    }
    if (seen.has(row.station)) {
      continue;
    }
    seen.add(row.station);
    taken.set(row.area, (taken.get(row.area) ?? 0) + 1);
    order.push(row);
  }

  return Object.freeze({
    on,
    capacity,
    perArea,
    stations: Object.freeze(order),
    waiting: queue.length - order.length,
    areas: Object.freeze(Array.from(taken.keys())),
  });
}

/**
 * What the round leaves behind. A station left waiting is not a finding on its
 * own, because a boat can only do what a boat can do. A station left waiting
 * that is already a year past due is, because that is not a scheduling problem
 * any more.
 */
export function rotationFindings(trip, queue, { staleDays = 365 } = {}) {
  const problems = findings();
  const worked = new Set(trip.stations.map((one) => one.station));
  for (const row of queue) {
    if (worked.has(row.station)) {
      continue;
    }
    if (row.state === 'never visited') {
      problems.warn('rotation.neverVisited', `${row.station} has never been sampled`, {
        station: row.station,
        area: row.area,
      });
      continue;
    }
    if (row.overdueDays >= staleDays) {
      problems.error(
        'rotation.abandoned',
        `${row.station} is ${row.overdueDays} days past due and was not on the round`,
        { station: row.station, area: row.area, overdueDays: row.overdueDays },
      );
    }
  }
  return problems;
}

export function describeTrip(trip) {
  if (trip.stations.length === 0) {
    return `nothing is due on ${formatCivilDate(trip.on)}`;
  }
  const areas = trip.areas.join(', ');
  return `${trip.stations.length} stations in ${areas}, with ${trip.waiting} left waiting`;
}
