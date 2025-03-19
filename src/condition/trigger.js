/**
 * The four things that close a conditional area.
 *
 * Every conditionally approved area has a management plan and every plan names
 * exactly one trigger. The triggers do not share a shape and that is the point
 * of this module: a rainfall trigger asks a gauge for a total over a window, a
 * stage trigger asks a different gauge for a peak, a bypass trigger asks the
 * sewer authority whether it reported anything, and a season trigger asks the
 * calendar and nothing else.
 *
 * So an area is not closed by rain. It is closed by whatever its plan says,
 * and two areas over the same water can disagree about the same storm.
 *
 * A trigger reports what it measured as well as whether it fired, because the
 * closure notice has to cite a number and the office has to be able to defend
 * it a year later.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { accumulation, peak, peakReading } from '../weather/gauge.js';
import { compareCivilDate, parseCivilDate } from '../time/civil.js';
import { windowEndingAt } from '../time/window.js';
import { civilDateAt } from '../time/instant.js';

export const RAINFALL = 'rainfall';
export const STAGE_CROSSING = 'stage crossing';
export const BYPASS = 'bypass';
export const SEASON = 'season';

export const TRIGGER_KINDS = Object.freeze([RAINFALL, STAGE_CROSSING, BYPASS, SEASON]);

export function rainfallTrigger({ gauge, inches, overHours }) {
  requireString(gauge, 'gauge');
  positive(inches, 'inches');
  positive(overHours, 'overHours');
  return Object.freeze({ kind: RAINFALL, gauge: gauge.trim().toUpperCase(), inches, overHours });
}

export function stageTrigger({ gauge, feet, overHours = 24 }) {
  requireString(gauge, 'gauge');
  positive(feet, 'feet');
  positive(overHours, 'overHours');
  return Object.freeze({
    kind: STAGE_CROSSING,
    gauge: gauge.trim().toUpperCase(),
    feet,
    overHours,
  });
}

export function bypassTrigger({ facility, withinHours = 48 }) {
  requireString(facility, 'facility');
  positive(withinHours, 'withinHours');
  return Object.freeze({ kind: BYPASS, facility: facility.trim().toUpperCase(), withinHours });
}

export function seasonTrigger({ from, to }) {
  const start = typeof from === 'string' ? parseCivilDate(from, 'from') : from;
  const end = typeof to === 'string' ? parseCivilDate(to, 'to') : to;
  if (start === undefined || end === undefined) {
    throw new InputError('trigger.season', 'a season runs between two dates', {});
  }
  return Object.freeze({ kind: SEASON, from: start, to: end });
}

/**
 * Ask a trigger whether it has fired as at a moment. The context carries the
 * gauge feed, the reported bypasses and the zone the area keeps its calendar
 * in, and a trigger reads only the part of it that its own kind needs.
 */
export function evaluateTrigger(trigger, { at, readings = [], bypasses = [], zone = 'eastern' }) {
  switch (trigger.kind) {
    case RAINFALL:
      return evaluateRainfall(trigger, at, readings);
    case STAGE_CROSSING:
      return evaluateStage(trigger, at, readings);
    case BYPASS:
      return evaluateBypass(trigger, at, bypasses);
    case SEASON:
      return evaluateSeason(trigger, at, zone);
    default:
      throw new InputError('trigger.kind', `${trigger.kind} is not a trigger this program keeps`, {
        kind: trigger.kind,
        known: TRIGGER_KINDS.slice(),
      });
  }
}

function evaluateRainfall(trigger, at, readings) {
  const span = windowEndingAt(at, trigger.overHours * 3600);
  const total = accumulation(readings, trigger.gauge, span);
  return Object.freeze({
    kind: RAINFALL,
    fired: total >= trigger.inches,
    measured: total,
    threshold: trigger.inches,
    unit: 'inches',
    gauge: trigger.gauge,
    span,
    cited: null,
  });
}

function evaluateStage(trigger, at, readings) {
  const span = windowEndingAt(at, trigger.overHours * 3600);
  const highest = peak(readings, trigger.gauge, span);
  return Object.freeze({
    kind: STAGE_CROSSING,
    fired: highest !== null && highest >= trigger.feet,
    measured: highest,
    threshold: trigger.feet,
    unit: 'feet',
    gauge: trigger.gauge,
    span,
    cited: peakReading(readings, trigger.gauge, span),
    unmeasured: highest === null,
  });
}

function evaluateBypass(trigger, at, bypasses) {
  const span = windowEndingAt(at, trigger.withinHours * 3600);
  const reported = bypasses.filter(
    (event) =>
      event.facility.trim().toUpperCase() === trigger.facility &&
      event.at.epochSecond >= span.start.epochSecond &&
      event.at.epochSecond < span.end.epochSecond,
  );
  return Object.freeze({
    kind: BYPASS,
    fired: reported.length > 0,
    measured: reported.length,
    threshold: 1,
    unit: 'reported bypasses',
    facility: trigger.facility,
    span,
    cited: reported.length === 0 ? null : reported[reported.length - 1],
  });
}

function evaluateSeason(trigger, at, zone) {
  const today = civilDateAt(zone, at);
  const inside =
    compareCivilDate(today, trigger.from) >= 0 && compareCivilDate(today, trigger.to) <= 0;
  return Object.freeze({
    kind: SEASON,
    fired: inside,
    measured: today,
    threshold: Object.freeze({ from: trigger.from, to: trigger.to }),
    unit: 'date',
    span: null,
    cited: null,
  });
}

function positive(value, field) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InputError('trigger.value', `${field} must be a positive number`, { field, value });
  }
  return value;
}
