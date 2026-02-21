import { describe, expect, it } from 'vitest';

import { canWriteSheet, headingsOf, renderSheet, sheetFor } from '../../src/report/sheet.js';
import { COLUMNS as TAKE_COLUMNS, takeReport } from '../../src/report/limits.js';
import { landingsReport } from '../../src/report/landings.js';
import { standingReport } from '../../src/report/standing.js';
import { inspectionRound } from '../../src/report/inspection.js';
import { parseCsv } from '../../src/io/csv.js';
import { loadCase } from '../../src/cli/context.js';
import { contextOf } from '../../src/cli/context.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE } from '../support/cli.js';

const loaded = loadCase(CASE);
const day = civilDate(2025, 8, 14);
const take = takeReport({
  records: loaded.records,
  harvesters: loaded.harvesters,
  limits: loaded.limits,
  day,
});

describe('rendering rows as a sheet', () => {
  it('writes the headings the columns name', () => {
    expect(renderSheet(TAKE_COLUMNS, []).trim()).toBe(headingsOf(TAKE_COLUMNS).join(','));
  });

  it('writes a row per record, in the column order', () => {
    const text = renderSheet(TAKE_COLUMNS, take.rows);
    expect(text.split('\n')).toHaveLength(take.rows.length + 2);
  });

  it('writes a missing cell as blank rather than as undefined', () => {
    const text = renderSheet(TAKE_COLUMNS, [{ harvester: 'SH-2025-04412' }]);
    expect(text).not.toContain('undefined');
    expect(text.split('\n')[1]).toBe('SH-2025-04412,,,,,,');
  });

  it('reads straight back through the sheet reader', () => {
    const read = parseCsv(renderSheet(TAKE_COLUMNS, take.rows));
    expect(read.problems.hasError()).toBe(false);
    expect(read.rows).toHaveLength(take.rows.length);
  });

  it('refuses a sheet with no columns', () => {
    expect(() => renderSheet([], take.rows)).toThrow(/at least one column/);
  });
});

describe('a report that carries its own columns', () => {
  it('writes the take sheet', () => {
    expect(sheetFor(take).split('\n')[0]).toBe('Licence,Name,Species,Area,Took,Limit,Ok');
  });

  it('writes the landings sheet', () => {
    const report = landingsReport({
      records: loaded.records,
      beds: loaded.beds,
      context: contextOf(loaded),
      underControl: loaded.underControl,
    });
    expect(canWriteSheet(report)).toBe(true);
    expect(sheetFor(report).split('\n')[0]).toBe('Lot,Bed,Water,Gear,Clock,Elapsed,Limit,Ok');
  });

  it('writes the inspection round', () => {
    const report = inspectionRound({
      dealers: loaded.dealers,
      inspections: loaded.inspections,
      on: civilDate(2025, 9, 30),
    });
    expect(sheetFor(report).split('\n')[0]).toContain('Dealer');
  });

  it('writes the standing chart', () => {
    const report = standingReport({
      areas: loaded.areas,
      plans: loaded.plans,
      feed: loaded.feed,
      orders: loaded.orders,
      at: { epochSecond: 1757062800 },
      from: { epochSecond: 1756699200 },
    });
    expect(sheetFor(report).split('\n')[0]).toContain('Area');
  });

  it('shows the same columns as the printed report, because they are the same list', () => {
    expect(take.columns).toBe(TAKE_COLUMNS);
  });

  it('refuses a report with no rows or no columns', () => {
    expect(() => sheetFor(null)).toThrow(/no rows to write/);
    expect(() => sheetFor({ rows: [] })).toThrow(/does not carry its columns/);
    expect(canWriteSheet({ rows: [] })).toBe(false);
  });
});
