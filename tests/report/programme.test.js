import { describe, expect, it } from 'vitest';

import { nextThingDue, programmeReport, renderProgramme } from '../../src/report/programme.js';
import { loadCase } from '../../src/cli/context.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';
import { CASE } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 9, 30);

const report = (extra = {}) =>
  programmeReport({
    areas: loaded.areas,
    stations: loaded.stations,
    samples: loaded.samples,
    on,
    ...extra,
  });

describe('what the report holds', () => {
  it('tracks two reviews for an unconditional area and three for a conditional one', () => {
    const answer = report();
    const b12 = answer.reviews.filter((one) => one.area === 'B-12');
    const c3 = answer.reviews.filter((one) => one.area === 'C-3');
    expect(b12).toHaveLength(3);
    expect(c3).toHaveLength(2);
  });

  it('tracks every station in service', () => {
    expect(report().schedule).toHaveLength(loaded.stations.length);
  });

  it('counts the boat visits the current classification costs', () => {
    expect(report().boatVisits).toBeGreaterThan(0);
  });

  it('costs more boat time when an area is conditional than when it is not', () => {
    const answer = report();
    const conditional = answer.schedule.filter((one) => one.station.startsWith('B12'));
    const plain = answer.schedule.filter((one) => one.station.startsWith('C3'));
    expect(Number(conditional[0].perYear)).toBeGreaterThan(Number(plain[0].perYear));
  });

  it('takes the review dates from the caller when given', () => {
    const recent = report({
      history: {
        'B-12': { lastReview: civilDate(2025, 9, 1), lastSurvey: civilDate(2025, 9, 1) },
      },
    });
    const b12 = recent.reviews.filter((one) => one.area === 'B-12');
    expect(b12.every((one) => one.state === 'current')).toBe(true);
  });

  it('falls back to the last reclassification where nobody supplied a date', () => {
    const answer = report();
    const b12 = answer.reviews.find((one) => one.area === 'B-12');
    expect(b12.last).toBe('2022-01-01');
    expect(b12.state).toBe('late');
  });

  it('skips an area the register does not reach on that day', () => {
    const early = programmeReport({
      areas: loaded.areas,
      stations: loaded.stations,
      samples: loaded.samples,
      on: civilDate(2010, 1, 1),
    });
    expect(early.reviews.every((one) => one.area === 'D-9')).toBe(true);
  });
});

describe('the findings', () => {
  it('raises an error for a review that is long past due', () => {
    expect(report().problems.has('review.late')).toBe(true);
  });

  it('warns about a station that has gone past its interval', () => {
    const later = programmeReport({
      areas: loaded.areas,
      stations: loaded.stations,
      samples: loaded.samples,
      on: civilDate(2025, 12, 1),
    });
    expect(later.problems.has('schedule.due')).toBe(true);
  });

  it('says nothing about the same stations while they are inside it', () => {
    const answer = report();
    expect(answer.problems.has('schedule.due')).toBe(false);
    expect(answer.schedule.some((one) => one.state === 'current')).toBe(true);
  });

  it('raises an error for a station that has never been visited', () => {
    const answer = programmeReport({
      areas: loaded.areas,
      stations: loaded.stations,
      samples: [],
      on,
    });
    expect(answer.problems.has('schedule.neverVisited')).toBe(true);
  });

  it('says nothing about a prohibited area, since it is off the round', () => {
    const answer = report();
    const d9 = answer.schedule.filter((one) => one.station.startsWith('D9'));
    for (const row of d9) {
      expect(row.state).toBe('not sampled');
    }
  });
});

describe('the rendered report', () => {
  const text = renderProgramme(report());

  it('opens with the counts', () => {
    expect(text).toContain('Programme standing');
    expect(text).toMatch(/Reviews tracked:\s+\d+/);
    expect(text).toMatch(/Visits a year at this classification:\s+\d+/);
  });

  it('holds a reviews table and a stations table', () => {
    expect(text).toContain('Reviews');
    expect(text).toContain('Stations');
    expect(text).toContain('B12-01');
  });

  it('prints the findings underneath', () => {
    expect(text).toContain('Findings');
  });

  it('leaves no trailing space and is the same text twice', () => {
    for (const line of text.split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
    expect(renderProgramme(report())).toBe(text);
  });
});

describe('the next thing due anywhere', () => {
  it('names an area and a kind with the earliest due date', () => {
    const next = nextThingDue(loaded.areas, on);
    expect(next.area).toBeTruthy();
    expect(formatCivilDate(next.due)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('answers with nothing where no area is classified yet', () => {
    expect(nextThingDue(loaded.areas, civilDate(1990, 1, 1))).toBeNull();
  });

  it('moves when a review date is supplied', () => {
    const before = nextThingDue(loaded.areas, on);
    const after = nextThingDue(loaded.areas, on, {
      [before.area]: { lastReview: civilDate(2025, 9, 1), lastSurvey: civilDate(2025, 9, 1) },
    });
    expect(formatCivilDate(after.due)).not.toBe(formatCivilDate(before.due));
  });
});
