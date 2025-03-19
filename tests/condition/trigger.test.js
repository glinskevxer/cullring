import { describe, expect, it } from 'vitest';

import {
  BYPASS,
  RAINFALL,
  SEASON,
  STAGE_CROSSING,
  TRIGGER_KINDS,
  bypassTrigger,
  evaluateTrigger,
  rainfallTrigger,
  seasonTrigger,
  stageTrigger,
} from '../../src/condition/trigger.js';
import { reading } from '../../src/weather/gauge.js';
import { parseInstant } from '../../src/time/instant.js';
import { civilDate } from '../../src/time/civil.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });

const READINGS = [
  reading({ gauge: 'BRD', at: at('2025-06-09 20:00'), value: 0.9 }),
  reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 0.6 }),
  reading({ gauge: 'BRD', at: at('2025-06-10 05:00'), value: 0.4 }),
  reading({ gauge: 'MLC', at: at('2025-06-10 05:00'), value: 0.2 }),
  reading({ gauge: 'PPR', at: at('2025-06-10 04:00'), value: 8.4 }),
];

const BYPASSES = [
  { facility: 'WWTP-3', at: at('2025-06-10 03:00'), note: 'wet weather' },
  { facility: 'WWTP-9', at: at('2025-06-01 03:00'), note: 'power' },
];

describe('building a trigger', () => {
  it('names the four kinds', () => {
    expect(TRIGGER_KINDS).toEqual([RAINFALL, STAGE_CROSSING, BYPASS, SEASON]);
  });

  it('normalises the gauge and the facility', () => {
    expect(rainfallTrigger({ gauge: ' brd ', inches: 1, overHours: 24 }).gauge).toBe('BRD');
    expect(bypassTrigger({ facility: ' wwtp-3 ' }).facility).toBe('WWTP-3');
  });

  it('refuses a threshold that is not a positive number', () => {
    expect(() => rainfallTrigger({ gauge: 'BRD', inches: 0, overHours: 24 })).toThrow(/positive/);
    expect(() => stageTrigger({ gauge: 'PPR', feet: -1 })).toThrow(/positive/);
    expect(() => bypassTrigger({ facility: 'WWTP-3', withinHours: 0 })).toThrow(/positive/);
  });

  it('refuses a trigger with no gauge at all', () => {
    expect(() => rainfallTrigger({ inches: 1, overHours: 24 })).toThrow(/gauge/);
  });

  it('reads a season written as dates or as civil dates', () => {
    expect(seasonTrigger({ from: '2025-05-15', to: '2025-09-15' }).from).toEqual(
      civilDate(2025, 5, 15),
    );
    expect(seasonTrigger({ from: civilDate(2025, 5, 15), to: civilDate(2025, 9, 15) }).to).toEqual(
      civilDate(2025, 9, 15),
    );
  });
});

describe('a rainfall trigger', () => {
  const trigger = rainfallTrigger({ gauge: 'BRD', inches: 1, overHours: 24 });

  it('totals the window ending at the moment asked about', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-06-10 06:00'), readings: READINGS });
    expect(answer.measured).toBeCloseTo(1.9, 9);
    expect(answer.fired).toBe(true);
    expect(answer.unit).toBe('inches');
  });

  it('does not fire on rain that fell before the window', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-06-11 06:00'), readings: READINGS });
    expect(answer.measured).toBe(0);
    expect(answer.fired).toBe(false);
  });

  it('fires exactly at the threshold and not a hundredth below it', () => {
    const tight = rainfallTrigger({ gauge: 'BRD', inches: 1.9, overHours: 24 });
    const tighter = rainfallTrigger({ gauge: 'BRD', inches: 1.91, overHours: 24 });
    const moment = { at: at('2025-06-10 06:00'), readings: READINGS };
    expect(evaluateTrigger(tight, moment).fired).toBe(true);
    expect(evaluateTrigger(tighter, moment).fired).toBe(false);
  });

  it('reads only its own gauge, so two areas disagree about one storm', () => {
    const other = rainfallTrigger({ gauge: 'MLC', inches: 1, overHours: 24 });
    const moment = { at: at('2025-06-10 06:00'), readings: READINGS };
    expect(evaluateTrigger(trigger, moment).fired).toBe(true);
    expect(evaluateTrigger(other, moment).fired).toBe(false);
  });

  it('reads a shorter window as a different question', () => {
    const short = rainfallTrigger({ gauge: 'BRD', inches: 1, overHours: 3 });
    const answer = evaluateTrigger(short, { at: at('2025-06-10 06:00'), readings: READINGS });
    expect(answer.measured).toBeCloseTo(0.4, 9);
  });
});

