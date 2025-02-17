import { describe, expect, it } from 'vitest';

import {
  ERROR,
  NOTE,
  SEVERITIES,
  WARNING,
  asError,
  asNote,
  asWarning,
  compareFinding,
  finding,
  findings,
  summarise,
  tallyByCode,
  toList,
} from '../../src/core/finding.js';

describe('building a finding', () => {
  it('holds its parts and freezes the detail', () => {
    const item = finding(ERROR, 'area.closed', 'the area was closed', { area: 'B12' });
    expect(item.severity).toBe(ERROR);
    expect(item.code).toBe('area.closed');
    expect(item.detail).toEqual({ area: 'B12' });
    expect(Object.isFrozen(item.detail)).toBe(true);
  });

  it('copies the detail so a later change cannot reach the finding', () => {
    const detail = { area: 'B12' };
    const item = finding(NOTE, 'a.b', 'text', detail);
    detail.area = 'C99';
    expect(item.detail.area).toBe('B12');
  });

  it('refuses a severity it does not know, and lists the ones it does', () => {
    try {
      finding('fatal', 'a.b', 'text');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('finding.severity');
      expect(error.detail.known).toEqual(SEVERITIES.slice());
    }
  });

  it('refuses an empty code or message', () => {
    expect(() => finding(ERROR, '', 'text')).toThrow(/code/);
    expect(() => finding(ERROR, 'a.b', '')).toThrow(/message/);
  });

  it('has a shorthand for each severity', () => {
    expect(asError('a', 'b').severity).toBe(ERROR);
    expect(asWarning('a', 'b').severity).toBe(WARNING);
    expect(asNote('a', 'b').severity).toBe(NOTE);
  });
});

describe('ordering', () => {
  it('puts errors before warnings before notes', () => {
    const list = [asNote('c', 'c'), asError('a', 'a'), asWarning('b', 'b')];
    expect(list.sort(compareFinding).map((item) => item.severity)).toEqual([ERROR, WARNING, NOTE]);
  });

  it('orders by code within a severity, and by message within a code', () => {
    const list = [asError('b.b', 'x'), asError('a.a', 'z'), asError('a.a', 'y')];
    expect(list.sort(compareFinding).map((item) => `${item.code}:${item.message}`)).toEqual([
      'a.a:y',
      'a.a:z',
      'b.b:x',
    ]);
  });

  it('calls two identical findings equal', () => {
    expect(compareFinding(asError('a', 'b'), asError('a', 'b'))).toBe(0);
  });
});

describe('the collector', () => {
  it('starts empty and clean', () => {
    const list = findings();
    expect(list.length).toBe(0);
    expect(list.isClean()).toBe(true);
    expect(list.isLawful()).toBe(true);
    expect(list.worst()).toBeNull();
  });

  it('takes an initial list', () => {
    expect(findings([asError('a', 'b')]).length).toBe(1);
  });

  it('chains, because a check adds several in a row', () => {
    const list = findings().error('a', 'one').warn('b', 'two').note('c', 'three');
    expect(list.length).toBe(3);
    expect(list.codes()).toEqual(['a', 'b', 'c']);
  });

  it('reports the worst severity it holds', () => {
    expect(findings().note('a', 'x').worst()).toBe(NOTE);
    expect(findings().note('a', 'x').warn('b', 'y').worst()).toBe(WARNING);
    expect(findings().note('a', 'x').error('b', 'y').worst()).toBe(ERROR);
  });

  it('is unlawful the moment an error lands, and warnings do not do that', () => {
    expect(findings().warn('a', 'x').isLawful()).toBe(true);
    expect(findings().warn('a', 'x').isClean()).toBe(false);
    expect(findings().error('a', 'x').isLawful()).toBe(false);
  });

  it('answers whether it holds a code', () => {
    const list = findings().error('area.closed', 'x');
    expect(list.has('area.closed')).toBe(true);
    expect(list.has('area.open')).toBe(false);
  });

  it('filters by severity in sorted order', () => {
    const list = findings().error('b', 'x').error('a', 'y').warn('c', 'z');
    expect(list.of(ERROR).map((item) => item.code)).toEqual(['a', 'b']);
    expect(list.of(WARNING)).toHaveLength(1);
  });

  it('keeps insertion order in raw and sorted order in list', () => {
    const list = findings().warn('z', 'x').error('a', 'y');
    expect(list.raw().map((item) => item.code)).toEqual(['z', 'a']);
    expect(list.list().map((item) => item.code)).toEqual(['a', 'z']);
  });

  it('absorbs another collector and a plain array', () => {
    const inner = findings().error('inner', 'x');
    const outer = findings()
      .warn('outer', 'y')
      .absorb(inner)
      .absorb([asNote('third', 'z')]);
    expect(outer.codes().sort()).toEqual(['inner', 'outer', 'third']);
  });

  it('refuses to absorb something that is neither', () => {
    expect(() => findings().absorb('nonsense')).toThrow(/list of findings/);
  });
});

describe('counting', () => {
  it('tallies by code', () => {
    const list = findings().error('a', 'x').error('a', 'y').warn('b', 'z');
    const tally = tallyByCode(list);
    expect(tally.get('a')).toBe(2);
    expect(tally.get('b')).toBe(1);
    expect(tally.get('c')).toBeUndefined();
  });

  it('summarises by severity', () => {
    const list = findings().error('a', 'x').warn('b', 'y').note('c', 'z').note('d', 'w');
    expect(summarise(list)).toEqual({ total: 4, errors: 1, warnings: 1, notes: 2 });
  });

  it('summarises an empty list as all zeroes', () => {
    expect(summarise([])).toEqual({ total: 0, errors: 0, warnings: 0, notes: 0 });
  });

  it('reads a plain array as a list', () => {
    expect(toList([asError('a', 'b')])).toHaveLength(1);
  });
});
