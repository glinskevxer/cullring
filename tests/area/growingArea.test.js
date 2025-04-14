import { describe, expect, it } from 'vitest';

import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import {
  BASES,
  BY_EMERGENCY,
  BY_SHORELINE,
  BY_SURVEY,
  areasInRegion,
  basisOn,
  classificationOn,
  classificationPeriod,
  currentPeriod,
  findArea,
  growingArea,
  periodOn,
  reclassifiedOn,
} from '../../src/area/growingArea.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';

const B12 = growingArea({
  id: 'B-12',
  name: 'Broad Creek',
  acres: 412,
  history: [
    classificationPeriod({ classification: APPROVED, from: '2018-01-01', to: '2022-05-31' }),
    classificationPeriod({
      classification: CONDITIONALLY_APPROVED,
      from: '2022-06-01',
      to: '2024-09-30',
      basis: BY_SHORELINE,
    }),
    classificationPeriod({ classification: RESTRICTED, from: '2024-10-01' }),
  ],
});

const C3 = growingArea({
  id: 'C-3',
  name: 'Middle Sound',
  history: [classificationPeriod({ classification: APPROVED, from: '2015-01-01' })],
});

const B7 = growingArea({
  id: 'B-7',
  name: 'Pamlico Point',
  history: [classificationPeriod({ classification: PROHIBITED, from: '2010-01-01' })],
});

describe('a classification period', () => {
  it('holds a class, a span and the basis it was set on', () => {
    const period = classificationPeriod({
      classification: 'Approved',
      from: '2020-01-01',
      basis: BY_EMERGENCY,
    });
    expect(period.classification).toBe(APPROVED);
    expect(period.basis).toBe(BY_EMERGENCY);
    expect(period.to).toBeNull();
  });

  it('defaults to having been set off a survey', () => {
    expect(classificationPeriod({ classification: APPROVED, from: '2020-01-01' }).basis).toBe(
      BY_SURVEY,
    );
  });

  it('refuses a basis it does not know and lists them', () => {
    try {
      classificationPeriod({ classification: APPROVED, from: '2020-01-01', basis: 'a hunch' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(BASES.slice());
    }
  });

  it('refuses a period that ends before it starts', () => {
    expect(() =>
      classificationPeriod({ classification: APPROVED, from: '2020-06-01', to: '2020-01-01' }),
    ).toThrow(/cannot end before it starts/);
  });

  it('refuses a class that is not one of the five', () => {
    expect(() => classificationPeriod({ classification: 'open', from: '2020-01-01' })).toThrow(
      /not a classification/,
    );
  });
});

describe('building an area', () => {
  it('reads the region and the number out of the identifier', () => {
    expect(B12.region).toBe('B');
    expect(B12.number).toBe(12);
    expect(B12.subarea).toBeNull();
  });

  it('sorts the history whatever order it arrives in', () => {
    const shuffled = growingArea({
      id: 'B-9',
      name: 'Turnagain',
      history: [
        classificationPeriod({ classification: RESTRICTED, from: '2022-01-01' }),
        classificationPeriod({ classification: APPROVED, from: '2018-01-01', to: '2021-12-31' }),
      ],
    });
    expect(shuffled.history.map((period) => period.classification)).toEqual([APPROVED, RESTRICTED]);
  });

  it('refuses an area with no history at all', () => {
    expect(() => growingArea({ id: 'B-9', name: 'Turnagain', history: [] })).toThrow(
      /at least 1 entries/,
    );
  });

  it('refuses two classifications in force at once', () => {
    expect(() =>
      growingArea({
        id: 'B-9',
        name: 'Turnagain',
        history: [
          classificationPeriod({ classification: APPROVED, from: '2018-01-01', to: '2022-12-31' }),
          classificationPeriod({ classification: RESTRICTED, from: '2022-01-01' }),
        ],
      }),
    ).toThrow(/two classifications at once/);
  });

  it('refuses a second period after one that never ended', () => {
    expect(() =>
      growingArea({
        id: 'B-9',
        name: 'Turnagain',
        history: [
          classificationPeriod({ classification: APPROVED, from: '2018-01-01' }),
          classificationPeriod({ classification: RESTRICTED, from: '2022-01-01' }),
        ],
      }),
    ).toThrow(/two classifications at once/);
  });

  it('refuses an area with no name', () => {
    expect(() =>
      growingArea({
        id: 'B-9',
        history: [classificationPeriod({ classification: APPROVED, from: '2018-01-01' })],
      }),
    ).toThrow(/name/);
  });
});

describe('reading the register on a day', () => {
  it.each([
    ['2018-01-01', APPROVED],
    ['2022-05-31', APPROVED],
    ['2022-06-01', CONDITIONALLY_APPROVED],
    ['2024-09-30', CONDITIONALLY_APPROVED],
    ['2024-10-01', RESTRICTED],
    ['2099-01-01', RESTRICTED],
  ])('reads %s as %s', (day, expected) => {
    const [year, month, dayOfMonth] = day.split('-').map(Number);
    expect(classificationOn(B12, civilDate(year, month, dayOfMonth))).toBe(expected);
  });

  it('answers with nothing before the register reaches', () => {
    expect(classificationOn(B12, civilDate(2017, 12, 31))).toBeNull();
    expect(periodOn(B12, civilDate(2017, 12, 31))).toBeNull();
    expect(basisOn(B12, civilDate(2017, 12, 31))).toBeNull();
  });

  it('reports the basis that period was set on', () => {
    expect(basisOn(B12, civilDate(2023, 1, 1))).toBe(BY_SHORELINE);
    expect(basisOn(B12, civilDate(2019, 1, 1))).toBe(BY_SURVEY);
  });

  it('names the current period and the days it was reclassified on', () => {
    expect(currentPeriod(B12).classification).toBe(RESTRICTED);
    expect(reclassifiedOn(B12).map(formatCivilDate)).toEqual(['2022-06-01', '2024-10-01']);
    expect(reclassifiedOn(C3)).toEqual([]);
  });
});

describe('finding areas', () => {
  const ALL = [B12, C3, B7];

  it('finds one by number, however it is written', () => {
    expect(findArea(ALL, 'b-12').name).toBe('Broad Creek');
    expect(findArea(ALL, 'B-99')).toBeNull();
  });

  it('lists a region in number order', () => {
    expect(areasInRegion(ALL, 'b').map((area) => area.id)).toEqual(['B-7', 'B-12']);
    expect(areasInRegion(ALL, 'Z')).toEqual([]);
  });
});
