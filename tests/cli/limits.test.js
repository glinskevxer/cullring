import { describe, expect, it } from 'vitest';

import { take } from '../../src/cli/commands/limits.js';
import { renderTake, takeReport } from '../../src/report/limits.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK } from '../../src/cli/output.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const day = civilDate(2025, 8, 14);

const report = (on = day, extra = {}) =>
  takeReport({
    records: loaded.records,
    harvesters: loaded.harvesters,
    limits: loaded.limits,
    day: on,
    ...extra,
  });

describe('the take report', () => {
  it('gives a row per licence, species and area', () => {
    const rows = report().rows;
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.every((one) => one.harvester.startsWith('SH-'))).toBe(true);
  });

  it('sorts by licence then species then area, so the sheet is stable', () => {
    const rows = report().rows;
    expect(rows).toEqual(
      rows.slice().sort((left, right) => (left.harvester < right.harvester ? -1 : 1)),
    );
  });

  it('names the limit that applied to each row', () => {
    const broad = report().rows.find((one) => one.area === 'B-12');
    const sound = report().rows.find((one) => one.area === 'C-3');
    expect(broad.limit).toBe('10');
    expect(sound.limit).toBe('20');
  });

  it('finds a licence over the area limit', () => {
    expect(report().problems.has('limit.overArea')).toBe(true);
  });

  it('finds a licence over the day limit that no single landing breached', () => {
    const answer = report();
    const overDay = answer.problems.list().find((one) => one.code === 'limit.overDay');
    expect(overDay.detail.harvester).toBe('SH-2025-04412');
    expect(overDay.detail.took).toBe(27);
  });

  it('counts the licences that landed and the rows that went over', () => {
    expect(report().licences).toBe(2);
    expect(report().over).toBe(2);
  });

  it('has nothing to say about a quiet day', () => {
    const quiet = report(civilDate(2025, 1, 1));
    expect(quiet.rows).toEqual([]);
    expect(quiet.problems.isClean()).toBe(true);
  });

  it('leaves a species with no limit alone', () => {
    const answer = report(day, { limits: [] });
    expect(answer.problems.isClean()).toBe(true);
    expect(answer.rows.every((one) => one.limit === '-')).toBe(true);
  });
});

describe('the rendered sheet', () => {
  const text = renderTake(report());

  it('names the day and the counts', () => {
    expect(text).toMatch(/Day:\s+2025-08-14/);
    expect(text).toMatch(/Licences that landed: 2/);
  });

  it('prints the findings underneath', () => {
    expect(text).toContain('bushels of oyster out of B-12 against 10');
    expect(text).toContain('in the day against 20');
  });

  it('says plainly when nothing was landed', () => {
    expect(renderTake(report(civilDate(2025, 1, 1)))).toContain('Nothing was landed on this day.');
  });

  it('is the same text twice', () => {
    expect(renderTake(report())).toBe(text);
  });
});

describe('the take command', () => {
  it('exits with a finding on a day somebody went over', () => {
    const io = recorder();
    expect(take(base({ on: '2025-08-14' }), io)).toBe(FOUND);
    expect(io.out).toContain('Take against the limits');
  });

  it('exits clean on a day nobody did', () => {
    const io = recorder();
    expect(take(base({ on: '2025-08-20' }), io)).toBe(OK);
  });

  it('prints the sheet as JSON when asked', () => {
    const io = recorder();
    take(base({ on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.licences).toBe(2);
    expect(answer.rows.length).toBeGreaterThan(2);
  });
});
