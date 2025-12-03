import { describe, expect, it } from 'vitest';

import {
  CRITICAL,
  FOLLOW_UP,
  FOLLOW_UP_BELOW,
  FOLLOW_UP_DAYS,
  ITEM_KINDS,
  OUTCOMES,
  ROUTINE,
  ROUTINE_DAYS,
  SHUT,
  WEIGHTED,
  describeInspection,
  inspection,
  itemById,
  latestFor,
  outcomeOf,
  requireScore,
  sheet,
  totalWeight,
} from '../../src/licence/inspection.js';
import { formatCivilDate } from '../../src/time/civil.js';

const made = (extra = {}) =>
  inspection({ dealer: 'SP-118', on: '2025-08-14', inspector: 'R. Willis', ...extra });

describe('the inspection sheet', () => {
  it('adds to a hundred across the weighted items', () => {
    expect(totalWeight()).toBe(100);
  });

  it('gives every item a kind the module knows', () => {
    for (const item of sheet()) {
      expect(ITEM_KINDS).toContain(item.kind);
    }
  });

  it('gives every weighted item a weight and every critical item none', () => {
    for (const item of sheet()) {
      if (item.kind === WEIGHTED) {
        expect(item.weight).toBeGreaterThan(0);
      } else {
        expect(item.weight).toBeUndefined();
      }
    }
  });

  it('describes every item', () => {
    for (const item of sheet()) {
      expect(item.description.length).toBeGreaterThan(8);
    }
  });

  it('names the critical items the office would name', () => {
    const critical = sheet()
      .filter((one) => one.kind === CRITICAL)
      .map((one) => one.id);
    expect(critical).toEqual(['water', 'sewage', 'temperature', 'tags']);
  });

  it('finds an item by name and refuses one that is not on the sheet', () => {
    expect(itemById('vermin').weight).toBeGreaterThan(0);
    expect(() => itemById('paperwork')).toThrow(/is not on the inspection sheet/);
  });

  it('hands back a copy, so a caller cannot edit the sheet', () => {
    const items = sheet();
    items.pop();
    expect(sheet()).toHaveLength(14);
  });
});

describe('scoring an inspection', () => {
  it('is a hundred where nothing failed', () => {
    expect(made().score).toBe(100);
    expect(made().critical).toEqual([]);
  });

  it('takes the weight off for each weighted item that failed', () => {
    expect(made({ failed: ['vermin'] }).score).toBe(88);
    expect(made({ failed: ['vermin', 'records'] }).score).toBe(76);
  });

  it('takes nothing off for a critical item, and lists it instead', () => {
    const one = made({ failed: ['water'] });
    expect(one.score).toBe(100);
    expect(one.critical.map((item) => item.id)).toEqual(['water']);
  });

  it('refuses an item that is not on the sheet', () => {
    expect(() => made({ failed: ['paperwork'] })).toThrow(/is not on the inspection sheet/);
  });

  it('refuses an inspection with no day', () => {
    expect(() => inspection({ dealer: 'SP-118' })).toThrow(/day it was made/);
  });

  it('refuses a certification number that is not one', () => {
    expect(() => made({ dealer: 'Core Sound Packing' })).toThrow(/certification number/);
  });
});

describe('what the score means', () => {
  it('sends a clean plant to the back of the queue for a year', () => {
    const outcome = outcomeOf(made());
    expect(outcome.outcome).toBe(ROUTINE);
    expect(formatCivilDate(outcome.nextDue)).toBe('2026-08-14');
    expect(ROUTINE_DAYS).toBe(365);
  });

  it('brings a poor plant back in thirty days', () => {
    const outcome = outcomeOf(made({ failed: ['equipment', 'records'] }));
    expect(outcome.outcome).toBe(FOLLOW_UP);
    expect(formatCivilDate(outcome.nextDue)).toBe('2025-09-13');
    expect(FOLLOW_UP_DAYS).toBe(30);
  });

  it('turns over exactly at the threshold', () => {
    expect(outcomeOf(made({ failed: ['handwash'] })).outcome).toBe(ROUTINE);
    expect(made({ failed: ['handwash'] }).score).toBe(FOLLOW_UP_BELOW + 3);
    expect(outcomeOf(made({ failed: ['equipment', 'clothing'] })).outcome).toBe(FOLLOW_UP);
  });

  it('shuts a plant that failed a critical item, whatever the score', () => {
    const outcome = outcomeOf(made({ failed: ['water'] }));
    expect(outcome.outcome).toBe(SHUT);
    expect(outcome.nextDue).toBeNull();
    expect(outcome.reason).toMatch(/1 critical items failed/);
  });

  it('shuts it even where the weighted score is perfect', () => {
    expect(made({ failed: ['tags'] }).score).toBe(100);
    expect(outcomeOf(made({ failed: ['tags'] })).outcome).toBe(SHUT);
  });

  it('only ever names one of the three outcomes', () => {
    for (const failed of [[], ['vermin'], ['water'], ['equipment', 'records', 'vermin']]) {
      expect(OUTCOMES).toContain(outcomeOf(made({ failed })).outcome);
    }
  });
});

describe('the most recent inspection', () => {
  const held = [
    made({ on: '2024-08-14' }),
    made({ on: '2025-08-14' }),
    made({ dealer: 'SS-042', on: '2025-09-01' }),
  ];

  it('is the one made last for that dealer', () => {
    expect(formatCivilDate(latestFor(held, 'SP-118').on)).toBe('2025-08-14');
  });

  it('is nothing for a dealer never inspected', () => {
    expect(latestFor(held, 'DP-003')).toBeNull();
  });

  it('describes itself in one line', () => {
    expect(describeInspection(made({ failed: ['vermin'] }))).toBe(
      'SP-118 on 2025-08-14: routine, scored 88, next 2026-08-14',
    );
    expect(describeInspection(made({ failed: ['water'] }))).toMatch(/no date set/);
  });
});

describe('the score guard', () => {
  it('takes a score inside the range and refuses one outside it', () => {
    expect(requireScore(88)).toBe(88);
    expect(() => requireScore(101)).toThrow(/at most 100/);
    expect(() => requireScore(-1)).toThrow(/at least 0/);
  });
});
