import { describe, expect, it } from 'vitest';

import {
  CULL_SIZE,
  HOLDING_HOURS,
  SAMPLING_INTERVAL,
  VARIANCE_KINDS,
  boundsFor,
  describeVariance,
  inForce,
  valueOr,
  variance,
  varianceFor,
  variancesFor,
} from '../../src/area/variance.js';
import { civilDate } from '../../src/time/civil.js';

const on = civilDate(2025, 8, 14);

const cull = variance({
  area: 'B-12',
  kind: CULL_SIZE,
  value: 2.5,
  grantedOn: '2024-01-01',
  expiresOn: '2026-12-31',
  reference: '15A NCAC 18A .0912',
});

const forOysters = variance({
  area: 'B-12',
  kind: CULL_SIZE,
  value: 2.75,
  species: 'oyster',
  grantedOn: '2025-01-01',
  expiresOn: '2026-12-31',
});

const interval = variance({
  area: 'D-2',
  kind: SAMPLING_INTERVAL,
  value: 90,
  grantedOn: '2024-01-01',
  expiresOn: '2026-12-31',
});

const lapsed = variance({
  area: 'C-3',
  kind: HOLDING_HOURS,
  value: 30,
  grantedOn: '2020-01-01',
  expiresOn: '2021-12-31',
});

const HELD = [cull, forOysters, interval, lapsed];

describe('the kinds', () => {
  it('is a closed list of three', () => {
    expect(VARIANCE_KINDS).toEqual([CULL_SIZE, SAMPLING_INTERVAL, HOLDING_HOURS]);
  });

  it('names what each replaces and the range it may take', () => {
    expect(boundsFor(CULL_SIZE)).toMatchObject({ field: 'inches' });
    expect(boundsFor(SAMPLING_INTERVAL)).toMatchObject({ field: 'days' });
    expect(boundsFor(HOLDING_HOURS)).toMatchObject({ field: 'hours' });
  });

  it('refuses a kind it does not grant', () => {
    expect(() => boundsFor('classification')).toThrow(/not a kind of variance/);
  });

  it('refuses a value outside the range for its kind', () => {
    expect(() =>
      variance({
        area: 'B-12',
        kind: CULL_SIZE,
        value: 9,
        grantedOn: '2024-01-01',
        expiresOn: '2026-12-31',
      }),
    ).toThrow(/at most 6/);
    expect(() =>
      variance({
        area: 'B-12',
        kind: SAMPLING_INTERVAL,
        value: 2,
        grantedOn: '2024-01-01',
        expiresOn: '2026-12-31',
      }),
    ).toThrow(/at least 7/);
  });

  it('refuses a variance that expires before it is granted', () => {
    expect(() =>
      variance({
        area: 'B-12',
        kind: CULL_SIZE,
        value: 2.5,
        grantedOn: '2026-01-01',
        expiresOn: '2024-01-01',
      }),
    ).toThrow(/expire before it is granted/);
  });
});

describe('when a variance is in force', () => {
  it('reads both ends as inclusive', () => {
    expect(inForce(cull, civilDate(2024, 1, 1))).toBe(true);
    expect(inForce(cull, civilDate(2026, 12, 31))).toBe(true);
    expect(inForce(cull, civilDate(2023, 12, 31))).toBe(false);
    expect(inForce(cull, civilDate(2027, 1, 1))).toBe(false);
  });
});

describe('which variance applies', () => {
  it('takes the one naming the species over the general one', () => {
    expect(varianceFor(HELD, { area: 'B-12', kind: CULL_SIZE, species: 'oyster', on })).toBe(
      forOysters,
    );
  });

  it('falls back to the general one for another species', () => {
    expect(varianceFor(HELD, { area: 'B-12', kind: CULL_SIZE, species: 'hard clam', on })).toBe(
      cull,
    );
  });

  it('answers with nothing for a kind nobody was granted', () => {
    expect(varianceFor(HELD, { area: 'B-12', kind: HOLDING_HOURS, on })).toBeNull();
  });

  it('answers with nothing once one has lapsed', () => {
    expect(varianceFor(HELD, { area: 'C-3', kind: HOLDING_HOURS, on })).toBeNull();
    expect(varianceFor(HELD, { area: 'C-3', kind: HOLDING_HOURS, on: civilDate(2021, 6, 1) })).toBe(
      lapsed,
    );
  });

  it('refuses two of the same kind in force at once, which is a register defect', () => {
    const twice = [cull, { ...cull, value: 2.75 }];
    expect(() => varianceFor(twice, { area: 'B-12', kind: CULL_SIZE, on })).toThrow(
      /two cull size variances at once/,
    );
  });
});

describe('the number a rule should use', () => {
  it('is the variance where there is one', () => {
    expect(valueOr(HELD, { area: 'B-12', kind: CULL_SIZE, on }, 3)).toBe(2.5);
    expect(valueOr(HELD, { area: 'B-12', kind: CULL_SIZE, species: 'oyster', on }, 3)).toBe(2.75);
  });

  it('is the standard where there is not', () => {
    expect(valueOr(HELD, { area: 'C-3', kind: CULL_SIZE, on }, 3)).toBe(3);
    expect(valueOr([], { area: 'B-12', kind: CULL_SIZE, on }, 3)).toBe(3);
  });

  it('is the standard again once the variance lapses', () => {
    expect(valueOr(HELD, { area: 'C-3', kind: HOLDING_HOURS, on }, 24)).toBe(24);
  });
});

describe('reading the register', () => {
  it('lists an area in the order they were granted', () => {
    expect(variancesFor(HELD, 'B-12').map((one) => one.value)).toEqual([2.5, 2.75]);
    expect(variancesFor(HELD, 'D-9')).toEqual([]);
  });

  it('describes one in a line the notice could carry', () => {
    expect(describeVariance(forOysters)).toBe(
      'B-12: cull size for oyster of 2.75 inches, to 2026-12-31',
    );
    expect(describeVariance(interval)).toBe('D-2: sampling interval of 90 days, to 2026-12-31');
  });
});
