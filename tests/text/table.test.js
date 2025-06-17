import { describe, expect, it } from 'vitest';

import {
  LEFT,
  RIGHT,
  bullets,
  column,
  definitionList,
  heading,
  renderTable,
  widthsFor,
  wrap,
} from '../../src/text/table.js';

const columns = [
  column('area', 'Area'),
  column('class', 'Class'),
  column('gm', 'Geo mean', { align: RIGHT }),
];

const rows = [
  { area: 'B-12', class: 'conditionally approved', gm: '5.6' },
  { area: 'C-3', class: 'approved', gm: '12.44' },
];

describe('column widths', () => {
  it('is the widest cell, or the heading if that is wider', () => {
    expect(widthsFor(columns, rows)).toEqual([4, 22, 8]);
  });

  it('takes a fixed width when the column names one', () => {
    expect(widthsFor([column('area', 'Area', { width: 12 })], rows)).toEqual([12]);
  });

  it('does not grow past the cap', () => {
    const wide = [{ area: 'x'.repeat(90) }];
    expect(widthsFor([column('area', 'Area')], wide)).toEqual([40]);
    expect(widthsFor([column('area', 'Area', { cap: 10 })], wide)).toEqual([10]);
  });

  it('reads a missing cell as empty rather than as undefined', () => {
    expect(widthsFor([column('missing', 'Gone')], rows)).toEqual([4]);
  });
});

describe('rendering a table', () => {
  it('puts the headings on the first line', () => {
    expect(renderTable(columns, rows).split('\n')[0]).toBe(
      'Area  Class                   Geo mean',
    );
  });

  it('rules under the headings', () => {
    expect(renderTable(columns, rows).split('\n')[1]).toBe(
      '----  ----------------------  --------',
    );
  });

  it('leaves the rule off when asked', () => {
    expect(renderTable(columns, rows, { rule: false }).split('\n')).toHaveLength(3);
  });

  it('aligns a right column so the numbers line up', () => {
    const lines = renderTable(columns, rows).split('\n');
    expect(lines[2].endsWith('     5.6')).toBe(true);
    expect(lines[3].endsWith('   12.44')).toBe(true);
  });

  it('leaves no trailing space on any line', () => {
    for (const line of renderTable(columns, rows).split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
  });

  it('indents every line when asked', () => {
    for (const line of renderTable(columns, rows, { indent: '    ' }).split('\n')) {
      expect(line.startsWith('    ')).toBe(true);
    }
  });

  it('renders a table with no rows as headings and a rule', () => {
    expect(renderTable(columns, []).split('\n')).toHaveLength(2);
  });

  it('defaults a column to the left', () => {
    expect(column('a', 'A').align).toBe(LEFT);
  });
});

describe('headings and lists', () => {
  it('rules a heading to its own width', () => {
    expect(heading('Standing')).toBe('Standing\n========');
    expect(heading('Standing', { underline: '-' })).toBe('Standing\n--------');
  });

  it('lines up a definition list on the colon', () => {
    const text = definitionList([
      ['Area', 'B-12'],
      ['Classification', 'conditionally approved'],
    ]);
    expect(text.split('\n')[0]).toBe('Area:           B-12');
  });

  it('indents a definition list when asked', () => {
    expect(definitionList([['Area', 'B-12']], { indent: '  ' }).startsWith('  Area:')).toBe(true);
  });

  it('marks up bullets', () => {
    expect(bullets(['one', 'two'])).toBe('- one\n- two');
    expect(bullets(['one'], { marker: '*', indent: '  ' })).toBe('  * one');
  });
});

describe('wrapping', () => {
  it('breaks on word boundaries inside the width', () => {
    const text = wrap('one two three four five six seven eight nine ten', 20);
    for (const line of text.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it('keeps every word', () => {
    const words = 'one two three four five six seven eight nine ten';
    expect(wrap(words, 20).split(/\s+/).join(' ')).toBe(words);
  });

  it('collapses runs of space', () => {
    expect(wrap('one    two', 40)).toBe('one two');
  });

  it('indents every line', () => {
    for (const line of wrap('one two three four five six', 20, { indent: '  ' }).split('\n')) {
      expect(line.startsWith('  ')).toBe(true);
    }
  });

  it('wraps nothing to nothing', () => {
    expect(wrap('', 40)).toBe('');
    expect(wrap('   ', 40)).toBe('');
  });
});
