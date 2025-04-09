/**
 * Walking a feed to find out when an area was actually shut.
 *
 * The plan says what closes the area and what reopens it. This module runs
 * both over a record of what happened and produces the closures, which is what
 * every other part of the program wants: the harvest check asks whether a
 * moment fell inside one, the monthly report counts them, and the trace has to
 * say which lots came off water that was open at the time.
 *
 * Two rules make the walk what it is.
 *
 * A trigger is only asked at the moments its own instrument reported. Between
 * a gauge's readings nothing about a rainfall total can change, and asking at
 * some other moment inside the same twenty four hours would find the total
 * still over the line and restart the closure for no reason. So the tides and
 * the laboratory results in the feed move the reopening side of the walk and
 * never the closing side.
 *
 * A report that finds the total still over the line does restart the clock,
 * because seventy two hours from the rain means seventy two hours from the
 * last rain and not from the first.
 *
 * The reopening test is only ever measured from the current closure's start.
 * A conforming sample collected before the closure began is not one of the two
 * that reopen it, and this is where a naive count of the laboratory log goes
 * wrong.
 */

import { CLOCK_DATE, CLOCK_HOURS, CLOCK_SAMPLES, CLOCK_TIDES } from '../time/clock.js';
import { MIDNIGHT } from '../time/civil.js';
import { addSeconds, compareInstant, instantFromCivil, civilDateAt } from '../time/instant.js';
import { window } from '../time/window.js';
import { evaluateReopening } from './reopening.js';
import { evaluateTrigger } from './trigger.js';

/**
 * Build the moments worth asking about. A total or a peak can only change when
 * a reading lands, a bypass can only start at a report, and a season can only
 * turn over at midnight, so every other instant would give the same answer as
 * the one before it.
 */
export function candidateMoments(plan, feed, span) {
  const points = [];
  const push = (point) => {
    if (point.epochSecond >= span.start.epochSecond && point.epochSecond <= span.end.epochSecond) {
      points.push(point);
    }
  };
  for (const entry of feed.readings ?? []) {
    push(entry.at);
  }
  for (const entry of feed.bypasses ?? []) {
    push(entry.at);
  }
  for (const entry of feed.samples ?? []) {
    push(entry.at);
  }
  for (const entry of feed.tides ?? []) {
    push(entry);
  }
  if (plan.trigger.kind === 'season') {
    let cursor = span.start;
    while (cursor.epochSecond <= span.end.epochSecond) {
      push(cursor);
      cursor = addSeconds(cursor, 86400);
    }
  }
  push(span.start);
  push(span.end);
  return dedupe(points);
}

/**
 * The moments the trigger's own instrument reported. A rainfall total can only
 * change when the rain gauge tips, a bypass can only begin when the authority
 * reports one, and a season can only turn over at midnight. Everything else in
 * the feed belongs to the reopening side of the walk.
 */
export function firingMoments(plan, feed, span) {
  const points = [];
  const push = (point) => {
    if (point.epochSecond >= span.start.epochSecond && point.epochSecond <= span.end.epochSecond) {
      points.push(point);
    }
  };
  if (plan.trigger.kind === 'rainfall' || plan.trigger.kind === 'stage crossing') {
    for (const entry of feed.readings ?? []) {
      if (entry.gauge === plan.trigger.gauge) {
        push(entry.at);
      }
    }
  }
  if (plan.trigger.kind === 'bypass') {
    for (const entry of feed.bypasses ?? []) {
      if (entry.facility.trim().toUpperCase() === plan.trigger.facility) {
        push(entry.at);
      }
    }
  }
  if (plan.trigger.kind === 'season') {
    let cursor = span.start;
    while (cursor.epochSecond <= span.end.epochSecond) {
      push(cursor);
      cursor = addSeconds(cursor, 86400);
    }
  }
  return dedupe(points);
}

function dedupe(points) {
  const sorted = points.slice().sort(compareInstant);
  const out = [];
  for (const point of sorted) {
    if (out.length === 0 || out[out.length - 1].epochSecond !== point.epochSecond) {
      out.push(point);
    }
  }
  return out;
}