describe('a stage trigger', () => {
  const trigger = stageTrigger({ gauge: 'PPR', feet: 8 });

  it('fires on the peak in the window', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-06-10 06:00'), readings: READINGS });
    expect(answer.measured).toBe(8.4);
    expect(answer.fired).toBe(true);
    expect(answer.cited.value).toBe(8.4);
  });

  it('does not fire when the gauge was never read, and says so', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-07-01 06:00'), readings: READINGS });
    expect(answer.fired).toBe(false);
    expect(answer.measured).toBeNull();
    expect(answer.unmeasured).toBe(true);
  });

  it('peaks rather than totals, which a rain trigger would not', () => {
    const twice = [
      reading({ gauge: 'PPR', at: at('2025-06-10 01:00'), value: 5 }),
      reading({ gauge: 'PPR', at: at('2025-06-10 02:00'), value: 5 }),
    ];
    const answer = evaluateTrigger(trigger, { at: at('2025-06-10 06:00'), readings: twice });
    expect(answer.measured).toBe(5);
  });
});

describe('a bypass trigger', () => {
  const trigger = bypassTrigger({ facility: 'WWTP-3', withinHours: 48 });

  it('fires when the named facility reported inside the window', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-06-10 06:00'), bypasses: BYPASSES });
    expect(answer.fired).toBe(true);
    expect(answer.measured).toBe(1);
    expect(answer.cited.note).toBe('wet weather');
  });

  it('ignores another facility entirely', () => {
    const other = bypassTrigger({ facility: 'WWTP-9', withinHours: 48 });
    const answer = evaluateTrigger(other, { at: at('2025-06-10 06:00'), bypasses: BYPASSES });
    expect(answer.fired).toBe(false);
  });

  it('stops firing once the window has moved past the report', () => {
    const answer = evaluateTrigger(trigger, { at: at('2025-06-13 06:00'), bypasses: BYPASSES });
    expect(answer.fired).toBe(false);
    expect(answer.cited).toBeNull();
  });
});

describe('a season trigger', () => {
  const trigger = seasonTrigger({ from: '2025-05-15', to: '2025-09-15' });

  it('fires inside the season and on both ends of it', () => {
    for (const day of ['2025-05-15', '2025-07-01', '2025-09-15']) {
      expect(evaluateTrigger(trigger, { at: at(`${day} 12:00`) }).fired).toBe(true);
    }
  });

  it('does not fire outside it', () => {
    for (const day of ['2025-05-14', '2025-09-16']) {
      expect(evaluateTrigger(trigger, { at: at(`${day} 12:00`) }).fired).toBe(false);
    }
  });

  it('reads the calendar in the zone it was given, not the machine zone', () => {
    const late = at('2025-05-15 00:30');
    expect(evaluateTrigger(trigger, { at: late, zone: 'eastern' }).fired).toBe(true);
    expect(evaluateTrigger(trigger, { at: late, zone: 'pacific' }).fired).toBe(false);
  });

  it('reads no gauge at all', () => {
    expect(evaluateTrigger(trigger, { at: at('2025-07-01 12:00') }).span).toBeNull();
  });
});

describe('an unknown trigger', () => {
  it('is refused rather than treated as never firing', () => {
    expect(() => evaluateTrigger({ kind: 'moon phase' }, { at: at('2025-07-01 12:00') })).toThrow(
      /not a trigger this program keeps/,
    );
  });
});
