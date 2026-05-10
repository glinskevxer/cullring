import { describe, expect, it } from 'vitest';

import {
  ADDED,
  ALGORITHM,
  CHANGED,
  MOVED,
  REMOVED,
  compareSeals,
  describeSealChange,
  digestOf,
  normalise,
  seal,
  sealFromJson,
  sealToJson,
} from '../../src/core/seal.js';

const pieces = (extra = []) => [
  { name: 'standing', text: 'B-12 approved' },
  { name: 'month', text: 'eleven landings' },
  ...extra,
];

describe('normalise', () => {
  it('reads the three line endings as one', () => {
    expect(normalise('a\r\nb')).toBe('a\nb');
    expect(normalise('a\rb')).toBe('a\nb');
    expect(normalise('a\nb')).toBe('a\nb');
  });

  it('drops trailing space, which is not what changed', () => {
    expect(normalise('a   \nb\t')).toBe('a\nb');
  });

  it('drops trailing blank lines', () => {
    expect(normalise('a\n\n\n')).toBe('a');
  });

  it('keeps a blank line in the middle, which is layout', () => {
    expect(normalise('a\n\nb')).toBe('a\n\nb');
  });

  it('refuses anything that is not text', () => {
    expect(() => normalise(12)).toThrow(/a seal is taken over text/);
  });
});

describe('digestOf', () => {
  it('gives the same answer for the same text', () => {
    expect(digestOf('hello')).toBe(digestOf('hello'));
  });

  it('gives the same answer for the same report written on two machines', () => {
    expect(digestOf('a\r\nb\r\n')).toBe(digestOf('a\nb'));
  });

  it('gives a different answer for different text', () => {
    expect(digestOf('a')).not.toBe(digestOf('b'));
  });
});

describe('seal', () => {
  it('hashes the whole and every piece', () => {
    const sealed = seal(pieces());
    expect(sealed.algorithm).toBe(ALGORITHM);
    expect(sealed.count).toBe(2);
    expect(sealed.pieces.map((one) => one.name)).toEqual(['standing', 'month']);
    expect(sealed.digest).toHaveLength(64);
  });

  it('is the same seal twice', () => {
    expect(seal(pieces()).digest).toBe(seal(pieces()).digest);
  });

  it('changes the whole when any piece changes', () => {
    const other = seal([{ name: 'standing', text: 'B-12 restricted' }, pieces()[1]]);
    expect(other.digest).not.toBe(seal(pieces()).digest);
  });

  it('refuses two pieces with the same name, which would hide one of them', () => {
    expect(() => seal([pieces()[0], pieces()[0]])).toThrow(/two pieces are both called standing/);
  });

  it('refuses a piece with no name or no text', () => {
    expect(() => seal([{ text: 'x' }])).toThrow(/has no name and text/);
    expect(() => seal([{ name: 'x' }])).toThrow(/has no name and text/);
  });

  it('refuses anything that is not a list of pieces', () => {
    expect(() => seal('everything')).toThrow(/a list of named pieces/);
  });

  it('seals an empty walk rather than refusing it', () => {
    expect(seal([]).count).toBe(0);
  });
});

describe('compareSeals', () => {
  const before = seal(pieces());

  it('says two identical walks are the same and lists nothing', () => {
    const answer = compareSeals(before, seal(pieces()));
    expect(answer.same).toBe(true);
    expect(answer.changes).toEqual([]);
  });

  it('names the one piece that changed rather than the whole walk', () => {
    const after = seal([{ name: 'standing', text: 'B-12 restricted' }, pieces()[1]]);
    const answer = compareSeals(before, after);
    expect(answer.same).toBe(false);
    expect(answer.changes).toHaveLength(1);
    expect(answer.changes[0]).toMatchObject({ name: 'standing', what: CHANGED });
  });

  it('names a piece that is new', () => {
    const after = seal(pieces([{ name: 'survey D-9', text: 'thin' }]));
    expect(compareSeals(before, after).changes).toEqual([{ name: 'survey D-9', what: ADDED }]);
  });

  it('names a piece that is gone', () => {
    const after = seal([pieces()[0]]);
    expect(compareSeals(before, after).changes).toEqual([{ name: 'month', what: REMOVED }]);
  });

  it('tells a piece that moved from a piece that changed, because only one is a bug', () => {
    const after = seal([pieces()[1], pieces()[0]]);
    const answer = compareSeals(before, after);
    expect(answer.changes.map((one) => one.what)).toEqual([MOVED, MOVED]);
    expect(answer.same).toBe(false);
  });

  it('says what happened in words', () => {
    expect(describeSealChange({ name: 'month', what: ADDED })).toBe('month is new');
    expect(describeSealChange({ name: 'month', what: REMOVED })).toBe('month is gone');
    expect(describeSealChange({ name: 'month', what: CHANGED })).toBe('month changed');
    expect(describeSealChange({ name: 'month', what: MOVED, from: 0, to: 1 })).toBe(
      'month moved from 1 to 2',
    );
  });
});

describe('writing a seal out and reading it back', () => {
  it('round trips', () => {
    const sealed = seal(pieces());
    const back = sealFromJson(sealToJson(sealed));
    expect(back.digest).toBe(sealed.digest);
    expect(back.pieces.map((one) => one.name)).toEqual(['standing', 'month']);
    expect(compareSeals(sealed, back).same).toBe(true);
  });

  it('writes something a person can read', () => {
    expect(sealToJson(seal(pieces()))).toContain('"algorithm": "sha256"');
  });

  it('refuses something that is not a seal', () => {
    expect(() => sealFromJson('{"hello":1}')).toThrow(/not a seal this programme wrote/);
  });
});
