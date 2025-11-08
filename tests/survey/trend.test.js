import { describe, expect, it } from 'vitest';

import {
  DIRECTIONS,
  IMPROVING,
  MATERIAL_SHARE,
  STEADY,
  WORSENING,
  describeTrend,
  direction,
  trendFor,
  yearlyMeans,
} from '../../src/survey/trend.js';
import { SYSTEMATIC_RANDOM } from '../../src/survey/strategy.js';
import { sample } from '../../src/survey/result.js';
import { civilDate } from '../../src/time/civil.js';

const on = civilDate(2025, 9, 30);

const run = (byYear) =>
  Object.entries(byYear).flatMap(([year, values]) =>
    values.map((value, index) =>
      sample({
        station: 'B12-01',
        collectedOn: civilDate(Number(year), 1 + (index % 12), 5),
        result: value,
      }),
    ),
  );

describe('the yearly points', () => {
  const samples = run({ 2023: [2, 4, 8], 2024: [4, 8, 16], 2025: [8, 16, 32] });

  it('gives one point a year, oldest first', () => {
    const points = yearlyMeans({ samples, on, strategyName: SYSTEMATIC_RANDOM });
    expect(points.map((one) => one.year)).toEqual([2023, 2024, 2025]);
  });

  it('counts what went into each point', () => {
    const points = yearlyMeans({ samples, on, strategyName: SYSTEMATIC_RANDOM });
    expect(points.every((one) => one.count === 3)).toBe(true);
  });

  it('takes the geometric mean rather than the arithmetic one', () => {
    const points = yearlyMeans({ samples, on, strategyName: SYSTEMATIC_RANDOM });
    expect(points[0].geometricMean).toBeCloseTo(4, 6);
  });

  it('drops results outside the strategy window', () => {
    const old = run({ 2015: [2, 2, 2], 2024: [4, 4, 4] });
    const points = yearlyMeans({ samples: old, on, strategyName: SYSTEMATIC_RANDOM });
    expect(points.map((one) => one.year)).toEqual([2024]);
  });

  it('drops results after the day being asked about', () => {
    const points = yearlyMeans({
      samples,
      on: civilDate(2024, 6, 30),
      strategyName: SYSTEMATIC_RANDOM,
    });
    expect(points.map((one) => one.year)).toEqual([2023, 2024]);
  });

  it('gives nothing where there is nothing in the window', () => {
    expect(yearlyMeans({ samples: [], on, strategyName: SYSTEMATIC_RANDOM })).toEqual([]);
  });
});

describe('the direction', () => {
  const point = (year, geometricMean) => ({ year, count: 5, geometricMean });

  it('needs three years before it will say anything', () => {
    expect(direction([point(2024, 2), point(2025, 20)]).direction).toBeNull();
    expect(direction([]).reason).toMatch(/fewer than three years/);
  });

  it('calls a rising run worsening', () => {
    const answer = direction([point(2023, 4), point(2024, 8), point(2025, 16)]);
    expect(answer.direction).toBe(WORSENING);
    expect(answer.change).toBeGreaterThan(0);
  });

  it('calls a falling run improving', () => {
    const answer = direction([point(2023, 16), point(2024, 8), point(2025, 4)]);
    expect(answer.direction).toBe(IMPROVING);
    expect(answer.change).toBeLessThan(0);
  });

  it('calls a small wobble steady rather than a direction', () => {
    const answer = direction([point(2023, 10), point(2024, 11), point(2025, 10.5)]);
    expect(answer.direction).toBe(STEADY);
    expect(Math.abs(answer.change)).toBeLessThan(MATERIAL_SHARE);
  });

  it('only calls a direction once the change is material', () => {
    const inside = direction([point(2023, 10), point(2024, 10), point(2025, 11.9)]);
    const outside = direction([point(2023, 10), point(2024, 10), point(2025, 13)]);
    expect(inside.direction).toBe(STEADY);
    expect(outside.direction).toBe(WORSENING);
  });

  it('says nothing where the earlier years hold nothing to compare', () => {
    const answer = direction([point(2023, 0), point(2024, 4), point(2025, 8)]);
    expect(answer.direction).toBeNull();
    expect(answer.reason).toMatch(/nothing to compare/);
  });

  it('refuses something that is not a list of points', () => {
    expect(() => direction(null)).toThrow(/list of points/);
  });

  it('only ever names one of the three directions', () => {
    for (const points of [
      [point(2023, 4), point(2024, 8), point(2025, 16)],
      [point(2023, 16), point(2024, 8), point(2025, 4)],
      [point(2023, 10), point(2024, 10), point(2025, 10)],
    ]) {
      expect(DIRECTIONS).toContain(direction(points).direction);
    }
  });
});

describe('the trend over a set of samples', () => {
  it('reads a worsening area as worsening', () => {
    const samples = run({ 2023: [2, 2, 2], 2024: [8, 8, 8], 2025: [32, 32, 32] });
    const trend = trendFor({ samples, on, strategyName: SYSTEMATIC_RANDOM });
    expect(trend.direction).toBe(WORSENING);
    expect(trend.years).toBe(3);
  });

  it('reads a steady area as steady', () => {
    const samples = run({ 2023: [10, 10, 10], 2024: [10, 10, 10], 2025: [10, 10, 10] });
    expect(trendFor({ samples, on, strategyName: SYSTEMATIC_RANDOM }).direction).toBe(STEADY);
  });

  it('describes itself in words the office would use', () => {
    const worsening = trendFor({
      samples: run({ 2023: [2, 2, 2], 2024: [8, 8, 8], 2025: [32, 32, 32] }),
      on,
      strategyName: SYSTEMATIC_RANDOM,
    });
    expect(describeTrend(worsening)).toMatch(/worsening over 3 years, by about \d+ per cent/);
    const thin = trendFor({ samples: [], on, strategyName: SYSTEMATIC_RANDOM });
    expect(describeTrend(thin)).toMatch(/no direction can be read/);
    const steady = trendFor({
      samples: run({ 2023: [10, 10, 10], 2024: [10, 10, 10], 2025: [10, 10, 10] }),
      on,
      strategyName: SYSTEMATIC_RANDOM,
    });
    expect(describeTrend(steady)).toBe('steady over 3 years');
  });
});
