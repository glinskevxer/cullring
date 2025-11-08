/**
 * Which way the water is going, which is not the same question as where it is.
 *
 * A survey says whether an area meets its standard today. It says nothing
 * about whether it has been getting worse for three years or had one bad
 * winter, and those two call for different things: the first is a
 * reclassification and the second is a closer look next season.
 *
 * The trend is a run of yearly geometric means over the strategy's window. It
 * is deliberately coarse. A monthly series over the same data would show the
 * seasonal swing, which everybody already knows about and which would drown
 * the signal the office is looking for.
 *
 * The direction is decided by comparing the first half of the run with the
 * second, not by fitting a line. A fitted slope on five points reads as
 * precision the data does not have, and the office would quote it.
 */

import { InputError } from '../core/errors.js';
import { AT_LIMIT, describeSet, roundTo } from './statistics.js';
import { censoringFor, windowYears } from './strategy.js';
import { addDays, compareCivilDate } from '../time/civil.js';

export const IMPROVING = 'improving';
export const STEADY = 'steady';
export const WORSENING = 'worsening';

export const DIRECTIONS = Object.freeze([IMPROVING, STEADY, WORSENING]);

/**
 * How much the two halves have to differ before the programme will call it a
 * direction. A fifth is about the year to year wobble on a clean area, so
 * anything under it is noise wearing a hat.
 */
export const MATERIAL_SHARE = 0.2;

/** One point per year, oldest first, over the window the strategy reaches. */
export function yearlyMeans({ samples, on, strategyName, censoring = null }) {
  const years = windowYears(strategyName);
  const policy = censoring ?? censoringFor(strategyName);
  const floor = addDays(on, -Math.round(years * 365.25));
  const inWindow = samples.filter(
    (one) =>
      compareCivilDate(one.collectedOn, floor) >= 0 && compareCivilDate(one.collectedOn, on) <= 0,
  );
  const byYear = new Map();
  for (const one of inWindow) {
    const year = one.collectedOn.year;
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year).push(one.result);
  }
  return Array.from(byYear.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, results]) =>
      Object.freeze({
        year,
        count: results.length,
        geometricMean: describeSet(results, policy).geometricMean,
      }),
    );
}

/**
 * The direction of travel, or nothing where there are too few years to have
 * one. Two points are a line and not a trend, so three is the floor.
 */
export function direction(points) {
  if (!Array.isArray(points)) {
    throw new InputError('trend.points', 'a direction is read off a list of points', {});
  }
  if (points.length < 3) {
    return Object.freeze({ direction: null, reason: 'fewer than three years of results' });
  }
  const half = Math.floor(points.length / 2);
  const early = mean(points.slice(0, half));
  const late = mean(points.slice(points.length - half));
  if (early === 0) {
    return Object.freeze({ direction: null, reason: 'the earlier years hold nothing to compare' });
  }
  const change = (late - early) / early;
  if (Math.abs(change) < MATERIAL_SHARE) {
    return Object.freeze({ direction: STEADY, change, early, late, reason: null });
  }
  return Object.freeze({
    direction: change > 0 ? WORSENING : IMPROVING,
    change,
    early,
    late,
    reason: null,
  });
}

function mean(points) {
  if (points.length === 0) {
    return 0;
  }
  return points.reduce((total, one) => total + one.geometricMean, 0) / points.length;
}

export function trendFor({ samples, on, strategyName }) {
  const points = yearlyMeans({ samples, on, strategyName, censoring: AT_LIMIT });
  const way = direction(points);
  return Object.freeze({
    points: Object.freeze(points),
    ...way,
    years: points.length,
  });
}

export function describeTrend(trend) {
  if (trend.direction === null) {
    return `no direction can be read: ${trend.reason}`;
  }
  if (trend.direction === STEADY) {
    return `steady over ${trend.years} years`;
  }
  const share = Math.abs(roundTo(trend.change * 100, 0));
  return `${trend.direction} over ${trend.years} years, by about ${share} per cent`;
}
