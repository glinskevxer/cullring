import { describe, expect, it } from 'vitest';

import {
  AREA_SHARE,
  NEVER_VISITED,
  TRIP_STATIONS,
  describeTrip,
  nextTrip,
  rotation,
  rotationFindings,
  weightOf,
} from '../../src/survey/rotation.js';
import { APPROVED, CONDITIONALLY_APPROVED, PROHIBITED } from '../../src/area/classification.js';
import { classificationPeriod, growingArea } from '../../src/area/growingArea.js';
import { civilDate } from '../../src/time/civil.js';

const ON = civilDate(2025, 9, 1);

const area = (id) =>
  growingArea({
    id,
    name: id,
    history: [classificationPeriod({ classification: APPROVED, from: '2015-01-01' })],
  });

const station = (id, areaId) => ({ id, areaId });

const sample = (stationId, collectedOn) => ({ station: stationId, collectedOn });

const setup = ({ classes = {}, stations, samples }) => ({
  areas: Array.from(new Set(stations.map((one) => one.areaId))).map(area),
  standing: new Map(
    Array.from(new Set(stations.map((one) => one.areaId))).map((id) => [
      id,
      classes[id] ?? APPROVED,
    ]),
  ),
  stations,
  samples,
  on: ON,
});

describe('weightOf', () => {
  it('puts a station nobody has ever been to above any delay', () => {
    expect(weightOf({ state: 'never visited', overdueDays: 0 })).toBe(NEVER_VISITED);
    expect(weightOf({ state: 'due', overdueDays: 400 })).toBe(400);
  });
});

describe('rotation', () => {
  it('orders the due stations by how badly they are wanted', () => {
    const queue = rotation(
      setup({
        stations: [station('SA-1', 'A-1'), station('SA-2', 'A-1')],
        samples: [sample('SA-1', civilDate(2025, 1, 1)), sample('SA-2', civilDate(2025, 6, 1))],
      }),
    );
    expect(queue.map((one) => one.station)).toEqual(['SA-1', 'SA-2']);
  });

  it('leaves out a station that is not due yet', () => {
    const queue = rotation(
      setup({
        stations: [station('SA-1', 'A-1')],
        samples: [sample('SA-1', civilDate(2025, 8, 25))],
      }),
    );
    expect(queue).toEqual([]);
  });

  it('leaves a prohibited area off the round rather than reporting it overdue', () => {
    const queue = rotation(
      setup({
        classes: { 'A-1': PROHIBITED },
        stations: [station('SA-1', 'A-1')],
        samples: [sample('SA-1', civilDate(2020, 1, 1))],
      }),
    );
    expect(queue).toEqual([]);
  });

  it('samples a conditional area twice as often, so it comes due first', () => {
    const queue = rotation(
      setup({
        classes: { 'B-2': CONDITIONALLY_APPROVED },
        stations: [station('SA-1', 'A-1'), station('SB-1', 'B-2')],
        samples: [sample('SA-1', civilDate(2025, 7, 25)), sample('SB-1', civilDate(2025, 7, 25))],
      }),
    );
    expect(queue.map((one) => one.station)).toEqual(['SB-1']);
  });

  it('skips an area the standing map does not reach', () => {
    const built = setup({
      stations: [station('SA-1', 'A-1')],
      samples: [sample('SA-1', civilDate(2020, 1, 1))],
    });
    built.standing = new Map();
    expect(rotation(built)).toEqual([]);
  });
});

