import { describe, expect, it } from 'vitest';

import {
  coversArea,
  describeSeason,
  isOpen,
  mayTake,
  nextOpening,
  openDays,
  season,
  seasonFor,
} from '../../src/condition/season.js';
import { BAY_SCALLOP, HARD_CLAM, OYSTER } from '../../src/harvest/record.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';

const scallop = season({ species: BAY_SCALLOP, from: '11-01', to: '03-31' });
const oyster = season({ species: OYSTER, from: '10-01', to: '03-31' });
const local = season({ species: OYSTER, from: '11-15', to: '02-28', areas: ['B-12'] });
const clam = season({ species: HARD_CLAM, from: '01-01', to: '12-31' });

const SEASONS = [scallop, oyster, local, clam];

describe('building a season', () => {
  it('keeps the month and day and drops the year', () => {
    expect(scallop.from).toEqual({ month: 11, day: 1 });
    expect(scallop.to).toEqual({ month: 3, day: 31 });
  });

  it('knows which seasons wrap the turn of the year', () => {
    expect(scallop.wraps).toBe(true);
    expect(clam.wraps).toBe(false);
  });

  it('takes a full date as well as a month and day', () => {
    expect(season({ species: OYSTER, from: '2025-10-01', to: '2026-03-31' }).from).toEqual({
      month: 10,
      day: 1,
    });
  });

  it('refuses a season with no dates', () => {
    expect(() => season({ species: OYSTER, from: '10-01' })).toThrow(/to is required/);
  });

  it('refuses a season with no species', () => {
    expect(() => season({ from: '10-01', to: '03-31' })).toThrow(/species/);
  });

  it('normalises the areas it names', () => {
    expect(
      season({ species: OYSTER, from: '10-01', to: '03-31', areas: [' b-12 '] }).areas,
    ).toEqual(['B-12']);
  });
});

describe('a season that wraps the year', () => {
  it('is open on both sides of the turn', () => {
    expect(isOpen(scallop, civilDate(2025, 12, 15))).toBe(true);
    expect(isOpen(scallop, civilDate(2026, 1, 15))).toBe(true);
  });

  it('is shut in the middle of the year', () => {
    expect(isOpen(scallop, civilDate(2025, 6, 15))).toBe(false);
    expect(isOpen(scallop, civilDate(2025, 9, 30))).toBe(false);
  });

  it('is open on the first day and the last', () => {
    expect(isOpen(scallop, civilDate(2025, 11, 1))).toBe(true);
    expect(isOpen(scallop, civilDate(2025, 3, 31))).toBe(true);
    expect(isOpen(scallop, civilDate(2025, 10, 31))).toBe(false);
    expect(isOpen(scallop, civilDate(2025, 4, 1))).toBe(false);
  });

  it('is open for fewer days than a year, which a wrong reading would not be', () => {
    expect(openDays(scallop, 2025)).toBeLessThan(200);
    expect(openDays(scallop, 2025)).toBeGreaterThan(100);
  });
});

describe('a season that does not wrap', () => {
  it('is open through its own months', () => {
    expect(isOpen(clam, civilDate(2025, 6, 15))).toBe(true);
    expect(openDays(clam, 2025)).toBe(365);
  });

  it('is shut outside a narrower one', () => {
    const narrow = season({ species: OYSTER, from: '05-01', to: '06-30' });
    expect(isOpen(narrow, civilDate(2025, 5, 15))).toBe(true);
    expect(isOpen(narrow, civilDate(2025, 7, 1))).toBe(false);
    expect(openDays(narrow, 2025)).toBe(61);
  });
});

describe('which season applies', () => {
  it('takes the one written for the area over the general one', () => {
    expect(seasonFor(SEASONS, OYSTER, 'B-12')).toBe(local);
    expect(seasonFor(SEASONS, OYSTER, 'C-3')).toBe(oyster);
  });

  it('answers with nothing where none is written for the species', () => {
    expect(seasonFor(SEASONS, 'mussel', 'B-12')).toBeNull();
  });

  it('reads a season with no areas as covering everywhere', () => {
    expect(coversArea(oyster, 'B-12')).toBe(true);
    expect(coversArea(local, 'B-12')).toBe(true);
    expect(coversArea(local, 'C-3')).toBe(false);
  });
});

describe('whether a species may be taken', () => {
  it('lets a species with no season through all year', () => {
    const answer = mayTake(SEASONS, 'mussel', 'B-12', civilDate(2025, 6, 15));
    expect(answer.open).toBe(true);
    expect(answer.reason).toMatch(/no season is written/);
  });

  it('shuts a species out of its season and opens it in', () => {
    expect(mayTake(SEASONS, BAY_SCALLOP, 'C-3', civilDate(2025, 6, 15)).open).toBe(false);
    expect(mayTake(SEASONS, BAY_SCALLOP, 'C-3', civilDate(2025, 12, 15)).open).toBe(true);
  });

  it('reads two species differently on the same day out of the same water', () => {
    const day = civilDate(2025, 6, 15);
    expect(mayTake(SEASONS, HARD_CLAM, 'C-3', day).open).toBe(true);
    expect(mayTake(SEASONS, BAY_SCALLOP, 'C-3', day).open).toBe(false);
  });

  it('reads the same species differently in two areas on one day', () => {
    const day = civilDate(2025, 10, 15);
    expect(mayTake(SEASONS, OYSTER, 'C-3', day).open).toBe(true);
    expect(mayTake(SEASONS, OYSTER, 'B-12', day).open).toBe(false);
  });

  it('describes the season it read', () => {
    expect(describeSeason(local)).toBe('oyster is open November 15 to February 28 in B-12');
    expect(describeSeason(scallop)).toMatch(/everywhere/);
  });
});

describe('when a shut season opens again', () => {
  it('names the next opening day', () => {
    expect(formatCivilDate(nextOpening(scallop, civilDate(2025, 6, 15)))).toBe('2025-11-01');
  });

  it('rolls into next year where the opening has already gone by', () => {
    expect(formatCivilDate(nextOpening(scallop, civilDate(2025, 4, 15)))).toBe('2025-11-01');
  });

  it('answers with nothing while the season is open', () => {
    expect(nextOpening(scallop, civilDate(2025, 12, 15))).toBeNull();
  });
});
