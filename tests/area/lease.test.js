import { describe, expect, it } from 'vitest';

import {
  EXPIRED,
  IN_FORCE,
  NOT_YET,
  RENEWAL_NOTICE_DAYS,
  SUSPENDED,
  coversDay,
  describeLease,
  findLease,
  holderOn,
  lease,
  leaseFindings,
  leasesFor,
  overlapping,
  standingOf,
} from '../../src/area/lease.js';
import { APPROVED, PROHIBITED, RESTRICTED } from '../../src/area/classification.js';
import { civilDate } from '../../src/time/civil.js';

const ON = civilDate(2025, 8, 15);

const build = (extra = {}) =>
  lease({
    id: 'SL-1104',
    bed: 'B12-BCK',
    holder: 'SF-1042',
    from: '2024-01-01',
    to: '2033-12-31',
    acres: 4.5,
    rentPaidThrough: '2025-12-31',
    ...extra,
  });

describe('building a lease', () => {
  it('squares the case up and keeps the term', () => {
    const one = lease({
      id: 'sl-1104',
      bed: 'b12-bck',
      holder: 'sf-1042',
      from: '2024-01-01',
      to: '2033-12-31',
    });
    expect(one.id).toBe('SL-1104');
    expect(one.bed).toBe('B12-BCK');
    expect(one.holder).toBe('SF-1042');
    expect(one.acres).toBe(null);
  });

  it('refuses a term that ends before it begins', () => {
    expect(() => build({ from: '2030-01-01', to: '2029-01-01' })).toThrow(/ends before it begins/);
  });

  it('refuses acres that are not a number of acres', () => {
    expect(() => build({ acres: -1 })).toThrow(/at least 0/);
  });
});

describe('the term', () => {
  it('covers the first and last day of itself', () => {
    expect(coversDay(build(), civilDate(2024, 1, 1))).toBe(true);
    expect(coversDay(build(), civilDate(2033, 12, 31))).toBe(true);
  });

  it('does not cover the day before or the day after', () => {
    expect(coversDay(build(), civilDate(2023, 12, 31))).toBe(false);
    expect(coversDay(build(), civilDate(2034, 1, 1))).toBe(false);
  });
});

describe('standingOf', () => {
  it('reads a lease inside its term over open water as in force', () => {
    expect(standingOf(build(), { on: ON, classification: APPROVED }).standing).toBe(IN_FORCE);
  });

  it('suspends a lease over prohibited water rather than ending it', () => {
    const where = standingOf(build(), { on: ON, classification: PROHIBITED });
    expect(where.standing).toBe(SUSPENDED);
  });

  it('leaves restricted water alone, because restricted product is not illegal product', () => {
    expect(standingOf(build(), { on: ON, classification: RESTRICTED }).standing).toBe(IN_FORCE);
  });

  it('reads either end of the term', () => {
    expect(standingOf(build(), { on: civilDate(2020, 1, 1) }).standing).toBe(NOT_YET);
    expect(standingOf(build(), { on: civilDate(2040, 1, 1) }).standing).toBe(EXPIRED);
  });

  it('says whether the water was asked about at all', () => {
    expect(standingOf(build(), { on: ON }).waterAsked).toBe(false);
    expect(standingOf(build(), { on: ON, classification: APPROVED }).waterAsked).toBe(true);
  });
});

describe('who held the ground', () => {
  const leases = [
    build({ id: 'SL-1', from: '2020-01-01', to: '2024-12-31', holder: 'SF-1001' }),
    build({ id: 'SL-2', from: '2025-01-01', to: '2034-12-31', holder: 'SF-1042' }),
  ];

  it('answers for the day asked about rather than for today', () => {
    expect(holderOn(leases, 'B12-BCK', civilDate(2022, 6, 1))).toBe('SF-1001');
    expect(holderOn(leases, 'B12-BCK', ON)).toBe('SF-1042');
  });

  it('says nobody held it in the gap', () => {
    const gapped = [leases[0], build({ id: 'SL-3', from: '2026-01-01', to: '2034-12-31' })];
    expect(holderOn(gapped, 'B12-BCK', ON)).toBe(null);
  });

  it('says nobody for ground nobody leased', () => {
    expect(holderOn(leases, 'C3-MID', ON)).toBe(null);
  });

  it('lists what one grower holds on a day', () => {
    expect(leasesFor(leases, 'sf-1042', ON).map((one) => one.id)).toEqual(['SL-2']);
    expect(leasesFor(leases, 'SF-1001', ON)).toEqual([]);
  });

  it('finds a lease by number', () => {
    expect(findLease(leases, 'sl-2').id).toBe('SL-2');
    expect(findLease(leases, 'SL-9')).toBe(null);
  });
});

