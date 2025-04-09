import { describe, expect, it } from 'vitest';

import {
  candidateMoments,
  closureHistory,
  earliestReopening,
  firingMoments,
  stateAt,
} from '../../src/condition/closure.js';
import { managementPlan } from '../../src/condition/plan.js';
import { afterHours, afterSamples, afterTides, onDate } from '../../src/condition/reopening.js';
import { rainfallTrigger, seasonTrigger } from '../../src/condition/trigger.js';
import { reading } from '../../src/weather/gauge.js';
import { parseInstant, toStoredForm } from '../../src/time/instant.js';
import { window } from '../../src/time/window.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });
const stamp = (point) => (point === null ? null : toStoredForm('eastern', point));
const JUNE = window(at('2025-06-01 00:00'), at('2025-06-30 00:00'));
const rain = rainfallTrigger({ gauge: 'BRD', inches: 1, overHours: 24 });

const plan = (reopening, area = 'B-12') =>
  managementPlan({ area, trigger: rain, reopening, effectiveFrom: '2025-01-01' });

const ONE_STORM = {
  readings: [reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 1.2 })],
};

const TWO_STORMS = {
  readings: [
    reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 1.2 }),
    reading({ gauge: 'BRD', at: at('2025-06-11 06:00'), value: 1.4 }),
  ],
};

describe('the moments worth asking about', () => {
  it('takes every reading, and both ends of the span', () => {
    const points = candidateMoments(plan(afterHours(72)), TWO_STORMS, JUNE);
    expect(points.map(stamp)).toContain('2025-06-10T02:00:00-04:00');
    expect(points[0].epochSecond).toBe(JUNE.start.epochSecond);
    expect(points[points.length - 1].epochSecond).toBe(JUNE.end.epochSecond);
  });

  it('drops readings outside the span', () => {
    const outside = { readings: [reading({ gauge: 'BRD', at: at('2025-05-01 02:00'), value: 9 })] };
    expect(candidateMoments(plan(afterHours(72)), outside, JUNE)).toHaveLength(2);
  });

  it('holds no duplicates', () => {
    const twice = {
      readings: [
        reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 0.6 }),
        reading({ gauge: 'MLC', at: at('2025-06-10 02:00'), value: 0.6 }),
      ],
    };
    const points = candidateMoments(plan(afterHours(72)), twice, JUNE);
    expect(new Set(points.map((point) => point.epochSecond)).size).toBe(points.length);
  });

  it('adds a moment a day for a season trigger, which no reading would give it', () => {
    const seasonal = managementPlan({
      area: 'C-3',
      trigger: seasonTrigger({ from: '2025-06-05', to: '2025-06-09' }),
      reopening: onDate('2025-06-10'),
      effectiveFrom: '2025-01-01',
    });
    expect(candidateMoments(seasonal, {}, JUNE).length).toBeGreaterThan(28);
  });
});

describe('when a closure could first lift', () => {
  it('works an hours rule out from the closure start', () => {
    expect(stamp(earliestReopening(plan(afterHours(72)), at('2025-06-10 02:00')))).toBe(
      '2025-06-13T02:00:00-04:00',
    );
  });

  it('works a fixed date out from the calendar', () => {
    expect(stamp(earliestReopening(plan(onDate('2025-09-16')), at('2025-06-10 02:00')))).toBe(
      '2025-09-16T00:00:00-04:00',
    );
  });

  it('cannot work a sample or a tide rule out at all, and says so', () => {
    expect(earliestReopening(plan(afterSamples(2)), at('2025-06-10 02:00'))).toBeNull();
    expect(earliestReopening(plan(afterTides(1)), at('2025-06-10 02:00'))).toBeNull();
  });
});

