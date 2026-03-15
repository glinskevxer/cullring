import { describe, expect, it } from 'vitest';

import {
  EDGE_TOLERANCE_METRES,
  boundaryCoverage,
  checkRegister,
} from '../../src/area/consistency.js';
import { loadCase } from '../../src/cli/context.js';
import { station } from '../../src/area/station.js';
import { bed } from '../../src/harvest/bed.js';
import { boundary } from '../../src/geo/polygon.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 9, 30);

const check = (extra = {}) =>
  checkRegister({
    areas: loaded.areas,
    stations: loaded.stations,
    beds: loaded.beds,
    plans: loaded.plans,
    sources: loaded.sources,
    boundaries: loaded.boundaries,
    tides: loaded.tides,
    on,
    ...extra,
  });

describe('the worked example register', () => {
  it('holds together', () => {
    const answer = check();
    expect(answer.holds).toBe(true);
    expect(answer.problems.of('error')).toEqual([]);
  });

  it('reports the one place two lines were drawn over each other', () => {
    const overlaps = check()
      .problems.list()
      .filter((one) => one.code === 'locate.overlap');
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].detail).toMatchObject({ left: 'D-2', right: 'D-9' });
  });

  it('checked every station, bed and source', () => {
    expect(check().checked).toBe(
      loaded.stations.length + loaded.beds.length + loaded.sources.length,
    );
  });

  it('has a boundary drawn for every area', () => {
    expect(boundaryCoverage(loaded.areas, loaded.boundaries)).toMatchObject({
      drawn: 5,
      missing: [],
      share: 1,
    });
  });
});

describe('what the check finds', () => {
  it('finds a station outside the boundary of its own area', () => {
    const strayed = [
      ...loaded.stations,
      station({ id: 'B12-09', latitude: 35.5, longitude: -76.0, openedOn: '2020-01-01' }),
    ];
    const answer = check({ stations: strayed });
    expect(answer.problems.has('register.stationOutside')).toBe(true);
    expect(answer.problems.list()[0].message).toMatch(/feet from the nearest corner/);
  });

  it('finds a station in an area that does not exist', () => {
    const strayed = [
      ...loaded.stations,
      station({ id: 'Z9-01', latitude: 34.7, longitude: -76.7, openedOn: '2020-01-01' }),
    ];
    expect(check({ stations: strayed }).problems.has('register.stationArea')).toBe(true);
  });

  it('finds a bed in an area that does not exist', () => {
    const strayed = [
      ...loaded.beds,
      bed({ id: 'Z9-XXX', name: 'nowhere', tideStation: 'BFT', elevation: 1 }),
    ];
    expect(check({ beds: strayed }).problems.has('register.bedArea')).toBe(true);
  });

  it('warns about a bed reading a tide station the table does not predict', () => {
    const answer = check();
    expect(answer.problems.has('register.bedTide')).toBe(false);
    const odd = [
      ...loaded.beds,
      bed({ id: 'B12-ZZZ', name: 'nowhere', tideStation: 'ZZZ', elevation: 1 }),
    ];
    expect(check({ beds: odd }).problems.has('register.bedTide')).toBe(true);
  });

  it('says nothing about tide stations where no table was loaded', () => {
    expect(check({ tides: [] }).problems.has('register.bedTide')).toBe(false);
  });

  it('finds a plan naming an area that does not exist', () => {
    const strayed = [...loaded.plans, { ...loaded.plans[0], area: 'Z-9' }];
    expect(check({ plans: strayed }).problems.has('register.planArea')).toBe(true);
  });

  it('finds a conditional area with no plan at all', () => {
    expect(check({ plans: [] }).problems.has('register.noPlan')).toBe(true);
  });

  it('finds a boundary drawn for an area that does not exist', () => {
    const strayed = [
      ...loaded.boundaries,
      boundary({
        areaId: 'Z-9',
        points: [
          [34.7, -76.7],
          [34.8, -76.7],
          [34.8, -76.6],
        ],
      }),
    ];
    expect(check({ boundaries: strayed }).problems.has('register.boundaryArea')).toBe(true);
  });

  it('says nothing about a position where no boundary is drawn', () => {
    expect(check({ boundaries: [] }).holds).toBe(true);
  });

  it('allows a station just outside the line, within the tolerance', () => {
    expect(EDGE_TOLERANCE_METRES).toBe(25);
    const edge = [
      station({ id: 'B12-08', latitude: 34.7451, longitude: -76.7, openedOn: '2020-01-01' }),
    ];
    expect(check({ stations: edge }).holds).toBe(true);
  });
});

describe('the boundary coverage', () => {
  it('names the areas with nothing drawn', () => {
    const partial = loaded.boundaries.filter((one) => one.areaId !== 'D-9');
    const answer = boundaryCoverage(loaded.areas, partial);
    expect(answer.missing).toEqual(['D-9']);
    expect(answer.share).toBeCloseTo(4 / 5, 6);
  });

  it('is nothing at all for a register with no areas', () => {
    expect(boundaryCoverage([], [])).toMatchObject({ areas: 0, drawn: 0, share: 0 });
  });
});
