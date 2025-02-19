import { describe, expect, it } from 'vitest';

import {
  DEALER_KINDS,
  formatLotId,
  parseAreaId,
  parseDealerId,
  parseHarvesterId,
  parseLotId,
  parseStationId,
  stationBelongsTo,
} from '../../src/core/identity.js';

describe('area numbers', () => {
  it('reads a plain area', () => {
    expect(parseAreaId('B-12')).toEqual({ id: 'B-12', region: 'B', number: 12, subarea: null });
  });

  it('reads a subarea and keeps the letter', () => {
    expect(parseAreaId('B-12A')).toMatchObject({ id: 'B-12A', number: 12, subarea: 'A' });
  });

  it('accepts a single digit number and normalises the written form', () => {
    expect(parseAreaId('b-7').id).toBe('B-7');
    expect(parseAreaId(' B-07 ').id).toBe('B-7');
  });

  it.each(['B12', 'B-', '12-B', 'B-123', 'B-12AB', ''])('refuses %s', (text) => {
    expect(() => parseAreaId(text, 'growingArea')).toThrow(/growingArea/);
  });

  it('refuses a zero area number', () => {
    expect(() => parseAreaId('B-0')).toThrow(/no area number/);
  });

  it('names the field when handed something that is not text', () => {
    expect(() => parseAreaId(12, 'growingArea')).toThrow(/must be written text/);
  });
});

describe('station numbers', () => {
  it('reads the area out of the station', () => {
    expect(parseStationId('B12-03')).toEqual({
      id: 'B12-03',
      region: 'B',
      areaNumber: 12,
      areaId: 'B-12',
      ordinal: 3,
    });
  });

  it.each(['B12-3', 'B-12-03', '12-03', ''])('refuses %s', (text) => {
    expect(() => parseStationId(text)).toThrow(/station number/);
  });

  it('answers whether a station sits in an area', () => {
    expect(stationBelongsTo('B12-03', 'B-12')).toBe(true);
    expect(stationBelongsTo('B12-03', 'B-12A')).toBe(true);
    expect(stationBelongsTo('B12-03', 'B-13')).toBe(false);
    expect(stationBelongsTo('C12-03', 'B-12')).toBe(false);
  });
});

describe('harvester licences', () => {
  it('reads the year and the serial', () => {
    expect(parseHarvesterId('SH-2025-04412')).toEqual({
      id: 'SH-2025-04412',
      issuedYear: 2025,
      serial: 4412,
    });
  });

  it.each(['SH-25-04412', 'SH-2025-4412', 'DP-2025-04412', ''])('refuses %s', (text) => {
    expect(() => parseHarvesterId(text)).toThrow(/harvester licence number/);
  });
});

describe('dealer certifications', () => {
  it.each([
    ['SS-042', 'shellstock shipper'],
    ['SP-118', 'shucker packer'],
    ['RP-007', 'repacker'],
    ['DP-003', 'depuration processor'],
  ])('reads the kind out of %s', (text, kind) => {
    const parsed = parseDealerId(text);
    expect(parsed.kind).toBe(kind);
    expect(parsed.serial).toBe(Number(text.slice(3)));
  });

  it('lists the prefixes it knows when it refuses one', () => {
    try {
      parseDealerId('XX-001');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.kinds).toEqual(Object.keys(DEALER_KINDS));
    }
  });

  it.each(['SP-1', 'SP-1188', 'SP118', ''])('refuses %s', (text) => {
    expect(() => parseDealerId(text)).toThrow(/certification number/);
  });
});

describe('lot numbers', () => {
  it('reads the landing date and the area out of the number', () => {
    expect(parseLotId('20250814-B12-004')).toEqual({
      id: '20250814-B12-004',
      landedOn: { year: 2025, month: 8, day: 14 },
      areaId: 'B-12',
      serial: 4,
    });
  });

  it('writes one back the same way', () => {
    expect(formatLotId({ year: 2025, month: 8, day: 14 }, 'B-12', 4)).toBe('20250814-B12-004');
    expect(formatLotId({ year: 2025, month: 8, day: 14 }, 'B-12A', 4)).toBe('20250814-B12-004');
  });

  it('round trips', () => {
    const text = formatLotId({ year: 2026, month: 1, day: 5 }, 'C-3', 12);
    expect(text).toBe('20260105-C3-012');
    expect(parseLotId(text).areaId).toBe('C-3');
  });

  it.each(['2025814-B12-004', '20250814-B-12-004', '20250814-B12-4', ''])('refuses %s', (text) => {
    expect(() => parseLotId(text)).toThrow(/lot number/);
  });
});
