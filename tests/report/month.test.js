import { describe, expect, it } from 'vitest';

import { monthReport, monthSpan, renderMonth } from '../../src/report/month.js';
import { BEDS, CONTEXT, DAY, UNDER_CONTROL } from '../support/day.js';
import { AREAS, PLANS, STORM } from '../support/register.js';
import { toStoredForm } from '../../src/time/instant.js';

const august = () =>
  monthReport({
    year: 2025,
    month: 8,
    areas: AREAS,
    plans: PLANS,
    feed: STORM,
    records: DAY,
    beds: BEDS,
    context: CONTEXT,
    underControl: UNDER_CONTROL,
  });

const june = () =>
  monthReport({
    year: 2025,
    month: 6,
    areas: AREAS,
    plans: PLANS,
    feed: STORM,
    records: [],
    beds: BEDS,
    context: CONTEXT,
  });

describe('the month span', () => {
  it('runs from the first midnight to the first midnight of the next month', () => {
    const span = monthSpan(2025, 8);
    expect(toStoredForm('eastern', span.start)).toBe('2025-08-01T00:00:00-04:00');
    expect(toStoredForm('eastern', span.end)).toBe('2025-09-01T00:00:00-04:00');
  });

  it('gets February right in a leap year and out of one', () => {
    expect(toStoredForm('eastern', monthSpan(2024, 2).end)).toBe('2024-03-01T00:00:00-05:00');
    expect(toStoredForm('eastern', monthSpan(2025, 2).end)).toBe('2025-03-01T00:00:00-05:00');
  });

  it('crosses the daylight boundary in March without losing an hour', () => {
    const span = monthSpan(2025, 3);
    expect(toStoredForm('eastern', span.start)).toBe('2025-03-01T00:00:00-05:00');
    expect(toStoredForm('eastern', span.end)).toBe('2025-04-01T00:00:00-04:00');
  });
});

describe('what the report holds', () => {
  it('takes only the landings inside the month', () => {
    expect(august().landingsSummary.lots).toBe(3);
    expect(june().landingsSummary.lots).toBe(0);
  });

  it('counts the closures the month held', () => {
    expect(august().closures).toHaveLength(0);
    expect(june().closures).toHaveLength(1);
  });

  it('counts the areas standing at the end of the month', () => {
    expect(august().standing.areas).toBe(5);
  });

  it('tallies the findings by code', () => {
    expect(august().landingsSummary.codes).toEqual({
      'harvest.dealerCannotTreat': 1,
      'vibrio.overTime': 1,
    });
  });
});

describe('the rendered report', () => {
  const text = renderMonth(august());

  it('names the month and the period it covers', () => {
    expect(text).toContain('Programme report for August 2025');
    expect(text).toMatch(/Period:\s+2025-08-01 to 2025-08-31/);
  });

  it('counts the lots three ways and shows that they add up', () => {
    expect(text).toMatch(/Lots landed:\s+3/);
    expect(text).toMatch(/Lots lawful:\s+2/);
    expect(text).toMatch(/Lots with findings:\s+1/);
    expect(text).toContain('Lawful and with findings sum to 3 of 3.');
  });

  it('says plainly when nothing was shut', () => {
    expect(text).toContain('No area was shut under a management plan this month.');
  });

  it('lists the closures when there were some', () => {
    const text2 = renderMonth(june());
    expect(text2).toContain('B-12');
    expect(text2).toMatch(/Closures:\s+1/);
    expect(text2).toContain('2025-06-10 02:00 EDT');
  });

  it('counts the hours each closure ran for', () => {
    expect(renderMonth(june())).toMatch(/72\.0/);
  });

  it('says plainly when nothing was found', () => {
    expect(renderMonth(june())).toContain('Nothing was found this month.');
  });

  it('lists the findings by code when there were some', () => {
    expect(text).toContain('harvest.dealerCannotTreat');
    expect(text).toContain('vibrio.overTime');
  });

  it('leaves no trailing space and is the same text twice', () => {
    for (const line of text.split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
    expect(renderMonth(august())).toBe(text);
  });
});
