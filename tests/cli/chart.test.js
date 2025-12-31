import { describe, expect, it } from 'vitest';

import { chart } from '../../src/cli/commands/chart.js';
import { chartFor, renderChart } from '../../src/report/chart.js';
import { loadCase } from '../../src/cli/context.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { findArea } from '../../src/area/growingArea.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 9, 30);

const sheet = (areaId, day = on, extra = {}) =>
  chartFor({
    area: findArea(loaded.areas, areaId),
    stations: loaded.stations,
    beds: loaded.beds,
    sources: loaded.sources,
    plans: loaded.plans,
    orders: loaded.orders,
    boundaries: loaded.boundaries,
    on: day,
    ...extra,
  });

describe('what a chart holds', () => {
  it('reads the classification on the day asked about', () => {
    expect(sheet('B-12').held).toBe('conditionally approved');
    expect(sheet('B-12', civilDate(2019, 1, 1)).held).toBe('approved');
  });

  it('takes only what belongs to the area', () => {
    const one = sheet('B-12');
    expect(one.stations.every((entry) => entry.areaId === 'B-12')).toBe(true);
    expect(one.beds.every((entry) => entry.areaId === 'B-12')).toBe(true);
    expect(one.sources.every((entry) => entry.areaId === 'B-12')).toBe(true);
  });

  it('carries the boundary and the box around it', () => {
    const one = sheet('B-12');
    expect(one.boundary.vertices).toHaveLength(4);
    expect(one.box.north).toBeGreaterThan(one.box.south);
    expect(one.box.east).toBeGreaterThan(one.box.west);
  });

  it('has no box where no boundary is drawn', () => {
    const one = sheet('B-12', on, { boundaries: [] });
    expect(one.boundary).toBeNull();
    expect(one.box).toBeNull();
  });

  it('names the orders over the area and none over another', () => {
    expect(sheet('C-3').orders.map((one) => one.number)).toEqual(['EO-2025-04']);
    expect(sheet('B-12').orders).toEqual([]);
  });
});

describe('the rendered chart', () => {
  const text = renderChart(sheet('B-12'));

  it('names the area and the class it is held to', () => {
    expect(text).toContain('B-12 Broad Creek');
    expect(text).toMatch(/Classification: conditionally approved/);
  });

  it('prints the corners rather than drawing a picture', () => {
    expect(text).toMatch(/North:\s+34\.7450/);
    expect(text).toMatch(/Corners: 4/);
  });

  it('prints the classification history in full', () => {
    expect(text).toContain('2018-01-01');
    expect(text).toContain('2022-01-01');
    expect(text).toContain('shoreline');
  });

  it('names both instruments of the plan', () => {
    expect(text).toContain('closes on 1 inches at BRD');
    expect(text).toContain('reopens after 72 hours');
  });

  it('says plainly where there is nothing to print', () => {
    expect(text).toContain('No order has ever been signed over this area.');
    const bare = renderChart(sheet('D-9'));
    expect(bare).toContain('No station has ever been set in this area.');
  });

  it('names what is on the bank', () => {
    expect(text).toContain('marina');
    expect(text).toContain('MAR-1');
  });

  it('says plainly where the survey found nothing', () => {
    const bare = renderChart(sheet('D-2'));
    expect(bare).toContain('The shoreline survey found nothing discharging into this area.');
  });

  it('names the outfall the reach is named for', () => {
    expect(renderChart(sheet('D-9'))).toContain('WWTP-3');
  });

  it('is the same text twice', () => {
    expect(renderChart(sheet('B-12'))).toBe(text);
  });
});

describe('the chart command', () => {
  it('prints the sheet', () => {
    const io = recorder();
    expect(chart(base({ area: 'B-12', on: '2025-09-30' }), io)).toBe(OK);
    expect(io.out).toContain('Classification history');
  });

  it('prints it as JSON when asked', () => {
    const io = recorder();
    chart(base({ area: 'B-12', on: '2025-09-30', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.area).toBe('B-12');
    expect(answer.stations).toHaveLength(3);
    expect(answer.sources[0].cap).toBe('prohibited');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(chart(base({ area: 'Z-9', on: '2025-09-30' }), io)).toBe(REFUSED);
  });
});
