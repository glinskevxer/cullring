import { describe, expect, it } from 'vitest';

import {
  BAY_SCALLOP,
  FORMS,
  HARD_CLAM,
  OYSTER,
  SHELLSTOCK,
  SHUCKED,
  SPECIES,
  describeHarvest,
  harvestRecord,
  harvestSeconds,
  recordsForArea,
  recordsForHarvester,
  sortRecords,
} from '../../src/harvest/record.js';
import { DREDGE, HAND, TONGS } from '../../src/licence/harvester.js';
import { civilDate } from '../../src/time/civil.js';
import { parseInstant } from '../../src/time/instant.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });

const base = {
  harvester: 'SH-2025-04412',
  bed: 'B12-BCK',
  gear: HAND,
  startedAt: at('2025-08-14 06:30'),
  landedAt: at('2025-08-14 09:45'),
  containers: 12,
};

describe('building a harvest record', () => {
  it('holds both times, because the rules read them separately', () => {
    const one = harvestRecord(base);
    expect(one.startedAt.epochSecond).toBe(at('2025-08-14 06:30').epochSecond);
    expect(one.landedAt.epochSecond).toBe(at('2025-08-14 09:45').epochSecond);
    expect(harvestSeconds(one)).toBe(3 * 3600 + 15 * 60);
  });

  it('reads the area off the bed', () => {
    expect(harvestRecord(base).areaId).toBe('B-12');
  });

  it('works the lot number out from the landing day and the area', () => {
    expect(harvestRecord(base).lot).toBe('20250814-B12-001');
  });

  it('takes a lot number that was already written on the tag', () => {
    expect(harvestRecord({ ...base, lot: '20250814-B12-004' }).lot).toBe('20250814-B12-004');
  });

  it('refuses a lot number naming an area the bed is not in', () => {
    expect(() => harvestRecord({ ...base, lot: '20250814-C3-004' })).toThrow(
      /names an area the bed is not in/,
    );
  });

  it('works the landing day out in the zone it was given', () => {
    const late = harvestRecord({
      ...base,
      startedAt: at('2025-08-14 22:00'),
      landedAt: at('2025-08-14 23:30'),
    });
    expect(late.landedOn).toEqual(civilDate(2025, 8, 14));
    const pacific = harvestRecord({
      ...base,
      startedAt: at('2025-08-14 22:00'),
      landedAt: at('2025-08-14 23:30'),
      zone: 'pacific',
    });
    expect(pacific.landedOn).toEqual(civilDate(2025, 8, 14));
  });

  it('defaults to oysters landed as shellstock and not iced', () => {
    const one = harvestRecord(base);
    expect(one.species).toBe(OYSTER);
    expect(one.form).toBe(SHELLSTOCK);
    expect(one.iced).toBe(false);
  });

  it('takes the other species and the other form', () => {
    expect(harvestRecord({ ...base, species: HARD_CLAM }).species).toBe(HARD_CLAM);
    expect(harvestRecord({ ...base, species: BAY_SCALLOP }).species).toBe(BAY_SCALLOP);
    expect(harvestRecord({ ...base, form: SHUCKED }).form).toBe(SHUCKED);
  });

  it('refuses a species and a form it does not handle, listing both sets', () => {
    try {
      harvestRecord({ ...base, species: 'mussel' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(SPECIES.slice());
    }
    try {
      harvestRecord({ ...base, form: 'frozen' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(FORMS.slice());
    }
  });

  it('refuses a harvest that landed before it started', () => {
    expect(() =>
      harvestRecord({
        ...base,
        startedAt: at('2025-08-14 09:45'),
        landedAt: at('2025-08-14 06:30'),
      }),
    ).toThrow(/cannot land before it started/);
  });

  it('allows a harvest that landed the instant it started', () => {
    expect(harvestSeconds(harvestRecord({ ...base, landedAt: at('2025-08-14 06:30') }))).toBe(0);
  });

  it('refuses times that are not instants', () => {
    expect(() => harvestRecord({ ...base, landedAt: '2025-08-14 09:45' })).toThrow(
      /the moment it started/,
    );
  });

  it('refuses gear that is not gear, and a container count that is not whole', () => {
    expect(() => harvestRecord({ ...base, gear: 'trawl' })).toThrow(/not gear/);
    expect(() => harvestRecord({ ...base, containers: 0 })).toThrow(/at least 1/);
    expect(() => harvestRecord({ ...base, containers: 2.5 })).toThrow(/whole number/);
  });

  it('carries the dealer when there is one, and nothing when there is not', () => {
    expect(harvestRecord({ ...base, dealer: 'sp-118' }).dealer).toBe('SP-118');
    expect(harvestRecord(base).dealer).toBeNull();
  });
});

describe('reading a list of records', () => {
  const one = harvestRecord({ ...base, lot: '20250814-B12-001' });
  const two = harvestRecord({
    ...base,
    lot: '20250814-B12-002',
    gear: TONGS,
    startedAt: at('2025-08-14 05:00'),
    landedAt: at('2025-08-14 07:00'),
  });
  const three = harvestRecord({
    ...base,
    harvester: 'SH-2025-00877',
    bed: 'C3-MSL',
    gear: DREDGE,
    lot: '20250814-C3-001',
  });
  const ALL = [one, two, three];

  it('selects by area', () => {
    expect(recordsForArea(ALL, 'B-12')).toHaveLength(2);
    expect(recordsForArea(ALL, 'C-3')).toHaveLength(1);
  });

  it('selects by harvester', () => {
    expect(recordsForHarvester(ALL, 'sh-2025-00877')).toHaveLength(1);
  });

  it('sorts by the moment the boat landed', () => {
    expect(sortRecords(ALL).map((entry) => entry.lot)[0]).toBe('20250814-B12-002');
  });

  it('describes a record the way the day sheet does', () => {
    expect(describeHarvest(one)).toBe('20250814-B12-001: 12 of oyster off B12-BCK on 2025-08-14');
  });
});