describe('overlapping', () => {
  it('finds two leases over the same ground at once, and chooses neither', () => {
    const clash = overlapping([
      build({ id: 'SL-1', from: '2020-01-01', to: '2026-12-31' }),
      build({ id: 'SL-2', from: '2025-01-01', to: '2034-12-31' }),
    ]);
    expect(clash).toEqual([{ bed: 'B12-BCK', first: 'SL-1', second: 'SL-2' }]);
  });

  it('reads two terms that touch at the ends as an overlap, because both cover that day', () => {
    const clash = overlapping([
      build({ id: 'SL-1', from: '2020-01-01', to: '2024-12-31' }),
      build({ id: 'SL-2', from: '2024-12-31', to: '2034-12-31' }),
    ]);
    expect(clash).toHaveLength(1);
  });

  it('leaves two terms that follow each other alone', () => {
    const clash = overlapping([
      build({ id: 'SL-1', from: '2020-01-01', to: '2024-12-31' }),
      build({ id: 'SL-2', from: '2025-01-01', to: '2034-12-31' }),
    ]);
    expect(clash).toEqual([]);
  });

  it('leaves two leases on different ground alone', () => {
    expect(overlapping([build({ id: 'SL-1' }), build({ id: 'SL-2', bed: 'C3-MID' })])).toEqual([]);
  });
});

describe('leaseFindings', () => {
  const findingsFor = (leases, classificationOf) =>
    leaseFindings(leases, { on: ON, classificationOf });

  it('says nothing about a lease in force with the rent paid', () => {
    expect(findingsFor([build()], () => APPROVED).isClean()).toBe(true);
  });

  it('reports arrears with the date it is paid through', () => {
    const problems = findingsFor([build({ rentPaidThrough: '2024-12-31' })], () => APPROVED);
    expect(problems.codes()).toEqual(['lease.rentOwed']);
    expect(problems.list()[0].detail.paidThrough).toBe('2024-12-31');
  });

  it('keeps an unrecorded rent date apart from arrears, because they go to different desks', () => {
    const problems = findingsFor([build({ rentPaidThrough: null })], () => APPROVED);
    expect(problems.codes()).toEqual(['lease.rentUnrecorded']);
  });

  it('notes a suspension and still asks for the rent', () => {
    const problems = findingsFor([build({ rentPaidThrough: '2024-12-31' })], () => PROHIBITED);
    expect(problems.codes().sort()).toEqual(['lease.rentOwed', 'lease.suspended']);
  });

  it('says nothing at all about an expired lease', () => {
    const problems = findingsFor([build({ from: '2010-01-01', to: '2015-12-31' })], () => APPROVED);
    expect(problems.isClean()).toBe(true);
  });

  it('gives notice before a term runs out', () => {
    const soon = build({ to: '2025-10-01' });
    expect(findingsFor([soon], () => APPROVED).codes()).toContain('lease.renewalDue');
  });

  it('gives no notice while the end is further off than the notice period', () => {
    const later = build({ to: '2026-06-01' });
    expect(findingsFor([later], () => APPROVED).codes()).not.toContain('lease.renewalDue');
    expect(RENEWAL_NOTICE_DAYS).toBe(120);
  });

  it('reports an overlap without needing to know anything about the water', () => {
    const problems = leaseFindings(
      [build({ id: 'SL-1', to: '2026-12-31' }), build({ id: 'SL-2', from: '2025-01-01' })],
      { on: ON },
    );
    expect(problems.codes()).toContain('lease.overlap');
  });

  it('describes one in a line', () => {
    const one = build();
    expect(describeLease(one, standingOf(one, { on: ON, classification: APPROVED }))).toBe(
      'SL-1104, 4.5 acres of B12-BCK to SF-1042, in force on the day asked about',
    );
  });
});