describe('nextTrip', () => {
  const many = (areaId, count) =>
    Array.from({ length: count }, (unused, index) => station(`S${areaId}-${index + 1}`, areaId));

  const stale = (list, on) => list.map((one) => sample(one.id, on));

  it('fills the boat and says what is left waiting', () => {
    const stations = [...many('A-1', 8), ...many('B-2', 8)];
    const trip = nextTrip(setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) }));
    expect(trip.stations).toHaveLength(TRIP_STATIONS);
    expect(trip.waiting).toBe(16 - TRIP_STATIONS);
    expect(trip.capacity).toBe(TRIP_STATIONS);
  });

  it('caps what one area may take, so the round keeps moving', () => {
    const stations = [...many('A-1', 8), ...many('B-2', 8)];
    const trip = nextTrip(setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) }));
    const perArea = Math.floor(TRIP_STATIONS * AREA_SHARE);
    const first = trip.stations.slice(0, perArea * 2).filter((one) => one.area === 'A-1');
    expect(first.length).toBe(perArea);
    expect(trip.areas).toContain('B-2');
  });

  it('takes an area whole when it fits inside the share', () => {
    const stations = [...many('A-1', 3), ...many('B-2', 3)];
    const trip = nextTrip(setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) }));
    expect(trip.stations).toHaveLength(6);
    expect(trip.waiting).toBe(0);
  });

  it('honours a smaller boat', () => {
    const stations = many('A-1', 6);
    const trip = nextTrip({
      ...setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) }),
      capacity: 2,
      share: 1,
    });
    expect(trip.stations).toHaveLength(2);
    expect(trip.perArea).toBe(2);
  });

  it('refuses a boat that cannot carry anybody', () => {
    const stations = many('A-1', 2);
    const built = setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) });
    expect(() => nextTrip({ ...built, capacity: 0 })).toThrow(/at least 1/);
    expect(() => nextTrip({ ...built, share: 2 })).toThrow(/at most 1/);
  });

  it('says plainly when nothing is due', () => {
    const stations = many('A-1', 2);
    const trip = nextTrip(setup({ stations, samples: stale(stations, civilDate(2025, 8, 28)) }));
    expect(trip.stations).toEqual([]);
    expect(describeTrip(trip)).toBe('nothing is due on 2025-09-01');
  });

  it('describes what the boat is doing', () => {
    const stations = [...many('A-1', 8), ...many('B-2', 8)];
    const built = setup({ stations, samples: stale(stations, civilDate(2024, 1, 1)) });
    expect(describeTrip(nextTrip(built))).toContain('stations in A-1, B-2, with 7 left waiting');
  });
});

describe('rotationFindings', () => {
  const built = (stations, samples) => setup({ stations, samples });

  it('says nothing about a station that is merely waiting its turn', () => {
    const stations = [station('SA-1', 'A-1'), station('SA-2', 'A-1')];
    const input = built(stations, [
      sample('SA-1', civilDate(2025, 6, 1)),
      sample('SA-2', civilDate(2025, 6, 1)),
    ]);
    const queue = rotation(input);
    const trip = nextTrip({ ...input, capacity: 1, share: 1 });
    expect(rotationFindings(trip, queue).isClean()).toBe(true);
  });

  it('raises an error for a station left off the round a year past due', () => {
    const stations = [station('SA-1', 'A-1'), station('SA-2', 'A-1')];
    const input = built(stations, [
      sample('SA-1', civilDate(2023, 1, 1)),
      sample('SA-2', civilDate(2023, 1, 2)),
    ]);
    const queue = rotation(input);
    const trip = nextTrip({ ...input, capacity: 1, share: 1 });
    const problems = rotationFindings(trip, queue);
    expect(problems.codes()).toEqual(['rotation.abandoned']);
    expect(problems.list()[0].detail.station).toBe('SA-2');
  });

  it('warns separately about a station nobody has ever been to', () => {
    const stations = [station('SA-1', 'A-1'), station('SA-2', 'A-1')];
    const input = built(stations, []);
    const queue = rotation(input);
    const trip = nextTrip({ ...input, capacity: 1, share: 1 });
    const problems = rotationFindings(trip, queue);
    expect(problems.codes()).toEqual(['rotation.neverVisited']);
    expect(problems.list()[0].detail.station).toBe('SA-2');
  });
});
