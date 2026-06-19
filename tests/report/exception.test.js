import { describe, expect, it } from 'vitest';

import {
  codeRows,
  errorCount,
  exceptionReport,
  familyOf,
  groupFindings,
  renderException,
} from '../../src/report/exception.js';
import { asError, asNote, asWarning, findings } from '../../src/core/finding.js';

const list = () =>
  findings([
    asError('harvest.closedWater', 'the water was shut'),
    asError('harvest.noTag', 'no tag'),
    asWarning('harvest.iceLate', 'ice went on late'),
    asNote('area.planClosed', 'the plan is shut'),
    asNote('area.planClosed', 'the plan is shut again'),
    asNote('area.planClosed', 'and again'),
    asWarning('locate.overlap', 'two lines'),
  ]);

describe('familyOf', () => {
  it('takes the part before the dot, which is the module that raised it', () => {
    expect(familyOf('harvest.closedWater')).toBe('harvest');
    expect(familyOf('internal')).toBe('internal');
  });
});

describe('groupFindings', () => {
  const families = groupFindings(list());

  it('counts each severity per family rather than summing them', () => {
    const harvest = families.find((one) => one.family === 'harvest');
    expect(harvest).toMatchObject({ errors: 2, warnings: 1, notes: 0 });
  });

  it('puts the family with the errors first, whatever the totals are', () => {
    expect(families[0].family).toBe('harvest');
    expect(families[1].family).toBe('locate');
  });

  it('names the worst code in each family, so one error is not buried in thirty notes', () => {
    expect(families.find((one) => one.family === 'area').worst).toBe('area.planClosed');
    expect(families[0].worst).toBe('harvest.closedWater');
  });

  it('has nothing to say about nothing', () => {
    expect(groupFindings([])).toEqual([]);
  });
});

describe('codeRows', () => {
  const rows = codeRows(list());

  it('puts the most frequent code first', () => {
    expect(rows[0]).toMatchObject({ code: 'area.planClosed', count: 3 });
  });

  it('carries the line the catalogue keeps for each', () => {
    expect(rows[0].says).toContain('shut under its own management plan');
  });

  it('says so rather than throwing on a code nothing describes', () => {
    const rogue = codeRows([asError('nowhere.atAll', 'invented')]);
    expect(rogue[0].says).toBe('nothing in the catalogue');
  });
});

describe('exceptionReport', () => {
  const report = exceptionReport({ on: '2025-08-31', findings: list(), counts: { Areas: 5 } });

  it('counts every severity', () => {
    expect(report.total).toBe(7);
    expect(report.errors).toBe(2);
    expect(report.warnings).toBe(2);
    expect(report.notes).toBe(3);
  });

  it('carries whatever counts the caller wanted printed', () => {
    expect(report.counts).toEqual({ Areas: 5 });
  });

  it('gives the manager one number and names it', () => {
    expect(errorCount(report)).toBe(2);
  });

  it('says a clean case is clean', () => {
    const clean = exceptionReport({ on: '2025-08-31', findings: [] });
    expect(clean.clean).toBe(true);
    expect(renderException(clean)).toContain('unusual enough to be worth checking');
  });
});

describe('renderException', () => {
  const text = renderException(exceptionReport({ on: '2025-08-31', findings: list() }));

  it('prints the counts, the families and the codes', () => {
    expect(text).toContain('Exceptions as at 2025-08-31');
    expect(text).toContain('By family');
    expect(text).toContain('By code');
    expect(text).toContain('harvest.closedWater');
  });

  it('says how many codes it did not show', () => {
    const many = findings(
      Array.from({ length: 20 }, (unused, index) => asNote('area.planClosed', `note ${index}`)),
    );
    const wide = renderException(exceptionReport({ on: '2025-08-31', findings: many }), {
      limit: 1,
    });
    expect(wide).not.toContain('more codes are not shown');
  });

  it('is the same text twice', () => {
    expect(renderException(exceptionReport({ on: '2025-08-31', findings: list() }))).toBe(text);
  });
});
