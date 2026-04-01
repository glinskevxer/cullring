import { describe, expect, it } from 'vitest';

import { compareStrategies, renderSurvey, surveyReport } from '../../src/report/survey.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import { ADVERSE_POLLUTION, SYSTEMATIC_RANDOM } from '../../src/survey/strategy.js';
import { TOTAL_COLIFORM } from '../../src/survey/standard.js';
import { civilDate } from '../../src/time/civil.js';
import { station } from '../../src/area/station.js';
import { sample } from '../../src/survey/result.js';
import { B12 } from '../support/register.js';
import { findArea } from '../../src/area/growingArea.js';
import { loadCase } from '../../src/cli/context.js';
import { CASE } from '../support/cli.js';
import { CLEAN_THIRTY, FOUL_THIRTY, MIDDLING_THIRTY, flat } from '../support/sets.js';

const on = civilDate(2025, 9, 30);
const base = { area: B12, heldTo: CONDITIONALLY_APPROVED, on };

const STATIONS = [1, 2, 3].map((ordinal) =>
  station({
    id: `B12-0${ordinal}`,
    latitude: 34.7,
    longitude: -76.6,
    openedOn: '2018-01-01',
  }),
);

const SAMPLES = [
  sample({ station: 'B12-01', collectedOn: '2025-09-01', result: 2 }),
  sample({ station: 'B12-02', collectedOn: '2025-09-01', result: 4.5 }),
];

describe('the proposal', () => {
  it('proposes a downgrade where the water no longer supports the class', () => {
    const report = surveyReport({ ...base, results: MIDDLING_THIRTY });
    expect(report.verdict.supported).toBe(RESTRICTED);
    expect(report.proposal.kind).toBe('downgrade');
    expect(report.proposal.to).toBe(RESTRICTED);
  });

  it('proposes holding where the water supports what it is held to', () => {
    const report = surveyReport({ ...base, results: CLEAN_THIRTY, heldTo: APPROVED });
    expect(report.proposal.kind).toBe('hold');
  });

  it('proposes an upgrade where the water supports better than the class', () => {
    const report = surveyReport({ ...base, results: CLEAN_THIRTY, heldTo: RESTRICTED });
    expect(report.proposal.kind).toBe('upgrade');
    expect(report.proposal.to).toBe(APPROVED);
  });

  it('proposes nothing at all where the set is too thin', () => {
    const report = surveyReport({ ...base, results: flat('<1.8', 8) });
    expect(report.proposal.kind).toBe('none');
    expect(report.verdict.supported).toBeNull();
  });

  it('walks all the way to prohibited where nothing is met', () => {
    const report = surveyReport({ ...base, results: FOUL_THIRTY });
    expect(report.verdict.supported).toBe(PROHIBITED);
    expect(report.proposal.kind).toBe('downgrade');
  });

  it('reads a conditional class against its open twin, so the proposal is comparable', () => {
    const report = surveyReport({ ...base, results: CLEAN_THIRTY });
    expect(report.proposal.kind).toBe('upgrade');
  });
});

describe('the rendered report', () => {
  const text = renderSurvey(surveyReport({ ...base, results: MIDDLING_THIRTY }));

  it('names the area, the class and the strategy at the top', () => {
    expect(text).toContain('Survey of B-12 Broad Creek');
    expect(text).toMatch(/Strategy: systematic random \(SRS\)/);
  });

  it('prints each criterion with what it read and what it had to meet', () => {
    expect(text).toContain('geometric mean');
    expect(text).toContain('estimated ninetieth percentile');
    expect(text).toMatch(/55\.4\s+14\s+no/);
  });

  it('prints the walk and the class it settled on', () => {
    expect(text).toContain('The walk');
    expect(text).toContain('Supported: restricted');
  });

  it('states the proposal in one line', () => {
    expect(text).toMatch(/Proposal: downgrade, the water no longer supports/);
  });

  it('says plainly when the set is too thin and proposes nothing', () => {
    const thin = renderSurvey(surveyReport({ ...base, results: flat('<1.8', 8) }));
    expect(thin).toContain('No classification is proposed.');
    expect(thin).not.toContain('The walk');
  });

  it('names the stations the survey never reached', () => {
    const report = surveyReport({
      ...base,
      results: MIDDLING_THIRTY,
      samples: SAMPLES,
      stations: STATIONS,
    });
    expect(renderSurvey(report)).toContain('Not visited this period: B12-03.');
  });

  it('leaves that line off where every station was visited', () => {
    expect(text).not.toContain('Not visited');
  });

  it('is the same text twice', () => {
    expect(renderSurvey(surveyReport({ ...base, results: MIDDLING_THIRTY }))).toBe(text);
  });
});

