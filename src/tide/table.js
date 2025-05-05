/**
 * Tide predictions, and the height of the water between two of them.
 *
 * The published table gives four moments a day and nothing in between, but the
 * question this program asks is not when high water is. It is when a bed at
 * two and a half feet above datum first came out of the water, because that is
 * when the clock on an intertidal harvest starts.
 *
 * Between one extreme and the next the water is taken to move as a half
 * cosine, which is the approximation the rule of twelfths is a rounding of. It
 * is not the real tide and nobody claims it is: it is the curve the office has
 * always drawn on the back of the prediction, and it is close enough that the
 * crossing time is right to a few minutes.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { addSeconds, compareInstant, instant, isInstant } from '../time/instant.js';
import { intersection, window } from '../time/window.js';

export const HIGH = 'high';
export const LOW = 'low';

export const EXTREMES = Object.freeze([HIGH, LOW]);

export function extreme({ station, at, kind, height }) {
  requireString(station, 'station');
  if (!isInstant(at)) {
    throw new InputError('tide.at', 'a tide extreme happens at an instant', {});
  }
  if (!EXTREMES.includes(kind)) {
    throw new InputError('tide.kind', `${kind} is not high water or low water`, {
      kind,
      known: EXTREMES.slice(),
    });
  }
  requireNumber(height, 'height');
  return Object.freeze({ station: station.trim().toUpperCase(), at, kind, height });
}

export function extremesFor(table, station) {
  const wanted = station.trim().toUpperCase();
  return table
    .filter((one) => one.station === wanted)
    .sort((left, right) => compareInstant(left.at, right.at));
}

/**
 * The predicted height at a moment. Outside the published extremes there is no
 * answer, because extrapolating a tide past the end of the table is how a bed
 * gets declared dry on a day nobody predicted.
 */
export function heightAt(table, station, at) {
  const extremes = extremesFor(table, station);
  for (let index = 1; index < extremes.length; index += 1) {
    const from = extremes[index - 1];
    const to = extremes[index];
    if (at.epochSecond >= from.at.epochSecond && at.epochSecond <= to.at.epochSecond) {
      return interpolate(from, to, at);
    }
  }
  return null;
}

function interpolate(from, to, at) {
  const span = to.at.epochSecond - from.at.epochSecond;
  if (span === 0) {
    return from.height;
  }
  const fraction = (at.epochSecond - from.at.epochSecond) / span;
  const middle = (from.height + to.height) / 2;
  const half = (from.height - to.height) / 2;
  return middle + half * Math.cos(Math.PI * fraction);
}

/**
 * The moment the water passes a given height between two extremes, or nothing
 * where it does not reach it in that leg.
 */
export function crossingBetween(from, to, height) {
  const swing = from.height - to.height;
  if (swing === 0) {
    return null;
  }
  const cosine = (2 * height - from.height - to.height) / swing;
  if (cosine < -1 || cosine > 1) {
    return null;
  }
  const fraction = Math.acos(cosine) / Math.PI;
  const span = to.at.epochSecond - from.at.epochSecond;
  return addSeconds(from.at, Math.round(fraction * span));
}

/**
 * The stretch of time the published table actually covers for a station. Every
 * question about exposure is clipped to this, because a tide extrapolated past
 * the end of the prediction is how a bed gets declared dry on a day nobody
 * predicted.
 */
export function predictedSpan(table, station) {
  const extremes = extremesFor(table, station);
  if (extremes.length < 2) {
    return null;
  }
  return window(extremes[0].at, extremes[extremes.length - 1].at);
}

/**
 * The windows in which a bed at a given elevation stands out of the water,
 * clipped to what the table predicts. A bed above every high water is dry
 * throughout the covered stretch and one below every low water is never dry,
 * and both come back as a plain answer rather than as an empty list nobody can
 * tell apart from a missing prediction.
 */
export function exposureWindows(table, station, elevation, span) {
  const covered = predictedSpan(table, station);
  if (covered === null) {
    return null;
  }
  const piece = intersection(covered, span);
  if (piece === null) {
    return [];
  }
  const extremes = extremesFor(table, station);
  const edges = [];
  for (let index = 1; index < extremes.length; index += 1) {
    const crossing = crossingBetween(extremes[index - 1], extremes[index], elevation);
    if (crossing !== null) {
      edges.push(crossing);
    }
  }
  const windows = [];
  let openedAt = below(table, station, piece.start, elevation) ? piece.start : null;
  for (const edge of edges) {
    if (edge.epochSecond <= piece.start.epochSecond || edge.epochSecond > piece.end.epochSecond) {
      continue;
    }
    const stillFalling = below(table, station, addSeconds(edge, 60), elevation);
    if (stillFalling && openedAt === null) {
      openedAt = edge;
    } else if (!stillFalling && openedAt !== null) {
      windows.push(window(openedAt, edge));
      openedAt = null;
    }
  }
  if (openedAt !== null) {
    windows.push(window(openedAt, piece.end));
  }
  return windows;
}

/**
 * Whether the bed stands clear of the water at that moment. The water being
 * exactly at the elevation counts as exposed, which matches the windows: an
 * exposure includes the instant it began, the way every window here includes
 * its own start.
 */
function below(table, station, at, elevation) {
  const height = heightAt(table, station, at);
  return height !== null && height <= elevation;
}

/**
 * The moment a falling tide most recently uncovered the bed, at or before a
 * given instant. This is the start of the clock for intertidal gear, and it is
 * nothing where the bed was already under water.
 */
export function lastExposureStart(table, station, elevation, at) {
  const extremes = extremesFor(table, station);
  if (extremes.length < 2) {
    return null;
  }
  const height = heightAt(table, station, at);
  if (height === null || height > elevation) {
    return null;
  }
  let best = null;
  for (let index = 1; index < extremes.length; index += 1) {
    const crossing = crossingBetween(extremes[index - 1], extremes[index], elevation);
    if (crossing === null || crossing.epochSecond > at.epochSecond) {
      continue;
    }
    const falling = extremes[index].height < extremes[index - 1].height;
    if (falling && (best === null || crossing.epochSecond > best.epochSecond)) {
      best = crossing;
    }
  }
  return best;
}

export function tideStations(table) {
  return Array.from(new Set(table.map((one) => one.station))).sort();
}

export function extremeAt(seconds, kind, height, station = 'BEAUFORT') {
  return extreme({ station, at: instant(seconds), kind, height });
}
