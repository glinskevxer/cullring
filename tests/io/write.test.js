import { describe, expect, it } from 'vitest';

import {
  writeAreas,
  writeBeds,
  writeCertificates,
  writeDealers,
  writeHarvesters,
  writeInspections,
  writeLandings,
  writeOrders,
  writePlans,
  writeRegister,
  writeReopening,
  writeSources,
  writeStations,
  writeTrigger,
} from '../../src/io/write.js';
import {
  loadAreas,
  loadBeds,
  loadCertificates,
  loadDealers,
  loadHarvests,
  loadHarvesters,
  loadInspections,
  loadOrders,
  loadPlans,
  loadSources,
  loadStations,
} from '../../src/io/load.js';
import { loadCase } from '../../src/cli/context.js';
import { CASE } from '../support/cli.js';

const loaded = loadCase(CASE);

/** A writer is only worth anything if the loader reads its output back the same. */
const roundTrip = (write, load, held) => load({ x: write(held) });

describe('the round trip', () => {
  it.each([
    ['areas', writeAreas, (value) => loadAreas({ areas: value.x })],
    ['stations', writeStations, (value) => loadStations({ stations: value.x })],
    ['beds', writeBeds, (value) => loadBeds({ beds: value.x })],
    ['harvesters', writeHarvesters, (value) => loadHarvesters({ harvesters: value.x })],
    ['dealers', writeDealers, (value) => loadDealers({ dealers: value.x })],
    ['plans', writePlans, (value) => loadPlans({ plans: value.x })],
    ['sources', writeSources, (value) => loadSources({ sources: value.x })],
    ['certificates', writeCertificates, (value) => loadCertificates({ certificates: value.x })],
    ['inspections', writeInspections, (value) => loadInspections({ inspections: value.x })],
  ])('reads %s back exactly as they went in', (field, write, load) => {
    const held = loaded[field];
    const answer = roundTrip(write, load, held);
    expect(answer.problems.hasError()).toBe(false);
    expect(answer.built).toEqual(held);
  });

  it('reads the orders back, instants and all', () => {
    const answer = loadOrders({ orders: writeOrders(loaded.orders, loaded.zone) });
    expect(answer.problems.hasError()).toBe(false);
    expect(answer.built).toEqual(loaded.orders);
  });

  it('reads the landings sheet back', () => {
    const answer = loadHarvests(writeLandings(loaded.records, loaded.zone));
    expect(answer.problems.hasError()).toBe(false);
    expect(answer.built).toEqual(loaded.records);
  });

  it('survives a second round trip unchanged, which is the stronger claim', () => {
    const once = writeAreas(loaded.areas);
    const twice = writeAreas(loadAreas({ areas: once }).built);
    expect(twice).toEqual(once);
  });
});

describe('the triggers and reopening rules', () => {
  it('writes each trigger kind in the shape the loader wants', () => {
    for (const plan of loaded.plans) {
      const written = writeTrigger(plan.trigger);
      expect(written.kind).toBe(plan.trigger.kind);
    }
  });

  it('writes each reopening kind with its own field name', () => {
    expect(writeReopening({ kind: 'after hours', target: { quantity: 72 } })).toEqual({
      kind: 'after hours',
      hours: 72,
    });
    expect(writeReopening({ kind: 'after samples', target: { quantity: 2 } })).toEqual({
      kind: 'after samples',
      count: 2,
    });
    expect(writeReopening({ kind: 'after tides', target: { quantity: 1 } })).toEqual({
      kind: 'after tides',
      cycles: 1,
    });
    expect(
      writeReopening({ kind: 'on date', target: { on: { year: 2025, month: 9, day: 16 } } }),
    ).toEqual({ kind: 'on date', on: '2025-09-16' });
  });
});

describe('what the writer leaves out', () => {
  it('omits an optional field rather than writing null', () => {
    const written = writeBeds(loaded.beds);
    const publicBottom = written.find((one) => one.tenure === 'public');
    expect('holder' in publicBottom).toBe(false);
  });

  it('omits an empty suspension list', () => {
    const written = writeHarvesters(loaded.harvesters);
    const quiet = written.find((one) => one.id === 'SH-2025-04412');
    expect('suspensions' in quiet).toBe(false);
  });

  it('keeps a suspension list that has something in it', () => {
    const written = writeHarvesters(loaded.harvesters);
    const held = written.find((one) => one.id === 'SH-2025-00877');
    expect(held.suspensions).toHaveLength(1);
  });
});

describe('the whole register', () => {
  const written = writeRegister(loaded);

  it('holds every list the loader reads', () => {
    for (const field of [
      'areas',
      'plans',
      'stations',
      'beds',
      'harvesters',
      'dealers',
      'sources',
      'orders',
      'certificates',
      'inspections',
    ]) {
      expect(Array.isArray(written[field])).toBe(true);
    }
  });

  it('keeps the zone the office works in', () => {
    expect(written.zone).toBe('eastern');
  });

  it('loads back with nothing to report', () => {
    for (const [load, field] of [
      [loadAreas, 'areas'],
      [loadPlans, 'plans'],
      [loadBeds, 'beds'],
      [loadDealers, 'dealers'],
    ]) {
      expect(load(written).problems.hasError()).toBe(false);
      expect(load(written).built).toHaveLength(loaded[field].length);
    }
  });

  it('is the same object twice', () => {
    expect(writeRegister(loaded)).toEqual(written);
  });
});
