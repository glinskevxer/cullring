import { describe, expect, it } from 'vitest';

import {
  CONTESTED,
  IN_ONE,
  UNPLACED,
  claimants,
  locate,
  misplacedStations,
  overlapFindings,
  overlappingPairs,
} from '../../src/geo/locate.js';
import { boundary } from '../../src/geo/polygon.js';
import { classificationPeriod, growingArea } from '../../src/area/growingArea.js';
import { civilDate } from '../../src/time/civil.js';

const square = (areaId, west, east, south = 34.7, north = 34.8) =>
  boundary({
    areaId,
    points: [
      [south, west],
      [north, west],
      [north, east],
      [south, east],
    ],
  });

const area = (id, name) =>
  growingArea({
    id,
    name: id,
    history: [classificationPeriod({ classification: name, from: '2020-01-01' })],
  });

const ON = civilDate(2025, 6, 1);

const BOUNDARIES = [square('A-01', -76.8, -76.6), square('A-02', -76.7, -76.5, 34.75, 34.85)];
const AREAS = [area('A-01', 'approved'), area('A-02', 'restricted')];

describe('claimants', () => {
  it('names every boundary that holds the position', () => {
    expect(claimants(BOUNDARIES, [34.72, -76.75])).toEqual(['A-01']);
    expect(claimants(BOUNDARIES, [34.78, -76.65])).toEqual(['A-01', 'A-02']);
    expect(claimants(BOUNDARIES, [34.9, -76.65])).toEqual([]);
  });

  it('counts a position on the line as inside, which the boundary rule says too', () => {
    expect(claimants(BOUNDARIES, [34.7, -76.8])).toContain('A-01');
  });
});

describe('locate', () => {
  it('places a position that only one area claims', () => {
    const placed = locate([34.72, -76.75], { boundaries: BOUNDARIES, areas: AREAS, on: ON });
    expect(placed.verdict).toBe(IN_ONE);
    expect(placed.areaId).toBe('A-01');
    expect(placed.classification).toBe('approved');
    expect(placed.settledBy).toBe(null);
  });

  it('gives contested ground to the stricter classification, not to the first line drawn', () => {
    const placed = locate([34.78, -76.65], { boundaries: BOUNDARIES, areas: AREAS, on: ON });
    expect(placed.verdict).toBe(CONTESTED);
    expect(placed.claimed).toEqual(['A-01', 'A-02']);
    expect(placed.areaId).toBe('A-02');
    expect(placed.settledBy).toBe('the stricter classification');
  });

  it('moves the answer when the register reclassifies, because the rule is not geometric', () => {
    const opened = [area('A-01', 'approved'), area('A-02', 'approved')];
    const placed = locate([34.78, -76.65], { boundaries: BOUNDARIES, areas: opened, on: ON });
    expect(placed.areaId).toBe('A-01');
    expect(placed.settledBy).toBe('the lower area id, because the classifications tie');
  });

  it('says so rather than guessing when no line holds the position', () => {
    const placed = locate([34.95, -76.65], { boundaries: BOUNDARIES, areas: AREAS, on: ON });
    expect(placed.verdict).toBe(UNPLACED);
    expect(placed.areaId).toBe(null);
    expect(placed.classification).toBe(null);
  });

  it('treats an area the register cannot classify as the weakest claim', () => {
    const thin = [area('A-01', 'approved')];
    const placed = locate([34.78, -76.65], { boundaries: BOUNDARIES, areas: thin, on: ON });
    expect(placed.areaId).toBe('A-01');
  });
});

describe('overlappingPairs', () => {
  it('finds the pair that shares ground and says what it tested', () => {
    const pairs = overlappingPairs(BOUNDARIES);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ left: 'A-01', right: 'A-02', tested: 'corners only' });
    expect(pairs[0].corners).toBeGreaterThan(0);
  });

  it('finds nothing between two areas that do not touch', () => {
    expect(overlappingPairs([square('A-01', -76.8, -76.7), square('A-03', -76.5, -76.4)])).toEqual(
      [],
    );
  });

  it('does not call two areas that share a line an overlap, because that is most of them', () => {
    const neighbours = [square('A-01', -76.8, -76.7), square('A-04', -76.7, -76.6)];
    expect(overlappingPairs(neighbours)).toEqual([]);
    expect(claimants(neighbours, [34.75, -76.7])).toEqual(['A-01', 'A-04']);
  });

  it('raises one warning per overlapping pair', () => {
    const problems = overlapFindings(BOUNDARIES);
    expect(problems.codes()).toEqual(['locate.overlap']);
    expect(problems.list()[0].message).toContain('settled by classification');
  });
});

describe('misplacedStations', () => {
  const station = (id, areaId, longitude) => ({
    id,
    areaId,
    latitude: 34.78,
    longitude,
  });

  it('says nothing about a station in the area it belongs to', () => {
    const problems = misplacedStations({
      stations: [station('S-1', 'A-01', -76.75)],
      boundaries: BOUNDARIES,
      areas: AREAS,
      on: ON,
    });
    expect(problems.isClean()).toBe(true);
  });

  it('raises an error when the position is squarely in another area', () => {
    const problems = misplacedStations({
      stations: [station('S-2', 'A-01', -76.55)],
      boundaries: BOUNDARIES,
      areas: AREAS,
      on: ON,
    });
    expect(problems.codes()).toEqual(['locate.otherArea']);
    expect(problems.list()[0].detail).toEqual({
      station: 'S-2',
      registered: 'A-01',
      drawn: 'A-02',
    });
  });

  it('warns with the distance to the nearest corner when nothing holds it', () => {
    const problems = misplacedStations({
      stations: [station('S-3', 'A-01', -77.5)],
      boundaries: BOUNDARIES,
      areas: AREAS,
      on: ON,
    });
    expect(problems.codes()).toEqual(['locate.unplaced']);
    expect(problems.list()[0].detail.cornerFeet).toBeGreaterThan(1000);
  });

  it('notes a station on contested ground that another area governs', () => {
    const problems = misplacedStations({
      stations: [station('S-4', 'A-01', -76.65)],
      boundaries: BOUNDARIES,
      areas: AREAS,
      on: ON,
    });
    expect(problems.codes()).toEqual(['locate.contested']);
    expect(problems.list()[0].detail.claimed).toEqual(['A-01', 'A-02']);
  });

  it('skips a station the register gives no position for', () => {
    const problems = misplacedStations({
      stations: [{ id: 'S-5', areaId: 'A-01' }],
      boundaries: BOUNDARIES,
      areas: AREAS,
      on: ON,
    });
    expect(problems.isClean()).toBe(true);
  });
});
