import { describe, expect, it } from 'vitest';

import {
  BOATYARD,
  MARINA,
  OUTFALL,
  SEPTIC,
  SOURCE_KINDS,
  STORMWATER,
  areaCap,
  capped,
  describeSource,
  pollutionSource,
  shorelineCap,
  sourcesIn,
  sourcesReaching,
  zoneFeet,
} from '../../src/survey/shoreline.js';
import {
  APPROVED,
  CONDITIONALLY_APPROVED,
  PROHIBITED,
  RESTRICTED,
} from '../../src/area/classification.js';

const plant = pollutionSource({
  id: 'wwtp-3',
  kind: OUTFALL,
  areaId: 'B-12',
  latitude: 34.72,
  longitude: -76.7,
  size: 500000,
  surveyedOn: '2024-06-01',
});

const yard = pollutionSource({
  id: 'BY-1',
  kind: BOATYARD,
  areaId: 'B-12',
  latitude: 34.73,
  longitude: -76.68,
  surveyedOn: '2024-06-01',
});

const drain = pollutionSource({
  id: 'SW-4',
  kind: STORMWATER,
  areaId: 'C-3',
  latitude: 34.9,
  longitude: -76.9,
  surveyedOn: '2024-06-01',
});

const septic = pollutionSource({
  id: 'SEP-9',
  kind: SEPTIC,
  areaId: 'B-12',
  latitude: 34.7302,
  longitude: -76.6802,
  surveyedOn: '2024-06-01',
});

/** A small outfall sitting on top of the boatyard, so two zones really overlap. */
const coLocatedOutfall = pollutionSource({
  id: 'WWTP-8',
  kind: OUTFALL,
  areaId: 'B-12',
  latitude: 34.7302,
  longitude: -76.6803,
  size: 4000,
  surveyedOn: '2024-06-01',
});

const SOURCES = [plant, yard, drain];

describe('the zone a source projects', () => {
  it('steps up with the design flow of an outfall', () => {
    expect(zoneFeet(OUTFALL, 5000)).toBe(1500);
    expect(zoneFeet(OUTFALL, 50000)).toBe(3000);
    expect(zoneFeet(OUTFALL, 500000)).toBe(6000);
    expect(zoneFeet(OUTFALL, 5000000)).toBe(10000);
  });

  it('steps exactly on the boundary rather than just above it', () => {
    expect(zoneFeet(OUTFALL, 10000)).toBe(1500);
    expect(zoneFeet(OUTFALL, 10001)).toBe(3000);
  });

  it('steps up with the slips of a marina', () => {
    expect(zoneFeet(MARINA, 8)).toBe(300);
    expect(zoneFeet(MARINA, 30)).toBe(750);
    expect(zoneFeet(MARINA, 200)).toBe(1500);
  });

  it('is a constant for the kinds that do not have a size', () => {
    expect(zoneFeet(BOATYARD, 0)).toBe(500);
    expect(zoneFeet(SEPTIC, 0)).toBe(300);
    expect(zoneFeet(STORMWATER, 0)).toBe(500);
  });

  it('refuses a kind it does not know and lists the ones it does', () => {
    try {
      zoneFeet('quarry', 0);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(SOURCE_KINDS.slice());
    }
  });

  it('refuses a negative size', () => {
    expect(() => zoneFeet(OUTFALL, -1)).toThrow(/at least 0/);
  });
});

describe('building a source', () => {
  it('works the zone out from the kind and the size', () => {
    expect(plant.zoneFeet).toBe(6000);
    expect(plant.zoneMetres).toBeCloseTo(6000 * 0.3048, 6);
  });

  it('carries the class it caps at', () => {
    expect(plant.cap).toBe(PROHIBITED);
    expect(yard.cap).toBe(RESTRICTED);
    expect(drain.cap).toBe(CONDITIONALLY_APPROVED);
  });

  it('normalises the identifier', () => {
    expect(plant.id).toBe('WWTP-3');
  });

  it('refuses a source with no identifier or no area', () => {
    expect(() =>
      pollutionSource({ kind: OUTFALL, areaId: 'B-12', latitude: 34, longitude: -76 }),
    ).toThrow(/id/);
    expect(() => pollutionSource({ id: 'X', kind: OUTFALL, latitude: 34, longitude: -76 })).toThrow(
      /areaId/,
    );
  });

  it('refuses a position off the earth', () => {
    expect(() =>
      pollutionSource({ id: 'X', kind: OUTFALL, areaId: 'B-12', latitude: 91, longitude: -76 }),
    ).toThrow(/latitude/);
  });

  it('describes itself in one line', () => {
    expect(describeSource(yard)).toBe('BY-1: boatyard, zone 500 ft, caps at restricted');
  });
});

