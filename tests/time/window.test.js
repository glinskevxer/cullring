import { describe, expect, it } from 'vitest';

import { instant } from '../../src/time/instant.js';
import {
  abuts,
  compareWindow,
  contains,
  coveredSeconds,
  intersection,
  isEmptyWindow,
  lengthHours,
  lengthSeconds,
  mergeWindows,
  overlaps,
  subtractWindows,
  window,
  windowEndingAt,
  windowOfLength,
} from '../../src/time/window.js';

const at = (seconds) => instant(seconds);
const span = (from, to) => window(at(from), at(to));

describe('building a window', () => {
  it('holds its two ends', () => {
    const w = span(100, 400);
    expect(w.start.epochSecond).toBe(100);
    expect(w.end.epochSecond).toBe(400);
    expect(Object.isFrozen(w)).toBe(true);
  });

  it('allows an empty window, because a closure lifted the moment it landed is one', () => {
    const w = span(100, 100);
    expect(isEmptyWindow(w)).toBe(true);
    expect(lengthSeconds(w)).toBe(0);
  });

  it('refuses a window that ends before it starts', () => {
    expect(() => span(400, 100)).toThrow(/cannot end before it starts/);
  });

  it('refuses ends that are not instants', () => {
    expect(() => window(100, 400)).toThrow(/from one instant to another/);
  });

  it('builds from a length in either direction', () => {
    expect(lengthSeconds(windowOfLength(at(100), 300))).toBe(300);
    expect(windowEndingAt(at(400), 300).start.epochSecond).toBe(100);
  });

  it('measures in hours as well, because the rules are written in hours', () => {
    expect(lengthHours(span(0, 5400))).toBe(1.5);
  });
});

describe('containment is half open', () => {
  const w = span(100, 400);

  it('includes the start', () => {
    expect(contains(w, at(100))).toBe(true);
  });

  it('excludes the end', () => {
    expect(contains(w, at(400))).toBe(false);
  });

  it('holds the inside and refuses the outside', () => {
    expect(contains(w, at(399))).toBe(true);
    expect(contains(w, at(99))).toBe(false);
    expect(contains(w, at(401))).toBe(false);
  });

  it('contains nothing when it is empty', () => {
    expect(contains(span(100, 100), at(100))).toBe(false);
  });
});

describe('overlap and abutment', () => {
  it('sees an overlap where the two share time', () => {
    expect(overlaps(span(100, 400), span(300, 500))).toBe(true);
    expect(overlaps(span(300, 500), span(100, 400))).toBe(true);
  });

  it('does not call touching windows an overlap', () => {
    expect(overlaps(span(100, 400), span(400, 500))).toBe(false);
    expect(abuts(span(100, 400), span(400, 500))).toBe(true);
    expect(abuts(span(400, 500), span(100, 400))).toBe(true);
  });

  it('sees neither where there is a gap', () => {
    expect(overlaps(span(100, 200), span(300, 400))).toBe(false);
    expect(abuts(span(100, 200), span(300, 400))).toBe(false);
  });

  it('gives the shared piece, or nothing', () => {
    expect(intersection(span(100, 400), span(300, 500))).toEqual(span(300, 400));
    expect(intersection(span(100, 200), span(300, 400))).toBeNull();
  });

  it('orders by start and then by end', () => {
    const windows = [span(300, 400), span(100, 500), span(100, 200)];
    expect(windows.sort(compareWindow).map(lengthSeconds)).toEqual([100, 400, 100]);
  });
});

describe('merging', () => {
  it('joins overlapping windows', () => {
    expect(mergeWindows([span(100, 300), span(200, 400)])).toEqual([span(100, 400)]);
  });

  it('joins touching windows, because a licence holder sees one closure', () => {
    expect(mergeWindows([span(100, 300), span(300, 400)])).toEqual([span(100, 400)]);
  });

  it('keeps separated windows apart and sorts them', () => {
    expect(mergeWindows([span(500, 600), span(100, 200)])).toEqual([
      span(100, 200),
      span(500, 600),
    ]);
  });

  it('swallows a window wholly inside another', () => {
    expect(mergeWindows([span(100, 900), span(300, 400)])).toEqual([span(100, 900)]);
  });

  it('merges nothing into nothing', () => {
    expect(mergeWindows([])).toEqual([]);
  });
});

describe('subtraction', () => {
  it('cuts a hole in the middle', () => {
    expect(subtractWindows(span(0, 1000), [span(400, 600)])).toEqual([
      span(0, 400),
      span(600, 1000),
    ]);
  });

  it('trims the front and the back', () => {
    expect(subtractWindows(span(0, 1000), [span(0, 200)])).toEqual([span(200, 1000)]);
    expect(subtractWindows(span(0, 1000), [span(800, 1000)])).toEqual([span(0, 800)]);
  });

  it('returns nothing when the cover swallows the window', () => {
    expect(subtractWindows(span(100, 200), [span(0, 1000)])).toEqual([]);
  });

  it('ignores covers that do not touch the window', () => {
    expect(subtractWindows(span(0, 100), [span(500, 600)])).toEqual([span(0, 100)]);
  });

  it('handles overlapping covers as one', () => {
    expect(subtractWindows(span(0, 1000), [span(200, 500), span(400, 700)])).toEqual([
      span(0, 200),
      span(700, 1000),
    ]);
  });
});

describe('coveredSeconds', () => {
  it('counts overlapping cover once', () => {
    expect(coveredSeconds(span(0, 1000), [span(0, 600), span(400, 800)])).toBe(800);
  });

  it('clips cover that runs past the ends', () => {
    expect(coveredSeconds(span(100, 200), [span(0, 1000)])).toBe(100);
  });

  it('counts nothing when nothing covers', () => {
    expect(coveredSeconds(span(0, 100), [])).toBe(0);
    expect(coveredSeconds(span(0, 100), [span(500, 600)])).toBe(0);
  });
});
