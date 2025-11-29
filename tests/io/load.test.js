import { describe, expect, it } from 'vitest';

import {
  buildReopening,
  buildTrigger,
  loadAreas,
  loadBeds,
  loadBypasses,
  loadCertificates,
  loadDealers,
  loadHarvesters,
  loadHarvests,
  loadMovements,
  loadPlans,
  loadReadings,
  loadSamples,
  loadStations,
  loadTides,
  readFlag,
} from '../../src/io/load.js';

describe('loading the areas', () => {
  const source = {
    areas: [
      {
        id: 'B-12',
        name: 'Broad Creek',
        acres: 412,
        history: [{ classification: 'conditionally approved', from: '2022-01-01' }],
      },
      { id: 'not an area', name: 'nowhere', history: [] },
    ],
  };

  it('builds what it can', () => {
    const answer = loadAreas(source);
    expect(answer.built).toHaveLength(1);
    expect(answer.built[0].name).toBe('Broad Creek');
  });

  it('reports the entry it could not build, by index', () => {
    const answer = loadAreas(source);
    expect(answer.problems.has('load.entry')).toBe(true);
    expect(answer.problems.list()[0].detail.index).toBe(1);
  });

  it('takes a bare list as well as a bundle', () => {
    expect(loadAreas(source.areas.slice(0, 1)).built).toHaveLength(1);
  });

  it('notes a bundle that carries no list at all', () => {
    expect(loadAreas({}).problems.has('load.absent')).toBe(true);
    expect(loadAreas(null).problems.has('load.absent')).toBe(true);
  });

  it('reports a list that is there and is not a list', () => {
    expect(loadAreas({ areas: 'B-12' }).problems.has('load.shape')).toBe(true);
  });
});

describe('loading the other registers', () => {
  it('loads stations, beds, harvesters and dealers', () => {
    expect(
      loadStations([{ id: 'B12-01', latitude: 34.7, longitude: -76.6, openedOn: '2020-01-01' }])
        .built,
    ).toHaveLength(1);
    expect(
      loadBeds([{ id: 'B12-BCK', name: 'flat', tideStation: 'BFT', elevation: 1.8 }]).built,
    ).toHaveLength(1);
    expect(
      loadHarvesters([
        {
          id: 'SH-2025-04412',
          name: 'Wade Ollis',
          gears: ['hand'],
          issuedOn: '2025-01-01',
          expiresOn: '2025-12-31',
        },
      ]).built,
    ).toHaveLength(1);
    expect(
      loadDealers([
        { id: 'SP-118', name: 'Core Sound', certifiedOn: '2025-01-01', expiresOn: '2025-12-31' },
      ]).built,
    ).toHaveLength(1);
  });

  it('reads a suspension list on a licence', () => {
    const answer = loadHarvesters([
      {
        id: 'SH-2025-04412',
        name: 'Wade Ollis',
        gears: ['hand'],
        issuedOn: '2025-01-01',
        expiresOn: '2025-12-31',
        suspensions: [{ from: '2025-07-01', to: '2025-07-31', reason: 'untagged lot' }],
      },
    ]);
    expect(answer.built[0].suspensions).toHaveLength(1);
  });
});

describe('building a trigger and a reopening rule from a plan file', () => {
  it.each([
    [{ kind: 'rainfall', gauge: 'BRD', inches: 1, overHours: 24 }, 'rainfall'],
    [{ kind: 'stage crossing', gauge: 'PPR', feet: 8 }, 'stage crossing'],
    [{ kind: 'bypass', facility: 'WWTP-3' }, 'bypass'],
    [{ kind: 'season', from: '2025-05-15', to: '2025-09-15' }, 'season'],
  ])('builds a %o', (spec, kind) => {
    expect(buildTrigger(spec).kind).toBe(kind);
  });

  it.each([
    [{ kind: 'after hours', hours: 72 }, 'after hours'],
    [{ kind: 'after samples', count: 2 }, 'after samples'],
    [{ kind: 'after tides', cycles: 1 }, 'after tides'],
    [{ kind: 'on date', on: '2025-09-16' }, 'on date'],
  ])('builds a %o', (spec, kind) => {
    expect(buildReopening(spec).kind).toBe(kind);
  });

  it('refuses a trigger or a rule with no kind', () => {
    expect(() => buildTrigger({})).toThrow(/carries a trigger with a kind/);
    expect(() => buildReopening(null)).toThrow(/carries a reopening rule with a kind/);
  });

  it('refuses a kind it does not know', () => {
    expect(() => buildTrigger({ kind: 'moon phase' })).toThrow(/is not a trigger/);
    expect(() => buildReopening({ kind: 'when it clears' })).toThrow(/is not a reopening rule/);
  });

  it('loads a whole plan', () => {
    const answer = loadPlans([
      {
        area: 'B-12',
        trigger: { kind: 'rainfall', gauge: 'BRD', inches: 1, overHours: 24 },
        reopening: { kind: 'after hours', hours: 72 },
        effectiveFrom: '2022-01-01',
      },
    ]);
    expect(answer.built[0].area).toBe('B-12');
    expect(answer.built[0].reopening.kind).toBe('after hours');
  });
});

