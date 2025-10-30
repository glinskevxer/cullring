import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  codes,
  describeCode,
  families,
  family,
  isKnownCode,
  renderCatalogueDocument,
} from '../../src/core/catalogue.js';
import { SEVERITIES } from '../../src/core/finding.js';

describe('the catalogue', () => {
  it('holds a good many codes across the rule families', () => {
    expect(codes().length).toBeGreaterThan(60);
    expect(families()).toContain('harvest');
    expect(families()).toContain('vibrio');
    expect(families()).toContain('trace');
  });

  it('lists them sorted, so a document built from it is stable', () => {
    expect(codes()).toEqual(codes().slice().sort());
    expect(families()).toEqual(families().slice().sort());
  });

  it('gives every code a severity the finding module knows', () => {
    for (const code of codes()) {
      expect(SEVERITIES).toContain(describeCode(code).severity);
    }
  });

  it('gives every code a description worth reading', () => {
    for (const code of codes()) {
      expect(describeCode(code).description.length).toBeGreaterThan(15);
    }
  });

  it('refuses a code it does not hold', () => {
    expect(isKnownCode('harvest.closedWater')).toBe(true);
    expect(isKnownCode('harvest.somethingElse')).toBe(false);
    expect(() => describeCode('harvest.somethingElse')).toThrow(/is not a finding/);
  });

  it('groups a family and holds every member of it', () => {
    const vibrio = family('vibrio');
    expect(vibrio.length).toBeGreaterThan(4);
    for (const code of vibrio) {
      expect(code.startsWith('vibrio.')).toBe(true);
    }
  });

  it('has no family with only one code, which would suggest a stray prefix', () => {
    for (const prefix of families()) {
      expect(family(prefix).length).toBeGreaterThan(1);
    }
  });

  it('covers every family the codes name', () => {
    const covered = families().flatMap((prefix) => family(prefix));
    expect(covered.sort()).toEqual(codes());
  });
});

describe('the findings document', () => {
  it('holds a section per family', () => {
    const text = renderCatalogueDocument();
    for (const prefix of families()) {
      expect(text).toContain(`## ${prefix}`);
    }
  });

  it('holds a line per code with its severity', () => {
    const text = renderCatalogueDocument();
    for (const code of codes()) {
      expect(text).toContain(`\`${code}\` (${describeCode(code).severity})`);
    }
  });

  it('is what is on disk', () => {
    expect(readFileSync('docs/findings.md', 'utf8')).toBe(renderCatalogueDocument());
  });

  it('ends with one newline and is the same text twice', () => {
    const text = renderCatalogueDocument();
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(renderCatalogueDocument()).toBe(text);
  });
});