describe('walking one storm', () => {
  it('closes at the reading that crossed the trigger', () => {
    const [closure] = closureHistory(plan(afterHours(72)), ONE_STORM, JUNE);
    expect(stamp(closure.start)).toBe('2025-06-10T02:00:00-04:00');
  });

  it('reopens exactly when the hours have run', () => {
    const [closure] = closureHistory(plan(afterHours(72)), ONE_STORM, JUNE);
    expect(stamp(closure.end)).toBe('2025-06-13T02:00:00-04:00');
    expect(closure.open).toBe(false);
    expect(closure.reopenedBy.met).toBe(true);
  });

  it('cites the number the closure notice has to carry', () => {
    const [closure] = closureHistory(plan(afterHours(72)), ONE_STORM, JUNE);
    expect(closure.firedBy.measured).toBeCloseTo(1.2, 9);
    expect(closure.firedBy.threshold).toBe(1);
    expect(closure.firedBy.gauge).toBe('BRD');
  });

  it('produces one closure and no more', () => {
    expect(closureHistory(plan(afterHours(72)), ONE_STORM, JUNE)).toHaveLength(1);
  });
});

describe('a second storm restarts the clock rather than starting a closure', () => {
  it('keeps one closure and counts the restart', () => {
    const closures = closureHistory(plan(afterHours(72)), TWO_STORMS, JUNE);
    expect(closures).toHaveLength(1);
    expect(closures[0].restarts).toBe(1);
  });

  it('moves the start to the later storm, which is what the rule means', () => {
    const [closure] = closureHistory(plan(afterHours(72)), TWO_STORMS, JUNE);
    expect(stamp(closure.start)).toBe('2025-06-11T06:00:00-04:00');
    expect(stamp(closure.end)).toBe('2025-06-14T06:00:00-04:00');
  });

  it('holds the area shut for longer than one storm would have', () => {
    const [one] = closureHistory(plan(afterHours(72)), ONE_STORM, JUNE);
    const [two] = closureHistory(plan(afterHours(72)), TWO_STORMS, JUNE);
    expect(two.end.epochSecond).toBeGreaterThan(one.end.epochSecond);
  });
});

describe('a reopening counted in samples', () => {
  const feed = {
    ...TWO_STORMS,
    samples: [
      { at: at('2025-06-09 09:00'), conforming: true },
      { at: at('2025-06-12 09:00'), conforming: true },
      { at: at('2025-06-13 09:00'), conforming: false },
      { at: at('2025-06-15 09:00'), conforming: true },
    ],
  };

  it('does not count a sample taken before the closure began', () => {
    const [closure] = closureHistory(plan(afterSamples(2)), feed, JUNE);
    expect(stamp(closure.end)).toBe('2025-06-15T09:00:00-04:00');
  });

  it('does not count a sample that did not conform', () => {
    const [closure] = closureHistory(plan(afterSamples(2)), feed, JUNE);
    expect(stamp(closure.end)).not.toBe('2025-06-13T09:00:00-04:00');
  });

  it('reopens on the sample that completes the count', () => {
    const [closure] = closureHistory(plan(afterSamples(1)), feed, JUNE);
    expect(stamp(closure.end)).toBe('2025-06-12T09:00:00-04:00');
  });

  it('leaves the closure open where the samples never arrive', () => {
    const [closure] = closureHistory(plan(afterSamples(4)), feed, JUNE);
    expect(closure.open).toBe(true);
    expect(closure.end).toBeNull();
    expect(closure.span).toBeNull();
  });
});

describe('a reopening counted in tides', () => {
  it('counts only the tides that turned after the closure started', () => {
    const feed = {
      ...ONE_STORM,
      tides: [at('2025-06-09 22:00'), at('2025-06-10 10:00'), at('2025-06-10 22:00')],
    };
    const [closure] = closureHistory(plan(afterTides(2)), feed, JUNE);
    expect(stamp(closure.end)).toBe('2025-06-10T22:00:00-04:00');
  });
});

