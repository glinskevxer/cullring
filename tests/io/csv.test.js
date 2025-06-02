import { describe, expect, it } from 'vitest';

import { parseCsv, readRows, writeCsv } from '../../src/io/csv.js';

const SHEET = [
  'id,name,note',
  'B-12,Broad Creek,"has a comma, here"',
  'B-14,"Cedar ""Bay""",fine',
  'bad,row',
  'C-3,Middle Sound,ok',
  '',
].join('\n');

describe('reading a sheet', () => {
  it('takes the first line as the headers', () => {
    expect(parseCsv(SHEET).headers).toEqual(['id', 'name', 'note']);
  });

  it('reads the rows into records keyed by header', () => {
    const read = parseCsv(SHEET);
    expect(read.rows[0].values).toEqual({
      id: 'B-12',
      name: 'Broad Creek',
      note: 'has a comma, here',
    });
  });

  it('keeps the line number each row was on', () => {
    expect(parseCsv(SHEET).rows.map((row) => row.line)).toEqual([2, 3, 5]);
  });

  it('reads a comma inside a quoted field', () => {
    expect(parseCsv(SHEET).rows[0].values.note).toBe('has a comma, here');
  });

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv(SHEET).rows[1].values.name).toBe('Cedar "Bay"');
  });

  it('reports a short row with its line number and carries on', () => {
    const read = parseCsv(SHEET);
    expect(read.rows).toHaveLength(3);
    expect(read.problems.has('csv.width')).toBe(true);
    expect(read.problems.list()[0].detail.line).toBe(4);
  });

  it('takes headers from the caller when the sheet carries none', () => {
    const read = parseCsv('B-12,Broad Creek\nC-3,Middle Sound\n', { headers: ['id', 'name'] });
    expect(read.rows).toHaveLength(2);
    expect(read.rows[0].line).toBe(1);
  });

  it('warns about an empty sheet rather than failing', () => {
    const read = parseCsv('');
    expect(read.rows).toEqual([]);
    expect(read.problems.has('csv.empty')).toBe(true);
  });

  it('reads a newline inside a quoted field as part of the field', () => {
    const read = parseCsv('id,note\nB-12,"first\nsecond"\nC-3,plain\n');
    expect(read.rows[0].values.note).toBe('first\nsecond');
    expect(read.rows[1].values.id).toBe('C-3');
  });

  it('keeps the line count right after a field holding a newline', () => {
    const read = parseCsv('id,note\nB-12,"first\nsecond"\nC-3,plain\n');
    expect(read.rows.map((row) => row.line)).toEqual([2, 4]);
  });

  it('does not mind carriage returns', () => {
    const read = parseCsv('id,name\r\nB-12,Broad Creek\r\n');
    expect(read.rows[0].values.name).toBe('Broad Creek');
  });

  it('refuses something that is not text at all', () => {
    expect(() => parseCsv(null)).toThrow(/read from text/);
  });

  it('skips a blank line in the middle', () => {
    const read = parseCsv('id,name\nB-12,Broad Creek\n\nC-3,Middle Sound\n');
    expect(read.rows).toHaveLength(2);
    expect(read.problems.hasError()).toBe(false);
  });
});

describe('building records out of rows', () => {
  const build = (values) => {
    if (values.id === 'bad') {
      throw new Error('that is not an area');
    }
    return { id: values.id.toUpperCase() };
  };

  it('builds what it can', () => {
    const read = parseCsv('id,name\nB-12,Broad Creek\nC-3,Middle Sound\n');
    const answer = readRows(read, build);
    expect(answer.built.map((one) => one.id)).toEqual(['B-12', 'C-3']);
    expect(answer.problems.hasError()).toBe(false);
  });

  it('reports the line number of a row the builder refused', () => {
    const read = parseCsv('id,name\nB-12,Broad Creek\nbad,thing\nC-3,Middle Sound\n');
    const answer = readRows(read, build);
    expect(answer.built).toHaveLength(2);
    expect(answer.problems.has('csv.row')).toBe(true);
    expect(answer.problems.list()[0].message).toMatch(/line 3/);
  });

  it('carries the reading problems through as well', () => {
    const answer = readRows(parseCsv(SHEET), (values) => values);
    expect(answer.problems.has('csv.width')).toBe(true);
  });

  it('passes the line number to the builder', () => {
    const read = parseCsv('id\nB-12\nC-3\n');
    const answer = readRows(read, (values, line) => ({ id: values.id, line }));
    expect(answer.built.map((one) => one.line)).toEqual([2, 3]);
  });
});

describe('writing a sheet', () => {
  it('writes the headers and the rows', () => {
    expect(writeCsv(['id', 'name'], [{ id: 'B-12', name: 'Broad Creek' }])).toBe(
      'id,name\nB-12,Broad Creek\n',
    );
  });

  it('quotes a field holding a comma, a quote or a newline', () => {
    expect(writeCsv(['a'], [{ a: 'x, y' }])).toBe('a\n"x, y"\n');
    expect(writeCsv(['a'], [{ a: 'x"y' }])).toBe('a\n"x""y"\n');
    expect(writeCsv(['a'], [{ a: 'x\ny' }])).toBe('a\n"x\ny"\n');
  });

  it('writes a missing field as blank rather than as undefined', () => {
    expect(writeCsv(['a', 'b'], [{ a: 'x' }])).toBe('a,b\nx,\n');
  });

  it('round trips through the reader', () => {
    const rows = [
      { id: 'B-12', name: 'has, a comma' },
      { id: 'C-3', name: 'plain' },
    ];
    const read = parseCsv(writeCsv(['id', 'name'], rows));
    expect(read.rows.map((row) => row.values)).toEqual(rows);
  });
});
