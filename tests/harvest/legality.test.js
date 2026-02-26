import { describe, expect, it } from 'vitest';

import { checkHarvest, checkLandings } from '../../src/harvest/legality.js';
import { APPROVED, PROHIBITED, RESTRICTED } from '../../src/area/classification.js';
import { DREDGE, TONGS } from '../../src/licence/harvester.js';
import { harvestRecord } from '../../src/harvest/record.js';
import { AREAS, JUNE_FIRST, PLANS, STORM } from '../support/register.js';
import { CHANNEL, FLAT, TIDES, at, tonged, waded } from '../support/water.js';
import { DEALERS, HARVESTERS, LEASED_BED, OUTFALL_BED } from '../support/people.js';

const context = {
  areas: AREAS,
  plans: PLANS,
  feed: STORM,
  harvesters: HARVESTERS,
  dealers: DEALERS,
  tides: TIDES,
  from: JUNE_FIRST,
};

const ask = (record, bed, extra = {}) =>
  checkHarvest({ ...context, record, bed, underControlAt: at('2025-08-14 12:00'), ...extra });

const boat = (extra = {}) => tonged({ harvester: 'SH-2025-00877', gear: TONGS, ...extra });

describe('a lawful harvest', () => {
  it('passes with nothing to report', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.lawful).toBe(true);
    expect(answer.problems.of('error')).toEqual([]);
    expect(answer.effective).toBe(APPROVED);
  });

  it('names the day it is judging and the class the water was', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.on).toBe('2025-08-14');
    expect(answer.treatment).toBeNull();
  });
});

describe('the water', () => {
  it('refuses a harvest out of prohibited water', () => {
    const record = harvestRecord({
      harvester: 'SH-2025-00877',
      bed: 'D9-OFL',
      gear: TONGS,
      startedAt: at('2025-08-14 07:00'),
      landedAt: at('2025-08-14 09:45'),
      containers: 4,
      dealer: 'SS-042',
    });
    const answer = ask(record, OUTFALL_BED);
    expect(answer.lawful).toBe(false);
    expect(answer.effective).toBe(PROHIBITED);
    expect(answer.problems.has('harvest.closedWater')).toBe(true);
  });

  it('refuses a harvest out of an area that is not in the register', () => {
    const record = harvestRecord({
      harvester: 'SH-2025-00877',
      bed: 'Z9-XXX',
      gear: TONGS,
      startedAt: at('2025-08-14 07:00'),
      landedAt: at('2025-08-14 09:45'),
      containers: 4,
    });
    const answer = ask(record, { ...CHANNEL, id: 'Z9-XXX', areaId: 'Z-9' });
    expect(answer.problems.has('harvest.unknownArea')).toBe(true);
  });

  it('refuses a harvest taken while the conditional plan had the area shut', () => {
    const record = boat({
      startedAt: at('2025-06-11 07:00'),
      landedAt: at('2025-06-11 09:00'),
      lot: '20250611-B12-002',
      dealer: 'SS-042',
    });
    const answer = ask(record, CHANNEL, { underControlAt: at('2025-06-11 12:00') });
    expect(answer.problems.has('harvest.closedWater')).toBe(true);
    expect(answer.closure).not.toBeNull();
  });

  it('allows the same harvest two days later, once the closure has lifted', () => {
    const record = boat({
      startedAt: at('2025-06-14 07:00'),
      landedAt: at('2025-06-14 09:00'),
      lot: '20250614-B12-002',
      dealer: 'SS-042',
    });
    const answer = ask(record, CHANNEL, { underControlAt: at('2025-06-14 12:00') });
    expect(answer.problems.has('harvest.closedWater')).toBe(false);
  });
});

describe('the people', () => {
  it('refuses a licence number that is not in the register', () => {
    const answer = ask(boat({ harvester: 'SH-2025-99999' }), CHANNEL);
    expect(answer.problems.has('harvest.unknownHarvester')).toBe(true);
  });

  it('refuses a harvest on a lapsed licence', () => {
    const answer = ask(boat({ harvester: 'SH-2024-03310' }), CHANNEL);
    expect(answer.problems.has('harvest.licenceLapsed')).toBe(true);
  });

  it('refuses a harvest inside a suspension', () => {
    const record = boat({
      startedAt: at('2025-07-14 07:00'),
      landedAt: at('2025-07-14 09:00'),
      lot: '20250714-B12-002',
    });
    const answer = ask(record, CHANNEL, { underControlAt: at('2025-07-14 12:00') });
    expect(answer.problems.has('harvest.licenceSuspended')).toBe(true);
  });

  it('refuses gear the licence is not endorsed for', () => {
    const answer = ask(waded({ harvester: 'SH-2025-00877' }), FLAT);
    expect(answer.problems.has('harvest.gearNotEndorsed')).toBe(true);
  });

  it('refuses somebody else working a lease', () => {
    const record = harvestRecord({
      harvester: 'SH-2025-00877',
      bed: 'D2-TGB',
      gear: DREDGE,
      startedAt: at('2025-08-14 07:00'),
      landedAt: at('2025-08-14 09:45'),
      containers: 4,
      dealer: 'DP-003',
    });
    const answer = ask(record, LEASED_BED);
    expect(answer.problems.has('harvest.leaseTrespass')).toBe(true);
  });

  it('allows the holder to work their own lease', () => {
    const record = harvestRecord({
      harvester: 'SH-2025-04412',
      bed: 'D2-TGB',
      gear: 'rake',
      startedAt: at('2025-08-14 07:00'),
      landedAt: at('2025-08-14 09:45'),
      containers: 4,
      dealer: 'DP-003',
    });
    const answer = ask(record, LEASED_BED);
    expect(answer.problems.has('harvest.leaseTrespass')).toBe(false);
  });
});

