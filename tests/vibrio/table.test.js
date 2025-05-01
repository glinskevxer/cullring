import { describe, expect, it } from 'vitest';

import {
  COOL,
  REGIONS,
  WARM,
  controlSeason,
  describeLimit,
  hoursAllowed,
  iceCredit,
  inControlSeason,
  temperatureRegion,
} from '../../src/vibrio/table.js';

describe('which temperature region an area sits in', () => {
  it('reads the warm sounds and the cool coast apart', () => {
    expect(temperatureRegion('B')).toBe(WARM);
    expect(temperatureRegion('C')).toBe(WARM);
    expect(temperatureRegion('A')).toBe(COOL);
    expect(temperatureRegion('D')).toBe(COOL);
  });

  it('is not fussy about case', () => {
    expect(temperatureRegion(' b ')).toBe(WARM);
  });

  it('refuses a letter that is in no region, and lists the ones that are', () => {
    try {
      temperatureRegion('Z', 'areaRegion');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toContain('B');
      expect(error.message).toMatch(/areaRegion/);
    }
  });

  it('refuses something that is not a letter', () => {
    expect(() => temperatureRegion(2)).toThrow(/must be an area region letter/);
  });
});

describe('the control season', () => {
  it('runs longer in warm water than in cool', () => {
    expect(controlSeason(WARM)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(controlSeason(COOL)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('has no limit at all in the winter, which is an answer rather than a gap', () => {
    for (const month of [11, 12, 1, 2, 3]) {
      expect(inControlSeason(WARM, month)).toBe(false);
      expect(hoursAllowed(WARM, month)).toBeNull();
    }
  });

  it('has a limit through the summer in both regions', () => {
    for (const month of [6, 7, 8, 9]) {
      expect(inControlSeason(WARM, month)).toBe(true);
      expect(inControlSeason(COOL, month)).toBe(true);
    }
  });

  it('covers April in warm water and not in cool', () => {
    expect(inControlSeason(WARM, 4)).toBe(true);
    expect(inControlSeason(COOL, 4)).toBe(false);
  });
});

describe('the hours the table allows', () => {
  it('is tightest in the warm months in warm water', () => {
    expect(hoursAllowed(WARM, 8)).toBe(10);
    expect(hoursAllowed(COOL, 8)).toBe(12);
  });

  it('loosens at the shoulders of the season', () => {
    expect(hoursAllowed(WARM, 4)).toBe(12);
    expect(hoursAllowed(WARM, 8)).toBeLessThan(hoursAllowed(WARM, 4));
  });

  it('is never tighter in cool water than in warm water in the same month', () => {
    for (const month of controlSeason(COOL)) {
      expect(hoursAllowed(COOL, month)).toBeGreaterThanOrEqual(hoursAllowed(WARM, month));
    }
  });

  it('refuses a region it does not keep and lists both', () => {
    try {
      hoursAllowed('tropical', 8);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(REGIONS.slice());
    }
  });

  it('refuses a month that is not one', () => {
    expect(() => hoursAllowed(WARM, 0)).toThrow(/is not a month/);
    expect(() => hoursAllowed(WARM, 13)).toThrow(/is not a month/);
    expect(() => inControlSeason(WARM, 1.5)).toThrow(/is not a month/);
  });
});

describe('the ice column', () => {
  it('buys longer, and does not stop the clock', () => {
    expect(hoursAllowed(WARM, 8, { iced: true })).toBe(12);
    expect(hoursAllowed(WARM, 8, { iced: true })).toBeGreaterThan(hoursAllowed(WARM, 8));
  });

  it('buys more at the shoulders in cool water than in the warm midsummer', () => {
    expect(iceCredit(COOL, 5)).toBe(4);
    expect(iceCredit(WARM, 8)).toBe(2);
  });

  it('buys nothing outside the season, because there is nothing to buy', () => {
    expect(iceCredit(WARM, 12)).toBe(0);
    expect(hoursAllowed(WARM, 12, { iced: true })).toBeNull();
  });

  it('never shortens the limit in any month of either season', () => {
    for (const region of REGIONS) {
      for (const month of controlSeason(region)) {
        expect(iceCredit(region, month)).toBeGreaterThan(0);
      }
    }
  });
});

describe('describing a limit', () => {
  it('names the month and the column', () => {
    expect(describeLimit(WARM, 8)).toBe('10 hours in August, without ice on board');
    expect(describeLimit(WARM, 8, { iced: true })).toBe('12 hours in August, with ice on board');
  });

  it('says plainly that a winter month has no limit', () => {
    expect(describeLimit(WARM, 12)).toMatch(/no time to temperature limit/);
  });
});
