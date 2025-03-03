import { describe, expect, it } from 'vitest';

import {
  ABOVE,
  BELOW,
  EXACT,
  LOWER_LIMIT,
  UPPER_LIMIT,
  atLowerLimit,
  atUpperLimit,
  formatMpn,
  isCensored,
  mpn,
  parseMpn,
  sample,
} from '../../src/survey/result.js';
import { civilDate } from '../../src/time/civil.js';

describe('building a result', () => {
  it('holds a value and a kind', () => {
    expect(mpn(23)).toEqual({ value: 23, kind: EXACT, censored: false });
  });

  it('marks both bounds as censored', () => {
    expect(mpn(LOWER_LIMIT, BELOW).censored).toBe(true);
    expect(mpn(UPPER_LIMIT, ABOVE).censored).toBe(true);
    expect(isCensored(mpn(23))).toBe(false);
  });

  it('refuses a value that is not a positive number', () => {
    expect(() => mpn(0)).toThrow(/positive number/);
    expect(() => mpn(-1)).toThrow(/positive number/);
    expect(() => mpn(Number.NaN)).toThrow(/positive number/);
  });

  it('refuses a kind it does not know', () => {
    expect(() => mpn(23, 'roughly')).toThrow(/not a kind of result/);
  });

  it('tells the two bounds apart', () => {
    expect(atLowerLimit(mpn(1.8, BELOW))).toBe(true);
    expect(atUpperLimit(mpn(1.8, BELOW))).toBe(false);
    expect(atUpperLimit(mpn(1600, ABOVE))).toBe(true);
  });
});

describe('reading the laboratory sheet', () => {
  it.each([
    ['23', 23, EXACT],
    ['1.8', 1.8, EXACT],
    ['<1.8', 1.8, BELOW],
    ['> 1600', 1600, ABOVE],
    ['  49 ', 49, EXACT],
  ])('reads %s', (text, value, kind) => {
    const reading = parseMpn(text);
    expect(reading.value).toBe(value);
    expect(reading.kind).toBe(kind);
  });

  it('takes a plain number as an exact result', () => {
    expect(parseMpn(23)).toEqual({ value: 23, kind: EXACT, censored: false });
  });

  it.each(['', 'nd', '<', '1.8.2', '-3', 'less than 1.8'])('refuses %s', (text) => {
    expect(() => parseMpn(text, 'coliform')).toThrow(/coliform/);
  });

  it('refuses something that is neither text nor a number', () => {
    expect(() => parseMpn(null)).toThrow(/must be a result/);
  });

  it('writes a result back the way the sheet has it', () => {
    expect(formatMpn(parseMpn('<1.8'))).toBe('<1.8');
    expect(formatMpn(parseMpn('>1600'))).toBe('>1600');
    expect(formatMpn(parseMpn('23'))).toBe('23');
  });
});

describe('a sample record', () => {
  it('binds a station, a day and a result, and works out the area', () => {
    const one = sample({ station: 'B12-03', collectedOn: '2025-04-08', result: '<1.8' });
    expect(one.station).toBe('B12-03');
    expect(one.areaId).toBe('B-12');
    expect(one.collectedOn).toEqual(civilDate(2025, 4, 8));
    expect(one.result.kind).toBe(BELOW);
    expect(one.kind).toBe('fecal coliform');
  });

  it('takes a date that is already a civil date', () => {
    const one = sample({ station: 'B12-03', collectedOn: civilDate(2025, 4, 8), result: 23 });
    expect(one.collectedOn).toEqual(civilDate(2025, 4, 8));
  });

  it('takes a result that is already a result', () => {
    const one = sample({ station: 'B12-03', collectedOn: '2025-04-08', result: mpn(49) });
    expect(one.result.value).toBe(49);
  });

  it('refuses a station number that is not one', () => {
    expect(() => sample({ station: 'B-12', collectedOn: '2025-04-08', result: 23 })).toThrow(
      /station number/,
    );
  });

  it('refuses a missing day', () => {
    expect(() => sample({ station: 'B12-03', result: 23 })).toThrow(/day it was collected/);
  });

  it('carries an optional note and a kind of analysis', () => {
    const one = sample({
      station: 'B12-03',
      collectedOn: '2025-04-08',
      result: 23,
      kind: 'total coliform',
      note: 'after rain',
    });
    expect(one.kind).toBe('total coliform');
    expect(one.note).toBe('after rain');
  });
});