describe('where the product goes', () => {
  const restricted = (extra = {}) =>
    harvestRecord({
      harvester: 'SH-2025-04412',
      bed: 'D2-TGB',
      gear: 'rake',
      startedAt: at('2025-08-14 07:00'),
      landedAt: at('2025-08-14 09:45'),
      containers: 4,
      ...extra,
    });

  it('says restricted product needs treatment', () => {
    const answer = ask(restricted({ dealer: 'DP-003' }), LEASED_BED);
    expect(answer.effective).toBe(RESTRICTED);
    expect(answer.treatment).toBe('relay or depuration');
  });

  it('refuses restricted product with no dealer named at all', () => {
    const answer = ask(restricted(), LEASED_BED);
    expect(answer.problems.has('harvest.noTreatmentDealer')).toBe(true);
  });

  it('refuses restricted product going to a dealer who cannot treat it', () => {
    const answer = ask(restricted({ dealer: 'SS-042' }), LEASED_BED);
    expect(answer.problems.has('harvest.dealerCannotTreat')).toBe(true);
  });

  it('allows restricted product going to the depuration processor', () => {
    const answer = ask(restricted({ dealer: 'DP-003' }), LEASED_BED);
    expect(answer.problems.has('harvest.dealerCannotTreat')).toBe(false);
  });

  it('does not ask for treatment on approved water', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.treatment).toBeNull();
    expect(answer.problems.has('harvest.noTreatmentDealer')).toBe(false);
  });

  it('refuses a dealer that is not in the register', () => {
    const answer = ask(boat({ dealer: 'SS-777' }), CHANNEL);
    expect(answer.problems.has('harvest.unknownDealer')).toBe(true);
  });

  it('refuses a dealer whose certification had lapsed', () => {
    const answer = ask(boat({ dealer: 'SS-099' }), CHANNEL);
    expect(answer.problems.has('harvest.dealerNotCertified')).toBe(true);
  });
});

describe('the temperature question is folded in', () => {
  it('fails a lawful harvest that got cold too late', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, {
      underControlAt: at('2025-08-14 20:00'),
    });
    expect(answer.lawful).toBe(false);
    expect(answer.problems.has('vibrio.overTime')).toBe(true);
    expect(answer.temperature.limitHours).toBe(10);
  });

  it('carries the temperature answer whole, so a report need not run it again', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.temperature.elapsedHours).toBe(5);
    expect(answer.temperature.compliant).toBe(true);
  });
});

describe('nothing stops at the first failure', () => {
  it('reports the water, the licence and the gear all at once', () => {
    const record = harvestRecord({
      harvester: 'SH-2025-00877',
      bed: 'D9-OFL',
      gear: 'hand',
      startedAt: at('2025-07-14 07:00'),
      landedAt: at('2025-07-14 09:45'),
      containers: 4,
      lot: '20250714-D9-001',
    });
    const answer = checkHarvest({
      ...context,
      record,
      bed: OUTFALL_BED,
      underControlAt: at('2025-07-14 12:00'),
    });
    expect(answer.problems.has('harvest.closedWater')).toBe(true);
    expect(answer.problems.has('harvest.licenceSuspended')).toBe(true);
    expect(answer.problems.of('error').length).toBeGreaterThanOrEqual(2);
  });
});

describe('a day of landings', () => {
  it('checks every record and sorts by lot', () => {
    const records = [
      boat({ dealer: 'SS-042', lot: '20250814-B12-009' }),
      waded({ dealer: 'SS-042', lot: '20250814-B12-001' }),
    ];
    const answers = checkLandings(records, {
      ...context,
      beds: [CHANNEL, FLAT],
      underControlAt: at('2025-08-14 12:00'),
    });
    expect(answers.map((one) => one.lot)).toEqual(['20250814-B12-001', '20250814-B12-009']);
  });
});