/**
 * The instant a closure could first be reopened, where that can be worked out
 * without waiting for something to be reported. An hours rule and a fixed date
 * both have one; a sample count and a tide count do not, and those wait for
 * the feed.
 */
export function earliestReopening(plan, start) {
  const clock = plan.reopening.clock;
  if (clock === CLOCK_HOURS) {
    return addSeconds(start, Math.round(plan.reopening.target.quantity * 3600));
  }
  if (clock === CLOCK_DATE) {
    return instantFromCivil(plan.zone, plan.reopening.target.on, MIDNIGHT);
  }
  return null;
}

function reopeningEvidence(plan, start, at, feed) {
  switch (plan.reopening.clock) {
    case CLOCK_HOURS:
      return { from: start, at };
    case CLOCK_DATE:
      return { on: civilDateAt(plan.zone, at) };
    case CLOCK_SAMPLES:
      return { conformingSamples: countConforming(feed, start, at) };
    case CLOCK_TIDES:
      return { tideCycles: countTides(feed, start, at) };
    default:
      return {};
  }
}

function countConforming(feed, start, at) {
  return (feed.samples ?? []).filter(
    (entry) =>
      entry.conforming === true &&
      entry.at.epochSecond > start.epochSecond &&
      entry.at.epochSecond <= at.epochSecond,
  ).length;
}

function countTides(feed, start, at) {
  return (feed.tides ?? []).filter(
    (point) => point.epochSecond > start.epochSecond && point.epochSecond <= at.epochSecond,
  ).length;
}

/**
 * The closures inside a span. An open closure at the end of the span is
 * reported with no end, which is what a notice on the wall looks like.
 */
export function closureHistory(plan, feed, span) {
  const pending = candidateMoments(plan, feed, span);
  const reporting = new Set(firingMoments(plan, feed, span).map((point) => point.epochSecond));
  const closures = [];
  let current = null;
  let index = 0;
  while (index < pending.length) {
    const at = pending[index];
    index += 1;
    const fired = reporting.has(at.epochSecond)
      ? evaluateTrigger(plan.trigger, {
          at,
          readings: feed.readings ?? [],
          bypasses: feed.bypasses ?? [],
          zone: plan.zone,
        })
      : { fired: false };
    if (fired.fired) {
      if (current === null) {
        current = { start: at, firedBy: fired, restarts: 0, reopenedBy: null };
      } else {
        current.start = at;
        current.restarts += 1;
        current.firedBy = fired;
      }
      const earliest = earliestReopening(plan, current.start);
      if (earliest !== null) {
        insertMoment(pending, index, earliest, span);
      }
      continue;
    }
    if (current === null) {
      continue;
    }
    const answer = evaluateReopening(
      plan.reopening,
      reopeningEvidence(plan, current.start, at, feed),
    );
    if (answer.met) {
      closures.push(sealed(current, at, answer));
      current = null;
    }
  }
  if (current !== null) {
    closures.push(sealed(current, null, null));
  }
  return closures;
}

function insertMoment(pending, from, point, span) {
  if (point.epochSecond < span.start.epochSecond || point.epochSecond > span.end.epochSecond) {
    return;
  }
  let at = from;
  while (at < pending.length && pending[at].epochSecond < point.epochSecond) {
    at += 1;
  }
  if (at < pending.length && pending[at].epochSecond === point.epochSecond) {
    return;
  }
  pending.splice(at, 0, point);
}

function sealed(current, end, reopenedBy) {
  return Object.freeze({
    start: current.start,
    end,
    span: end === null ? null : window(current.start, end),
    firedBy: current.firedBy,
    reopenedBy,
    restarts: current.restarts,
    open: end === null,
  });
}

/** Whether the plan had the area shut at a moment, and which closure did it. */
export function stateAt(plan, feed, at, { from = null } = {}) {
  const start = from ?? at;
  const span = window(start.epochSecond <= at.epochSecond ? start : at, at);
  const closures = closureHistory(plan, feed, span);
  const holding = closures.find(
    (closure) =>
      closure.start.epochSecond <= at.epochSecond &&
      (closure.end === null || closure.end.epochSecond > at.epochSecond),
  );
  return Object.freeze({
    area: plan.area,
    at,
    closed: holding !== undefined,
    closure: holding ?? null,
    closures,
  });
}
