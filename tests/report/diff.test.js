import { describe, expect, it } from 'vitest';

import {
  GONE,
  NEW,
  SAME,
  describeDiff,
  diffReport,
  lineDiff,
  renderDiff,
  withContext,
} from '../../src/report/diff.js';
import { seal } from '../../src/core/seal.js';

const before = [
  { name: 'standing', text: 'B-12 approved\nB-14 restricted\nC-3 approved' },
  { name: 'month', text: 'eleven landings' },
];

const after = [
  { name: 'standing', text: 'B-12 restricted\nB-14 restricted\nC-3 approved' },
  { name: 'month', text: 'eleven landings' },
];

const build = (left = before, right = after) =>
  diffReport({
    before: seal(left),
    after: seal(right),
    beforePieces: left,
    afterPieces: right,
  });

describe('lineDiff', () => {
  it('marks every line the same when nothing moved', () => {
    const steps = lineDiff(['a', 'b'], ['a', 'b']);
    expect(steps.map((one) => one.mark)).toEqual([SAME, SAME]);
  });

  it('marks a replaced line out and in', () => {
    const steps = lineDiff(['a', 'b'], ['a', 'c']);
    expect(steps.map((one) => one.mark)).toEqual([SAME, GONE, NEW]);
    expect(steps[2].text).toBe('c');
  });

  it('keeps the lines that did not move rather than replacing the whole block', () => {
    const steps = lineDiff(['a', 'b', 'c'], ['a', 'x', 'b', 'c']);
    expect(steps.filter((one) => one.mark === SAME).map((one) => one.text)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(steps.filter((one) => one.mark === NEW)).toHaveLength(1);
  });

  it('reads an empty side as everything gone or everything new', () => {
    expect(lineDiff(['a'], []).map((one) => one.mark)).toEqual([GONE]);
    expect(lineDiff([], ['a']).map((one) => one.mark)).toEqual([NEW]);
    expect(lineDiff([], [])).toEqual([]);
  });
});

describe('withContext', () => {
  const long = Array.from({ length: 20 }, (unused, index) => `line ${index}`);

  it('shows only what moved and a little around it', () => {
    const steps = lineDiff(
      long,
      long.map((line, index) => (index === 10 ? 'changed' : line)),
    );
    const shown = withContext(steps, 1);
    expect(shown.length).toBeLessThan(steps.length);
    expect(shown.some((one) => one.text === 'changed')).toBe(true);
  });

  it('marks the gap where it skipped', () => {
    const changed = long.map((line, index) => (index === 2 || index === 17 ? 'changed' : line));
    const shown = withContext(lineDiff(long, changed), 1);
    expect(shown.some((one) => one.gap === true)).toBe(true);
  });

  it('shows nothing at all when nothing moved', () => {
    expect(withContext(lineDiff(long, long))).toEqual([]);
  });
});

describe('diffReport', () => {
  it('names the one piece that moved and counts its lines', () => {
    const report = build();
    expect(report.same).toBe(false);
    expect(report.pieces).toHaveLength(1);
    expect(report.pieces[0]).toMatchObject({ name: 'standing', added: 1, removed: 1 });
  });

  it('says the two walks are the same when they are', () => {
    const report = build(before, before);
    expect(report.same).toBe(true);
    expect(report.pieces).toEqual([]);
  });

  it('works from the seals alone and says the lines were never given', () => {
    const report = diffReport({ before: seal(before), after: seal(after) });
    expect(report.haveText).toBe(false);
    expect(report.pieces[0].steps).toEqual([]);
  });

  it('names a piece that is new without pretending to diff it', () => {
    const grown = [...after, { name: 'survey D-9', text: 'thin' }];
    const report = build(before, grown);
    const added = report.pieces.find((one) => one.name === 'survey D-9');
    expect(added.what).toBe('added');
    expect(added.steps).toEqual([]);
  });

  it('is unmoved by the line endings the report was written with', () => {
    const windows = before.map((piece) => ({
      ...piece,
      text: piece.text.split('\n').join('\r\n'),
    }));
    expect(build(before, windows).same).toBe(true);
  });
});

describe('renderDiff', () => {
  it('says the two are the same in one line', () => {
    expect(renderDiff(build(before, before))).toContain('the same, piece for piece');
  });

  it('prints the table and then the lines', () => {
    const text = renderDiff(build());
    expect(text).toContain('Pieces that moved: 1');
    expect(text).toContain('- B-12 approved');
    expect(text).toContain('+ B-12 restricted');
  });

  it('says when it only had the seals', () => {
    const text = renderDiff(diffReport({ before: seal(before), after: seal(after) }));
    expect(text).toContain('no, only the seals were given');
  });

  it('is the same text twice', () => {
    expect(renderDiff(build())).toBe(renderDiff(build()));
  });

  it('gives a script one line to read', () => {
    expect(describeDiff(build(before, before))).toBe('the two walks are the same');
    expect(describeDiff(build())).toBe('standing changed');
  });
});
