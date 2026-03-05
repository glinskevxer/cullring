import { describe, expect, it } from 'vitest';

import {
  AT_YEAR_END,
  annualReport,
  endOfMonth,
  isInYear,
  renderAnnual,
  yearSpan,
} from '../../src/report/annual.js';
import { annual } from '../../src/cli/commands/annual.js';
import { loadCase } from '../../src/cli/context.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';
import { toStoredForm } from '../../src/time/instant.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);

const report = (year = 2025) =>
  annualReport({
    year,
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    orders: loaded.orders,
    records: loaded.records,
  });

describe('the year span', () => {
  it('runs midnight to midnight across the year', () => {
    const span = yearSpan(2025);
    expect(toStoredForm('eastern', span.start)).toBe('2025-01-01T00:00:00-05:00');
    expect(toStoredForm('eastern', span.end)).toBe('2026-01-01T00:00:00-05:00');
  });

  it('says which day is the end of a month, leap year and all', () => {
    expect(formatCivilDate(endOfMonth(2024, 2))).toBe('2024-02-29');
    expect(formatCivilDate(endOfMonth(2025, 2))).toBe('2025-02-28');
  });

  it('reads whether a day is in a year', () => {
    expect(isInYear(civilDate(2025, 6, 1), 2025)).toBe(true);
    expect(isInYear(civilDate(2026, 1, 1), 2025)).toBe(false);
  });
});

describe('the counts', () => {
  it('counts every classified area once', () => {
    const answer = report();
    const total = Array.from(answer.byClass.values()).reduce((sum, one) => sum + one.areas, 0);
    expect(total).toBe(answer.classified);
  });

  it('counts every classified acre once', () => {
    const answer = report();
    const total = Array.from(answer.byClass.values()).reduce((sum, one) => sum + one.acres, 0);
    expect(total).toBe(answer.acres);
  });

  it('says which convention it counted by', () => {
    expect(report().convention).toBe(AT_YEAR_END);
  });

  it('counts the closures and the hours they ran for', () => {
    const answer = report();
    expect(answer.closures.length).toBeGreaterThan(0);
    expect(answer.closureHours).toBeGreaterThan(0);
  });

  it('counts the landings and the bushels in the year', () => {
    expect(report().landings).toBe(loaded.records.length);
    expect(report().containers).toBeGreaterThan(90);
  });

  it('counts nothing at all in a year the registers do not reach', () => {
    const early = report(2000);
    expect(early.classified).toBe(0);
    expect(early.landings).toBe(0);
  });
});

describe('the rendered report', () => {
  const text = renderAnnual(report());

  it('names the year and the convention', () => {
    expect(text).toContain('Annual report for 2025');
    expect(text).toContain(AT_YEAR_END);
  });

  it('gives a row per classification and a share of the acres', () => {
    expect(text).toContain('conditionally approved');
    expect(text).toMatch(/\d+\.\d%/);
  });

  it('says the acres add up, which is the first question at the conference', () => {
    expect(text).toMatch(/The acres add to \d+, which is every classified acre counted once\./);
  });

  it('is the same text twice', () => {
    expect(renderAnnual(report())).toBe(text);
  });
});

describe('the annual command', () => {
  it('prints the report', () => {
    const io = recorder();
    expect(annual(base({ year: '2025' }), io)).toBe(OK);
    expect(io.out).toContain('Acres by classification');
  });

  it('prints the counts as JSON when asked', () => {
    const io = recorder();
    annual(base({ year: '2025', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.year).toBe(2025);
    expect(answer.acres).toBeGreaterThan(1000);
  });

  it('refuses something that is not a year', () => {
    const io = recorder();
    expect(annual(base({ year: 'last' }), io)).toBe(REFUSED);
    expect(annual(base({ year: '1066' }), io)).toBe(REFUSED);
  });
});
