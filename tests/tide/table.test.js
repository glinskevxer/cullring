import { describe, expect, it } from 'vitest';

import {
  EXTREMES,
  HIGH,
  LOW,
  crossingBetween,
  exposureWindows,
  extreme,
  extremesFor,
  heightAt,
  lastExposureStart,
  predictedSpan,
  tideStations,
} from '../../src/tide/table.js';
import { instant, parseInstant, toStoredForm } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });
const stamp = (point) => (point === null ? null : toStoredForm('eastern', point));

const TABLE = [
  extreme({ station: 'BFT', at: at('2025-08-14 02:12'), kind: HIGH, height: 3.4 }),
  extreme({ station: 'BFT', at: at('2025-08-14 08:30'), kind: LOW, height: 0.2 }),
  extreme({ station: 'BFT', at: at('2025-08-14 14:44'), kind: HIGH, height: 3.6 }),
  extreme({ station: 'BFT', at: at('2025-08-14 21:02'), kind: LOW, height: 0.1 }),
  extreme({ station: 'HAT', at: at('2025-08-14 03:00'), kind: HIGH, height: 2 }),
  extreme({ station: 'HAT', at: at('2025-08-14 09:00'), kind: LOW, height: 0 }),
];

const DAY = window(at('2025-08-14 00:00'), at('2025-08-14 23:59'));

describe('building an extreme', () => {
  it('holds the station, the moment, the kind and the height', () => {
    const one = TABLE[0];
    expect(one.station).toBe('BFT');
    expect(one.kind).toBe(HIGH);
    expect(one.height).toBe(3.4);
  });

  it('refuses a kind that is neither high water nor low water', () => {
    try {
      extreme({ station: 'BFT', at: at('2025-08-14 02:12'), kind: 'slack', height: 1 });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(EXTREMES.slice());
    }
  });

  it('refuses a moment that is not an instant', () => {
    expect(() =>
      extreme({ station: 'BFT', at: '2025-08-14 02:12', kind: HIGH, height: 1 }),
    ).toThrow(/happens at an instant/);
  });

  it('allows a negative height, because a datum is not the sea bed', () => {
    expect(extreme({ station: 'BFT', at: instant(0), kind: LOW, height: -0.4 }).height).toBe(-0.4);
  });

  it('lists the stations a table carries', () => {
    expect(tideStations(TABLE)).toEqual(['BFT', 'HAT']);
    expect(extremesFor(TABLE, 'bft')).toHaveLength(4);
  });
});

describe('the height between two extremes', () => {
  it('is the published height at an extreme itself', () => {
    expect(heightAt(TABLE, 'BFT', at('2025-08-14 02:12'))).toBeCloseTo(3.4, 9);
    expect(heightAt(TABLE, 'BFT', at('2025-08-14 08:30'))).toBeCloseTo(0.2, 9);
  });

  it('is the midpoint of the leg halfway through it', () => {
    expect(heightAt(TABLE, 'BFT', at('2025-08-14 05:21'))).toBeCloseTo(1.8, 6);
  });

  it('falls all the way through a falling leg', () => {
    const early = heightAt(TABLE, 'BFT', at('2025-08-14 03:00'));
    const middle = heightAt(TABLE, 'BFT', at('2025-08-14 05:21'));
    const late = heightAt(TABLE, 'BFT', at('2025-08-14 08:00'));
    expect(early).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
  });

  it('has no answer outside the published table, rather than a guess', () => {
    expect(heightAt(TABLE, 'BFT', at('2025-08-14 01:00'))).toBeNull();
    expect(heightAt(TABLE, 'BFT', at('2025-08-15 01:00'))).toBeNull();
    expect(heightAt(TABLE, 'ZZZ', at('2025-08-14 05:00'))).toBeNull();
  });

  it('names the stretch it can answer for', () => {
    const covered = predictedSpan(TABLE, 'BFT');
    expect(stamp(covered.start)).toBe('2025-08-14T02:12:00-04:00');
    expect(stamp(covered.end)).toBe('2025-08-14T21:02:00-04:00');
    expect(predictedSpan(TABLE, 'ZZZ')).toBeNull();
  });
});

describe('the crossing of a height', () => {
  it('finds the midpoint crossing exactly', () => {
    expect(stamp(crossingBetween(TABLE[0], TABLE[1], 1.8))).toBe('2025-08-14T05:21:00-04:00');
  });

  it('finds a crossing nearer the top of the leg for a higher bed', () => {
    const high = crossingBetween(TABLE[0], TABLE[1], 3);
    const low = crossingBetween(TABLE[0], TABLE[1], 1);
    expect(high.epochSecond).toBeLessThan(low.epochSecond);
  });

  it('answers with nothing where the water never reaches the height in that leg', () => {
    expect(crossingBetween(TABLE[0], TABLE[1], 9)).toBeNull();
    expect(crossingBetween(TABLE[0], TABLE[1], -9)).toBeNull();
  });

  it('answers with nothing where the two extremes are the same height', () => {
    const flat = extreme({ station: 'BFT', at: at('2025-08-14 08:30'), kind: LOW, height: 3.4 });
    expect(crossingBetween(TABLE[0], flat, 3.4)).toBeNull();
  });
});