describe('reading one set under both strategies', () => {
  const both = compareStrategies({ ...base, results: CLEAN_THIRTY, heldTo: APPROVED }, [
    SYSTEMATIC_RANDOM,
    ADVERSE_POLLUTION,
  ]);

  it('gives a row for each strategy', () => {
    expect(both.map((one) => one.strategy)).toEqual([SYSTEMATIC_RANDOM, ADVERSE_POLLUTION]);
  });

  it('reads different criteria under each', () => {
    expect(both[0].criteria.map((one) => one.criterion)).toContain(
      'estimated ninetieth percentile',
    );
    expect(both[1].criteria.map((one) => one.criterion)).toContain('highest single result');
  });

  it('reads a different geometric mean under each, because the censoring differs', () => {
    expect(both[1].geometricMean).toBeLessThan(both[0].geometricMean);
  });

  it('can settle on the same class by different arithmetic', () => {
    expect(both[0].supported).toBe(both[1].supported);
  });
});

describe('the analysis matters as much as the class', () => {
  it('reads the same set differently under total coliform', () => {
    const fecal = surveyReport({ ...base, results: MIDDLING_THIRTY, heldTo: APPROVED });
    const total = surveyReport({
      ...base,
      results: MIDDLING_THIRTY,
      heldTo: APPROVED,
      analysis: TOTAL_COLIFORM,
    });
    expect(fecal.verdict.meetsHeld).toBe(false);
    expect(total.verdict.meetsHeld).toBe(true);
  });
});

describe('the stations the survey missed are printed either way', () => {
  it('names them under a thin set, which is usually why the set is thin', () => {
    const report = surveyReport({
      ...base,
      results: MIDDLING_THIRTY,
      samples: SAMPLES,
      stations: STATIONS,
    });
    const text = renderSurvey(report);
    expect(text).toContain('No classification is proposed.');
    expect(text).toContain('Not visited this period: B12-03.');
  });

  it('names them under a full set as well', () => {
    const full = [1, 2, 3].flatMap((ordinal) =>
      Array.from({ length: 10 }, () =>
        sample({ station: `B12-0${ordinal}`, collectedOn: '2025-09-01', result: 2 }),
      ),
    );
    const report = surveyReport({
      ...base,
      results: MIDDLING_THIRTY,
      samples: full,
      stations: [
        ...STATIONS,
        station({ id: 'B12-04', latitude: 34.7, longitude: -76.6, openedOn: '2018-01-01' }),
      ],
    });
    const text = renderSurvey(report);
    expect(text).toContain('Supported: restricted');
    expect(text).toContain('Not visited this period: B12-04.');
  });
});

describe('the condition, once the report is given the means to check it', () => {
  const loaded = loadCase(CASE);
  const area = findArea(loaded.areas, 'B-12');
  const selected = loaded.samples.filter((one) => one.areaId === 'B-12');

  const built = (extra) =>
    surveyReport({
      area,
      results: selected.map((one) => one.result),
      heldTo: 'conditionally approved',
      strategy: ADVERSE_POLLUTION,
      samples: selected,
      on: civilDate(2025, 8, 31),
      ...extra,
    });

  it('reads the set whole when it has no plan to check against', () => {
    const report = built({});
    expect(report.conditioned.checked).toBe(false);
    expect(report.verdict.sufficiency.total).toBe(selected.length);
  });

  it('says out loud that it never checked', () => {
    expect(built({}).verdict.problems.codes()).toContain('conditions.notChecked');
  });

  it('drops what was not taken under the condition once the plans are handed over', () => {
    const report = built({ plans: loaded.plans, feed: loaded.feed, zone: loaded.zone });
    expect(report.conditioned.checked).toBe(true);
    expect(report.conditioned.dropped.length).toBeGreaterThan(0);
    expect(renderSurvey(report)).toContain('Dropped as not adverse');
  });

  it('leaves a systematic reading of the same set untouched', () => {
    const report = surveyReport({
      area,
      results: selected.map((one) => one.result),
      heldTo: 'conditionally approved',
      strategy: SYSTEMATIC_RANDOM,
      samples: selected,
      plans: loaded.plans,
      feed: loaded.feed,
      on: civilDate(2025, 8, 31),
    });
    expect(report.conditioned.enforced).toBe(false);
    expect(report.verdict.sufficiency.total).toBe(selected.length);
  });
});
