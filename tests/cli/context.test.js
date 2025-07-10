import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FEEDS, REGISTER_FILE, contextOf, loadCase } from '../../src/cli/context.js';

const EXAMPLE = 'examples/core-sound';

describe('the worked example loads clean', () => {
  const loaded = loadCase(EXAMPLE);

  it('reads every register', () => {
    expect(loaded.areas).toHaveLength(5);
    expect(loaded.plans).toHaveLength(2);
    expect(loaded.stations).toHaveLength(8);
    expect(loaded.beds).toHaveLength(6);
    expect(loaded.harvesters).toHaveLength(4);
    expect(loaded.dealers).toHaveLength(5);
  });

  it('reads every feed', () => {
    expect(loaded.feed.readings.length).toBeGreaterThan(50);
    expect(loaded.tides.length).toBeGreaterThan(50);
    expect(loaded.samples.length).toBeGreaterThan(400);
    expect(loaded.records).toHaveLength(10);
    expect(loaded.book.length).toBeGreaterThan(20);
    expect(loaded.underControl.size).toBe(10);
  });

  it('has nothing to complain about', () => {
    expect(loaded.problems.list()).toEqual([]);
  });

  it('keeps the zone the office works in', () => {
    expect(loaded.zone).toBe('eastern');
  });

  it('hands a rule module everything it wants', () => {
    const context = contextOf(loaded);
    expect(context.areas).toBe(loaded.areas);
    expect(context.feed.readings).toBe(loaded.feed.readings);
    expect(context.beds).toBe(loaded.beds);
    expect(context.from).toBeNull();
  });
});

describe('a case directory with things missing', () => {
  let directory;

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'cullring-'));
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reports a register that is not there', () => {
    const loaded = loadCase(directory);
    expect(loaded.problems.has('case.noRegister')).toBe(true);
    expect(loaded.areas).toEqual([]);
  });

  it('reports a register that will not parse', () => {
    writeFileSync(join(directory, REGISTER_FILE), '{ not json');
    const loaded = loadCase(directory);
    expect(loaded.problems.has('case.badRegister')).toBe(true);
  });

  it('notes a missing feed rather than failing on it', () => {
    writeFileSync(join(directory, REGISTER_FILE), JSON.stringify({ areas: [], plans: [] }));
    const loaded = loadCase(directory);
    expect(loaded.problems.has('case.noFeed')).toBe(true);
    expect(loaded.problems.hasError()).toBe(false);
  });

  it('reports a feed that is there and unreadable, with the file named', () => {
    writeFileSync(join(directory, REGISTER_FILE), JSON.stringify({ areas: [], plans: [] }));
    writeFileSync(join(directory, FEEDS.readings), 'gauge,at,value\nBRD,not a time,1\n');
    const loaded = loadCase(directory);
    const finding = loaded.problems.list().find((one) => one.code === 'csv.row');
    expect(finding.message).toMatch(/gauge\.csv/);
    expect(finding.message).toMatch(/line 2/);
  });

  it('reports a control sheet row it cannot read', () => {
    writeFileSync(join(directory, REGISTER_FILE), JSON.stringify({ areas: [], plans: [] }));
    writeFileSync(join(directory, FEEDS.control), 'lot,at\n20250814-B12-001,never\n');
    const loaded = loadCase(directory);
    expect(loaded.problems.has('case.control')).toBe(true);
  });

  it('reads a control sheet that is fine', () => {
    writeFileSync(join(directory, REGISTER_FILE), JSON.stringify({ areas: [], plans: [] }));
    writeFileSync(join(directory, FEEDS.control), 'lot,at\n20250814-B12-001,2025-08-14 12:00\n');
    const loaded = loadCase(directory);
    expect(loaded.underControl.get('20250814-B12-001').epochSecond).toBeGreaterThan(0);
  });
});

describe('the file names are the ones the office uses', () => {
  it('names the register and every feed', () => {
    expect(REGISTER_FILE).toBe('register.json');
    expect(Object.values(FEEDS)).toEqual([
      'gauge.csv',
      'bypass.csv',
      'tide.csv',
      'samples.csv',
      'landings.csv',
      'ledger.csv',
      'control.csv',
    ]);
  });
});
