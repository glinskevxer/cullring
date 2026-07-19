import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LIMITS,
  byteLength,
  depthOf,
  describeLimits,
  guardBytes,
  guardFeed,
  guardField,
  guardRegister,
  guardRows,
} from '../../src/io/guard.js';
import { loadCase } from '../../src/cli/context.js';
import { parseCsv } from '../../src/io/csv.js';

describe('byteLength', () => {
  it('counts bytes rather than characters', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('ø')).toBe(2);
  });
});

describe('guardBytes', () => {
  it('lets an ordinary file through', () => {
    expect(guardBytes('a,b\n1,2', { what: 'a sheet' })).toBe('a,b\n1,2');
  });

  it('refuses one over the limit, naming the file and the size', () => {
    expect(() => guardBytes('x'.repeat(300), { what: 'a sheet', limit: 100 })).toThrow(
      /a sheet is 300 bytes, over the 100 bytes limit/,
    );
  });

  it('says megabytes when the numbers are big, because bytes are unreadable', () => {
    expect(() =>
      guardBytes('x'.repeat(2 * 1024 * 1024), { what: 'a sheet', limit: 1024 * 1024 }),
    ).toThrow(/2MB, over the 1MB limit/);
  });
});

describe('guardRows and guardField', () => {
  it('lets an ordinary count through', () => {
    expect(guardRows(400, { what: 'a sheet' })).toBe(400);
  });

  it('refuses a count over the limit', () => {
    expect(() => guardRows(500, { what: 'a sheet', limit: 100 })).toThrow(/holds 500 rows/);
  });

  it('refuses a field longer than anybody types', () => {
    expect(() => guardField('x'.repeat(50), { what: 'a sheet', limit: 10 })).toThrow(
      /a field of 50 characters/,
    );
  });

  it("lets anything that is not text past, because that is another rule's job", () => {
    expect(guardField(12, { what: 'a sheet', limit: 1 })).toBe(12);
  });
});

describe('depthOf', () => {
  it('reads a flat value as one', () => {
    expect(depthOf(4)).toBe(1);
    expect(depthOf(null)).toBe(1);
  });

  it('counts the nesting', () => {
    expect(depthOf({ a: { b: { c: 1 } } })).toBe(4);
    expect(depthOf([[[1]]])).toBe(4);
  });

  it('stops as soon as it is deeper than the limit', () => {
    let deep = 1;
    for (let index = 0; index < 200; index += 1) {
      deep = [deep];
    }
    expect(depthOf(deep, 10)).toBeGreaterThan(10);
  });
});

describe('guardRegister', () => {
  it('parses an ordinary register', () => {
    expect(guardRegister('{"areas":[]}')).toEqual({ areas: [] });
  });

  it('refuses one nested past the limit', () => {
    let deep = '1';
    for (let index = 0; index < LIMITS.depth + 5; index += 1) {
      deep = `[${deep}]`;
    }
    expect(() => guardRegister(deep)).toThrow(/nests \d+ deep/);
  });

  it('refuses a list longer than any register holds', () => {
    const many = JSON.stringify({ areas: new Array(LIMITS.listLength + 1).fill(0) });
    expect(() => guardRegister(many)).toThrow(/entries under areas/);
  });

  it('still throws the parse error for something that is not JSON', () => {
    expect(() => guardRegister('{ not json')).toThrow();
  });
});

describe('guardFeed', () => {
  it('lets an ordinary sheet through', () => {
    expect(guardFeed('a,b\n1,2\n', 'gauge.csv')).toContain('a,b');
  });

  it('counts the lines without splitting the file', () => {
    const many = 'a\n'.repeat(LIMITS.rows + 2);
    expect(() => guardFeed(many, 'gauge.csv')).toThrow(/holds more than \d+ lines/);
  });
});

describe('the guards in the reading path', () => {
  it('refuses a sheet with a field nobody typed', () => {
    expect(() => parseCsv(`a,b\n1,${'x'.repeat(LIMITS.fieldLength + 1)}\n`)).toThrow(
      /a field of \d+ characters/,
    );
  });

  it('turns a refused feed into a finding rather than a crash', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cullring-'));
    writeFileSync(join(directory, 'register.json'), '{"version":2,"areas":[]}', 'utf8');
    writeFileSync(join(directory, 'gauge.csv'), 'gauge,at,value\n'.repeat(LIMITS.rows + 2), 'utf8');
    const loaded = loadCase(directory);
    expect(loaded.problems.codes()).toContain('case.unreadable');
    expect(loaded.feed.readings).toEqual([]);
  });

  it('reads both worked examples without tripping anything', () => {
    for (const name of ['core-sound', 'white-oak']) {
      const loaded = loadCase(`examples/${name}`);
      expect(loaded.problems.codes()).not.toContain('case.unreadable');
    }
  });
});

describe('describeLimits', () => {
  it('prints every limit in words', () => {
    const rows = describeLimits();
    expect(rows).toHaveLength(6);
    expect(rows[0][1]).toContain('MB');
  });
});
