import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { checkSchema } from '../../src/io/schema.js';
import { loadCase } from '../../src/cli/context.js';
import { readFileSync } from 'node:fs';

const root = 'examples';
const cases = readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory());

describe('every worked example', () => {
  it('there is more than one, so nothing is tuned to a single case', () => {
    expect(cases.length).toBeGreaterThan(1);
  });

  it.each(cases)('%s loads with no error', (name) => {
    const loaded = loadCase(join(root, name));
    expect(loaded.problems.of('error')).toEqual([]);
  });

  it.each(cases)('%s declares the register version', (name) => {
    const register = JSON.parse(readFileSync(join(root, name, 'register.json'), 'utf8'));
    const schema = checkSchema(register);
    expect(schema.version).not.toBe(null);
    expect(schema.unknown).toEqual([]);
    expect(schema.tooNew).toEqual([]);
  });

  it.each(cases)('%s carries areas, plans and beds', (name) => {
    const loaded = loadCase(join(root, name));
    expect(loaded.areas.length).toBeGreaterThan(0);
    expect(loaded.plans.length).toBeGreaterThan(0);
    expect(loaded.beds.length).toBeGreaterThan(0);
  });

  it('the two cases do not share an area id, so nothing can be confused between them', () => {
    const ids = cases.map((name) => loadCase(join(root, name)).areas.map((one) => one.id));
    const all = ids.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('the two cases do not share a licence number either', () => {
    const all = cases.flatMap((name) => loadCase(join(root, name)).harvesters.map((one) => one.id));
    expect(new Set(all).size).toBe(all.length);
  });
});
