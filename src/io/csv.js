/**
 * Reading the sheets the office actually receives.
 *
 * Every one of these files was typed by somebody in a hurry on a boat or at a
 * dock, and a reader that threw on the first bad row would be useless: the one
 * bad row is usually the one worth knowing about, and the other four hundred
 * still have to be read.
 *
 * So a read never throws on content. It comes back as rows and problems, and
 * every problem carries the line number it was on, because the person fixing
 * the file is looking at line numbers and not at field names.
 *
 * Quoting is the minimum that the domain needs: a field may be quoted, a quote
 * inside a quoted field is doubled, and a quoted field may hold a comma or a
 * newline. Nothing else. A dialect option would be a thing to get wrong later.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';

export function parseCsv(text, { headers = null, skipBlank = true } = {}) {
  if (typeof text !== 'string') {
    throw new InputError('csv.type', 'a sheet is read from text', { saw: typeof text });
  }
  const problems = findings();
  const lines = splitRecords(text);
  if (lines.length === 0) {
    problems.warn('csv.empty', 'the sheet is empty', {});
    return Object.freeze({ headers: [], rows: Object.freeze([]), problems });
  }
  const columns = headers ?? lines[0].fields.map((field) => field.trim());
  const start = headers === null ? 1 : 0;
  const rows = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (skipBlank && line.fields.length === 1 && line.fields[0].trim() === '') {
      continue;
    }
    if (line.fields.length !== columns.length) {
      problems.error(
        'csv.width',
        `line ${line.line} has ${line.fields.length} fields against ${columns.length}`,
        { line: line.line, saw: line.fields.length, wanted: columns.length },
      );
      continue;
    }
    const row = {};
    for (let column = 0; column < columns.length; column += 1) {
      row[columns[column]] = line.fields[column];
    }
    rows.push(Object.freeze({ line: line.line, values: Object.freeze(row) }));
  }
  return Object.freeze({ headers: Object.freeze(columns), rows: Object.freeze(rows), problems });
}

function splitRecords(text) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, fields });
    fields = [];
    recordLine = line;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
          continue;
        }
        quoted = false;
        continue;
      }
      if (character === '\n') {
        line += 1;
      }
      field += character;
      continue;
    }
    if (character === '"' && field === '') {
      quoted = true;
      continue;
    }
    if (character === ',') {
      endField();
      continue;
    }
    if (character === '\r') {
      continue;
    }
    if (character === '\n') {
      line += 1;
      endRecord();
      recordLine = line;
      continue;
    }
    field += character;
  }
  if (field !== '' || fields.length > 0) {
    endRecord();
  }
  return records;
}

/**
 * Turn rows into whatever the caller wants, keeping the line number on
 * anything that fails. The builder throwing is the ordinary way a row is
 * rejected, so the caller writes plain code and gets a line number for free.
 */
export function readRows(read, build) {
  const problems = findings();
  problems.absorb(read.problems);
  const built = [];
  for (const row of read.rows) {
    try {
      built.push(build(row.values, row.line));
    } catch (error) {
      problems.error('csv.row', `line ${row.line}: ${error.message}`, {
        line: row.line,
        cause: error.code ?? 'unknown',
      });
    }
  }
  return Object.freeze({ built: Object.freeze(built), problems });
}

export function writeCsv(headers, rows) {
  const out = [headers.map(quote).join(',')];
  for (const row of rows) {
    out.push(headers.map((header) => quote(row[header] ?? '')).join(','));
  }
  return `${out.join('\n')}\n`;
}

function quote(value) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