describe('the education requirement', () => {
  const CERTIFICATES = [
    {
      harvester: 'SH-2025-00877',
      course: 'shellfish sanitation',
      sat: { year: 2024, month: 2, day: 19 },
      expires: { year: 2027, month: 2, day: 19 },
    },
  ];

  it('is not checked at all where no register was supplied', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.problems.has('harvest.educationLapsed')).toBe(false);
    expect(answer.lawful).toBe(true);
  });

  it('says nothing per lot about the absence, because the loader says it once', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.problems.codes().every((code) => !code.startsWith('harvest.education'))).toBe(
      true,
    );
  });

  it('passes a harvester whose certificate is current', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, { certificates: CERTIFICATES });
    expect(answer.problems.has('harvest.educationLapsed')).toBe(false);
  });

  it('fails a harvester with no certificate in a register that is being kept', () => {
    const answer = ask(waded({ dealer: 'SS-042' }), FLAT, { certificates: CERTIFICATES });
    expect(answer.problems.has('harvest.educationLapsed')).toBe(true);
    expect(answer.lawful).toBe(false);
  });

  it('tells an empty register apart from no register', () => {
    const empty = ask(boat({ dealer: 'SS-042' }), CHANNEL, { certificates: [] });
    const absent = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(empty.problems.has('harvest.educationLapsed')).toBe(true);
    expect(absent.problems.has('harvest.educationLapsed')).toBe(false);
  });
});

describe('the season', () => {
  const SEASONS = [
    {
      species: 'oyster',
      from: { month: 10, day: 15 },
      to: { month: 3, day: 31 },
      wraps: true,
      areas: ['B-12'],
      note: null,
    },
  ];

  it('shuts a species out of its season, on water that is open', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, { seasons: SEASONS });
    expect(answer.problems.has('harvest.outOfSeason')).toBe(true);
    expect(answer.effective).toBe(APPROVED);
  });

  it('opens it again inside the season', () => {
    const record = boat({
      dealer: 'SS-042',
      startedAt: at('2025-11-14 07:00'),
      landedAt: at('2025-11-14 09:00'),
      lot: '20251114-B12-002',
    });
    const answer = ask(record, CHANNEL, {
      seasons: SEASONS,
      underControlAt: at('2025-11-14 12:00'),
    });
    expect(answer.problems.has('harvest.outOfSeason')).toBe(false);
  });

  it('leaves an area the season does not name alone', () => {
    const elsewhere = [{ ...SEASONS[0], areas: ['C-3'] }];
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, { seasons: elsewhere });
    expect(answer.problems.has('harvest.outOfSeason')).toBe(false);
  });

  it('says nothing at all where no season is written', () => {
    expect(ask(boat({ dealer: 'SS-042' }), CHANNEL).problems.has('harvest.outOfSeason')).toBe(
      false,
    );
  });
});

describe('the cull, where somebody measured a sample', () => {
  const VARIANCES = [
    {
      area: 'B-12',
      kind: 'cull size',
      value: 2.5,
      field: 'inches',
      species: 'oyster',
      grantedOn: { year: 2024, month: 1, day: 1 },
      expiresOn: { year: 2026, month: 12, day: 31 },
      reference: null,
    },
  ];

  const shorts = Array.from({ length: 100 }, () => 2.7);

  it('says nothing at all where nobody measured', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL);
    expect(answer.problems.has('cull.overTolerance')).toBe(false);
  });

  it('fails a sample of undersize against the standard size', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, { measurements: shorts });
    expect(answer.problems.has('cull.overTolerance')).toBe(true);
  });

  it('passes the same sample where the area holds a variance', () => {
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, {
      measurements: shorts,
      variances: VARIANCES,
    });
    expect(answer.problems.has('cull.overTolerance')).toBe(false);
  });

  it('does not take a variance granted for another species', () => {
    const clams = [{ ...VARIANCES[0], species: 'hard clam' }];
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, {
      measurements: shorts,
      variances: clams,
    });
    expect(answer.problems.has('cull.overTolerance')).toBe(true);
  });

  it('does not take a variance granted for another area', () => {
    const elsewhere = [{ ...VARIANCES[0], area: 'C-3' }];
    const answer = ask(boat({ dealer: 'SS-042' }), CHANNEL, {
      measurements: shorts,
      variances: elsewhere,
    });
    expect(answer.problems.has('cull.overTolerance')).toBe(true);
  });

  it('passes a sample of market size with or without the variance', () => {
    const market = Array.from({ length: 100 }, () => 3.4);
    expect(
      ask(boat({ dealer: 'SS-042' }), CHANNEL, { measurements: market }).problems.has(
        'cull.overTolerance',
      ),
    ).toBe(false);
  });
});
