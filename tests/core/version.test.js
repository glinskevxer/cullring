import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  NAME,
  VERSION,
  comparable,
  compareProvenance,
  provenance,
  provenanceLine,
} from '../../src/core/version.js';
import { SCHEMA_VERSION } from '../../src/io/schema.js';
import { codes } from '../../src/core/catalogue.js';
import { ruleNames } from '../../src/core/rules.js';
import { walk } from '../../src/cli/commands/month.js';
import { base, recorder } from '../support/cli.js';

describe('provenance', () => {
  it('carries the four things that decide an answer', () => {
    const one = provenance();
    expect(one).toEqual({
      programme: NAME,
      version: VERSION,
      schema: SCHEMA_VERSION,
      codes: codes().length,
      rules: ruleNames().length,
    });
  });

  it('agrees with the version in package.json', () => {
    const packaged = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(packaged.version).toBe(VERSION);
    expect(packaged.name).toBe(NAME);
  });

  it('reads as one line', () => {
    expect(provenanceLine()).toContain(`cullring ${VERSION}`);
    expect(provenanceLine()).toContain('register schema');
  });
});

describe('compareProvenance', () => {
  const one = provenance();

  it('says nothing changed when nothing did', () => {
    const answer = compareProvenance(one, provenance());
    expect(answer.same).toBe(true);
    expect(answer.changes).toEqual([]);
  });

  it('names each thing that moved rather than saying the programme changed', () => {
    const answer = compareProvenance(one, { ...one, version: '0.9.0', codes: one.codes - 3 });
    expect(answer.changes).toHaveLength(2);
    expect(answer.changes[0]).toContain('the programme went from');
    expect(answer.changes[1]).toContain('finding codes went from');
  });

  it('names a schema bump, which means the case itself was migrated', () => {
    expect(compareProvenance(one, { ...one, schema: 1 }).changes[0]).toContain(
      'register schema went from 2 to 1',
    );
  });

  it('names a rule change', () => {
    expect(compareProvenance(one, { ...one, rules: 4 }).changes[0]).toContain(
      'the rules went from',
    );
  });
});

describe('comparable', () => {
  it('says two reports from the same programme need no warning', () => {
    expect(comparable(provenance(), provenance())).toEqual({ comparable: true, warn: null });
  });

  it('still compares two from different programmes, and says so', () => {
    const answer = comparable(provenance(), { ...provenance(), version: '0.9.0' });
    expect(answer.comparable).toBe(true);
    expect(answer.warn).toContain('written by different programmes');
  });
});

describe('the walk', () => {
  it('seals the provenance as a piece of its own', () => {
    const io = recorder();
    walk(base({ on: '2025-08-31' }), io);
    expect(io.out).toContain('  provenance');
    expect(io.out).toContain(provenanceLine());
  });
});
