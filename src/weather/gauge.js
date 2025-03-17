/**
 * Gauges, and the readings that come off them.
 *
 * A conditional area's plan names a gauge, and the gauge is not a detail. Two
 * areas eight miles apart on the same river close on different rainfall
 * because they read different gauges, and a summer thunderstorm can drop two
 * inches on one and nothing on the other. So a reading carries the gauge it
 * came from and nothing in this program averages two gauges together.
 *
 * There are two kinds of gauge and they are read differently. A rain gauge is
 * cumulative: what matters is the total over a window, and a window with no
 * readings in it means no rain rather than no data. A stage gauge is
 * instantaneous: what matters is the highest level reached, and a window with
 * no readings in it means nobody looked.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { compareInstant, isInstant, parseInstant } from '../time/instant.js';
import { contains } from '../time/window.js';

export const RAIN = 'rain';
export const STAGE = 'stage';

export const GAUGE_KINDS = Object.freeze([RAIN, STAGE]);

export function gauge({ id, kind, name = null, zone = 'eastern' }) {
  requireString(id, 'gauge id');
  if (!GAUGE_KINDS.includes(kind)) {
    throw new InputError('gauge.kind', `${kind} is not a kind of gauge`, {
      kind,
      known: GAUGE_KINDS.slice(),
    });
  }
  return Object.freeze({ id: id.trim().toUpperCase(), kind, name, zone });
}

export function reading({ gauge: gaugeId, at, value, zone = null }) {
  requireString(gaugeId, 'gauge id');
  const when = isInstant(at) ? at : parseInstant(at, { zone, field: 'at' });
  if (!Number.isFinite(value) || value < 0) {
    throw new InputError('reading.value', 'a gauge reading is a number of at least zero', {
      value,
    });
  }
  return Object.freeze({ gauge: gaugeId.trim().toUpperCase(), at: when, value });
}

export function readingsFor(readings, gaugeId) {
  const wanted = gaugeId.trim().toUpperCase();
  return readings
    .filter((entry) => entry.gauge === wanted)
    .sort((left, right) => compareInstant(left.at, right.at));
}

export function readingsWithin(readings, span) {
  return readings
    .filter((entry) => contains(span, entry.at))
    .sort((left, right) => compareInstant(left.at, right.at));
}

/**
 * The total over a window, which is what a rainfall trigger reads. A window
 * with nothing in it totals zero, because a rain gauge that reported nothing
 * reported no rain.
 */
export function accumulation(readings, gaugeId, span) {
  return readingsWithin(readingsFor(readings, gaugeId), span).reduce(
    (total, entry) => total + entry.value,
    0,
  );
}

/**
 * The highest level in a window, which is what a stage trigger reads. A window
 * with nothing in it has no answer at all, because a river nobody measured is
 * not a river that stayed low.
 */
export function peak(readings, gaugeId, span) {
  const within = readingsWithin(readingsFor(readings, gaugeId), span);
  if (within.length === 0) {
    return null;
  }
  return within.reduce((highest, entry) => (entry.value > highest ? entry.value : highest), 0);
}

/** The reading that carried the peak, for a report that has to cite one. */
export function peakReading(readings, gaugeId, span) {
  const within = readingsWithin(readingsFor(readings, gaugeId), span);
  if (within.length === 0) {
    return null;
  }
  return within.reduce((best, entry) => (entry.value > best.value ? entry : best));
}

export function latestBefore(readings, gaugeId, point) {
  const before = readingsFor(readings, gaugeId).filter(
    (entry) => entry.at.epochSecond <= point.epochSecond,
  );
  return before.length === 0 ? null : before[before.length - 1];
}

export function gaugeIds(readings) {
  return Array.from(new Set(readings.map((entry) => entry.gauge))).sort();
}
