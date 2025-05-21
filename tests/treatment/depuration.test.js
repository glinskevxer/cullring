import { describe, expect, it } from 'vitest';

import {
  CYCLE_HOURS,
  checkDepuration,
  depurationBatch,
  longestRunHours,
  runningWindows,
} from '../../src/treatment/depuration.js';
import { DEALERS } from '../support/people.js';
import { parseMpn } from '../../src/survey/result.js';
import { parseInstant } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });
const outage = (from, to) => window(at(from), at(to));
const clean = ['<1.8', '2', '4.5'].map((text) => parseMpn(text));
const dirty = ['49', '79', '110'].map((text) => parseMpn(text));

const batch = depurationBatch({
  id: 'DEP-2025-0042',
  processor: 'DP-003',
  lots: ['20250814-D2-001', '20250814-D2-002'],
  species: 'oyster',
  sourceClassification: 'restricted',
  tank: 3,
});

const run = (extra = {}) =>
  checkDepuration({
    batch,
    startedAt: at('2025-08-14 12:00'),
    endedAt: at('2025-08-16 09:00'),
    releaseSamples: clean,
    dealers: DEALERS,
    ...extra,
  });

describe('the running windows of a cycle', () => {
  it('is the whole cycle where nothing stopped', () => {
    const windows = runningWindows({
      startedAt: at('2025-08-14 12:00'),
      endedAt: at('2025-08-16 09:00'),
    });
    expect(windows).toHaveLength(1);
    expect(longestRunHours(windows)).toBe(45);
  });

  it('splits the cycle around an outage', () => {
    const windows = runningWindows({
      startedAt: at('2025-08-14 12:00'),
      endedAt: at('2025-08-16 09:00'),
      outages: [outage('2025-08-15 02:00', '2025-08-15 04:00')],
    });
    expect(windows).toHaveLength(2);
    expect(longestRunHours(windows)).toBe(29);
  });

  it('takes the longest run and not the total, which is the whole point', () => {
    const windows = runningWindows({
      startedAt: at('2025-08-14 12:00'),
      endedAt: at('2025-08-16 12:00'),
      outages: [outage('2025-08-15 12:00', '2025-08-15 13:00')],
    });
    const total = windows.reduce(
      (sum, one) => sum + (one.end.epochSecond - one.start.epochSecond) / 3600,
      0,
    );
    expect(total).toBe(47);
    expect(longestRunHours(windows)).toBe(24);
  });

  it('merges overlapping outages rather than counting them twice', () => {
    const windows = runningWindows({
      startedAt: at('2025-08-14 12:00'),
      endedAt: at('2025-08-16 12:00'),
      outages: [
        outage('2025-08-15 02:00', '2025-08-15 06:00'),
        outage('2025-08-15 04:00', '2025-08-15 08:00'),
      ],
    });
    expect(windows).toHaveLength(2);
    expect(longestRunHours(windows)).toBe(28);
  });

  it('handles an outage running to the very end', () => {
    const windows = runningWindows({
      startedAt: at('2025-08-14 12:00'),
      endedAt: at('2025-08-16 12:00'),
      outages: [outage('2025-08-16 06:00', '2025-08-16 12:00')],
    });
    expect(windows).toHaveLength(1);
    expect(longestRunHours(windows)).toBe(42);
  });
});

describe('a cycle that releases', () => {
  it('passes a clean unbroken run', () => {
    const answer = run();
    expect(answer.released).toBe(true);
    expect(answer.longestRunHours).toBe(45);
    expect(answer.release.met).toBe(true);
  });

  it('releases exactly at forty four hours', () => {
    expect(run({ endedAt: at('2025-08-16 08:00') }).released).toBe(true);
    expect(run({ endedAt: at('2025-08-16 07:00') }).released).toBe(false);
    expect(CYCLE_HOURS).toBe(44);
  });
});

describe('a cycle that does not', () => {
  it('refuses a run broken in the middle, even where the total is long enough', () => {
    const answer = run({ outages: [outage('2025-08-15 02:00', '2025-08-15 03:00')] });
    expect(answer.problems.has('depuration.short')).toBe(true);
  });

  it('refuses a cycle that ended before it started', () => {
    const answer = run({ startedAt: at('2025-08-16 09:00'), endedAt: at('2025-08-14 12:00') });
    expect(answer.problems.has('depuration.order')).toBe(true);
  });

  it('refuses times that are not instants', () => {
    expect(run({ endedAt: '2025-08-16 09:00' }).problems.has('depuration.time')).toBe(true);
  });
});

describe('who may run a cycle', () => {
  it('refuses a processor that is not in the register', () => {
    const answer = run({ batch: { ...batch, processor: 'DP-999' } });
    expect(answer.problems.has('depuration.unknownProcessor')).toBe(true);
  });

  it('refuses a dealer whose certification does not allow depuration', () => {
    const answer = run({ batch: { ...batch, processor: 'SP-118' } });
    expect(answer.problems.has('depuration.notCertified')).toBe(true);
  });
});

describe('what may go in one tank', () => {
  it('refuses a batch holding lots from two areas', () => {
    const answer = run({
      batch: { ...batch, lots: ['20250814-D2-001', '20250814-B12-001'] },
    });
    expect(answer.problems.has('depuration.mixedAreas')).toBe(true);
  });

  it('refuses an empty batch', () => {
    expect(run({ batch: { ...batch, lots: [] } }).problems.has('depuration.empty')).toBe(true);
  });

  it('allows several lots out of one area', () => {
    expect(run().problems.has('depuration.mixedAreas')).toBe(false);
  });
});

describe('the release sample', () => {
  it('is scored against the approved standard, which is the claim being made', () => {
    const answer = run();
    expect(answer.release.limit).toBe(14);
  });

  it('refuses a batch that comes out over the approved limit', () => {
    const answer = run({ releaseSamples: dirty });
    expect(answer.problems.has('depuration.releaseOverLimit')).toBe(true);
    expect(answer.released).toBe(false);
  });

  it('refuses a batch with no release sample at all', () => {
    const answer = run({ releaseSamples: [] });
    expect(answer.problems.has('depuration.noRelease')).toBe(true);
    expect(answer.release).toBeNull();
  });
});
