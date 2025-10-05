import { describe, expect, it } from 'vitest';

import { MAXIMUM_DAYS, checkWetStorage } from '../../src/treatment/wetStorage.js';
import { APPROVED, RESTRICTED } from '../../src/area/classification.js';
import { AREAS, JUNE_FIRST, PLANS, STORM, at } from '../support/register.js';
import { DEALERS } from '../support/people.js';

const store = (extra = {}) =>
  checkWetStorage({
    lot: '20250602-C3-001',
    dealer: 'SS-042',
    areaId: 'C-3',
    harvestedAs: APPROVED,
    placedAt: at('2025-06-02 12:00'),
    removedAt: at('2025-06-05 12:00'),
    areas: AREAS,
    plans: PLANS,
    feed: STORM,
    dealers: DEALERS,
    from: JUNE_FIRST,
    ...extra,
  });

describe('a lawful float', () => {
  it('passes', () => {
    const answer = store();
    expect(answer.lawful).toBe(true);
    expect(answer.days).toBe(3);
  });

  it('passes right up to the limit', () => {
    expect(store({ removedAt: at('2025-06-16 12:00') }).lawful).toBe(true);
    expect(store({ removedAt: at('2025-06-16 13:00') }).problems.has('wet.tooLong')).toBe(true);
    expect(MAXIMUM_DAYS).toBe(14);
  });
});

describe('what may not be wet stored', () => {
  it('refuses product out of restricted water, and says why', () => {
    const answer = store({ harvestedAs: RESTRICTED });
    expect(answer.problems.has('wet.needsTreatment')).toBe(true);
    expect(answer.problems.list()[0].message).toMatch(/which wet storage is not/);
  });

  it('refuses it even where the receiving water is perfectly approved', () => {
    const answer = store({ harvestedAs: RESTRICTED });
    expect(answer.problems.has('wet.waterNotApproved')).toBe(false);
    expect(answer.lawful).toBe(false);
  });

  it('warns rather than refuses where nothing records the origin', () => {
    const answer = store({ harvestedAs: null });
    expect(answer.problems.has('wet.unknownOrigin')).toBe(true);
    expect(answer.lawful).toBe(true);
  });
});

describe('who may wet store', () => {
  it('allows a shellstock shipper and a depuration processor', () => {
    expect(store({ dealer: 'SS-042' }).problems.has('wet.notPermitted')).toBe(false);
    expect(store({ dealer: 'DP-003' }).problems.has('wet.notPermitted')).toBe(false);
  });

  it('refuses a shucker packer, whose certification does not list it', () => {
    expect(store({ dealer: 'SP-118' }).problems.has('wet.notPermitted')).toBe(true);
  });

  it('refuses a dealer that is not in the register, and no dealer at all', () => {
    expect(store({ dealer: 'SS-777' }).problems.has('wet.unknownDealer')).toBe(true);
    expect(store({ dealer: null }).problems.has('wet.noDealer')).toBe(true);
  });
});

describe('the water it sits in', () => {
  it('refuses a float in water that is not approved', () => {
    expect(store({ areaId: 'D-2' }).problems.has('wet.waterNotApproved')).toBe(true);
  });

  it('refuses a float in a conditional area that shut partway through', () => {
    const answer = store({
      areaId: 'B-12',
      placedAt: at('2025-06-08 12:00'),
      removedAt: at('2025-06-12 12:00'),
    });
    expect(answer.problems.has('wet.waterNotApproved')).toBe(true);
  });

  it('allows the same water for a spell that misses the closure', () => {
    const answer = store({
      areaId: 'B-12',
      placedAt: at('2025-06-15 12:00'),
      removedAt: at('2025-06-18 12:00'),
    });
    expect(answer.lawful).toBe(true);
  });

  it('refuses water that is not in the register', () => {
    expect(store({ areaId: 'Z-9' }).problems.has('wet.unknownWater')).toBe(true);
  });
});

describe('the times', () => {
  it('refuses a float taken out before it went in', () => {
    const answer = store({ placedAt: at('2025-06-05 12:00'), removedAt: at('2025-06-02 12:00') });
    expect(answer.problems.has('wet.order')).toBe(true);
  });

  it('refuses times that are not instants', () => {
    expect(store({ removedAt: '2025-06-05 12:00' }).problems.has('wet.time')).toBe(true);
  });
});
