import { describe, expect, it } from 'vitest';

import {
  REINSTATEMENT_SURVEY,
  annualVisits,
  describeSchedule,
  intervalDays,
  lastVisit,
  nextDue,
  samplesPerYear,
  scheduleFor,
} from '../../src/survey/schedule.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import { station } from '../../src/area/station.js';
import { sample } from '../../src/survey/result.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';
import { B12 } from '../support/register.js';

const on = civilDate(2025, 9, 30);

const STATIONS = ['B12-01', 'B12-02', 'B12-03', 'B12-04'].map((id) =>
  station({ id, latitude: 34.7, longitude: -76.7, openedOn: '2018-01-01' }),
);

const SAMPLES = [
  sample({ station: 'B12-01', collectedOn: '2025-09-20', result: 2 }),
  sample({ station: 'B12-01', collectedOn: '2025-08-20', result: 2 }),
  sample({ station: 'B12-02', collectedOn: '2025-01-20', result: 2 }),
  sample({ station: 'B12-04', collectedOn: '2025-08-20', result: 2 }),
];

describe('how often each class is sampled', () => {
  it('samples a conditional area twice as often as its unconditional twin', () => {
    expect(samplesPerYear(CONDITIONALLY_APPROVED)).toBe(2 * samplesPerYear(APPROVED));
    expect(samplesPerYear(CONDITIONALLY_RESTRICTED)).toBe(2 * samplesPerYear(RESTRICTED));
  });

  it('does not sample a prohibited area at all', () => {
    expect(samplesPerYear(PROHIBITED)).toBe(0);
    expect(intervalDays(PROHIBITED)).toBeNull();
  });

  it('turns the rate into a gap between visits', () => {
    expect(intervalDays(APPROVED)).toBe(61);
    expect(intervalDays(CONDITIONALLY_APPROVED)).toBe(30);
  });

  it('refuses a class it does not know', () => {
    expect(() => samplesPerYear('open')).toThrow(/not a classification/);
  });

  it('costs twice the boat time on a conditional area of the same size', () => {
    expect(annualVisits(CONDITIONALLY_APPROVED, 3)).toBe(36);
    expect(annualVisits(APPROVED, 3)).toBe(18);
    expect(annualVisits(PROHIBITED, 3)).toBe(0);
  });
});

describe('when a station is next due', () => {
  it('is the last visit plus the gap', () => {
    const next = nextDue(APPROVED, civilDate(2025, 8, 1));
    expect(formatCivilDate(next.due)).toBe('2025-10-01');
  });

  it('has no answer for a prohibited area, and names why', () => {
    const next = nextDue(PROHIBITED, civilDate(2025, 8, 1));
    expect(next.due).toBeNull();
    expect(next.reason).toBe(REINSTATEMENT_SURVEY);
  });

  it('has no answer for a station never visited, and names that differently', () => {
    const next = nextDue(APPROVED, null);
    expect(next.due).toBeNull();
    expect(next.reason).toBe('never visited');
  });
});

describe('the last visit to a station', () => {
  it('is the most recent one', () => {
    expect(formatCivilDate(lastVisit(SAMPLES, 'B12-01'))).toBe('2025-09-20');
  });

  it('is nothing for a station with no samples', () => {
    expect(lastVisit(SAMPLES, 'B12-03')).toBeNull();
  });
});

describe('the schedule for an area', () => {
  const schedule = (classificationName) =>
    scheduleFor({
      area: B12,
      classificationName,
      stations: STATIONS,
      samples: SAMPLES,
      on,
    });

  it('gives a row per station', () => {
    expect(schedule(APPROVED).map((one) => one.station)).toEqual([
      'B12-01',
      'B12-02',
      'B12-03',
      'B12-04',
    ]);
  });

  it('calls a recently visited station current', () => {
    const row = schedule(APPROVED).find((one) => one.station === 'B12-01');
    expect(row.state).toBe('current');
    expect(row.overdueDays).toBe(0);
  });

  it('calls a long unvisited station due, with the days', () => {
    const row = schedule(APPROVED).find((one) => one.station === 'B12-02');
    expect(row.state).toBe('due');
    expect(row.overdueDays).toBeGreaterThan(150);
  });

  it('calls a station with no samples never visited rather than overdue', () => {
    const row = schedule(APPROVED).find((one) => one.station === 'B12-03');
    expect(row.state).toBe('never visited');
    expect(row.overdueDays).toBe(0);
  });

  it('turns a current station due when the class tightens the interval', () => {
    const loose = schedule(APPROVED).find((one) => one.station === 'B12-04');
    const tight = schedule(CONDITIONALLY_APPROVED).find((one) => one.station === 'B12-04');
    expect(loose.state).toBe('current');
    expect(tight.state).toBe('due');
    expect(tight.overdueDays).toBe(11);
  });

  it('leaves a station visited last week current under either class', () => {
    for (const name of [APPROVED, CONDITIONALLY_APPROVED]) {
      expect(schedule(name).find((one) => one.station === 'B12-01').state).toBe('current');
    }
  });

  it('takes every station off the round in a prohibited area', () => {
    for (const row of schedule(PROHIBITED)) {
      expect(row.state).toBe('not sampled');
      expect(row.due).toBeNull();
      expect(row.reason).toBe(REINSTATEMENT_SURVEY);
    }
  });

  it('carries the rate and the interval on every row', () => {
    const row = schedule(CONDITIONALLY_APPROVED)[0];
    expect(row.perYear).toBe(12);
    expect(row.intervalDays).toBe(30);
  });

  it('refuses a schedule with no classification', () => {
    expect(() => scheduleFor({ area: B12, stations: STATIONS, samples: SAMPLES, on })).toThrow(
      /needs a classification/,
    );
  });
});

describe('describing a row', () => {
  it('says something different for each of the four states', () => {
    const rows = scheduleFor({
      area: B12,
      classificationName: APPROVED,
      stations: STATIONS,
      samples: SAMPLES,
      on,
    });
    expect(describeSchedule(rows[0])).toMatch(/next due/);
    expect(describeSchedule(rows[1])).toMatch(/days past due/);
    expect(describeSchedule(rows[2])).toMatch(/never been visited/);
    const off = scheduleFor({
      area: B12,
      classificationName: PROHIBITED,
      stations: STATIONS,
      samples: SAMPLES,
      on,
    });
    expect(describeSchedule(off[0])).toMatch(/reinstatement survey/);
  });
});
