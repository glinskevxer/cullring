import { describe, expect, it } from 'vitest';

import {
  METRES_PER_FOOT,
  describePosition,
  distanceFeet,
  distanceMetres,
  distanceNauticalMiles,
  feetToMetres,
  metresToFeet,
  nearest,
  point,
  toPoint,
  within,
} from '../../src/geo/point.js';

const beaufort = point(34.7182, -76.6638);
const harkers = point(34.6929, -76.5583);

describe('building a position', () => {
  it('holds a latitude and a longitude', () => {
    expect(beaufort).toEqual({ latitude: 34.7182, longitude: -76.6638 });
  });

  it('refuses a position off the earth', () => {
    expect(() => point(91, 0)).toThrow(/latitude/);
    expect(() => point(0, 181)).toThrow(/longitude/);
  });

  it('takes a pair as well as a record', () => {
    expect(toPoint([34.7182, -76.6638])).toEqual(beaufort);
    expect(toPoint(beaufort)).toEqual(beaufort);
  });

  it('refuses nothing at all, and names the field', () => {
    expect(() => toPoint(null, 'station')).toThrow(/station is required/);
  });

  it('describes a position the way a survey sheet writes it', () => {
    expect(describePosition(beaufort)).toBe('34.7182N 76.6638W');
    expect(describePosition(point(-34.5, 151.2))).toBe('34.5000S 151.2000E');
  });
});

describe('distance', () => {
  it('is nothing between a point and itself', () => {
    expect(distanceMetres(beaufort, beaufort)).toBeCloseTo(0, 6);
  });

  it('is the same both ways round', () => {
    expect(distanceMetres(beaufort, harkers)).toBeCloseTo(distanceMetres(harkers, beaufort), 6);
  });

  it('gets a known short hop about right', () => {
    const metres = distanceMetres(beaufort, harkers);
    expect(metres).toBeGreaterThan(9000);
    expect(metres).toBeLessThan(11000);
  });

  it('gets a degree of latitude about right', () => {
    const metres = distanceMetres(point(34, -76), point(35, -76));
    expect(metres).toBeGreaterThan(110000);
    expect(metres).toBeLessThan(112000);
  });

  it('converts to the units the rule book uses', () => {
    const metres = distanceMetres(beaufort, harkers);
    expect(distanceFeet(beaufort, harkers)).toBeCloseTo(metres / METRES_PER_FOOT, 6);
    expect(distanceNauticalMiles(beaufort, harkers)).toBeCloseTo(metres / 1852, 6);
  });

  it('converts feet and metres both ways', () => {
    expect(feetToMetres(1000)).toBeCloseTo(304.8, 6);
    expect(metresToFeet(304.8)).toBeCloseTo(1000, 6);
    expect(metresToFeet(feetToMetres(500))).toBeCloseTo(500, 6);
  });

  it('refuses a negative length', () => {
    expect(() => feetToMetres(-1)).toThrow(/at least 0/);
  });
});

describe('within a circle', () => {
  it('holds a point at the centre', () => {
    expect(within(beaufort, beaufort, 100)).toBe(true);
  });

  it('holds a point exactly on the edge', () => {
    const metres = distanceMetres(beaufort, harkers);
    expect(within(beaufort, harkers, metres)).toBe(true);
    expect(within(beaufort, harkers, metres - 1)).toBe(false);
  });

  it('refuses a negative radius', () => {
    expect(() => within(beaufort, harkers, -1)).toThrow(/at least 0/);
  });
});

describe('the nearest of a list', () => {
  const stations = [
    { id: 'far', latitude: 35.5, longitude: -76 },
    { id: 'near', latitude: 34.72, longitude: -76.66 },
    { id: 'middling', latitude: 34.9, longitude: -76.7 },
  ];

  it('finds it and reports the distance', () => {
    const found = nearest(beaufort, stations);
    expect(found.candidate.id).toBe('near');
    expect(found.metres).toBeLessThan(1000);
  });

  it('takes a reader for the position', () => {
    const wrapped = stations.map((one) => ({ station: one }));
    const found = nearest(beaufort, wrapped, (one) => one.station);
    expect(found.candidate.station.id).toBe('near');
  });

  it('answers with nothing for an empty list', () => {
    expect(nearest(beaufort, [])).toBeNull();
  });
});
