import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  OURS,
  RULE_BOOK,
  define,
  isDefined,
  ourWords,
  renderGlossaryDocument,
  ruleBookWords,
  words,
} from '../../src/core/glossary.js';
import { CLASSIFICATIONS } from '../../src/area/classification.js';

describe('the glossary', () => {
  it('defines every classification', () => {
    for (const name of CLASSIFICATIONS) {
      expect(isDefined(name)).toBe(true);
    }
  });

  it('lists its words sorted', () => {
    expect(words()).toEqual(words().slice().sort());
  });

  it('says where every word came from', () => {
    for (const word of words()) {
      expect([RULE_BOOK, OURS]).toContain(define(word).source);
    }
  });

  it('gives every word a meaning worth reading', () => {
    for (const word of words()) {
      expect(define(word).meaning.length).toBeGreaterThan(25);
    }
  });

  it('marks the words this programme invented, and there are some', () => {
    expect(ourWords().length).toBeGreaterThan(2);
    expect(ourWords()).toContain('the walk');
    expect(ourWords()).toContain('trailing period');
  });

  it('does not claim a classification as its own invention', () => {
    for (const name of CLASSIFICATIONS) {
      expect(define(name).source).toBe(RULE_BOOK);
    }
  });

  it('splits cleanly into the two sources', () => {
    expect([...ourWords(), ...ruleBookWords()].sort()).toEqual(words());
  });

  it('refuses a word it does not hold', () => {
    expect(isDefined('cullring')).toBe(false);
    expect(() => define('cullring')).toThrow(/is not in the glossary/);
  });
});

describe('the glossary document', () => {
  it('holds a line per word', () => {
    const text = renderGlossaryDocument();
    for (const word of words()) {
      expect(text).toContain(`**${word}**`);
    }
  });

  it('marks the invented words in the document as well', () => {
    const text = renderGlossaryDocument();
    for (const word of ourWords()) {
      expect(text).toContain(`**${word}** **ours**`);
    }
  });

  it('is what is on disk', () => {
    expect(readFileSync('docs/glossary.md', 'utf8')).toBe(renderGlossaryDocument());
  });

  it('is the same text twice and ends with one newline', () => {
    const text = renderGlossaryDocument();
    expect(renderGlossaryDocument()).toBe(text);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});

describe('the design note', () => {
  const text = readFileSync('docs/design.md', 'utf8');

  it('names all six compositions', () => {
    for (const module of [
      'src/survey/evaluate.js',
      'src/survey/strategy.js',
      'src/survey/shoreline.js',
      'src/condition/',
      'src/vibrio/clock.js',
      'src/area/effective.js',
    ]) {
      expect(text).toContain(module);
    }
  });

  it('names every layer the source actually has', () => {
    const rows = text.split('\n').filter((line) => line.startsWith('| '));
    const named = rows.map((line) => line.split('|')[1].trim());
    for (const layer of ['core', 'time', 'geo', 'registers', 'rules', 'reports', 'cli']) {
      expect(named).toContain(layer);
    }
  });

  it('says what the seal is claiming', () => {
    expect(text).toContain('cullring walk');
    expect(text).toContain('sha256');
  });
});
