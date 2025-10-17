import { describe, expect, it } from 'vitest';

import { renderStanding, standingRows, standingSummary } from '../../src/report/standing.js';
import { AREAS, JUNE_FIRST, PLANS, STORM, at } from '../support/register.js';

const during = {
  areas: AREAS,
  plans: PLANS,
  feed: STORM,
  at: at('2025-06-11 09:00'),
  from: JUNE_FIRST,
};
const after = { ...during, at: at('2025-06-14 09:00') };

describe('the rows', () => {
  it('gives one line per area, in register order', () => {
    expect(standingRows(during).map((row) => row.area)).toEqual([
      'B-12',
      'B-14',
      'C-3',
      'D-2',
      'D-9',
    ]);
  });

  it('prints the paper class and the class in force in separate columns', () => {
    const row = standingRows(during).find((one) => one.area === 'B-12');
    expect(row.paper).toBe('CA');
    expect(row.effective).toBe('PRO');
  });

  it('shows them the same where no plan is involved', () => {
    const row = standingRows(during).find((one) => one.area === 'C-3');
    expect(row.paper).toBe(row.effective);
  });

  it('names what shut the area, with the number the notice has to carry', () => {
    const row = standingRows(during).find((one) => one.area === 'B-12');
    expect(row.cause).toBe('1.20 against 1 inches');
  });

  it('names what will lift it, in the unit the plan is written in', () => {
    const row = standingRows(during).find((one) => one.area === 'B-12');
    expect(row.lifts).toBe('after 72 hours');
  });

  it('leaves both columns empty for an area that is not shut', () => {
    const row = standingRows(during).find((one) => one.area === 'C-3');
    expect(row.cause).toBe('-');
    expect(row.lifts).toBe('-');
  });

  it('carries the whole standing so a caller need not ask twice', () => {
    const row = standingRows(during).find((one) => one.area === 'B-12');
    expect(row.standing.closure.firedBy.gauge).toBe('BRD');
  });

  it('reads the same areas differently once the closure has lifted', () => {
    const row = standingRows(after).find((one) => one.area === 'B-12');
    expect(row.shut).toBe('no');
    expect(row.effective).toBe('APP');
  });
});

describe('the rendered chart', () => {
  const text = renderStanding(during);

  it('opens with a heading and the moment it is as at', () => {
    expect(text.split('\n')[0]).toBe('Growing area standing');
    expect(text).toMatch(/As at:\s+2025-06-11 09:00 EDT/);
  });

  it('counts the areas and the ones under a closure', () => {
    expect(text).toMatch(/Areas:\s+5/);
    expect(text).toMatch(/Shut by a plan or an order: 1/);
  });

  it('holds one line per area', () => {
    for (const id of ['B-12', 'B-14', 'C-3', 'D-2', 'D-9']) {
      expect(text).toContain(id);
    }
  });

  it('prints the register findings underneath', () => {
    expect(text).toContain('Register findings');
    expect(text).toContain('area.planClosed');
  });

  it('leaves the findings section off where there is nothing to say', () => {
    expect(renderStanding(after)).not.toContain('Register findings');
  });

  it('leaves no trailing space on any line', () => {
    for (const line of text.split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
  });

  it('is the same text twice, which is the cheapest test that it is deterministic', () => {
    expect(renderStanding(during)).toBe(text);
  });
});

describe('the summary', () => {
  it('counts the areas, the closures and the findings', () => {
    expect(standingSummary(during)).toEqual({
      areas: 5,
      closed: 1,
      byClass: { APP: 1, PRO: 2, RES: 2 },
      findings: 1,
    });
  });

  it('moves a closed area out of prohibited once the closure lifts', () => {
    const summary = standingSummary(after);
    expect(summary.closed).toBe(0);
    expect(summary.byClass.APP).toBe(2);
  });

  it('sorts the classes so the shape is stable', () => {
    expect(Object.keys(standingSummary(during).byClass)).toEqual(['APP', 'PRO', 'RES']);
  });
});
