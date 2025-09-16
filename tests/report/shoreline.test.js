import { describe, expect, it } from 'vitest';

import { renderSurvey, surveyReport } from '../../src/report/survey.js';
import { OUTFALL, MARINA, pollutionSource } from '../../src/survey/shoreline.js';
import { APPROVED, PROHIBITED, RESTRICTED } from '../../src/area/classification.js';
import { station } from '../../src/area/station.js';
import { civilDate } from '../../src/time/civil.js';
import { B12 } from '../support/register.js';
import { CLEAN_THIRTY } from '../support/sets.js';

const on = civilDate(2025, 9, 30);

const STATIONS = [
  station({ id: 'B12-01', latitude: 34.7295, longitude: -76.7168, openedOn: '2018-01-01' }),
  station({ id: 'B12-02', latitude: 34.7203, longitude: -76.7012, openedOn: '2018-01-01' }),
];

const marina = pollutionSource({
  id: 'MAR-1',
  kind: MARINA,
  areaId: 'B-12',
  latitude: 34.7295,
  longitude: -76.7168,
  size: 64,
  surveyedOn: '2024-06-01',
});

const distant = pollutionSource({
  id: 'WWTP-9',
  kind: OUTFALL,
  areaId: 'B-12',
  latitude: 35.9,
  longitude: -75.2,
  size: 750000,
  surveyedOn: '2024-06-01',
});

const report = (sources) =>
  surveyReport({
    area: B12,
    results: CLEAN_THIRTY,
    heldTo: APPROVED,
    samples: [],
    stations: STATIONS,
    sources,
    on,
  });

describe('the shoreline caps what the samples support', () => {
  it('leaves clean water alone where nothing reaches a station', () => {
    const answer = report([distant]);
    expect(answer.verdict.supported).toBe(APPROVED);
    expect(answer.cap).toBeNull();
    expect(answer.supported).toBe(APPROVED);
    expect(answer.proposal.kind).toBe('hold');
  });

  it('caps clean water at prohibited where a marina sits on a station', () => {
    const answer = report([marina]);
    expect(answer.verdict.supported).toBe(APPROVED);
    expect(answer.cap).toBe(PROHIBITED);
    expect(answer.supported).toBe(PROHIBITED);
  });

  it('turns a hold into a downgrade, which is the point of the cap', () => {
    expect(report([distant]).proposal.kind).toBe('hold');
    expect(report([marina]).proposal.kind).toBe('downgrade');
  });

  it('names the sources that did the capping', () => {
    expect(report([marina]).sources.map((one) => one.id)).toEqual(['MAR-1']);
    expect(report([distant]).sources.map((one) => one.id)).toEqual(['WWTP-9']);
  });

  it('takes no notice of a source in another area', () => {
    const elsewhere = pollutionSource({ ...marina, id: 'MAR-2', areaId: 'C-3' });
    expect(report([elsewhere]).cap).toBeNull();
  });

  it('never proposes something more permissive than the cap', () => {
    for (const sources of [[], [distant], [marina]]) {
      const answer = report(sources);
      if (answer.cap !== null) {
        expect([answer.cap, answer.verdict.supported]).toContain(answer.supported);
      }
    }
  });
});

describe('the rendered report shows both readings', () => {
  it('prints what the samples support and what the shoreline allows', () => {
    const text = renderSurvey(report([marina]));
    expect(text).toContain('Supported by the samples: approved');
    expect(text).toContain('Capped by the shoreline at: prohibited');
    expect(text).toContain('Supported: prohibited');
  });

  it('names the source with its zone and its cap', () => {
    expect(renderSurvey(report([marina]))).toContain(
      'MAR-1: marina, zone 1500 ft, caps at prohibited',
    );
  });

  it('leaves the cap lines off where there is no cap', () => {
    const text = renderSurvey(report([distant]));
    expect(text).not.toContain('Capped by the shoreline');
    expect(text).toContain('Supported: approved');
  });

  it('still prints both lines when they agree', () => {
    const restricted = pollutionSource({
      id: 'BY-3',
      kind: 'boatyard',
      areaId: 'B-12',
      latitude: 34.7203,
      longitude: -76.7012,
      surveyedOn: '2024-06-01',
    });
    const text = renderSurvey(report([restricted]));
    expect(text).toContain('Capped by the shoreline at: restricted');
    expect(text).toContain('Supported: restricted');
    expect(report([restricted]).supported).toBe(RESTRICTED);
  });
});
