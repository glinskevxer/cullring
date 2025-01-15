import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  CullringError,
  InputError,
  NotFoundError,
  RuleError,
  describeError,
  isCullringError,
} from '../../src/core/errors.js';

describe('the error types', () => {
  it('carries a code and a detail bag', () => {
    const error = new CullringError('some.code', 'something went wrong', { field: 'name' });
    expect(error.code).toBe('some.code');
    expect(error.message).toBe('something went wrong');
    expect(error.detail).toEqual({ field: 'name' });
  });

  it('defaults the detail bag so callers can read it without a guard', () => {
    expect(new CullringError('c', 'm').detail).toEqual({});
  });

  it('serialises to the shape the reports print', () => {
    const error = new RuleError('rule.broken', 'the area is closed', { area: 'B12' });
    expect(error.toJSON()).toEqual({
      code: 'rule.broken',
      message: 'the area is closed',
      detail: { area: 'B12' },
    });
  });

  it.each([
    [InputError, 'InputError'],
    [RuleError, 'RuleError'],
    [NotFoundError, 'NotFoundError'],
    [ConfigError, 'ConfigError'],
  ])('names itself so a catch can tell the kinds apart', (Kind, name) => {
    const error = new Kind('x', 'y');
    expect(error.name).toBe(name);
    expect(error).toBeInstanceOf(CullringError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('isCullringError', () => {
  it('accepts every kind the program raises', () => {
    expect(isCullringError(new InputError('a', 'b'))).toBe(true);
    expect(isCullringError(new RuleError('a', 'b'))).toBe(true);
  });

  it('rejects an ordinary error, which is a defect rather than a finding', () => {
    expect(isCullringError(new TypeError('boom'))).toBe(false);
    expect(isCullringError('boom')).toBe(false);
    expect(isCullringError(null)).toBe(false);
  });
});

describe('describeError', () => {
  it('passes ours through untouched', () => {
    const error = new NotFoundError('area.unknown', 'no area B99', { id: 'B99' });
    expect(describeError(error)).toEqual({
      code: 'area.unknown',
      message: 'no area B99',
      detail: { id: 'B99' },
    });
  });

  it('keeps the text of a foreign error under the internal code', () => {
    expect(describeError(new RangeError('out of range'))).toEqual({
      code: 'internal',
      message: 'out of range',
      detail: {},
    });
  });

  it('does not crash on a thrown string or object', () => {
    expect(describeError('just text').message).toBe('just text');
    expect(describeError({ a: 1 }).code).toBe('internal');
  });
});
