import { harvestRecord } from '../../src/harvest/record.js';
import { AREAS, JUNE_FIRST, PLANS, STORM } from './register.js';
import { CHANNEL, FLAT, TIDES, at } from './water.js';
import { DEALERS, HARVESTERS, LEASED_BED, OUTFALL_BED } from './people.js';

export const BEDS = [CHANNEL, FLAT, LEASED_BED, OUTFALL_BED];

export const CONTEXT = {
  areas: AREAS,
  plans: PLANS,
  feed: STORM,
  harvesters: HARVESTERS,
  dealers: DEALERS,
  tides: TIDES,
  from: JUNE_FIRST,
};

/** A boat lot off the channel, lawful in every respect. */
export const CLEAN_LOT = harvestRecord({
  lot: '20250814-B12-002',
  harvester: 'SH-2025-00877',
  bed: 'B12-CHN',
  gear: 'tongs',
  startedAt: at('2025-08-14 07:00'),
  landedAt: at('2025-08-14 09:45'),
  containers: 14,
  dealer: 'SS-042',
});

/** A wading lot off the flat, whose clock started with the tide. */
export const WADED_LOT = harvestRecord({
  lot: '20250814-B12-001',
  harvester: 'SH-2025-04412',
  bed: 'B12-BCK',
  gear: 'hand',
  startedAt: at('2025-08-14 07:00'),
  landedAt: at('2025-08-14 09:45'),
  containers: 12,
  dealer: 'SS-042',
});

/** Restricted water into a dealer who cannot treat it. */
export const RESTRICTED_LOT = harvestRecord({
  lot: '20250814-D2-001',
  harvester: 'SH-2025-04412',
  bed: 'D2-TGB',
  gear: 'rake',
  startedAt: at('2025-08-14 06:30'),
  landedAt: at('2025-08-14 09:00'),
  containers: 6,
  dealer: 'SS-042',
});

export const DAY = [CLEAN_LOT, WADED_LOT, RESTRICTED_LOT];

export const UNDER_CONTROL = new Map([
  ['20250814-B12-002', at('2025-08-14 12:00')],
  ['20250814-B12-001', at('2025-08-14 12:00')],
  ['20250814-D2-001', at('2025-08-14 20:00')],
]);
