import { describe, expect, it } from 'vitest';

import {
  caveat,
  coverageReport,
  everyRegister,
  heldBy,
  renderCoverage,
} from '../../src/report/coverage.js';
import { loadCase } from '../../src/cli/context.js';
import { CASE } from '../support/cli.js';

const full = loadCase(CASE);
const second = loadCase('examples/white-oak');

describe('heldBy', () => {
  it('says which registers a full case carries', () => {
    const held = heldBy(full);
    expect(held.areas).toBe(true);
    expect(held.tides).toBe(true);
    expect(held.book).toBe(true);
  });

  it('reads an empty list as absent, not as present and empty', () => {
    expect(heldBy({ areas: [], feed: {} }).areas).toBe(false);
  });

  it('copes with a case that carries nothing at all', () => {
    expect(() => heldBy({})).not.toThrow();
    expect(heldBy({}).samples).toBe(false);
  });
});

describe('everyRegister', () => {
  it('names each register once', () => {
    const names = everyRegister();
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('tides');
  });
});

describe('coverageReport', () => {
  it('calls a full case complete', () => {
    const report = coverageReport(full);
    expect(report.complete).toBe(report.rows.length);
    expect(report.problems.isClean()).toBe(true);
    expect(caveat(report)).toBe(null);
  });

  it('names what a thinner case cannot say, and why', () => {
    const report = coverageReport(second);
    const standing = report.rows.find((one) => one.report === 'standing');
    expect(standing.state).toBe('narrowed');
    expect(standing.because[0]).toContain('emergency order');
  });

  it('warns rather than erring where a report still works', () => {
    const report = coverageReport(second);
    expect(report.problems.hasError()).toBe(false);
    expect(report.problems.codes()).toEqual(['coverage.narrowed']);
  });

  it('calls a report blocked where a register it cannot work without is gone', () => {
    const bare = coverageReport({ ...full, areas: [], samples: [] });
    const survey = bare.rows.find((one) => one.report === 'survey');
    expect(survey.state).toBe('blocked');
    expect(bare.problems.codes()).toContain('coverage.blocked');
  });

  it('names the tide table, which is the one that quietly changes an answer', () => {
    const noTides = coverageReport({ ...full, tides: [] });
    const landings = noTides.rows.find((one) => one.report === 'landings');
    expect(landings.because[0]).toContain('generous reading');
  });

  it('names the lease register, which quietly reads today instead of the day', () => {
    const noLeases = coverageReport({ ...full, leases: [] });
    const landings = noLeases.rows.find((one) => one.report === 'landings');
    expect(landings.because.join(' ')).toContain('holds only today');
  });

  it('gives one sentence for the top of a thin report', () => {
    expect(caveat(coverageReport(second))).toContain('narrower than they look');
  });
});

describe('renderCoverage', () => {
  it('counts the registers and the complete reports', () => {
    const text = renderCoverage(coverageReport(full));
    expect(text).toContain('Reports that are complete:     7 of 7');
    expect(text).toContain('standing      complete');
  });

  it('prints the second and later reasons under a heading of their own', () => {
    const text = renderCoverage(coverageReport({ ...full, tides: [], certificates: [] }));
    expect(text).toContain('And also');
    expect(text).toContain('landings: the education requirement is not checked');
  });

  it('is the same text twice', () => {
    expect(renderCoverage(coverageReport(full))).toBe(renderCoverage(coverageReport(full)));
  });
});
