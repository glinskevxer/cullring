/**
 * Reports as a sheet, for the people who want them in a spreadsheet.
 *
 * Half the requests this office gets are somebody wanting the standing chart
 * in a column they can sort. A report already has rows and named columns, so
 * this is a rendering rather than a second report: the same rows, written with
 * commas instead of spaces, and nothing computed twice.
 *
 * The findings do not go in the sheet. A spreadsheet row is one record and a
 * finding is a sentence about a record, and the two do not belong in the same
 * table however convenient it would be. They go to standard error the way they
 * do for every other rendering.
 */

import { InputError } from '../core/errors.js';
import { writeCsv } from '../io/csv.js';

/**
 * Render rows through the same column definitions the table renderer uses, so
 * the sheet and the printed report cannot show different columns.
 */
export function renderSheet(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new InputError('sheet.columns', 'a sheet needs at least one column', {});
  }
  const headers = columns.map((one) => one.heading);
  return writeCsv(
    headers,
    rows.map((row) => {
      const out = {};
      for (const one of columns) {
        out[one.heading] = row[one.key] ?? '';
      }
      return out;
    }),
  );
}

/** The headings a set of columns produces, for anything that wants them alone. */
export function headingsOf(columns) {
  return columns.map((one) => one.heading);
}

/**
 * A sheet from a report that carries its own columns. Every report that can be
 * written as a sheet exports the pair, so that adding a column to the printed
 * report adds it to the sheet in the same commit.
 */
export function sheetFor(report) {
  if (report === null || report === undefined || !Array.isArray(report.rows)) {
    throw new InputError('sheet.report', 'that report has no rows to write', {});
  }
  if (!Array.isArray(report.columns)) {
    throw new InputError('sheet.report', 'that report does not carry its columns', {});
  }
  return renderSheet(report.columns, report.rows);
}

export function canWriteSheet(report) {
  return (
    report !== null &&
    report !== undefined &&
    Array.isArray(report.rows) &&
    Array.isArray(report.columns)
  );
}
