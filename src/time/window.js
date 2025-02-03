/**
 * Half open windows of time.
 *
 * Every window in this program includes its start and excludes its end. That
 * is not a taste: a closure that runs to midnight and a harvest at midnight
 * are the case the office argues about, and the only way to stop two adjacent
 * windows both claiming the boundary is to decide once and write it down.
 *
 * Windows are used for closures, for the rainfall accumulation the trigger
 * reads, for a tide exposure and for the period a report covers. They are the
 * same shape in all four places, which is why they live here rather than in
 * whichever module needed one first.
 */

import { InputError } from '../core/errors.js';
import { addSeconds, compareInstant, isInstant, secondsBetween } from './instant.js';

export function window(start, end) {
  if (!isInstant(start) || !isInstant(end)) {
    throw new InputError('window.parts', 'a window runs from one instant to another', {});
  }
  if (end.epochSecond < start.epochSecond) {
    throw new InputError('window.order', 'a window cannot end before it starts', {
      start: start.epochSecond,
      end: end.epochSecond,
    });
  }
  return Object.freeze({ start, end });
}

export function windowOfLength(start, seconds) {
  return window(start, addSeconds(start, seconds));
}

export function windowEndingAt(end, seconds) {
  return window(addSeconds(end, -seconds), end);
}

export function lengthSeconds(span) {
  return secondsBetween(span.start, span.end);
}

export function lengthHours(span) {
  return lengthSeconds(span) / 3600;
}

export function isEmptyWindow(span) {
  return lengthSeconds(span) === 0;
}

/** Half open: the start counts, the end does not. */
export function contains(span, point) {
  return point.epochSecond >= span.start.epochSecond && point.epochSecond < span.end.epochSecond;
}

export function overlaps(left, right) {
  return (
    left.start.epochSecond < right.end.epochSecond && right.start.epochSecond < left.end.epochSecond
  );
}

/** Touching windows do not overlap, but they are worth telling apart from a gap. */
export function abuts(left, right) {
  return (
    left.end.epochSecond === right.start.epochSecond ||
    right.end.epochSecond === left.start.epochSecond
  );
}

export function intersection(left, right) {
  if (!overlaps(left, right)) {
    return null;
  }
  const start = left.start.epochSecond > right.start.epochSecond ? left.start : right.start;
  const end = left.end.epochSecond < right.end.epochSecond ? left.end : right.end;
  return window(start, end);
}

export function compareWindow(left, right) {
  const byStart = compareInstant(left.start, right.start);
  return byStart === 0 ? compareInstant(left.end, right.end) : byStart;
}

/**
 * Merge a list into the fewest windows that cover the same time. Windows that
 * only touch are merged, because a closure that runs to noon followed by one
 * that starts at noon is one closure to anybody holding a licence.
 */
export function mergeWindows(spans) {
  const sorted = spans.slice().sort(compareWindow);
  const merged = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.start.epochSecond <= last.end.epochSecond) {
      if (span.end.epochSecond > last.end.epochSecond) {
        merged[merged.length - 1] = window(last.start, span.end);
      }
      continue;
    }
    merged.push(span);
  }
  return merged;
}

/** What is left of a window once the covered ones are taken out of it. */
export function subtractWindows(span, covers) {
  const merged = mergeWindows(covers.filter((cover) => overlaps(span, cover)));
  const gaps = [];
  let cursor = span.start;
  for (const cover of merged) {
    if (cover.start.epochSecond > cursor.epochSecond) {
      gaps.push(window(cursor, cover.start));
    }
    if (cover.end.epochSecond > cursor.epochSecond) {
      cursor = cover.end;
    }
  }
  if (cursor.epochSecond < span.end.epochSecond) {
    gaps.push(window(cursor, span.end));
  }
  return gaps;
}

export function coveredSeconds(span, covers) {
  return mergeWindows(covers.map((cover) => intersection(span, cover)).filter(Boolean)).reduce(
    (total, piece) => total + lengthSeconds(piece),
    0,
  );
}
