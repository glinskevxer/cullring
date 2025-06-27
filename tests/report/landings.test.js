import { describe, expect, it } from 'vitest';

import {
  describeCodes,
  landingsReport,
  landingsSummary,
  lotsWith,
  renderLandings,
} from '../../src/report/landings.js';
import { BEDS, CLEAN_LOT, CONTEXT, DAY, UNDER_CONTROL } from '../support/day.js';
import { civilDate } from '../../src/time/civil.js';

const report = landingsReport({
  records: DAY,
  beds: BEDS,
  context: CONTEXT,
  underControl: UNDER_CONTROL,
});

describe('the rows', () => {
  it('gives one line per lot, in lot order', () => {
    expect(report.rows.map((row) => row.lot)).toEqual([
      '20250814-B12-001',
      '20250814-B12-002',
      '20250814-D2-001',
    ]);
  });

  it('names the class the water was in force as, not the paper class', () => {
    expect(report.rows[0].water).toBe('APP');
    expect(report.rows[2].water).toBe('RES');
  });

  it('names which clock each lot ran on', () => {
    expect(report.rows[0].clock).toBe('first tide exposure');
    expect(report.rows[1].clock).toBe('harvest');
  });

  it('gives the wading lot a longer elapsed time than the boat lot on the same morning', () => {
    expect(Number(report.rows[0].elapsed)).toBeGreaterThan(Number(report.rows[1].elapsed));
  });

  it('reads a different limit in a cool region than in a warm one', () => {
    expect(report.rows[0].limit).toBe('10 hours');
    expect(report.rows[2].limit).toBe('12 hours');
  });

  it('counts the lawful and the unlawful', () => {
    expect(report.lawful).toBe(2);
    expect(report.unlawful).toBe(1);
  });

  it('carries the whole answer on each row', () => {
    expect(report.rows[2].answer.problems.has('harvest.dealerCannotTreat')).toBe(true);
  });
});

describe('the rendered report', () => {
  const text = renderLandings(report, { on: civilDate(2025, 8, 14) });

  it('opens with the day and the counts', () => {
    expect(text).toMatch(/Day:\s+2025-08-14/);
    expect(text).toMatch(/Lawful:\s+2/);
    expect(text).toMatch(/With findings: 1/);
  });

  it('holds one line per lot', () => {
    for (const row of report.rows) {
      expect(text).toContain(row.lot);
    }
  });

  it('prints the findings in full underneath, not one line each', () => {
    expect(text).toContain('Findings');
    expect(text).toContain('needs relay or depuration and SS-042 cannot do it');
    expect(text).toContain('took 13.5 hours against a limit of 12');
  });

  it('says which clock the lot with findings ran on', () => {
    expect(text).toMatch(/the clock runs from harvest, because/);
  });

  it('leaves the findings section off a clean day', () => {
    const clean = landingsReport({
      records: [CLEAN_LOT],
      beds: BEDS,
      context: CONTEXT,
      underControl: UNDER_CONTROL,
    });
    expect(renderLandings(clean)).not.toContain('Findings');
  });

  it('prints a dash for a day nobody supplied', () => {
    expect(renderLandings(report)).toMatch(/Day:\s+-/);
  });

  it('leaves no trailing space and is the same text twice', () => {
    for (const line of text.split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
    expect(renderLandings(report, { on: civilDate(2025, 8, 14) })).toBe(text);
  });
});

describe('the summary', () => {
  it('counts the lots and tallies the codes', () => {
    expect(landingsSummary(report)).toEqual({
      lots: 3,
      lawful: 2,
      unlawful: 1,
      containers: 3,
      codes: { 'harvest.dealerCannotTreat': 1, 'vibrio.overTime': 1 },
    });
  });

  it('sorts the codes so the shape is stable', () => {
    expect(Object.keys(landingsSummary(report).codes)).toEqual([
      'harvest.dealerCannotTreat',
      'vibrio.overTime',
    ]);
  });

  it('names the lots that broke a particular rule', () => {
    expect(lotsWith(report, 'vibrio.overTime')).toEqual(['20250814-D2-001']);
    expect(lotsWith(report, 'harvest.closedWater')).toEqual([]);
  });

  it('reads the codes out as words', () => {
    expect(describeCodes(report)).toBe('harvest.dealerCannotTreat and vibrio.overTime');
  });

  it('has nothing to say about a clean day', () => {
    const clean = landingsReport({
      records: [CLEAN_LOT],
      beds: BEDS,
      context: CONTEXT,
      underControl: UNDER_CONTROL,
    });
    expect(landingsSummary(clean).codes).toEqual({});
    expect(describeCodes(clean)).toBe('');
  });
});

describe('a lot with no temperature record at all', () => {
  it('is reported rather than passed', () => {
    const missing = landingsReport({ records: [CLEAN_LOT], beds: BEDS, context: CONTEXT });
    expect(missing.unlawful).toBe(1);
    expect(lotsWith(missing, 'vibrio.noControl')).toEqual(['20250814-B12-002']);
  });
});
