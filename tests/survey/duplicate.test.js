import { describe, expect, it } from 'vitest';

import {
  CONTROL_FACTOR,
  MINIMUM_PAIRS,
  checkRun,
  controlLimit,
  describeRun,
  meanRange,
  pair,
  repeatability,
} from '../../src/survey/duplicate.js';
import { parseMpn } from '../../src/survey/result.js';

const split = (station, a, b) =>
  pair({ station, collectedOn: '2025-08-14', first: parseMpn(a), second: parseMpn(b) });

/** A tight run: every pair within a factor of about two. */
const TIGHT = [
  split('B12-01', '23', '33'),
  split('B12-02', '4.5', '7.8'),
  split('B12-03', '13', '9.2'),
  split('C3-01', '49', '79'),
  split('C3-02', '2', '2'),
];

describe('a split pair', () => {
  it('measures the difference of the logs, not of the counts', () => {
    const tenfold = split('B12-01', '10', '100');
    expect(tenfold.range).toBeCloseTo(1, 9);
  });

  it('is nothing where the two halves agree', () => {
    expect(split('B12-01', '23', '23').range).toBe(0);
  });

  it('is the same whichever half is written first', () => {
    expect(split('B12-01', '10', '100').range).toBeCloseTo(split('B12-01', '100', '10').range, 9);
  });

  it('reads a bound at its face value, the way the routine programme does', () => {
    expect(split('B12-01', '<1.8', '1.8').range).toBe(0);
  });

  it('refuses a pair with a half missing', () => {
    expect(() => pair({ station: 'B12-01', first: parseMpn('23') })).toThrow(/two results/);
  });
});

describe('the control limit', () => {
  it('is the control factor times the average range', () => {
    expect(controlLimit(TIGHT)).toBeCloseTo(CONTROL_FACTOR * meanRange(TIGHT), 9);
  });

  it('refuses to average nothing', () => {
    expect(() => meanRange([])).toThrow(/at least 1 entries/);
  });

  it('grows when the run gets looser', () => {
    const loose = [...TIGHT, split('D2-01', '2', '200')];
    expect(controlLimit(loose)).toBeGreaterThan(controlLimit(TIGHT));
  });
});

describe('checking a run', () => {
  it('passes a tight run', () => {
    const run = checkRun(TIGHT);
    expect(run.inControl).toBe(true);
    expect(run.outOfControl).toEqual([]);
  });

  it('finds the one pair that is out of line with the rest', () => {
    const run = checkRun([...TIGHT, split('D2-01', '2', '1600')]);
    expect(run.inControl).toBe(false);
    expect(run.outOfControl.map((one) => one.station)).toEqual(['D2-01']);
    expect(run.problems.has('duplicate.outOfControl')).toBe(true);
  });

  it('judges a pair against the run it is in, not against a fixed number', () => {
    const wide = [
      split('B12-01', '2', '20'),
      split('B12-02', '4', '40'),
      split('B12-03', '8', '80'),
      split('C3-01', '3', '30'),
      split('C3-02', '5', '50'),
    ];
    const same = split('D2-01', '2', '20');
    expect(checkRun([...wide, same]).inControl).toBe(true);
    expect(checkRun([...TIGHT, same]).inControl).toBe(false);
  });

  it('sets no limit at all from too few pairs, and says so', () => {
    const run = checkRun(TIGHT.slice(0, 3));
    expect(run.limit).toBeNull();
    expect(run.inControl).toBeNull();
    expect(run.problems.has('duplicate.thin')).toBe(true);
    expect(MINIMUM_PAIRS).toBe(5);
  });

  it('does not call a thin run a failure', () => {
    expect(checkRun(TIGHT.slice(0, 3)).problems.hasError()).toBe(false);
  });

  it('handles a run with nothing in it', () => {
    const run = checkRun([]);
    expect(run.mean).toBeNull();
    expect(run.problems.has('duplicate.thin')).toBe(true);
  });

  it('carries a label onto every finding', () => {
    const run = checkRun([...TIGHT, split('D2-01', '2', '1600')], { label: 'run 2025-08-14' });
    expect(run.problems.list()[0].detail.label).toBe('run 2025-08-14');
  });
});

describe('reporting on a run', () => {
  it('gives the repeatability as the mean range', () => {
    expect(repeatability(checkRun(TIGHT))).toBeCloseTo(meanRange(TIGHT), 9);
    expect(repeatability(checkRun([]))).toBeNull();
  });

  it('describes each of the three states differently', () => {
    expect(describeRun(checkRun(TIGHT))).toMatch(/all in control/);
    expect(describeRun(checkRun([...TIGHT, split('D2-01', '2', '1600')]))).toMatch(
      /1 out of control/,
    );
    expect(describeRun(checkRun(TIGHT.slice(0, 2)))).toMatch(/too few to set a limit/);
  });
});
