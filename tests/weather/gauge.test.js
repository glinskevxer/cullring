import { describe, expect, it } from 'vitest';

import {
  GAUGE_KINDS,
  RAIN,
  STAGE,
  accumulation,
  gauge,
  gaugeIds,
  latestBefore,
  peak,
  peakReading,
  reading,
  readingsFor,
  readingsWithin,
  trailing,
  trailingAccumulation,
  trailingPeak,
  trailingPeakReading,
} from '../../src/weather/gauge.js';
import { parseInstant } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });
const span = (from, to) => window(at(from), at(to));

const FEED = [
  reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 0.4 }),
  reading({ gauge: 'BRD', at: at('2025-06-10 05:00'), value: 0.9 }),
  reading({ gauge: 'BRD', at: at('2025-06-10 08:00'), value: 0.3 }),
  reading({ gauge: 'BRD', at: at('2025-06-11 02:00'), value: 1.1 }),
  reading({ gauge: 'MLC', at: at('2025-06-10 05:00'), value: 0.1 }),
  reading({ gauge: 'MLC', at: at('2025-06-10 07:00'), value: 0.2 }),
];

describe('describing a gauge', () => {
  it('holds its identity and normalises the number', () => {
    expect(gauge({ id: ' brd ', kind: RAIN })).toMatchObject({ id: 'BRD', kind: RAIN });
  });

  it('refuses a kind it does not know and lists both', () => {
    try {
      gauge({ id: 'BRD', kind: 'tide' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(GAUGE_KINDS.slice());
    }
  });

  it('refuses a gauge with no number', () => {
    expect(() => gauge({ id: '', kind: RAIN })).toThrow(/gauge id/);
  });
});

describe('a reading', () => {
  it('takes an instant or a written stamp with a zone', () => {
    const one = reading({ gauge: 'BRD', at: '2025-06-10 02:00', value: 0.4, zone: 'eastern' });
    expect(one.at.epochSecond).toBe(at('2025-06-10 02:00').epochSecond);
  });

  it('refuses a negative value, because no gauge reads below zero', () => {
    expect(() => reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: -1 })).toThrow(
      /at least zero/,
    );
  });

  it('allows zero, because a rain gauge reporting nothing is a reading', () => {
    expect(reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 0 }).value).toBe(0);
  });
});

describe('selecting readings', () => {
  it('takes only the gauge asked for, in time order', () => {
    const list = readingsFor(FEED, 'brd');
    expect(list).toHaveLength(4);
    expect(list.map((entry) => entry.value)).toEqual([0.4, 0.9, 0.3, 1.1]);
  });

  it('takes only the readings inside the window, half open at the end', () => {
    const list = readingsWithin(
      readingsFor(FEED, 'BRD'),
      span('2025-06-10 02:00', '2025-06-10 08:00'),
    );
    expect(list.map((entry) => entry.value)).toEqual([0.4, 0.9]);
  });

  it('lists the gauges a feed carries, in order', () => {
    expect(gaugeIds(FEED)).toEqual(['BRD', 'MLC']);
  });
});

describe('accumulation, which a rain trigger reads', () => {
  it('totals the window', () => {
    expect(accumulation(FEED, 'BRD', span('2025-06-10 00:00', '2025-06-10 12:00'))).toBeCloseTo(
      1.6,
      9,
    );
  });

  it('does not reach across the window ends', () => {
    expect(accumulation(FEED, 'BRD', span('2025-06-10 03:00', '2025-06-10 06:00'))).toBeCloseTo(
      0.9,
      9,
    );
  });

  it('totals a gauge with nothing in the window as zero', () => {
    expect(accumulation(FEED, 'MLC', span('2025-06-11 00:00', '2025-06-12 00:00'))).toBe(0);
  });

  it('never mixes two gauges', () => {
    const both = accumulation(FEED, 'BRD', span('2025-06-10 00:00', '2025-06-10 12:00'));
    const one = accumulation(FEED, 'MLC', span('2025-06-10 00:00', '2025-06-10 12:00'));
    expect(one).toBeCloseTo(0.3, 9);
    expect(both).not.toBeCloseTo(both + one, 9);
  });
});

