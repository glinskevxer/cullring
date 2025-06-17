import { describe, expect, it } from 'vitest';

import {
  count,
  dash,
  decimal,
  feet,
  fit,
  hours,
  inches,
  integer,
  joinWords,
  padLeft,
  padRight,
  titleCase,
  yesNo,
} from '../../src/text/format.js';

describe('numbers', () => {
  it('prints a decimal to the places asked for', () => {
    expect(decimal(5.5512, 2)).toBe('5.55');
    expect(decimal(5.5512)).toBe('5.6');
    expect(decimal(5, 2)).toBe('5.00');
  });

  it('prints an integer rounded', () => {
    expect(integer(5.5)).toBe('6');
    expect(integer(5.4)).toBe('5');
  });

  it('prints nothing for nothing rather than the word null', () => {
    expect(decimal(null)).toBe('');
    expect(decimal(undefined)).toBe('');
    expect(decimal(Number.NaN)).toBe('');
    expect(integer(null)).toBe('');
    expect(integer(Number.NaN)).toBe('');
  });

  it('prints units the way the office writes them', () => {
    expect(inches(1.234)).toBe('1.23 in');
    expect(feet(8.42)).toBe('8.4 ft');
  });
});

describe('counts and words', () => {
  it('pluralises properly and not with an s in brackets', () => {
    expect(count(1, 'hour')).toBe('1 hour');
    expect(count(2, 'hour')).toBe('2 hours');
    expect(count(0, 'hour')).toBe('0 hours');
  });

  it('takes an irregular plural', () => {
    expect(count(2, 'analysis', 'analyses')).toBe('2 analyses');
  });

  it('prints hours, and says so plainly when there is no limit', () => {
    expect(hours(10)).toBe('10 hours');
    expect(hours(1)).toBe('1 hour');
    expect(hours(6.65)).toBe('6.7 hours');
    expect(hours(null)).toBe('no limit');
  });

  it('says yes and no', () => {
    expect(yesNo(true)).toBe('yes');
    expect(yesNo(false)).toBe('no');
  });

  it('prints a dash for a blank cell', () => {
    expect(dash(null)).toBe('-');
    expect(dash('')).toBe('-');
    expect(dash(0)).toBe('0');
    expect(dash('B-12')).toBe('B-12');
  });
});

describe('fitting text', () => {
  it('leaves text that fits alone', () => {
    expect(fit('B-12', 10)).toBe('B-12');
    expect(fit('B-12', 4)).toBe('B-12');
  });

  it('cuts with an ellipsis rather than silently', () => {
    expect(fit('conditionally approved', 10)).toBe('condition\u2026');
  });

  it('handles a width of one or nothing', () => {
    expect(fit('abc', 1)).toBe('a');
    expect(fit('abc', 0)).toBe('');
  });

  it('reads nothing as an empty string', () => {
    expect(fit(null, 5)).toBe('');
  });

  it('pads both ways to the width', () => {
    expect(padRight('B-12', 8)).toBe('B-12    ');
    expect(padLeft('5.6', 8)).toBe('     5.6');
    expect(padRight('conditionally approved', 6)).toBe('condi\u2026');
  });
});

describe('lists of words', () => {
  it.each([
    [[], ''],
    [['B-12'], 'B-12'],
    [['B-12', 'C-3'], 'B-12 and C-3'],
    [['B-12', 'C-3', 'D-2'], 'B-12, C-3 and D-2'],
  ])('reads %o as %s', (values, expected) => {
    expect(joinWords(values)).toBe(expected);
  });

  it('takes another conjunction', () => {
    expect(joinWords(['relay', 'depuration'], 'or')).toBe('relay or depuration');
  });

  it('title cases a phrase without touching the rest of the letters', () => {
    expect(titleCase('conditionally approved')).toBe('Conditionally Approved');
    expect(titleCase('')).toBe('');
  });
});
