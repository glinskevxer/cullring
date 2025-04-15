import { classificationPeriod, growingArea } from '../../src/area/growingArea.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  CONDITIONALLY_RESTRICTED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';
import { managementPlan } from '../../src/condition/plan.js';
import { afterHours, afterSamples } from '../../src/condition/reopening.js';
import { rainfallTrigger } from '../../src/condition/trigger.js';
import { reading } from '../../src/weather/gauge.js';
import { parseInstant } from '../../src/time/instant.js';

export const at = (text) => parseInstant(text, { zone: 'eastern' });

/** Plainly approved all the way through. */
export const C3 = growingArea({
  id: 'C-3',
  name: 'Middle Sound',
  acres: 980,
  history: [classificationPeriod({ classification: APPROVED, from: '2015-01-01' })],
});

/** Conditionally approved, and the one the storms are written for. */
export const B12 = growingArea({
  id: 'B-12',
  name: 'Broad Creek',
  acres: 412,
  history: [
    classificationPeriod({ classification: APPROVED, from: '2018-01-01', to: '2021-12-31' }),
    classificationPeriod({ classification: CONDITIONALLY_APPROVED, from: '2022-01-01' }),
  ],
});

/** Conditionally restricted, which falls to restricted rather than to approved. */
export const B14 = growingArea({
  id: 'B-14',
  name: 'Cedar Bay',
  history: [classificationPeriod({ classification: CONDITIONALLY_RESTRICTED, from: '2019-01-01' })],
});

/** Restricted outright, so relay or depuration and nothing else. */
export const D2 = growingArea({
  id: 'D-2',
  name: 'Turnagain Bight',
  history: [classificationPeriod({ classification: RESTRICTED, from: '2020-01-01' })],
});

/** Prohibited outright, next to the outfall. */
export const D9 = growingArea({
  id: 'D-9',
  name: 'Outfall Reach',
  history: [classificationPeriod({ classification: PROHIBITED, from: '2005-01-01' })],
});

export const AREAS = [B12, B14, C3, D2, D9];

export const B12_PLAN = managementPlan({
  area: 'B-12',
  trigger: rainfallTrigger({ gauge: 'BRD', inches: 1, overHours: 24 }),
  reopening: afterHours(72),
  effectiveFrom: '2022-01-01',
  reference: '15A NCAC 18A .0910',
});

export const B14_PLAN = managementPlan({
  area: 'B-14',
  trigger: rainfallTrigger({ gauge: 'MLC', inches: 0.75, overHours: 24 }),
  reopening: afterSamples(2),
  effectiveFrom: '2019-01-01',
});

export const PLANS = [B12_PLAN, B14_PLAN];

/** One inch and a bit on BRD in the small hours of the tenth of June. */
export const STORM = {
  readings: [
    reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 1.2 }),
    reading({ gauge: 'MLC', at: at('2025-06-10 02:00'), value: 0.3 }),
  ],
};

export const JUNE_FIRST = at('2025-06-01 00:00');
