import { describe, expect, it } from 'vitest';

import {
  SCHEMA_VERSION,
  checkSchema,
  keysAddedIn,
  knownKeys,
  looksLike,
  readVersion,
  versionOf,
} from '../../src/io/schema.js';

describe('the key list', () => {
  it('grows with the version and never shrinks', () => {
    expect(knownKeys(1).length).toBeLessThan(knownKeys(2).length);
    for (const key of knownKeys(1)) {
      expect(knownKeys(2)).toContain(key);
    }
  });

  it('says which version first knew a key', () => {
    expect(versionOf('areas')).toBe(1);
    expect(versionOf('embargoes')).toBe(2);
    expect(versionOf('nothing')).toBe(null);
  });

  it('lists what a version added', () => {
    expect(keysAddedIn(2)).toContain('seasons');
    expect(keysAddedIn(9)).toEqual([]);
  });
});

describe('readVersion', () => {
  it('reads a declared version', () => {
    const read = readVersion({ version: 2 });
    expect(read.version).toBe(2);
    expect(read.declared).toBe(true);
    expect(read.problems.isClean()).toBe(true);
  });

  it('reads an unversioned file as the first, and says so', () => {
    const read = readVersion({ areas: [] });
    expect(read.version).toBe(1);
    expect(read.declared).toBe(false);
    expect(read.problems.codes()).toEqual(['schema.unversioned']);
  });

  it('refuses a version it does not keep rather than reading the nearest one', () => {
    const read = readVersion({ version: 4 });
    expect(read.version).toBe(null);
    expect(read.problems.codes()).toEqual(['schema.version']);
  });

  it('refuses a version that is not a whole number', () => {
    expect(readVersion({ version: '2' }).version).toBe(null);
    expect(readVersion({ version: 1.5 }).version).toBe(null);
  });
});

describe('looksLike', () => {
  it('finds the key somebody meant to type', () => {
    expect(looksLike('embargos', knownKeys())).toBe('embargoes');
    expect(looksLike('Areas', knownKeys())).toBe('areas');
  });

  it('gives up rather than guessing wildly', () => {
    expect(looksLike('tideCharts', knownKeys())).toBe(null);
  });
});

describe('checkSchema', () => {
  it('passes a current register', () => {
    const answer = checkSchema({ version: SCHEMA_VERSION, areas: [], embargoes: [] });
    expect(answer.problems.isClean()).toBe(true);
    expect(answer.unknown).toEqual([]);
  });

  it('catches the mistyped key that would otherwise load fine and hold nothing', () => {
    const answer = checkSchema({ version: 2, embargos: [] });
    expect(answer.unknown).toEqual(['embargos']);
    expect(answer.problems.list()[0].message).toContain('did you mean embargoes');
  });

  it('says a key nothing reads even when it cannot guess', () => {
    const answer = checkSchema({ version: 2, tideCharts: [] });
    expect(answer.problems.codes()).toEqual(['schema.unknownKey']);
    expect(answer.problems.list()[0].detail.guess).toBe(null);
  });

  it('warns about a file hand edited past its own version', () => {
    const answer = checkSchema({ version: 1, areas: [], embargoes: [] });
    expect(answer.tooNew).toEqual(['embargoes']);
    expect(answer.problems.codes()).toContain('schema.aheadOfVersion');
  });

  it('says nothing about a key the version knows and the office does not keep', () => {
    const answer = checkSchema({ version: 2, areas: [] });
    expect(answer.problems.isClean()).toBe(true);
  });

  it('stops at a version it cannot read rather than reporting every key as unknown', () => {
    const answer = checkSchema({ version: 9, areas: [] });
    expect(answer.version).toBe(null);
    expect(answer.unknown).toEqual([]);
    expect(answer.problems.codes()).toEqual(['schema.version']);
  });

  it('reads an unversioned register as one and holds it to that', () => {
    const answer = checkSchema({ areas: [], seasons: [] });
    expect(answer.version).toBe(1);
    expect(answer.tooNew).toEqual(['seasons']);
  });
});

describe('the version key itself', () => {
  it('is allowed at every version, because a version one file may say it is one', () => {
    expect(knownKeys(1)).toContain('version');
    expect(checkSchema({ version: 1, areas: [] }).problems.isClean()).toBe(true);
  });

  it('belongs to no version, so nothing ever calls it ahead of its file', () => {
    expect(versionOf('version')).toBe(null);
    expect(keysAddedIn(2)).not.toContain('version');
  });
});
