import { describe, expect, it } from 'vitest';

import { LANDINGS, REGISTER, SHAPES, exportCase, narrowTo } from '../../src/cli/commands/export.js';
import { loadCase } from '../../src/cli/context.js';
import { loadAreas, loadHarvests, loadPlans } from '../../src/io/load.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);

describe('narrowing a case to one area', () => {
  const narrow = narrowTo(loaded, 'B-12');

  it('keeps the one area and drops the rest', () => {
    expect(narrow.areas.map((one) => one.id)).toEqual(['B-12']);
  });

  it('keeps only what belongs to that water', () => {
    expect(narrow.plans.every((one) => one.area === 'B-12')).toBe(true);
    expect(narrow.stations.every((one) => one.areaId === 'B-12')).toBe(true);
    expect(narrow.beds.every((one) => one.areaId === 'B-12')).toBe(true);
    expect(narrow.sources.every((one) => one.areaId === 'B-12')).toBe(true);
  });

  it('keeps only the landings off that water', () => {
    expect(narrow.records.every((one) => one.areaId === 'B-12')).toBe(true);
    expect(narrow.records.length).toBeLessThan(loaded.records.length);
  });

  it('keeps the licences and certifications, which are not attached to water', () => {
    expect(narrow.harvesters).toEqual(loaded.harvesters);
    expect(narrow.dealers).toEqual(loaded.dealers);
  });

  it('keeps an order that names the area and drops one that does not', () => {
    expect(narrowTo(loaded, 'C-3').orders.map((one) => one.number)).toEqual(['EO-2025-04']);
    expect(narrowTo(loaded, 'B-12').orders).toEqual([]);
  });
});

describe('the export command', () => {
  it('writes the whole register as JSON', () => {
    const io = recorder();
    expect(exportCase(base(), io)).toBe(OK);
    const written = JSON.parse(io.out);
    expect(written.areas).toHaveLength(5);
    expect(written.zone).toBe('eastern');
  });

  it('writes a register the loader reads straight back', () => {
    const io = recorder();
    exportCase(base(), io);
    const written = JSON.parse(io.out);
    expect(loadAreas(written).built).toEqual(loaded.areas);
    expect(loadPlans(written).built).toEqual(loaded.plans);
  });

  it('narrows to one area when asked', () => {
    const io = recorder();
    exportCase(base({ area: 'B-12' }), io);
    const written = JSON.parse(io.out);
    expect(written.areas).toHaveLength(1);
    expect(written.beds.every((one) => one.id.startsWith('B12'))).toBe(true);
  });

  it('writes the landings sheet when asked for that shape', () => {
    const io = recorder();
    exportCase(base({ shape: LANDINGS }), io);
    expect(io.lines[0]).toBe(
      'lot,harvester,bed,gear,species,form,startedAt,landedAt,containers,dealer,iced',
    );
    expect(io.lines).toHaveLength(loaded.records.length + 1);
  });

  it('writes a landings sheet the loader reads straight back', () => {
    const io = recorder();
    exportCase(base({ shape: LANDINGS }), io);
    const answer = loadHarvests(`${io.out}\n`);
    expect(answer.problems.hasError()).toBe(false);
    expect(answer.built).toEqual(loaded.records);
  });

  it('narrows the landings to a day', () => {
    const io = recorder();
    exportCase(base({ shape: LANDINGS, on: '2025-08-14' }), io);
    expect(io.lines).toHaveLength(5);
  });

  it('narrows the landings to an area and a day at once', () => {
    const io = recorder();
    exportCase(base({ shape: LANDINGS, area: 'B-12', on: '2025-08-14' }), io);
    expect(io.lines).toHaveLength(3);
  });

  it('names the two shapes it writes', () => {
    expect(SHAPES).toEqual([REGISTER, LANDINGS]);
  });

  it('refuses a shape it does not write', () => {
    const io = recorder();
    expect(exportCase(base({ shape: 'geojson' }), io)).toBe(REFUSED);
    expect(io.err).toContain('is not a shape this command writes');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(exportCase(base({ area: 'Z-9' }), io)).toBe(REFUSED);
  });
});
