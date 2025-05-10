import { describe, expect, it } from 'vitest';

import { describeVibrio, spentBeforeHarvest, vibrioCheck } from '../../src/vibrio/compliance.js';
import { WARM } from '../../src/vibrio/table.js';
import { FROM_EXPOSURE, FROM_HARVEST } from '../../src/vibrio/clock.js';
import { CHANNEL, FLAT, TIDES, UNPREDICTED, at, tonged, waded } from '../support/water.js';

const check = (record, bed, underControlAt) =>
  vibrioCheck({ record, bed, tides: TIDES, underControlAt });

describe('a boat harvest in August', () => {
  it('passes when the lot is iced down inside the ten hours', () => {
    const answer = check(tonged(), CHANNEL, at('2025-08-14 14:00'));
    expect(answer.compliant).toBe(true);
    expect(answer.limitHours).toBe(10);
    expect(answer.elapsedHours).toBe(7);
    expect(answer.region).toBe(WARM);
  });

  it('fails when it is an hour late', () => {
    const answer = check(tonged(), CHANNEL, at('2025-08-14 18:00'));
    expect(answer.compliant).toBe(false);
    expect(answer.problems.has('vibrio.overTime')).toBe(true);
  });

  it('passes exactly on the limit', () => {
    expect(check(tonged(), CHANNEL, at('2025-08-14 17:00')).compliant).toBe(true);
    expect(check(tonged(), CHANNEL, at('2025-08-14 17:01')).compliant).toBe(false);
  });

  it('buys two more hours with ice on board', () => {
    const iced = check(tonged({ iced: true }), CHANNEL, at('2025-08-14 18:00'));
    expect(iced.limitHours).toBe(12);
    expect(iced.compliant).toBe(true);
  });

  it('runs the clock from the harvest, since the gear works from a boat', () => {
    expect(check(tonged(), CHANNEL, at('2025-08-14 14:00')).clockStart.basis).toBe(FROM_HARVEST);
  });
});

describe('a wading harvest on the same morning', () => {
  it('fails at a moment the boat harvest passed, because the clock started earlier', () => {
    const boat = check(tonged(), CHANNEL, at('2025-08-14 16:30'));
    const flat = check(waded(), FLAT, at('2025-08-14 16:30'));
    expect(boat.compliant).toBe(true);
    expect(flat.compliant).toBe(false);
  });

  it('runs the clock from the tide and reports the head start', () => {
    const answer = check(waded(), FLAT, at('2025-08-14 12:00'));
    expect(answer.clockStart.basis).toBe(FROM_EXPOSURE);
    expect(answer.headStartSeconds).toBe(99 * 60);
    expect(answer.elapsedHours).toBeCloseTo(6.65, 6);
  });

  it('reports how much of the allowance was gone before anybody picked it up', () => {
    const answer = check(waded(), FLAT, at('2025-08-14 12:00'));
    expect(spentBeforeHarvest(answer)).toBeCloseTo(1.65 / 10, 6);
  });

  it('buys the same two hours with ice, which does not move the start', () => {
    const plain = check(waded(), FLAT, at('2025-08-14 16:30'));
    const iced = check(waded({ iced: true }), FLAT, at('2025-08-14 16:30'));
    expect(plain.compliant).toBe(false);
    expect(iced.compliant).toBe(true);
    expect(iced.clockStart.at.epochSecond).toBe(plain.clockStart.at.epochSecond);
  });
});

describe('when the question has no answer', () => {
  it('refuses a lot off a bed with no tide prediction', () => {
    const record = waded({ bed: 'C3-MSL', lot: '20250814-C3-001' });
    const answer = vibrioCheck({
      record,
      bed: UNPREDICTED,
      tides: TIDES,
      underControlAt: at('2025-08-14 12:00'),
    });
    expect(answer.compliant).toBe(false);
    expect(answer.problems.has('vibrio.noClock')).toBe(true);
    expect(answer.limitHours).toBeNull();
  });

  it('refuses a lot with no record of going under control', () => {
    const answer = vibrioCheck({ record: tonged(), bed: CHANNEL, tides: TIDES });
    expect(answer.problems.has('vibrio.noControl')).toBe(true);
    expect(answer.limitHours).toBe(10);
  });

  it('refuses a control time before the clock started', () => {
    const answer = check(tonged(), CHANNEL, at('2025-08-14 06:00'));
    expect(answer.problems.has('vibrio.beforeClock')).toBe(true);
  });
});

describe('outside the control season', () => {
  const december = {
    startedAt: at('2025-12-14 07:00'),
    landedAt: at('2025-12-14 09:45'),
    lot: '20251214-B12-002',
  };

  it('applies no limit and says so as a note rather than a failure', () => {
    const answer = check(tonged(december), CHANNEL, at('2025-12-15 09:00'));
    expect(answer.compliant).toBe(true);
    expect(answer.limitHours).toBeNull();
    expect(answer.problems.has('vibrio.outOfSeason')).toBe(true);
    expect(answer.problems.hasError()).toBe(false);
  });

  it('passes a lot that sat for a day, which July would have failed', () => {
    const answer = check(tonged(december), CHANNEL, at('2025-12-15 09:00'));
    expect(answer.compliant).toBe(true);
  });

  it('has nothing to report about the allowance spent', () => {
    expect(spentBeforeHarvest(check(tonged(december), CHANNEL, at('2025-12-15 09:00')))).toBeNull();
  });
});

describe('describing the answer', () => {
  it('gives the elapsed hours against the limit', () => {
    expect(describeVibrio(check(tonged(), CHANNEL, at('2025-08-14 14:00')))).toBe(
      '20250814-B12-002: 7 of 10 hours',
    );
  });

  it('says when no limit applies and when nothing was recorded', () => {
    const december = check(
      tonged({
        startedAt: at('2025-12-14 07:00'),
        landedAt: at('2025-12-14 09:45'),
        lot: '20251214-B12-002',
      }),
      CHANNEL,
      at('2025-12-15 09:00'),
    );
    expect(describeVibrio(december)).toMatch(/no limit applies/);
    const missing = vibrioCheck({ record: tonged(), bed: CHANNEL, tides: TIDES });
    expect(describeVibrio(missing)).toMatch(/nothing recorded/);
  });
});

describe('an area the temperature table does not know', () => {
  it('reports a finding rather than throwing, because a check reports', () => {
    const record = { ...tonged(), areaId: 'Z-9' };
    const answer = vibrioCheck({
      record,
      bed: CHANNEL,
      tides: TIDES,
      underControlAt: at('2025-08-14 12:00'),
    });
    expect(answer.compliant).toBe(false);
    expect(answer.problems.has('vibrio.noRegion')).toBe(true);
    expect(answer.limitHours).toBeNull();
  });
});
