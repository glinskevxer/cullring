import { describe, expect, it } from 'vitest';

import {
  LEASE,
  PUBLIC,
  TENURES,
  bed,
  bedsIn,
  findBed,
  mayWork,
  parseBedId,
} from '../../src/harvest/bed.js';

const flat = bed({
  id: 'B12-BCK',
  name: 'Broad Creek flat',
  tideStation: 'BFT',
  elevation: 1.8,
  acres: 22,
});

const deep = bed({ id: 'B12-CHN', name: 'the channel edge', tideStation: 'BFT', elevation: -1.2 });

const leased = bed({
  id: 'C3-MSL',
  name: 'Middle Sound lease',
  tideStation: 'HAT',
  elevation: 0.4,
  tenure: LEASE,
  holder: 'SH-2025-04412',
});

const ALL = [deep, flat, leased];

describe('reading a bed number', () => {
  it('takes the area out of it', () => {
    expect(parseBedId('B12-BCK')).toEqual({ id: 'B12-BCK', areaId: 'B-12', tag: 'BCK' });
  });

  it('is not fussy about case or spacing', () => {
    expect(parseBedId(' b12-bck ').id).toBe('B12-BCK');
  });

  it.each(['B-12-BCK', 'B12BCK', 'B12-B', 'B12-TOOLONG', ''])('refuses %s', (text) => {
    expect(() => parseBedId(text, 'ground')).toThrow(/ground/);
  });

  it('refuses something that is not written text', () => {
    expect(() => parseBedId(12)).toThrow(/must be written as/);
  });
});

describe('building a bed', () => {
  it('holds the two facts the temperature clock needs', () => {
    expect(flat.tideStation).toBe('BFT');
    expect(flat.elevation).toBe(1.8);
  });

  it('allows an elevation below the datum, which is most of the ground', () => {
    expect(deep.elevation).toBe(-1.2);
  });

  it('refuses an elevation nothing on this coast reaches', () => {
    expect(() =>
      bed({ id: 'B12-XXX', name: 'nowhere', tideStation: 'BFT', elevation: 40 }),
    ).toThrow(/elevation/);
  });

  it('refuses a tenure it does not know and lists both', () => {
    try {
      bed({ id: 'B12-XXX', name: 'nowhere', tideStation: 'BFT', elevation: 1, tenure: 'rented' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(TENURES.slice());
    }
  });

  it('refuses a lease with no holder', () => {
    expect(() =>
      bed({ id: 'B12-XXX', name: 'nowhere', tideStation: 'BFT', elevation: 1, tenure: LEASE }),
    ).toThrow(/carries no holder/);
  });

  it('refuses public bottom with a holder, which is a contradiction', () => {
    expect(() =>
      bed({
        id: 'B12-XXX',
        name: 'nowhere',
        tideStation: 'BFT',
        elevation: 1,
        tenure: PUBLIC,
        holder: 'SH-2025-04412',
      }),
    ).toThrow(/cannot have a holder/);
  });

  it('refuses a holder that is not a licence number', () => {
    expect(() =>
      bed({
        id: 'B12-XXX',
        name: 'nowhere',
        tideStation: 'BFT',
        elevation: 1,
        tenure: LEASE,
        holder: 'SP-118',
      }),
    ).toThrow(/harvester licence number/);
  });
});

describe('selecting beds', () => {
  it('takes the area, in number order', () => {
    expect(bedsIn(ALL, 'B-12').map((one) => one.id)).toEqual(['B12-BCK', 'B12-CHN']);
  });

  it('reads a subarea as the same area', () => {
    expect(bedsIn(ALL, 'B-12A')).toHaveLength(2);
  });

  it('finds one by number, and answers with nothing where there is none', () => {
    expect(findBed(ALL, 'c3-msl').name).toBe('Middle Sound lease');
    expect(findBed(ALL, 'B12-ZZZ')).toBeNull();
  });
});

describe('who may work the ground', () => {
  it('lets anybody work public bottom', () => {
    expect(mayWork(flat, 'SH-2025-00877')).toBe(true);
  });

  it('lets only the holder work a lease', () => {
    expect(mayWork(leased, 'SH-2025-04412')).toBe(true);
    expect(mayWork(leased, 'SH-2025-00877')).toBe(false);
  });

  it('refuses a licence number that is not one', () => {
    expect(() => mayWork(leased, 'SP-118')).toThrow(/harvester licence number/);
  });
});
