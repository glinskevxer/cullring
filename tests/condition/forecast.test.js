import { describe, expect, it } from 'vitest';

import {
  describeForecast,
  feedWith,
  forecastReading,
  isForecast,
  momentsOf,
  whatWouldClose,
} from '../../src/condition/forecast.js';
import { reading } from '../../src/weather/gauge.js';
import { AREAS, PLANS, STORM, at } from '../support/register.js';
import { toStoredForm } from '../../src/time/instant.js';

const forecast = (gauge, when, value) =>
  forecastReading({ gauge, at: at(when), value, confidence: 0.7 });

const AHEAD = [
  forecast('BRD', '2025-06-20 06:00', 0.4),
  forecast('BRD', '2025-06-20 12:00', 0.9),
  forecast('MLC', '2025-06-20 12:00', 0.2),
];

describe('a forecast reading', () => {
  it('is marked as a forecast and a measured one is not', () => {
    expect(isForecast(AHEAD[0])).toBe(true);
    expect(isForecast(reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 1 }))).toBe(false);
  });

  it('carries a confidence where the service gave one', () => {
    expect(AHEAD[0].confidence).toBe(0.7);
    expect(
      forecastReading({ gauge: 'BRD', at: at('2025-06-20 06:00'), value: 1 }).confidence,
    ).toBeNull();
  });

  it('refuses a confidence outside nought to one, and a negative value', () => {
    expect(() =>
      forecastReading({ gauge: 'BRD', at: at('2025-06-20 06:00'), value: 1, confidence: 2 }),
    ).toThrow(/at most 1/);
    expect(() => forecastReading({ gauge: 'BRD', at: at('2025-06-20 06:00'), value: -1 })).toThrow(
      /at least 0/,
    );
  });

  it('refuses a moment that is not an instant', () => {
    expect(() => forecastReading({ gauge: 'BRD', at: '2025-06-20 06:00', value: 1 })).toThrow(
      /for an instant/,
    );
  });
});

describe('the projected feed', () => {
  it('holds the measured readings and the forecast ones after them', () => {
    const projected = feedWith(STORM, AHEAD);
    expect(projected.readings).toHaveLength(STORM.readings.length + AHEAD.length);
  });

  it('drops a forecast for a moment already measured, because the measurement wins', () => {
    const stale = [forecast('BRD', '2025-06-01 06:00', 5)];
    expect(feedWith(STORM, stale).readings).toHaveLength(STORM.readings.length);
  });

  it('leaves the measured feed alone', () => {
    const before = STORM.readings.length;
    feedWith(STORM, AHEAD);
    expect(STORM.readings).toHaveLength(before);
  });

  it('projects onto an empty feed without falling over', () => {
    expect(feedWith({}, AHEAD).readings).toHaveLength(AHEAD.length);
  });
});

describe('the moments worth asking about', () => {
  it('is every distinct forecast instant, in order', () => {
    const moments = momentsOf(AHEAD);
    expect(moments.map((one) => toStoredForm('eastern', one))).toEqual([
      '2025-06-20T06:00:00-04:00',
      '2025-06-20T12:00:00-04:00',
    ]);
  });

  it('is nothing at all for no forecast', () => {
    expect(momentsOf([])).toEqual([]);
  });
});

describe('what a forecast would close', () => {
  const ask = (forecasts) =>
    whatWouldClose({
      areas: AREAS,
      plans: PLANS,
      feed: { readings: [] },
      forecasts,
      moments: momentsOf(forecasts),
    });

  it('gives a row per area that carries a plan and none for the rest', () => {
    const rows = ask(AHEAD);
    expect(rows.map((one) => one.area)).toEqual(['B-12', 'B-14']);
  });

  it('shuts an area whose trigger the forecast reaches', () => {
    const heavy = [forecast('BRD', '2025-06-20 06:00', 1.4)];
    const row = ask(heavy).find((one) => one.area === 'B-12');
    expect(row.wouldClose).toBe(true);
    expect(toStoredForm('eastern', row.at)).toBe('2025-06-20T06:00:00-04:00');
  });

  it('names the first moment it would shut, not every one', () => {
    const long = [
      forecast('BRD', '2025-06-20 06:00', 1.4),
      forecast('BRD', '2025-06-20 12:00', 1.4),
    ];
    expect(toStoredForm('eastern', ask(long)[0].at)).toBe('2025-06-20T06:00:00-04:00');
  });

  it('shuts on the accumulation rather than on any one reading', () => {
    const row = ask(AHEAD).find((one) => one.area === 'B-12');
    expect(row.wouldClose).toBe(true);
    expect(toStoredForm('eastern', row.at)).toBe('2025-06-20T12:00:00-04:00');
    expect(AHEAD.every((one) => one.value < 1)).toBe(true);
  });

  it('leaves an area open where the forecast does not reach its trigger', () => {
    const light = [forecast('BRD', '2025-06-20 06:00', 0.2)];
    const row = ask(light).find((one) => one.area === 'B-12');
    expect(row.wouldClose).toBe(false);
    expect(row.at).toBeNull();
  });

  it('reads each area against its own gauge', () => {
    const onlyMlc = [forecast('MLC', '2025-06-20 06:00', 1.4)];
    const rows = ask(onlyMlc);
    expect(rows.find((one) => one.area === 'B-14').wouldClose).toBe(true);
    expect(rows.find((one) => one.area === 'B-12').wouldClose).toBe(false);
  });

  it('describes each row the way the notice would', () => {
    const heavy = [forecast('BRD', '2025-06-20 06:00', 1.4)];
    const rows = ask(heavy);
    expect(describeForecast(rows[0])).toMatch(/B-12 would shut on 1\.4 inches against 1/);
    expect(describeForecast(rows[1])).toBe('B-14 would stay open');
  });

  it('has nothing to say where no forecast was given', () => {
    expect(ask([])).toEqual([]);
  });
});
