import {
  DEPURATED,
  LANDED,
  RECEIVED,
  REPACKED,
  SHIPPED,
  SHUCKED,
  ledger,
  movement,
} from '../../src/trace/ledger.js';
import { parseInstant } from '../../src/time/instant.js';

export const at = (text) => parseInstant(text, { zone: 'eastern' });

/**
 * One week in August. Two lots land, one is shucked and sold on, the other is
 * depurated and shipped out of state. A third lot is repacked twice, which is
 * where a trace usually loses the thread.
 */
export const BOOK = ledger([
  movement({ kind: LANDED, lot: '20250814-B12-001', at: at('2025-08-14 09:45'), containers: 12 }),
  movement({
    kind: RECEIVED,
    lot: '20250814-B12-001',
    at: at('2025-08-14 11:00'),
    dealer: 'SP-118',
    containers: 12,
  }),
  movement({
    kind: SHUCKED,
    lot: '20250814-B12-001',
    becomes: '20250815-B12-101',
    at: at('2025-08-15 07:30'),
    dealer: 'SP-118',
  }),
  movement({
    kind: SHIPPED,
    lot: '20250815-B12-101',
    at: at('2025-08-15 14:00'),
    dealer: 'SP-118',
    toParty: 'Piedmont Fish House',
  }),

  movement({ kind: LANDED, lot: '20250814-D2-001', at: at('2025-08-14 10:15'), containers: 8 }),
  movement({
    kind: RECEIVED,
    lot: '20250814-D2-001',
    at: at('2025-08-14 12:30'),
    dealer: 'DP-003',
    containers: 8,
  }),
  movement({
    kind: DEPURATED,
    lot: '20250814-D2-001',
    at: at('2025-08-16 09:00'),
    dealer: 'DP-003',
  }),
  movement({
    kind: SHIPPED,
    lot: '20250814-D2-001',
    at: at('2025-08-16 15:00'),
    dealer: 'DP-003',
    toParty: 'Chesapeake Wholesale',
  }),

  movement({ kind: LANDED, lot: '20250812-C3-004', at: at('2025-08-12 08:00'), containers: 20 }),
  movement({
    kind: RECEIVED,
    lot: '20250812-C3-004',
    at: at('2025-08-12 10:00'),
    dealer: 'SS-042',
  }),
  movement({
    kind: REPACKED,
    lot: '20250812-C3-004',
    becomes: '20250813-C3-201',
    at: at('2025-08-13 09:00'),
    dealer: 'RP-007',
  }),
  movement({
    kind: REPACKED,
    lot: '20250813-C3-201',
    becomes: '20250814-C3-301',
    at: at('2025-08-14 09:00'),
    dealer: 'RP-007',
  }),
  movement({
    kind: SHIPPED,
    lot: '20250814-C3-301',
    at: at('2025-08-14 16:00'),
    dealer: 'RP-007',
    toParty: 'Coastal Provisions',
  }),
]);
