import { describe, expect, it } from 'vitest';

import {
  FROM_EXPOSURE,
  FROM_HARVEST,
  clockStart,
  describeClockStart,
  headStartSeconds,
} from '../../src/vibrio/clock.js';
import { DIVER, DREDGE, HAND, RAKE, TONGS } from '../../src/licence/harvester.js';
import { toStoredForm } from '../../src/time/instant.js';
import { CHANNEL, FLAT, TIDES, UNPREDICTED, at, tonged, waded } from '../support/water.js';

const stamp = (point) => (point === null ? null : toStoredForm('eastern', point));

describe('gear worked from a boat', () => {
  it.each([TONGS, DREDGE, DIVER])('starts the clock at the harvest for %s', (gear) => {
    const start = clockStart({ record: tonged({ gear }), bed: CHANNEL, tides: TIDES });
    expect(start.basis).toBe(FROM_HARVEST);
    expect(stamp(start.at)).toBe('2025-08-14T07:00:00-04:00');
    expect(start.known).toBe(true);
  });

  it('does not consult the tide at all, so it works with no table', () => {
    const start = clockStart({ record: tonged(), bed: CHANNEL, tides: [] });
    expect(start.known).toBe(true);
    expect(stamp(start.at)).toBe('2025-08-14T07:00:00-04:00');
  });

  it('gives that harvest no head start', () => {
    const record = tonged();
    const start = clockStart({ record, bed: CHANNEL, tides: TIDES });
    expect(headStartSeconds(start, record)).toBe(0);
  });
});

describe('gear worked on foot', () => {
  it.each([HAND, RAKE])('starts the clock at the tide for %s', (gear) => {
    const start = clockStart({ record: waded({ gear }), bed: FLAT, tides: TIDES });
    expect(start.basis).toBe(FROM_EXPOSURE);
    expect(stamp(start.at)).toBe('2025-08-14T05:21:00-04:00');
  });

  it('gives the lot the head start it actually had', () => {
    const record = waded();
    const start = clockStart({ record, bed: FLAT, tides: TIDES });
    expect(headStartSeconds(start, record)).toBe(99 * 60);
  });

  it('starts the clock earlier than the boat clock on the same morning', () => {
    const wading = clockStart({ record: waded(), bed: FLAT, tides: TIDES });
    const boat = clockStart({ record: tonged(), bed: CHANNEL, tides: TIDES });
    expect(wading.at.epochSecond).toBeLessThan(boat.at.epochSecond);
  });

  it('starts a higher bed earlier than a lower one on the same tide', () => {
    const higher = clockStart({
      record: waded(),
      bed: { ...FLAT, elevation: 2.5 },
      tides: TIDES,
    });
    const lower = clockStart({ record: waded(), bed: { ...FLAT, elevation: 1 }, tides: TIDES });
    expect(higher.at.epochSecond).toBeLessThan(lower.at.epochSecond);
  });
});

describe('the awkward cases', () => {
  it('reads a bed still under water at the harvest from the harvest', () => {
    const start = clockStart({
      record: waded({ startedAt: at('2025-08-14 03:00') }),
      bed: FLAT,
      tides: TIDES,
    });
    expect(start.basis).toBe(FROM_HARVEST);
    expect(start.reason).toMatch(/under water/);
    expect(start.known).toBe(true);
  });

  it('refuses to start a clock it cannot predict, rather than taking the harvest time', () => {
    const start = clockStart({
      record: waded({ bed: 'C3-MSL', lot: '20250814-C3-001' }),
      bed: UNPREDICTED,
      tides: TIDES,
    });
    expect(start.known).toBe(false);
    expect(start.at).toBeNull();
    expect(start.basis).toBe(FROM_EXPOSURE);
    expect(start.reason).toMatch(/no tide is predicted/);
  });

  it('refuses just as firmly when the table runs out before the harvest', () => {
    const start = clockStart({
      record: waded({ startedAt: at('2025-08-16 07:00'), landedAt: at('2025-08-16 09:00') }),
      bed: FLAT,
      tides: TIDES,
    });
    expect(start.known).toBe(false);
  });

  it('has no head start to report where the clock never started', () => {
    const record = waded({ bed: 'C3-MSL', lot: '20250814-C3-001' });
    const start = clockStart({ record, bed: UNPREDICTED, tides: TIDES });
    expect(headStartSeconds(start, record)).toBeNull();
  });

  it('takes the harvest time where the bed came up at the very moment work began', () => {
    const start = clockStart({
      record: waded({ startedAt: at('2025-08-14 05:21') }),
      bed: FLAT,
      tides: TIDES,
    });
    expect(start.basis).toBe(FROM_HARVEST);
    expect(start.reason).toMatch(/no earlier than the harvest/);
  });
});

describe('describing the start', () => {
  it('says which basis it took and why', () => {
    const wading = clockStart({ record: waded(), bed: FLAT, tides: TIDES });
    expect(describeClockStart(wading)).toBe(
      'the clock runs from first tide exposure, because B12-BCK came out of the water before the harvest started',
    );
  });

  it('says plainly when it could not start at all', () => {
    const start = clockStart({
      record: waded({ bed: 'C3-MSL', lot: '20250814-C3-001' }),
      bed: UNPREDICTED,
      tides: TIDES,
    });
    expect(describeClockStart(start)).toMatch(/cannot be started/);
  });
});
