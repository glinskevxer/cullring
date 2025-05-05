import { bed } from '../../src/harvest/bed.js';
import { harvestRecord } from '../../src/harvest/record.js';
import { HAND, TONGS } from '../../src/licence/harvester.js';
import { HIGH, LOW, extreme } from '../../src/tide/table.js';
import { parseInstant } from '../../src/time/instant.js';

export const at = (text) => parseInstant(text, { zone: 'eastern' });

/** A flat that comes out of the water on every falling tide. */
export const FLAT = bed({
  id: 'B12-BCK',
  name: 'Broad Creek flat',
  tideStation: 'BFT',
  elevation: 1.8,
  acres: 22,
});

/** Ground in the channel that never comes up. */
export const CHANNEL = bed({
  id: 'B12-CHN',
  name: 'the channel edge',
  tideStation: 'BFT',
  elevation: -1.2,
});

/** A bed whose tide station this table does not predict. */
export const UNPREDICTED = bed({
  id: 'C3-MSL',
  name: 'Middle Sound lease',
  tideStation: 'ZZZ',
  elevation: 1.4,
});

/** One August day at Beaufort: two highs and two lows. */
export const TIDES = [
  extreme({ station: 'BFT', at: at('2025-08-14 02:12'), kind: HIGH, height: 3.4 }),
  extreme({ station: 'BFT', at: at('2025-08-14 08:30'), kind: LOW, height: 0.2 }),
  extreme({ station: 'BFT', at: at('2025-08-14 14:44'), kind: HIGH, height: 3.6 }),
  extreme({ station: 'BFT', at: at('2025-08-14 21:02'), kind: LOW, height: 0.1 }),
];

const base = {
  harvester: 'SH-2025-04412',
  bed: 'B12-BCK',
  containers: 12,
};

/** A wading harvest on the flat, picked up well after the tide dropped it. */
export const waded = (extra = {}) =>
  harvestRecord({
    ...base,
    gear: HAND,
    startedAt: at('2025-08-14 07:00'),
    landedAt: at('2025-08-14 09:45'),
    ...extra,
  });

/** The same morning worked from a boat over the channel. */
export const tonged = (extra = {}) =>
  harvestRecord({
    ...base,
    bed: 'B12-CHN',
    lot: '20250814-B12-002',
    gear: TONGS,
    startedAt: at('2025-08-14 07:00'),
    landedAt: at('2025-08-14 09:45'),
    ...extra,
  });
