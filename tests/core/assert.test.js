import { describe, expect, it } from 'vitest';

import {
  invariant,
  requireArray,
  requireNumber,
  requireObject,
  requireOneOf,
  requireString,
  required,
} from '../../src/core/assert.js';
import { InputError } from '../../src/core/errors.js';

describe('required', () => {
  it('returns the value so a guard can be inlined', () => {
    expect(required(0, 'count')).toBe(0);
    expect(required('', 'name')).toBe('');
    expect(required(false, 'iced')).toBe(false);
  });

  it.each([undefined, null])('refuses %s and names the field', (value) => {
    expect(() => required(value, 'harvestedAt')).toThrow(InputError);
    try {
      required(value, 'harvestedAt');
    } catch (error) {
      expect(error.code).toBe('field.missing');
      expect(error.detail.field).toBe('harvestedAt');
    }
  });
});

describe('requireString', () => {
  it('accepts text and hands it back', () => {
    expect(requireString('B12', 'area')).toBe('B12');
  });

  it('refuses a number with the type code', () => {
    expect(() => requireString(12, 'area')).toThrow(/must be text/);
  });

  it('refuses blank text by default', () => {
    expect(() => requireString('   ', 'area')).toThrow(/must not be empty/);
  });

  it('allows blank text when the caller says so', () => {
    expect(requireString('', 'note', { allowEmpty: true })).toBe('');
  });
});

describe('requireNumber', () => {
  it('accepts a plain number', () => {
    expect(requireNumber(3.5, 'inches')).toBe(3.5);
  });

  it.each([
    ['not a number', 'field.type'],
    [Number.NaN, 'field.type'],
    [Number.POSITIVE_INFINITY, 'field.range'],
  ])('refuses %s', (value, code) => {
    try {
      requireNumber(value, 'inches');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe(code);
    }
  });

  it('enforces a floor and a ceiling', () => {
    expect(() => requireNumber(-1, 'inches', { min: 0 })).toThrow(/at least 0/);
    expect(() => requireNumber(9, 'inches', { max: 5 })).toThrow(/at most 5/);
    expect(requireNumber(5, 'inches', { min: 0, max: 5 })).toBe(5);
  });

  it('enforces wholeness when asked', () => {
    expect(() => requireNumber(2.5, 'bags', { integer: true })).toThrow(/whole number/);
    expect(requireNumber(2, 'bags', { integer: true })).toBe(2);
  });
});

describe('requireOneOf', () => {
  it('accepts a listed value', () => {
    expect(requireOneOf('approved', 'class', ['approved', 'prohibited'])).toBe('approved');
  });

  it('lists what it would have accepted', () => {
    try {
      requireOneOf('open', 'class', ['approved', 'prohibited']);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('field.choice');
      expect(error.detail.allowed).toEqual(['approved', 'prohibited']);
    }
  });

  it('takes any iterable, not only an array', () => {
    expect(requireOneOf('a', 'letter', new Set(['a', 'b']))).toBe('a');
  });
});

describe('requireArray and requireObject', () => {
  it('accepts a list and enforces a minimum length', () => {
    expect(requireArray([1, 2], 'samples', { min: 2 })).toEqual([1, 2]);
    expect(() => requireArray([1], 'samples', { min: 2 })).toThrow(/at least 2 entries/);
  });

  it('refuses a record where a list is wanted', () => {
    expect(() => requireArray({}, 'samples')).toThrow(/must be a list/);
  });

  it('refuses a list where a record is wanted', () => {
    expect(() => requireObject([], 'plan')).toThrow(/must be a record/);
    expect(requireObject({ a: 1 }, 'plan')).toEqual({ a: 1 });
  });
});

describe('invariant', () => {
  it('is silent when the contract holds', () => {
    expect(() => invariant(true, 'holds')).not.toThrow();
  });

  it('throws a plain error, because it is never the caller who is wrong', () => {
    expect(() => invariant(false, 'the walk must settle')).toThrow(
      /invariant: the walk must settle/,
    );
  });
});