describe('which sources reach a position', () => {
  it('finds the ones whose zone covers it', () => {
    const reaching = sourcesReaching(SOURCES, { latitude: 34.721, longitude: -76.701 });
    expect(reaching.map((one) => one.id)).toEqual(['WWTP-3']);
  });

  it('finds none well outside every zone', () => {
    expect(sourcesReaching(SOURCES, { latitude: 35.9, longitude: -75.2 })).toEqual([]);
  });

  it('finds several where the zones overlap, in identifier order', () => {
    const reaching = sourcesReaching([...SOURCES, septic], {
      latitude: 34.7301,
      longitude: -76.6801,
    });
    expect(reaching.map((one) => one.id)).toEqual(['BY-1', 'SEP-9']);
  });

  it('finds none at a point between two zones that do not meet', () => {
    expect(sourcesReaching(SOURCES, { latitude: 34.7285, longitude: -76.6815 })).toEqual([]);
  });

  it('selects by area as well', () => {
    expect(sourcesIn(SOURCES, 'B-12').map((one) => one.id)).toEqual(['BY-1', 'WWTP-3']);
    expect(sourcesIn(SOURCES, 'D-9')).toEqual([]);
  });
});

describe('the cap the shoreline puts on a position', () => {
  it('is nothing where nothing reaches, rather than approved', () => {
    expect(shorelineCap(SOURCES, { latitude: 35.9, longitude: -75.2 })).toBeNull();
  });

  it('is the class of the one source that reaches', () => {
    expect(shorelineCap(SOURCES, { latitude: 34.721, longitude: -76.701 })).toBe(PROHIBITED);
  });

  it('is the strictest where several reach', () => {
    const near = { latitude: 34.7301, longitude: -76.6801 };
    expect(shorelineCap([yard, septic], near)).toBe(RESTRICTED);
    expect(shorelineCap([yard, septic, coLocatedOutfall], near)).toBe(PROHIBITED);
  });

  it('is the boatyard class where only the boatyard reaches', () => {
    expect(shorelineCap([yard], { latitude: 34.7301, longitude: -76.6801 })).toBe(RESTRICTED);
  });
});

describe('the cap over a whole area', () => {
  it('is the strictest cap at any of its stations', () => {
    const stations = [
      { latitude: 34.721, longitude: -76.701 },
      { latitude: 35.9, longitude: -75.2 },
    ];
    expect(areaCap(SOURCES, stations)).toBe(PROHIBITED);
  });

  it('is nothing where no station is reached', () => {
    expect(areaCap(SOURCES, [{ latitude: 35.9, longitude: -75.2 }])).toBeNull();
  });

  it('is nothing where there are no stations at all', () => {
    expect(areaCap(SOURCES, [])).toBeNull();
  });
});

describe('folding the two kinds of evidence', () => {
  it('leaves the bacteriological answer alone where there is no cap', () => {
    expect(capped(APPROVED, null)).toBe(APPROVED);
  });

  it('takes the cap where the cap is stricter', () => {
    expect(capped(APPROVED, RESTRICTED)).toBe(RESTRICTED);
    expect(capped(APPROVED, PROHIBITED)).toBe(PROHIBITED);
  });

  it('leaves the bacteriological answer where it is already stricter', () => {
    expect(capped(PROHIBITED, RESTRICTED)).toBe(PROHIBITED);
  });

  it('never returns something more permissive than either input', () => {
    for (const supported of [APPROVED, RESTRICTED, PROHIBITED]) {
      for (const cap of [APPROVED, CONDITIONALLY_APPROVED, RESTRICTED, PROHIBITED]) {
        const answer = capped(supported, cap);
        expect([supported, cap]).toContain(answer);
      }
    }
  });
});
