import { describe, expect, it } from 'vitest';

import { renderSurvey, surveyReport } from '../../src/report/survey.js';
import { APPROVED, RESTRICTED } from '../../src/area/classification.js';
import { IMPROVING, STEADY, WORSENING } from '../../src/survey/trend.js';
import { sample } from '../../src/survey/result.js';
import { civilDate } from '../../src/time/civil.js';
import { B12 } from '../support/register.js';
import { CLEAN_THIRTY, MIDDLING_THIRTY } from '../support/sets.js';

const on = civilDate(2025, 9, 30);

const run = (byYear) =>
  Object.entries(byYear).flatMap(([year, values]) =>
    values.map((value, index) =>
      sample({
        station: 'B12-01',
        collectedOn: civilDate(Number(year), 1 + (index % 12), 5),
        result: value,
      }),
    ),
  );

const report = ({ results, heldTo, samples }) =>
  surveyReport({ area: B12, results, heldTo, samples, stations: [], sources: [], on });

const STEADY_RUN = run({ 2023: [10, 10, 10], 2024: [10, 10, 10], 2025: [10, 10, 10] });
const WORSENING_RUN = run({ 2023: [2, 2, 2], 2024: [8, 8, 8], 2025: [32, 32, 32] });
const IMPROVING_RUN = run({ 2023: [32, 32, 32], 2024: [8, 8, 8], 2025: [2, 2, 2] });

describe('the trend on a survey', () => {
  it('reads the direction off the samples the survey was given', () => {
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: WORSENING_RUN }).trend.direction,
    ).toBe(WORSENING);
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: IMPROVING_RUN }).trend.direction,
    ).toBe(IMPROVING);
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: STEADY_RUN }).trend.direction,
    ).toBe(STEADY);
  });

  it('has no direction where the survey carries no dated samples', () => {
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: [] }).trend.direction,
    ).toBeNull();
  });
});

describe('the watch, which is not the proposal', () => {
  it('watches water that still passes and is heading the wrong way', () => {
    const answer = report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: WORSENING_RUN });
    expect(answer.proposal.kind).toBe('hold');
    expect(answer.watch.watch).toBe(true);
    expect(answer.watch.reason).toMatch(/worsening/);
  });

  it('does not watch water that is already failing, because that is a proposal', () => {
    const answer = report({ results: MIDDLING_THIRTY, heldTo: APPROVED, samples: WORSENING_RUN });
    expect(answer.proposal.kind).toBe('downgrade');
    expect(answer.watch.watch).toBe(false);
    expect(answer.watch.reason).toMatch(/rather than a watch/);
  });

  it('does not watch steady water', () => {
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: STEADY_RUN }).watch.watch,
    ).toBe(false);
  });

  it('does not watch improving water', () => {
    expect(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: IMPROVING_RUN }).watch.watch,
    ).toBe(false);
  });

  it('does not watch where the set was too thin to support anything', () => {
    const thin = surveyReport({
      area: B12,
      results: CLEAN_THIRTY.slice(0, 4),
      heldTo: APPROVED,
      samples: WORSENING_RUN,
      stations: [],
      sources: [],
      on,
    });
    expect(thin.supported).toBeNull();
    expect(thin.watch.watch).toBe(false);
  });

  it('watches water held to a class it comfortably beats, if it is worsening', () => {
    const answer = report({ results: CLEAN_THIRTY, heldTo: RESTRICTED, samples: WORSENING_RUN });
    expect(answer.proposal.kind).toBe('upgrade');
    expect(answer.watch.watch).toBe(true);
  });
});

describe('the rendered report', () => {
  it('prints the trend on every survey', () => {
    const text = renderSurvey(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: STEADY_RUN }),
    );
    expect(text).toContain('Trend: steady over 3 years.');
  });

  it('prints a watch line only where there is one', () => {
    const watched = renderSurvey(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: WORSENING_RUN }),
    );
    const quiet = renderSurvey(
      report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: STEADY_RUN }),
    );
    expect(watched).toMatch(/Watch: yes, worsening/);
    expect(quiet).not.toContain('Watch:');
  });

  it('says plainly when no direction can be read', () => {
    const text = renderSurvey(report({ results: CLEAN_THIRTY, heldTo: APPROVED, samples: [] }));
    expect(text).toMatch(/Trend: no direction can be read/);
  });
});