describe('asking about one moment', () => {
  const held = plan(afterHours(72));

  it('says the area was shut in the middle of a closure', () => {
    const answer = stateAt(held, ONE_STORM, at('2025-06-11 08:00'), {
      from: at('2025-06-01 00:00'),
    });
    expect(answer.closed).toBe(true);
    expect(answer.area).toBe('B-12');
    expect(stamp(answer.closure.start)).toBe('2025-06-10T02:00:00-04:00');
  });

  it('says it was open before the storm and after the closure lifted', () => {
    for (const moment of ['2025-06-09 08:00', '2025-06-14 08:00']) {
      const answer = stateAt(held, ONE_STORM, at(moment), { from: at('2025-06-01 00:00') });
      expect(answer.closed).toBe(false);
      expect(answer.closure).toBeNull();
    }
  });

  it('is shut at the instant the closure starts and open at the instant it lifts', () => {
    const shut = stateAt(held, ONE_STORM, at('2025-06-10 02:00'), { from: at('2025-06-01 00:00') });
    const lifted = stateAt(held, ONE_STORM, at('2025-06-13 02:00'), {
      from: at('2025-06-01 00:00'),
    });
    expect(shut.closed).toBe(true);
    expect(lifted.closed).toBe(false);
  });

  it('hands back the closures it walked, so a report need not walk them again', () => {
    const answer = stateAt(held, TWO_STORMS, at('2025-06-20 08:00'), {
      from: at('2025-06-01 00:00'),
    });
    expect(answer.closures).toHaveLength(1);
  });
});

describe('the trigger is only asked where its own instrument reported', () => {
  it('lists the gauge readings for a rainfall plan and nothing else', () => {
    const feed = {
      ...ONE_STORM,
      tides: [at('2025-06-10 10:00')],
      samples: [{ at: at('2025-06-10 12:00'), conforming: true }],
    };
    const firing = firingMoments(plan(afterHours(72)), feed, JUNE);
    expect(firing.map(stamp)).toEqual(['2025-06-10T02:00:00-04:00']);
    expect(candidateMoments(plan(afterHours(72)), feed, JUNE).length).toBeGreaterThan(
      firing.length,
    );
  });

  it('ignores a reading from a gauge the plan does not name', () => {
    const feed = {
      readings: [
        reading({ gauge: 'BRD', at: at('2025-06-10 02:00'), value: 1.2 }),
        reading({ gauge: 'MLC', at: at('2025-06-10 09:00'), value: 4 }),
      ],
    };
    expect(firingMoments(plan(afterHours(72)), feed, JUNE)).toHaveLength(1);
  });

  it('does not restart a closure on a tide or a laboratory result', () => {
    const feed = {
      ...ONE_STORM,
      tides: [at('2025-06-10 10:00'), at('2025-06-10 22:00')],
      samples: [{ at: at('2025-06-11 09:00'), conforming: true }],
    };
    const [closure] = closureHistory(plan(afterHours(72)), feed, JUNE);
    expect(closure.restarts).toBe(0);
    expect(stamp(closure.end)).toBe('2025-06-13T02:00:00-04:00');
  });

  it('still restarts on a later reading that keeps the total over the line', () => {
    const [closure] = closureHistory(plan(afterHours(72)), TWO_STORMS, JUNE);
    expect(closure.restarts).toBe(1);
  });

  it('lists the day boundaries for a season plan, since the calendar is its instrument', () => {
    const seasonal = managementPlan({
      area: 'C-3',
      trigger: seasonTrigger({ from: '2025-06-05', to: '2025-06-09' }),
      reopening: onDate('2025-06-10'),
      effectiveFrom: '2025-01-01',
    });
    expect(firingMoments(seasonal, {}, JUNE).length).toBeGreaterThan(28);
  });

  it('lists nothing for a bypass plan whose facility never reported', () => {
    const bypassPlan = managementPlan({
      area: 'D-1',
      trigger: { kind: 'bypass', facility: 'WWTP-3', withinHours: 48 },
      reopening: afterHours(24),
      effectiveFrom: '2025-01-01',
    });
    const feed = { bypasses: [{ facility: 'WWTP-9', at: at('2025-06-10 03:00') }] };
    expect(firingMoments(bypassPlan, feed, JUNE)).toEqual([]);
    expect(closureHistory(bypassPlan, feed, JUNE)).toEqual([]);
  });
});
