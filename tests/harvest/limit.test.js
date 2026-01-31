import { describe, expect, it } from 'vitest';

import {
  checkTake,
  describeTake,
  limitFor,
  overOn,
  requireBushels,
  takeLimit,
  takeOn,
} from '../../src/harvest/limit.js';
import { harvestRecord } from '../../src/harvest/record.js';
import { civilDate } from '../../src/time/civil.js';
import { at } from '../support/water.js';

const day = civilDate(2025, 8, 14);

const landed = (lot, bed, containers, harvester = 'SH-2025-04412', species = 'oyster') =>
  harvestRecord({
    lot,
    harvester,
    bed,
    gear: 'rake',
    species,
    startedAt: at('2025-08-14 07:00'),
    landedAt: at('2025-08-14 09:00'),
    containers,
  });

const GENERAL = takeLimit({ species: 'oyster', bushels: 10 });
const LOCAL = takeLimit({ species: 'oyster', bushels: 4, areas: ['B-12'] });
const LIMITS = [GENERAL, LOCAL];

describe('which limit applies', () => {
  it('takes the area limit over the general one', () => {
    expect(limitFor(LIMITS, 'oyster', 'B-12')).toBe(LOCAL);
    expect(limitFor(LIMITS, 'oyster', 'C-3')).toBe(GENERAL);
  });

  it('answers with nothing where none is written for the species', () => {
    expect(limitFor(LIMITS, 'hard clam', 'B-12')).toBeNull();
  });

  it('refuses a limit that is not a number of bushels', () => {
    expect(() => takeLimit({ species: 'oyster', bushels: -1 })).toThrow(/at least 0/);
    expect(() => takeLimit({ bushels: 10 })).toThrow(/species/);
  });
});

describe('what a licence took on a day', () => {
  const records = [
    landed('20250814-B12-001', 'B12-BCK', 3),
    landed('20250814-B12-002', 'B12-CHN', 2),
    landed('20250814-C3-001', 'C3-MSL', 4),
    landed('20250814-D2-001', 'D2-TGB', 5, 'SH-2025-00877'),
  ];

  it('adds up the trips, not each one on its own', () => {
    const took = takeOn(records, 'SH-2025-04412', day);
    expect(took.total).toBe(9);
    expect(took.records).toHaveLength(3);
  });

  it('splits the take by area as well as by species', () => {
    const took = takeOn(records, 'SH-2025-04412', day);
    expect(took.byArea.get('oyster|B-12')).toBe(5);
    expect(took.byArea.get('oyster|C-3')).toBe(4);
    expect(took.bySpecies.get('oyster')).toBe(9);
  });

  it('takes only that licence and only that day', () => {
    expect(takeOn(records, 'SH-2025-00877', day).total).toBe(5);
    expect(takeOn(records, 'SH-2025-04412', civilDate(2025, 8, 15)).total).toBe(0);
  });
});

describe('checking a day against the limits', () => {
  it('passes a day inside both limits', () => {
    const records = [landed('20250814-B12-001', 'B12-BCK', 3)];
    expect(checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS }).lawful).toBe(
      true,
    );
  });

  it('fails on the area limit where one area was worked too hard', () => {
    const records = [landed('20250814-B12-001', 'B12-BCK', 5)];
    const answer = checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS });
    expect(answer.problems.has('limit.overArea')).toBe(true);
  });

  it('fails on the day limit where several areas add past it', () => {
    const records = [
      landed('20250814-B12-001', 'B12-BCK', 4),
      landed('20250814-C3-001', 'C3-MSL', 7),
    ];
    const answer = checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS });
    expect(answer.problems.has('limit.overDay')).toBe(true);
    expect(answer.problems.has('limit.overArea')).toBe(false);
  });

  it('would have passed every landing on its own, which is the point', () => {
    const records = [
      landed('20250814-B12-001', 'B12-BCK', 4),
      landed('20250814-C3-001', 'C3-MSL', 7),
    ];
    for (const one of records) {
      expect(
        checkTake({ records: [one], harvester: 'SH-2025-04412', day, limits: LIMITS }).lawful,
      ).toBe(true);
    }
    expect(checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS }).lawful).toBe(
      false,
    );
  });

  it('counts each area against its own limit', () => {
    const records = [
      landed('20250814-B12-001', 'B12-BCK', 5),
      landed('20250814-C3-001', 'C3-MSL', 3),
    ];
    const answer = checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS });
    expect(answer.problems.of('error')).toHaveLength(1);
    expect(answer.problems.list()[0].detail.area).toBe('B-12');
  });

  it('says nothing where no limit is written for the species', () => {
    const records = [landed('20250814-B12-001', 'B12-BCK', 40, 'SH-2025-04412', 'hard clam')];
    expect(checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS }).lawful).toBe(
      true,
    );
  });

  it('describes a day the way the patrol would write it', () => {
    const records = [landed('20250814-B12-001', 'B12-BCK', 3)];
    const answer = checkTake({ records, harvester: 'SH-2025-04412', day, limits: LIMITS });
    expect(describeTake(answer)).toBe('SH-2025-04412 landed 3 of oyster');
    const nothing = checkTake({ records: [], harvester: 'SH-2025-04412', day, limits: LIMITS });
    expect(describeTake(nothing)).toMatch(/landed nothing that day/);
  });
});

describe('everybody who went over', () => {
  it('names them and nobody else', () => {
    const records = [
      landed('20250814-B12-001', 'B12-BCK', 9),
      landed('20250814-D2-001', 'D2-TGB', 2, 'SH-2025-00877'),
    ];
    const over = overOn(records, day, LIMITS);
    expect(over.map((one) => one.harvester)).toEqual(['SH-2025-04412']);
  });

  it('names nobody on a quiet day', () => {
    expect(overOn([], day, LIMITS)).toEqual([]);
  });
});

describe('the bushel guard', () => {
  it('takes a whole count and refuses anything else', () => {
    expect(requireBushels(4)).toBe(4);
    expect(() => requireBushels(2.5)).toThrow(/whole number of bushels/);
    expect(() => requireBushels(-1)).toThrow(/whole number of bushels/);
  });
});
