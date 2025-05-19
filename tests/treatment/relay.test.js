import { describe, expect, it } from 'vitest';

import {
  COLD_DAYS,
  NO_PUMPING_BELOW,
  WARM_DAYS,
  WARM_WATER_AT,
  checkRelay,
  relayDays,
  relayPermit,
} from '../../src/treatment/relay.js';
import { AREAS, JUNE_FIRST, PLANS, STORM, at } from '../support/register.js';
import { harvestRecord } from '../../src/harvest/record.js';

const lot = harvestRecord({
  harvester: 'SH-2025-04412',
  bed: 'D2-TGB',
  gear: 'rake',
  startedAt: at('2025-06-02 07:00'),
  landedAt: at('2025-06-02 09:00'),
  containers: 8,
  dealer: 'DP-003',
});

const permit = relayPermit({
  number: 'rl-2025-018',
  harvester: 'SH-2025-04412',
  fromArea: 'D-2',
  toArea: 'C-3',
  issuedOn: '2025-05-01',
  expiresOn: '2025-10-31',
});

const relay = (extra = {}) =>
  checkRelay({
    record: lot,
    permit,
    toArea: 'C-3',
    laidAt: at('2025-06-02 12:00'),
    liftedAt: at('2025-06-16 12:00'),
    waterTemperature: 74,
    areas: AREAS,
    plans: PLANS,
    feed: STORM,
    from: JUNE_FIRST,
    ...extra,
  });

describe('how long a relay has to run', () => {
  it('is fourteen days in warm water', () => {
    expect(relayDays(74)).toBe(WARM_DAYS);
    expect(relayDays(WARM_WATER_AT)).toBe(WARM_DAYS);
  });

  it('is twenty one days when the water is cool', () => {
    expect(relayDays(WARM_WATER_AT - 1)).toBe(COLD_DAYS);
    expect(relayDays(45)).toBe(COLD_DAYS);
    expect(relayDays(NO_PUMPING_BELOW)).toBe(COLD_DAYS);
  });

  it('is no answer at all below the pumping floor', () => {
    expect(relayDays(NO_PUMPING_BELOW - 1)).toBeNull();
    expect(relayDays(35)).toBeNull();
  });

  it('refuses a temperature that is not a number', () => {
    expect(() => relayDays('cold')).toThrow(/waterTemperature/);
  });
});

describe('a relay permit', () => {
  it('normalises the number', () => {
    expect(permit.number).toBe('RL-2025-018');
  });

  it('refuses a permit with no number', () => {
    expect(() => relayPermit({ number: '  ' })).toThrow(/carries a number/);
  });
});

describe('a relay that works', () => {
  it('releases the lot', () => {
    const answer = relay();
    expect(answer.released).toBe(true);
    expect(answer.requiredDays).toBe(14);
    expect(answer.heldDays).toBe(14);
  });

  it('releases exactly on the fourteenth day and not a moment before', () => {
    expect(relay({ liftedAt: at('2025-06-16 12:00') }).released).toBe(true);
    expect(relay({ liftedAt: at('2025-06-16 11:00') }).released).toBe(false);
  });
});

describe('a relay that does not', () => {
  it('refuses a lot lifted early', () => {
    const answer = relay({ liftedAt: at('2025-06-10 12:00') });
    expect(answer.problems.has('relay.tooShort')).toBe(true);
  });

  it('refuses a lot lifted before it was laid', () => {
    const answer = relay({ laidAt: at('2025-06-16 12:00'), liftedAt: at('2025-06-02 12:00') });
    expect(answer.problems.has('relay.order')).toBe(true);
  });

  it('refuses a relay in water too cold for the shellfish to pump', () => {
    const answer = relay({ waterTemperature: 38 });
    expect(answer.problems.has('relay.tooCold')).toBe(true);
    expect(answer.requiredDays).toBeNull();
  });

  it('asks for the longer period in cool water, and fails a fourteen day relay', () => {
    const answer = relay({ waterTemperature: 46 });
    expect(answer.requiredDays).toBe(21);
    expect(answer.problems.has('relay.tooShort')).toBe(true);
  });

  it('refuses a relay under no permit', () => {
    expect(relay({ permit: null }).problems.has('relay.noPermit')).toBe(true);
  });

  it('refuses a relay into water the permit does not name', () => {
    const answer = relay({ toArea: 'B-12' });
    expect(answer.problems.has('relay.wrongWater')).toBe(true);
  });

  it('refuses a relay into water that is not in the register', () => {
    const answer = relay({ toArea: 'Z-9', permit: { ...permit, toArea: 'Z-9' } });
    expect(answer.problems.has('relay.unknownWater')).toBe(true);
  });
});

describe('the receiving water has to hold approved for the whole period', () => {
  it('refuses a relay into water that is not approved at all', () => {
    const answer = relay({ toArea: 'D-2', permit: { ...permit, toArea: 'D-2' } });
    expect(answer.problems.has('relay.waterNotApproved')).toBe(true);
  });

  it('refuses a relay into a conditional area that shut partway through', () => {
    const answer = relay({
      toArea: 'B-12',
      permit: { ...permit, toArea: 'B-12' },
      laidAt: at('2025-06-02 12:00'),
      liftedAt: at('2025-06-16 12:00'),
    });
    expect(answer.problems.has('relay.waterNotApproved')).toBe(true);
  });

  it('allows the same water for a period that misses the closure', () => {
    const answer = relay({
      toArea: 'B-12',
      permit: { ...permit, toArea: 'B-12' },
      laidAt: at('2025-06-15 12:00'),
      liftedAt: at('2025-06-29 12:00'),
    });
    expect(answer.problems.has('relay.waterNotApproved')).toBe(false);
    expect(answer.released).toBe(true);
  });

  it('counts the days the water was not approved, so the notice can say how bad it was', () => {
    const answer = relay({ toArea: 'D-2', permit: { ...permit, toArea: 'D-2' } });
    const finding = answer.problems.list().find((one) => one.code === 'relay.waterNotApproved');
    expect(finding.detail.days).toBeGreaterThan(1);
  });
});

describe('a relay of product that did not need one', () => {
  it('notes it without failing the relay, because it is not unlawful', () => {
    const answer = relay({ harvestedAs: 'approved' });
    expect(answer.problems.has('relay.notNeeded')).toBe(true);
    expect(answer.released).toBe(true);
  });

  it('says nothing where the product did need treating', () => {
    expect(relay({ harvestedAs: 'restricted' }).problems.has('relay.notNeeded')).toBe(false);
  });

  it('says nothing where nobody supplied the class it came out of', () => {
    expect(relay().problems.has('relay.notNeeded')).toBe(false);
  });
});
