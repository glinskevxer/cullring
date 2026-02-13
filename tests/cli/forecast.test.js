import { describe, expect, it } from 'vitest';

import { forecastCommand } from '../../src/cli/commands/forecast.js';
import { loadCase } from '../../src/cli/context.js';
import { loadForecast } from '../../src/io/load.js';
import { isForecast } from '../../src/condition/forecast.js';
import { FOUND, OK } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);

describe('the forecast feed', () => {
  it('is read from its own file, not merged into the gauge feed', () => {
    expect(loaded.forecast.length).toBeGreaterThan(0);
    expect(loaded.feed.readings.every((one) => !isForecast(one))).toBe(true);
  });

  it('marks every reading in it as a forecast', () => {
    expect(loaded.forecast.every(isForecast)).toBe(true);
  });

  it('carries the confidence the service gave', () => {
    expect(loaded.forecast[0].confidence).toBeGreaterThan(0);
  });

  it('reports a row it cannot read, by line', () => {
    const answer = loadForecast('gauge,at,value\nBRD,not a time,1\n');
    expect(answer.problems.has('csv.row')).toBe(true);
  });

  it('reads a blank confidence as none rather than as nought', () => {
    const answer = loadForecast('gauge,at,value,confidence\nBRD,2025-10-03 06:00,0.4,\n');
    expect(answer.built[0].confidence).toBeNull();
  });
});

describe('the forecast command', () => {
  it('says how much forecast it read and what it would do', () => {
    const io = recorder();
    expect(forecastCommand(base(), io)).toBe(FOUND);
    expect(io.out).toContain('What the forecast would close');
    expect(io.out).toMatch(/Forecast readings: 5/);
  });

  it('shuts the area whose gauge the forecast reaches and leaves the other open', () => {
    const io = recorder();
    forecastCommand(base(), io);
    expect(io.out).toMatch(/B-12 would shut on 1\.3 inches against 1/);
    expect(io.out).toContain('B-14 would stay open');
  });

  it('shuts on the accumulation, which no single forecast reading reaches', () => {
    const io = recorder();
    forecastCommand(base(), io);
    const rain = loaded.forecast.filter((one) => one.gauge === 'BRD');
    expect(rain.every((one) => one.value < 1)).toBe(true);
    expect(io.out).toMatch(/B-12 .*yes/);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    forecastCommand(base({ json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.readings).toBe(5);
    expect(answer.areas.find((one) => one.area === 'B-12').wouldClose).toBe(true);
  });

  it('exits clean and says so where there is no forecast', () => {
    const io = recorder();
    expect(forecastCommand(base({ case: 'examples' }), io)).toBe(OK);
    expect(io.out).toContain('There is no forecast loaded, so nothing can be said.');
  });
});
