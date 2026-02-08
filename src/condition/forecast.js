/**
 * What a forecast would do to the plans, which is a question about a number
 * that has not happened yet.
 *
 * The office is asked this every Friday in the autumn: if the weather does
 * what the service says, which areas shut and when. It is answered by running
 * the same trigger against a feed that has forecast readings in it rather than
 * measured ones, which is the whole reason the trigger takes a feed instead of
 * reading a gauge itself.
 *
 * A forecast reading is marked as such and never enters the real feed. An area
 * shut on a forecast is a warning to the licence holders, not a closure, and a
 * programme that let the two mix would eventually issue a closure notice for
 * rain that did not fall.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { civilDateAt, isInstant } from '../time/instant.js';
import { evaluateTrigger } from './trigger.js';
import { planInForce } from './plan.js';

export function forecastReading({ gauge, at, value, confidence = null }) {
  requireString(gauge, 'gauge');
  if (!isInstant(at)) {
    throw new InputError('forecast.at', 'a forecast reading is for an instant', {});
  }
  requireNumber(value, 'value', { min: 0 });
  if (confidence !== null) {
    requireNumber(confidence, 'confidence', { min: 0, max: 1 });
  }
  return Object.freeze({
    gauge: gauge.trim().toUpperCase(),
    at,
    value,
    forecast: true,
    confidence,
  });
}

export function isForecast(reading) {
  return reading.forecast === true;
}

/**
 * The feed as it would be if the forecast came true. The measured readings
 * come first and the forecast ones after, which is the only order that makes
 * sense: a forecast for a moment that has already been measured is stale and
 * the measurement wins.
 */
export function feedWith(feed, forecasts) {
  const measured = feed.readings ?? [];
  const latest = measured.reduce(
    (best, one) => (one.at.epochSecond > best ? one.at.epochSecond : best),
    Number.NEGATIVE_INFINITY,
  );
  return {
    ...feed,
    readings: [...measured, ...forecasts.filter((one) => one.at.epochSecond > latest)],
  };
}

/**
 * Which plans the forecast would close, and on which reading. It reports the
 * first moment each plan fires rather than every moment, because the licence
 * holders want to know when to come in and not how long the rain goes on.
 */
export function whatWouldClose({ areas, plans, feed, forecasts, moments, zone = 'eastern' }) {
  // No forecast is a real question with a real answer: nothing would close.
  // Reading the plan in force needed a day, and the day was taken off the first
  // moment, so an empty list read a property of undefined and the command died
  // on the quietest week of the year.
  if (moments.length === 0) {
    return Object.freeze([]);
  }
  const projected = feedWith(feed, forecasts);
  const out = [];
  for (const area of areas) {
    const plan = planInForce(plans, area.id, civilDateAt(zone, moments[0]));
    if (plan === null) {
      continue;
    }
    let firstAt = null;
    let cited = null;
    for (const at of moments) {
      const fired = evaluateTrigger(plan.trigger, {
        at,
        readings: projected.readings,
        bypasses: projected.bypasses ?? [],
        zone,
      });
      if (fired.fired) {
        firstAt = at;
        cited = fired;
        break;
      }
    }
    out.push(
      Object.freeze({
        area: area.id,
        name: area.name,
        plan,
        wouldClose: firstAt !== null,
        at: firstAt,
        cited,
      }),
    );
  }
  return Object.freeze(out);
}

/** The moments a forecast is worth asking about: every forecast reading. */
export function momentsOf(forecasts) {
  const seen = new Map();
  for (const one of forecasts) {
    seen.set(one.at.epochSecond, one.at);
  }
  return Array.from(seen.values()).sort((left, right) => left.epochSecond - right.epochSecond);
}

export function describeForecast(row) {
  if (!row.wouldClose) {
    return `${row.area} would stay open`;
  }
  if (row.cited === null || typeof row.cited.measured !== 'number') {
    return `${row.area} would shut`;
  }
  return `${row.area} would shut on ${row.cited.measured} ${row.cited.unit} against ${row.cited.threshold}`;
}