describe('loading the feeds', () => {
  it('loads gauge readings', () => {
    const answer = loadReadings('gauge,at,value\nBRD,2025-06-10 02:00,1.2\n');
    expect(answer.built[0].gauge).toBe('BRD');
    expect(answer.built[0].value).toBe(1.2);
  });

  it('loads bypass reports', () => {
    const answer = loadBypasses('facility,at,note\nWWTP-3,2025-06-10 03:00,wet weather\n');
    expect(answer.built[0].facility).toBe('WWTP-3');
    expect(answer.built[0].note).toBe('wet weather');
  });

  it('loads tide extremes', () => {
    const answer = loadTides('station,at,kind,height\nBFT,2025-08-14 02:12,high,3.4\n');
    expect(answer.built[0].kind).toBe('high');
    expect(answer.built[0].height).toBe(3.4);
  });

  it('loads samples, bounds and all', () => {
    const answer = loadSamples('station,collectedOn,result\nB12-01,2025-04-08,<1.8\n');
    expect(answer.built[0].result.kind).toBe('below');
    expect(answer.built[0].areaId).toBe('B-12');
  });

  it('takes the analysis off the sheet when it carries one', () => {
    const answer = loadSamples(
      'station,collectedOn,result,kind\nB12-01,2025-04-08,23,total coliform\n',
    );
    expect(answer.built[0].kind).toBe('total coliform');
  });

  it('falls back to the default analysis on a blank column', () => {
    const answer = loadSamples('station,collectedOn,result,kind\nB12-01,2025-04-08,23,\n');
    expect(answer.built[0].kind).toBe('fecal coliform');
  });

  it('loads landings', () => {
    const answer = loadHarvests(
      [
        'lot,harvester,bed,gear,species,form,startedAt,landedAt,containers,dealer,iced',
        ',SH-2025-04412,B12-BCK,hand,,,2025-08-14 07:00,2025-08-14 09:45,12,SS-042,yes',
      ].join('\n'),
    );
    expect(answer.built[0].lot).toBe('20250814-B12-001');
    expect(answer.built[0].species).toBe('oyster');
    expect(answer.built[0].iced).toBe(true);
  });

  it('loads a ledger, keeping the lot a shucking minted', () => {
    const answer = loadMovements(
      [
        'kind,lot,becomes,at,dealer,containers,toParty,note',
        'shucked,20250814-B12-001,20250815-B12-101,2025-08-15 07:30,SP-118,,,',
      ].join('\n'),
    );
    expect(answer.built[0].becomes).toBe('20250815-B12-101');
    expect(answer.built[0].containers).toBeNull();
  });

  it('reports a bad row by line number and loads the rest', () => {
    const answer = loadReadings(
      'gauge,at,value\nBRD,2025-06-10 02:00,1.2\nBRD,not a time,0.4\nBRD,2025-06-11 02:00,0.9\n',
    );
    expect(answer.built).toHaveLength(2);
    expect(answer.problems.list()[0].message).toMatch(/line 3/);
  });
});

describe('reading a flag off a sheet', () => {
  it.each(['y', 'Yes', 'TRUE', '1', 'iced'])('reads %s as iced', (text) => {
    expect(readFlag(text)).toBe(true);
  });

  it.each(['n', 'no', '', '0', 'false', undefined, null])('reads %s as not iced', (text) => {
    expect(readFlag(text)).toBe(false);
  });
});

describe('a register that leaves a list out entirely', () => {
  it('notes it rather than calling it malformed', () => {
    const answer = loadDealers({ areas: [] });
    expect(answer.problems.has('load.absent')).toBe(true);
    expect(answer.problems.hasError()).toBe(false);
    expect(answer.built).toEqual([]);
  });

  it('still calls a list that is there and is not a list an error', () => {
    const answer = loadDealers({ dealers: 'SP-118' });
    expect(answer.problems.has('load.shape')).toBe(true);
    expect(answer.problems.hasError()).toBe(true);
  });

  it('reads a null register as absent throughout', () => {
    expect(loadAreas(null).problems.has('load.absent')).toBe(true);
  });
});

describe('the certificate register', () => {
  it('is noted once when the office keeps none', () => {
    const answer = loadCertificates({ areas: [] });
    expect(answer.problems.has('load.absent')).toBe(true);
    expect(answer.built).toEqual([]);
  });

  it('loads what is there', () => {
    const answer = loadCertificates({
      certificates: [
        { harvester: 'SH-2025-04412', course: 'shellfish sanitation', sat: '2024-02-19' },
      ],
    });
    expect(answer.built).toHaveLength(1);
    expect(answer.built[0].expires.year).toBe(2027);
  });

  it('reports a certificate it cannot build, by index', () => {
    const answer = loadCertificates({
      certificates: [{ harvester: 'SP-118', course: 'x', sat: '2024-02-19' }],
    });
    expect(answer.problems.has('load.entry')).toBe(true);
  });
});