describe('peak, which a stage trigger reads', () => {
  it('takes the highest reading in the window', () => {
    expect(peak(FEED, 'BRD', span('2025-06-10 00:00', '2025-06-11 12:00'))).toBe(1.1);
  });

  it('answers with nothing when nobody measured, rather than with zero', () => {
    expect(peak(FEED, 'MLC', span('2025-06-11 00:00', '2025-06-12 00:00'))).toBeNull();
    expect(accumulation(FEED, 'MLC', span('2025-06-11 00:00', '2025-06-12 00:00'))).toBe(0);
  });

  it('names the reading that carried the peak', () => {
    const found = peakReading(FEED, 'BRD', span('2025-06-10 00:00', '2025-06-11 12:00'));
    expect(found.value).toBe(1.1);
    expect(found.at.epochSecond).toBe(at('2025-06-11 02:00').epochSecond);
  });

  it('has no peak reading either where there is nothing', () => {
    expect(peakReading(FEED, 'MLC', span('2025-06-11 00:00', '2025-06-12 00:00'))).toBeNull();
  });
});

describe('the last reading before a moment', () => {
  it('finds it, and includes a reading exactly on the moment', () => {
    expect(latestBefore(FEED, 'BRD', at('2025-06-10 08:00')).value).toBe(0.3);
    expect(latestBefore(FEED, 'BRD', at('2025-06-10 07:59')).value).toBe(0.9);
  });

  it('answers with nothing before the record starts', () => {
    expect(latestBefore(FEED, 'BRD', at('2025-06-09 00:00'))).toBeNull();
  });

  it('is asked per gauge, never across them', () => {
    expect(latestBefore(FEED, 'MLC', at('2025-06-11 00:00')).value).toBe(0.2);
  });
});

describe('the two kinds are read differently on purpose', () => {
  it('gives a rain gauge a total and a stage gauge a peak', () => {
    expect(gauge({ id: 'BRD', kind: RAIN }).kind).toBe(RAIN);
    expect(gauge({ id: 'PPR', kind: STAGE }).kind).toBe(STAGE);
    const quiet = span('2025-07-01 00:00', '2025-07-02 00:00');
    expect(accumulation(FEED, 'BRD', quiet)).toBe(0);
    expect(peak(FEED, 'BRD', quiet)).toBeNull();
  });
});

describe('the trailing period, which is closed at the near end', () => {
  it('counts a reading taken at the very moment asked about', () => {
    const total = trailingAccumulation(FEED, 'BRD', at('2025-06-10 05:00'), 24 * 3600);
    expect(total).toBeCloseTo(1.3, 9);
  });

  it('is what the ordinary window would have missed', () => {
    const window24 = span('2025-06-09 05:00', '2025-06-10 05:00');
    expect(accumulation(FEED, 'BRD', window24)).toBeCloseTo(0.4, 9);
    expect(trailingAccumulation(FEED, 'BRD', at('2025-06-10 05:00'), 24 * 3600)).toBeCloseTo(
      1.3,
      9,
    );
  });

  it('excludes a reading exactly at the far end, so two periods cannot both claim it', () => {
    const total = trailingAccumulation(FEED, 'BRD', at('2025-06-11 02:00'), 24 * 3600);
    expect(total).toBeCloseTo(2.3, 9);
  });

  it('peaks the same period, and answers with nothing where nobody looked', () => {
    expect(trailingPeak(FEED, 'BRD', at('2025-06-11 02:00'), 24 * 3600)).toBe(1.1);
    expect(trailingPeak(FEED, 'BRD', at('2025-07-01 04:00'), 24 * 3600)).toBeNull();
    expect(trailingPeakReading(FEED, 'BRD', at('2025-07-01 04:00'), 24 * 3600)).toBeNull();
  });

  it('names the reading that carried the peak', () => {
    const found = trailingPeakReading(FEED, 'BRD', at('2025-06-10 05:00'), 24 * 3600);
    expect(found.value).toBe(0.9);
  });

  it('reads only its own gauge', () => {
    expect(trailing(FEED, 'MLC', at('2025-06-10 05:00'), 24 * 3600)).toHaveLength(1);
  });
});
