import { describe, expect, it } from 'vitest';

import {
  closedSeconds,
  closedShare,
  closureNotices,
  renderClosureHistory,
  renderNotice,
} from '../../src/report/closure.js';
import { B12, B12_PLAN, C3, JUNE_FIRST, STORM, at } from '../support/register.js';
import { reading } from '../../src/weather/gauge.js';
import { window } from '../../src/time/window.js';

const JUNE = window(JUNE_FIRST, at('2025-06-30 00:00'));
const notices = closureNotices({ area: B12, plan: B12_PLAN, feed: STORM, span: JUNE });

const TWO_STORMS = {
  readings: [...STORM.readings, reading({ gauge: 'BRD', at: at('2025-06-11 06:00'), value: 1.4 })],
};

describe('the notices', () => {
  it('gives one per closure', () => {
    expect(notices).toHaveLength(1);
    expect(notices[0].area).toBe('B-12');
  });

  it('cites the reading that shut the area', () => {
    expect(notices[0].citation).toBe('1.20 inches at BRD against a trigger of 1');
  });

  it('knows whether the closure is still in force', () => {
    expect(notices[0].open).toBe(false);
    const short = closureNotices({
      area: B12,
      plan: B12_PLAN,
      feed: STORM,
      span: window(JUNE_FIRST, at('2025-06-11 00:00')),
    });
    expect(short[0].open).toBe(true);
  });

  it('gives no notices where the plan never fired', () => {
    expect(closureNotices({ area: C3, plan: B12_PLAN, feed: {}, span: JUNE })).toEqual([]);
  });
});

describe('the notice as written', () => {
  it('says it is lifted where it is', () => {
    expect(renderNotice(notices[0]).split('\n')[0]).toBe('Closure lifted: B-12 Broad Creek');
  });

  it('says it is in force where it is, and what will lift it', () => {
    const open = closureNotices({
      area: B12,
      plan: B12_PLAN,
      feed: STORM,
      span: window(JUNE_FIRST, at('2025-06-11 00:00')),
    })[0];
    const text = renderNotice(open);
    expect(text.split('\n')[0]).toBe('Closure in force: B-12 Broad Creek');
    expect(text).toMatch(/Reopens:\s+after 72 hours/);
  });

  it('gives the moment it closed in the zone the office keeps', () => {
    expect(renderNotice(notices[0])).toMatch(/Closed from: 2025-06-10 02:00 EDT/);
  });

  it('cites the rule the plan was made under', () => {
    expect(renderNotice(notices[0])).toMatch(/Under:\s+15A NCAC 18A \.0910/);
  });

  it('says how many times the clock restarted, and only when it did', () => {
    expect(renderNotice(notices[0])).not.toContain('Clock restarted');
    const restarted = closureNotices({
      area: B12,
      plan: B12_PLAN,
      feed: TWO_STORMS,
      span: JUNE,
    })[0];
    expect(renderNotice(restarted)).toMatch(/Clock restarted:\s+1 times/);
  });

  it('moves the closure start to the later storm when the clock restarted', () => {
    const restarted = closureNotices({
      area: B12,
      plan: B12_PLAN,
      feed: TWO_STORMS,
      span: JUNE,
    })[0];
    expect(renderNotice(restarted)).toMatch(/Closed from:\s+2025-06-11 06:00 EDT/);
  });
});

describe('the history', () => {
  const text = renderClosureHistory({ area: B12, plan: B12_PLAN, feed: STORM, span: JUNE });

  it('names the plan in both its instruments', () => {
    expect(text).toContain('closes on 1 inches at BRD over 24 hours');
    expect(text).toContain('reopens after 72 hours');
  });

  it('counts the closures and lists them', () => {
    expect(text).toMatch(/Closures: 1/);
    expect(text).toContain('2025-06-10 02:00 EDT');
  });

  it('says plainly when the area was never shut', () => {
    const quiet = renderClosureHistory({ area: B12, plan: B12_PLAN, feed: {}, span: JUNE });
    expect(quiet).toContain('The area was not shut under its plan at any point');
  });

  it('says a closure still in force is still shut', () => {
    const text2 = renderClosureHistory({
      area: B12,
      plan: B12_PLAN,
      feed: STORM,
      span: window(JUNE_FIRST, at('2025-06-11 00:00')),
    });
    expect(text2).toContain('still shut');
  });

  it('is the same text twice', () => {
    expect(renderClosureHistory({ area: B12, plan: B12_PLAN, feed: STORM, span: JUNE })).toBe(text);
  });
});

describe('how much of the period was shut', () => {
  it('counts the seconds of every closure', () => {
    expect(closedSeconds({ plan: B12_PLAN, feed: STORM, span: JUNE })).toBe(72 * 3600);
  });

  it('gives that as a share of the period', () => {
    expect(closedShare({ plan: B12_PLAN, feed: STORM, span: JUNE })).toBeCloseTo(
      (72 * 3600) / (29 * 86400),
      9,
    );
  });

  it('counts an open closure to the end of the period', () => {
    const short = window(JUNE_FIRST, at('2025-06-11 02:00'));
    expect(closedSeconds({ plan: B12_PLAN, feed: STORM, span: short })).toBe(24 * 3600);
  });

  it('counts nothing where nothing shut', () => {
    expect(closedSeconds({ plan: B12_PLAN, feed: {}, span: JUNE })).toBe(0);
    expect(closedShare({ plan: B12_PLAN, feed: {}, span: JUNE })).toBe(0);
  });

  it('gives an empty period a share of nothing rather than dividing by zero', () => {
    const nothing = window(JUNE_FIRST, JUNE_FIRST);
    expect(closedShare({ plan: B12_PLAN, feed: STORM, span: nothing })).toBe(0);
  });
});