describe('when a bed is out of the water', () => {
  it('gives the two exposures a bed at 1.8 feet gets that day', () => {
    const windows = exposureWindows(TABLE, 'BFT', 1.8, DAY);
    expect(windows).toHaveLength(2);
    expect(stamp(windows[0].start)).toBe('2025-08-14T05:21:00-04:00');
    expect(stamp(windows[0].end)).toBe('2025-08-14T11:30:00-04:00');
  });

  it('does not claim the bed was dry before the table starts', () => {
    const windows = exposureWindows(TABLE, 'BFT', 1.8, DAY);
    expect(windows[0].start.epochSecond).toBeGreaterThanOrEqual(at('2025-08-14 02:12').epochSecond);
  });

  it('does not carry the last exposure past the end of the table', () => {
    const windows = exposureWindows(TABLE, 'BFT', 1.8, DAY);
    const last = windows[windows.length - 1];
    expect(stamp(last.end)).toBe('2025-08-14T21:02:00-04:00');
  });

  it('says a bed below every low water is never out of the water', () => {
    expect(exposureWindows(TABLE, 'BFT', 0, DAY)).toEqual([]);
  });

  it('says a bed above every high water is out of it throughout', () => {
    const windows = exposureWindows(TABLE, 'BFT', 9, DAY);
    expect(windows).toHaveLength(1);
    expect(stamp(windows[0].start)).toBe('2025-08-14T02:12:00-04:00');
    expect(stamp(windows[0].end)).toBe('2025-08-14T21:02:00-04:00');
  });

  it('answers with nothing at all for a station it cannot predict', () => {
    expect(exposureWindows(TABLE, 'ZZZ', 1.8, DAY)).toBeNull();
  });

  it('answers with no exposures for a day the table does not reach', () => {
    const other = window(at('2025-08-20 00:00'), at('2025-08-20 23:59'));
    expect(exposureWindows(TABLE, 'BFT', 1.8, other)).toEqual([]);
  });

  it('gives a higher bed a longer exposure than a lower one', () => {
    const high = exposureWindows(TABLE, 'BFT', 2.5, DAY);
    const low = exposureWindows(TABLE, 'BFT', 1, DAY);
    const total = (list) =>
      list.reduce((sum, one) => sum + (one.end.epochSecond - one.start.epochSecond), 0);
    expect(total(high)).toBeGreaterThan(total(low));
  });
});

describe('when the falling tide last uncovered the bed', () => {
  it('finds the crossing that started the exposure the harvest sat in', () => {
    expect(stamp(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 10:00')))).toBe(
      '2025-08-14T05:21:00-04:00',
    );
  });

  it('answers with nothing while the bed is under water', () => {
    expect(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 16:00'))).toBeNull();
    expect(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 03:00'))).toBeNull();
  });

  it('answers with nothing outside the published table', () => {
    expect(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-15 10:00'))).toBeNull();
    expect(lastExposureStart(TABLE, 'ZZZ', 1.8, at('2025-08-14 10:00'))).toBeNull();
  });

  it('takes the most recent crossing when a day holds two', () => {
    const late = lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 20:00'));
    expect(stamp(late)).toBe('2025-08-14T17:56:26-04:00');
  });

  it('gives a higher bed an earlier start than a lower one', () => {
    const high = lastExposureStart(TABLE, 'BFT', 2.5, at('2025-08-14 10:00'));
    const low = lastExposureStart(TABLE, 'BFT', 1, at('2025-08-14 10:00'));
    expect(high.epochSecond).toBeLessThan(low.epochSecond);
  });

  it('needs two extremes before it can say anything', () => {
    const thin = [TABLE[0]];
    expect(lastExposureStart(thin, 'BFT', 1.8, at('2025-08-14 10:00'))).toBeNull();
  });
});

describe('the instant the water reaches the elevation counts as exposed', () => {
  it('reads the crossing moment itself as the start of an exposure', () => {
    expect(stamp(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 05:21')))).toBe(
      '2025-08-14T05:21:00-04:00',
    );
  });

  it('still reads a second earlier as under water', () => {
    expect(lastExposureStart(TABLE, 'BFT', 1.8, at('2025-08-14 05:20:59'))).toBeNull();
  });

  it('matches the window, which includes its own start', () => {
    const windows = exposureWindows(TABLE, 'BFT', 1.8, DAY);
    expect(stamp(windows[0].start)).toBe('2025-08-14T05:21:00-04:00');
  });
});
