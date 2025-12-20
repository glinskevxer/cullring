import { describe, expect, it } from 'vitest';

import {
  boundary,
  boundaryFor,
  boundingBox,
  contains,
  nearestCornerMetres,
  onEdge,
  polygon,
} from '../../src/geo/polygon.js';

const SQUARE = polygon(
  [
    [34.7, -76.72],
    [34.74, -76.72],
    [34.74, -76.66],
    [34.7, -76.66],
  ],
  { name: 'Broad Creek' },
);

const L_SHAPE = polygon([
  [34.7, -76.72],
  [34.74, -76.72],
  [34.74, -76.69],
  [34.72, -76.69],
  [34.72, -76.66],
  [34.7, -76.66],
]);

describe('building a boundary', () => {
  it('keeps the corners it was given', () => {
    expect(SQUARE.vertices).toHaveLength(4);
    expect(SQUARE.name).toBe('Broad Creek');
  });

  it('drops a repeated closing corner', () => {
    const closed = polygon([
      [34.7, -76.72],
      [34.74, -76.72],
      [34.74, -76.66],
      [34.7, -76.72],
    ]);
    expect(closed.vertices).toHaveLength(3);
  });

  it('refuses fewer than three corners', () => {
    expect(() =>
      polygon([
        [34.7, -76.72],
        [34.74, -76.72],
      ]),
    ).toThrow(/at least 3 entries/);
  });

  it('refuses three corners that are really two', () => {
    expect(() =>
      polygon([
        [34.7, -76.72],
        [34.74, -76.72],
        [34.7, -76.72],
      ]),
    ).toThrow(/three corners that are not the same/);
  });

  it('refuses a corner off the earth', () => {
    expect(() =>
      polygon([
        [91, -76.72],
        [34.74, -76.72],
        [34.74, -76.66],
      ]),
    ).toThrow(/latitude/);
  });

  it('binds a boundary to an area and normalises the number', () => {
    const one = boundary({ areaId: ' b-12 ', points: SQUARE.vertices });
    expect(one.areaId).toBe('B-12');
    expect(one.vertices).toHaveLength(4);
  });

  it('finds a boundary by area', () => {
    const held = [boundary({ areaId: 'B-12', points: SQUARE.vertices })];
    expect(boundaryFor(held, 'b-12').areaId).toBe('B-12');
    expect(boundaryFor(held, 'C-3')).toBeNull();
  });
});

describe('whether a point is inside', () => {
  it('holds a point in the middle', () => {
    expect(contains(SQUARE, { latitude: 34.72, longitude: -76.69 })).toBe(true);
  });

  it('refuses a point outside on every side', () => {
    for (const outside of [
      { latitude: 34.8, longitude: -76.69 },
      { latitude: 34.6, longitude: -76.69 },
      { latitude: 34.72, longitude: -76.8 },
      { latitude: 34.72, longitude: -76.6 },
    ]) {
      expect(contains(SQUARE, outside)).toBe(false);
    }
  });

  it('counts the boundary itself as inside, and says so rather than leaving it to chance', () => {
    expect(onEdge(SQUARE, { latitude: 34.7, longitude: -76.69 })).toBe(true);
    expect(contains(SQUARE, { latitude: 34.7, longitude: -76.69 })).toBe(true);
  });

  it('counts a corner as inside', () => {
    expect(contains(SQUARE, { latitude: 34.7, longitude: -76.72 })).toBe(true);
  });

  it('handles a shape that is not convex', () => {
    expect(contains(L_SHAPE, { latitude: 34.71, longitude: -76.71 })).toBe(true);
    expect(contains(L_SHAPE, { latitude: 34.735, longitude: -76.67 })).toBe(false);
  });

  it('takes a wider edge tolerance when asked', () => {
    const justOutside = { latitude: 34.6999, longitude: -76.69 };
    expect(contains(SQUARE, justOutside)).toBe(false);
    expect(contains(SQUARE, justOutside, { edgeMetres: 50 })).toBe(true);
  });
});

describe('the bounding box', () => {
  it('is the smallest box that holds the shape', () => {
    expect(boundingBox(SQUARE)).toEqual({
      south: 34.7,
      north: 34.74,
      west: -76.72,
      east: -76.66,
    });
  });

  it('is the same for a shape and its bounding box', () => {
    const box = boundingBox(SQUARE);
    const asShape = polygon([
      [box.south, box.west],
      [box.north, box.west],
      [box.north, box.east],
      [box.south, box.east],
    ]);
    expect(boundingBox(asShape)).toEqual(box);
  });
});

describe('the nearest corner', () => {
  it('is nothing away from a corner itself', () => {
    expect(nearestCornerMetres(SQUARE, { latitude: 34.7, longitude: -76.72 })).toBeCloseTo(0, 6);
  });

  it('grows as the point moves away', () => {
    const near = nearestCornerMetres(SQUARE, { latitude: 34.71, longitude: -76.71 });
    const far = nearestCornerMetres(SQUARE, { latitude: 35.5, longitude: -76.0 });
    expect(far).toBeGreaterThan(near);
  });
});
