import { describe, expect, it } from 'vitest';

import { renderRound, roundReport, whyNow } from '../../src/report/round.js';
import { round } from '../../src/cli/commands/round.js';
import { loadCase } from '../../src/cli/context.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);

const report = (on, extra = {}) =>
  roundReport({
    areas: loaded.areas,
    stations: loaded.stations,
    samples: loaded.samples,
    on,
    ...extra,
  });

describe('whyNow', () => {
  it('gives one reason a station is on the list', () => {
    expect(whyNow({ state: 'never visited' })).toBe('never sampled');
    expect(whyNow({ state: 'due', overdueDays: 400 })).toBe('over a year behind');
    expect(whyNow({ state: 'due', overdueDays: 20, perYear: 6 })).toBe('6 a year, 20 days over');
  });
});

describe('the round over the worked example', () => {
  it('has nothing to do while the sampling is current', () => {
    const answer = report(civilDate(2025, 8, 31));
    expect(answer.due).toBe(0);
    expect(answer.rows).toEqual([]);
    expect(renderRound(answer)).toContain('The boat can go somewhere else');
  });

  it('works every station once the whole programme is behind', () => {
    const answer = report(civilDate(2025, 12, 31));
    expect(answer.due).toBe(8);
    expect(answer.rows).toHaveLength(8);
    expect(answer.trip.waiting).toBe(0);
  });

  it('puts the conditional areas first, because they are sampled twice as often', () => {
    const answer = report(civilDate(2025, 12, 31));
    expect(answer.rows.slice(0, 3).map((one) => one.area)).toEqual(['B-12', 'B-12', 'B-12']);
    expect(answer.rows[0].class).toBe('CA');
  });

  it('spreads a small boat across areas rather than emptying one', () => {
    const answer = report(civilDate(2026, 6, 1), { capacity: 3 });
    expect(answer.rows).toHaveLength(3);
    expect(new Set(answer.rows.map((one) => one.area)).size).toBe(3);
    expect(answer.trip.waiting).toBe(5);
  });

  it('reports what it left behind once a station is a year past due', () => {
    const answer = report(civilDate(2027, 1, 1), { capacity: 2 });
    expect(answer.problems.codes()).toEqual(['rotation.abandoned']);
    expect(renderRound(answer)).toContain('Left behind');
  });
});

describe('the rendered round', () => {
  const text = renderRound(report(civilDate(2025, 12, 31)));

  it('names the day and counts the work', () => {
    expect(text).toContain('Sampling round for 2025-12-31');
    expect(text).toContain('Due today:              8');
    expect(text).toContain('Share of what is due:   100.0%');
  });

  it('numbers the stations in the order the boat works them', () => {
    expect(text).toMatch(/ {2}1 {2}B12-01/);
    expect(text).toContain('Why now');
  });

  it('is the same text twice', () => {
    expect(renderRound(report(civilDate(2025, 12, 31)))).toBe(text);
  });
});

describe('the round command', () => {
  it('prints the round', () => {
    const io = recorder();
    expect(round(base({ on: '2025-12-31' }), io)).toBe(OK);
    expect(io.out).toContain('The round');
  });

  it('takes a smaller boat', () => {
    const io = recorder();
    round(base({ on: '2025-12-31', boat: '2', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.capacity).toBe(2);
    expect(answer.round).toHaveLength(2);
    expect(answer.waiting).toBe(6);
  });

  it.each(['0', 'half', '2.5'])('refuses a boat of %s', (boat) => {
    const io = recorder();
    expect(round(base({ on: '2025-12-31', boat }), io)).toBe(REFUSED);
    expect(io.err).toContain('whole number of stations');
  });
});
