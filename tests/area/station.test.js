import { describe, expect, it } from 'vitest';

import {
  BOTTOM,
  DEPTHS,
  SURFACE,
  countsByStation,
  findStation,
  isInService,
  station,
  stationsIn,
  stationsInService,
  unvisited,
} from '../../src/area/station.js';
import { civilDate } from '../../src/time/civil.js';
import { sample } from '../../src/survey/result.js';

const one = station({
  id: 'B12-01',
  latitude: 34.71,
  longitude: -76.68,
  openedOn: '2018-04-01',
  description: 'off the point',
});
const two = station({ id: 'B12-02', latitude: 34.72, longitude: -76.7, openedOn: '2018-04-01' });
const three = station({
  id: 'B12-03',
  latitude: 34.73,
  longitude: -76.72,
  openedOn: '2018-04-01',
  retiredOn: '2024-12-31',
});
const other = station({ id: 'C3-01', latitude: 34.9, longitude: -76.9, openedOn: '2020-01-01' });
const ALL = [three, one, other, two];

describe('building a station', () => {
  it('reads the area out of the number', () => {
    expect(one.areaId).toBe('B-12');
    expect(one.ordinal).toBe(1);
  });

  it('defaults to a surface sample and takes a bottom one', () => {
    expect(one.depth).toBe(SURFACE);
    const deep = station({
      id: 'B12-04',
      latitude: 34.7,
      longitude: -76.6,
      openedOn: '2020-01-01',
      depth: BOTTOM,
    });
    expect(deep.depth).toBe(BOTTOM);
  });

  it('refuses a depth it does not know and lists both', () => {
    try {
      station({
        id: 'B12-04',
        latitude: 34.7,
        longitude: -76.6,
        openedOn: '2020-01-01',
        depth: 'mid',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(DEPTHS.slice());
    }
  });

  it('refuses a position off the earth', () => {
    expect(() =>
      station({ id: 'B12-04', latitude: 91, longitude: -76.6, openedOn: '2020-01-01' }),
    ).toThrow(/latitude/);
    expect(() =>
      station({ id: 'B12-04', latitude: 34.7, longitude: -181, openedOn: '2020-01-01' }),
    ).toThrow(/longitude/);
  });

  it('refuses a station retired before it opened', () => {
    expect(() =>
      station({
        id: 'B12-04',
        latitude: 34.7,
        longitude: -76.6,
        openedOn: '2020-01-01',
        retiredOn: '2019-01-01',
      }),
    ).toThrow(/retired before it opened/);
  });

  it('refuses a station with no opening date', () => {
    expect(() => station({ id: 'B12-04', latitude: 34.7, longitude: -76.6 })).toThrow(
      /openedOn is required/,
    );
  });
});

describe('service dates', () => {
  it('reads both ends as inclusive', () => {
    expect(isInService(three, civilDate(2018, 4, 1))).toBe(true);
    expect(isInService(three, civilDate(2024, 12, 31))).toBe(true);
    expect(isInService(three, civilDate(2018, 3, 31))).toBe(false);
    expect(isInService(three, civilDate(2025, 1, 1))).toBe(false);
  });

  it('treats a station that was never retired as still in service', () => {
    expect(isInService(one, civilDate(2099, 1, 1))).toBe(true);
  });
});

describe('selecting stations', () => {
  it('takes the area, in ordinal order', () => {
    expect(stationsIn(ALL, 'B-12').map((entry) => entry.id)).toEqual([
      'B12-01',
      'B12-02',
      'B12-03',
    ]);
  });

  it('reads a subarea as the same area, since a station number has no subarea', () => {
    expect(stationsIn(ALL, 'B-12A')).toHaveLength(3);
  });

  it('drops a retired station once the day has passed it', () => {
    expect(stationsInService(ALL, 'B-12', civilDate(2025, 6, 1)).map((entry) => entry.id)).toEqual([
      'B12-01',
      'B12-02',
    ]);
    expect(stationsInService(ALL, 'B-12', civilDate(2024, 6, 1))).toHaveLength(3);
  });

  it('finds one by number, and answers with nothing where there is none', () => {
    expect(findStation(ALL, 'b12-02').id).toBe('B12-02');
    expect(findStation(ALL, 'B12-09')).toBeNull();
  });
});

describe('counting what a survey visited', () => {
  const samples = [
    sample({ station: 'B12-01', collectedOn: '2025-04-01', result: 2 }),
    sample({ station: 'B12-01', collectedOn: '2025-04-08', result: 4.5 }),
    sample({ station: 'B12-02', collectedOn: '2025-04-08', result: 7.8 }),
  ];

  it('counts by station', () => {
    expect(countsByStation(samples)).toEqual({ 'B12-01': 2, 'B12-02': 1 });
  });

  it('counts nothing as nothing', () => {
    expect(countsByStation([])).toEqual({});
  });

  it('names the stations in service that the survey never reached', () => {
    expect(unvisited(ALL, 'B-12', samples, civilDate(2024, 6, 1))).toEqual(['B12-03']);
  });

  it('does not name a station that was already retired', () => {
    expect(unvisited(ALL, 'B-12', samples, civilDate(2025, 6, 1))).toEqual([]);
  });
});
