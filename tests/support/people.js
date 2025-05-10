import { dealer } from '../../src/licence/dealer.js';
import { DREDGE, HAND, RAKE, TONGS, harvester, suspension } from '../../src/licence/harvester.js';
import { LEASE, bed } from '../../src/harvest/bed.js';

/** Wades the flats. Endorsed for the two gears that work on foot. */
export const WADE = harvester({
  id: 'SH-2025-04412',
  name: 'Wade Ollis',
  gears: [HAND, RAKE],
  issuedOn: '2025-01-01',
  expiresOn: '2025-12-31',
});

/** Works from a boat, and was suspended for the month of July. */
export const DELLA = harvester({
  id: 'SH-2025-00877',
  name: 'Della Pruitt',
  gears: [TONGS, DREDGE],
  issuedOn: '2025-01-01',
  expiresOn: '2025-12-31',
  suspensions: [suspension({ from: '2025-07-01', to: '2025-07-31', reason: 'untagged lot' })],
});

/** Licence ran out at the end of April. */
export const LAPSED = harvester({
  id: 'SH-2024-03310',
  name: 'Roscoe Gaskill',
  gears: [TONGS],
  issuedOn: '2024-05-01',
  expiresOn: '2025-04-30',
});

export const HARVESTERS = [WADE, DELLA, LAPSED];

const dates = { certifiedOn: '2025-01-01', expiresOn: '2025-12-31' };

export const SHIPPER = dealer({ id: 'SS-042', name: 'Beaufort Oyster', ...dates });
export const SHUCKER = dealer({ id: 'SP-118', name: 'Core Sound Packing', ...dates });
export const DEPURATOR = dealer({ id: 'DP-003', name: 'Newport River Depuration', ...dates });
export const LAPSED_DEALER = dealer({
  id: 'SS-099',
  name: 'Gone Concern',
  certifiedOn: '2024-01-01',
  expiresOn: '2024-12-31',
});

export const DEALERS = [SHIPPER, SHUCKER, DEPURATOR, LAPSED_DEALER];

/** A lease of Wade's on the restricted side of the sound. */
export const LEASED_BED = bed({
  id: 'D2-TGB',
  name: 'Turnagain lease',
  tideStation: 'BFT',
  elevation: 0.6,
  tenure: LEASE,
  holder: 'SH-2025-04412',
});

/** Public bottom in the prohibited water by the outfall. */
export const OUTFALL_BED = bed({
  id: 'D9-OFL',
  name: 'Outfall Reach bottom',
  tideStation: 'BFT',
  elevation: -0.5,
});
