import { describe, expect, it } from 'vitest';

import { selectSamples, survey } from '../../src/cli/commands/survey.js';
import { loadCase } from '../../src/cli/context.js';
import { ADVERSE_POLLUTION, SYSTEMATIC_RANDOM } from '../../src/survey/strategy.js';
import { FECAL_COLIFORM, TOTAL_COLIFORM } from '../../src/survey/standard.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 9, 30);

describe('selecting the results a survey may use', () => {
  it('takes only the area asked about', () => {
    const chosen = selectSamples(loaded.samples, {
      areaId: 'B-12',
      on,
      strategyName: SYSTEMATIC_RANDOM,
      analysisName: FECAL_COLIFORM,
    });
    expect(chosen.length).toBeGreaterThan(30);
    expect(chosen.every((one) => one.areaId === 'B-12')).toBe(true);
  });

  it('takes only the analysis being scored', () => {
    const chosen = selectSamples(loaded.samples, {
      areaId: 'B-12',
      on,
      strategyName: SYSTEMATIC_RANDOM,
      analysisName: TOTAL_COLIFORM,
    });
    expect(chosen).toEqual([]);
  });

  it('reaches back further on the adverse programme than on the routine one', () => {
    const routine = selectSamples(loaded.samples, {
      areaId: 'B-12',
      on,
      strategyName: SYSTEMATIC_RANDOM,
      analysisName: FECAL_COLIFORM,
    });
    const adverse = selectSamples(loaded.samples, {
      areaId: 'B-12',
      on,
      strategyName: ADVERSE_POLLUTION,
      analysisName: FECAL_COLIFORM,
    });
    expect(adverse.length).toBeGreaterThanOrEqual(routine.length);
  });

  it('takes nothing after the day being scored', () => {
    const chosen = selectSamples(loaded.samples, {
      areaId: 'B-12',
      on: civilDate(2023, 3, 1),
      strategyName: SYSTEMATIC_RANDOM,
      analysisName: FECAL_COLIFORM,
    });
    expect(chosen.every((one) => one.collectedOn.year <= 2023)).toBe(true);
  });

  it('takes nothing at all for an area with no stations', () => {
    expect(
      selectSamples(loaded.samples, {
        areaId: 'D-9',
        on,
        strategyName: SYSTEMATIC_RANDOM,
        analysisName: FECAL_COLIFORM,
      }),
    ).toEqual([]);
  });
});

describe('the survey command', () => {
  it('scores an area against the class the register holds it to', () => {
    const io = recorder();
    expect(survey(base({ area: 'B-12', on: '2025-09-30' }), io)).toBe(OK);
    expect(io.out).toContain('Survey of B-12 Broad Creek');
    expect(io.out).toMatch(/Held to:\s+conditionally approved/);
  });

  it('takes a class from the caller instead when told to', () => {
    const io = recorder();
    survey(base({ area: 'B-12', on: '2025-09-30', heldTo: 'restricted' }), io);
    expect(io.out).toMatch(/Held to:\s+restricted/);
  });

  it('proposes a downgrade for water that no longer supports its class', () => {
    const io = recorder();
    survey(base({ area: 'D-2', on: '2025-09-30' }), io);
    expect(io.out).toMatch(/Proposal: downgrade/);
  });

  it('prints both strategies side by side when asked', () => {
    const io = recorder();
    survey(base({ area: 'B-14', on: '2025-09-30', both: true }), io);
    expect(io.out).toContain('The same results under both strategies');
    expect(io.out).toContain('highest single result');
    expect(io.out).toContain('estimated ninetieth percentile');
  });

  it('leaves the comparison off unless it is asked for', () => {
    const io = recorder();
    survey(base({ area: 'B-14', on: '2025-09-30' }), io);
    expect(io.out).not.toContain('The same results under both strategies');
  });

  it('prints the proposal as JSON when asked', () => {
    const io = recorder();
    survey(base({ area: 'B-14', on: '2025-09-30', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.area).toBe('B-14');
    expect(answer.supported).toBe('restricted');
    expect(answer.perStation['B14-01']).toBeGreaterThan(0);
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(survey(base({ area: 'Z-9', on: '2025-09-30' }), io)).toBe(REFUSED);
  });

  it('refuses a day the register does not reach', () => {
    const io = recorder();
    expect(survey(base({ area: 'B-12', on: '2005-01-01' }), io)).toBe(REFUSED);
    expect(io.err).toContain('no classification of record');
  });

  it('refuses a strategy and an analysis it does not know', () => {
    const io = recorder();
    expect(() =>
      survey(base({ area: 'B-12', on: '2025-09-30', strategy: 'whenever' }), io),
    ).toThrow(/not a sampling strategy/);
    expect(() =>
      survey(base({ area: 'B-12', on: '2025-09-30', analysis: 'enterococcus' }), io),
    ).toThrow(/not an analysis/);
  });

  it('says the set is too thin where an area has almost no results', () => {
    const io = recorder();
    survey(base({ area: 'D-9', on: '2025-09-30', heldTo: 'prohibited' }), io);
    expect(io.out).toContain('No classification is proposed.');
  });
});
