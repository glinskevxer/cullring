/**
 * Plain text tables, sized to what is in them.
 *
 * Everything this program prints goes to a terminal or into an email, so the
 * tables are fixed width and the columns are as wide as their widest cell up
 * to a cap. Nothing here draws a box: the office prints these and writes on
 * them, and a box just wastes the margin.
 *
 * A column knows how to align itself. Numbers go right so the decimal points
 * line up, which is the only reason anybody reads a column of numbers.
 */

import { padLeft, padRight } from './format.js';

export const LEFT = 'left';
export const RIGHT = 'right';

export function column(key, heading, { align = LEFT, width = null, cap = 40 } = {}) {
  return Object.freeze({ key, heading, align, width, cap });
}

export function widthsFor(columns, rows) {
  return columns.map((one) => {
    if (one.width !== null) {
      return one.width;
    }
    const longest = rows.reduce(
      (best, row) => Math.max(best, String(row[one.key] ?? '').length),
      one.heading.length,
    );
    return Math.min(longest, one.cap);
  });
}

export function renderTable(columns, rows, { rule = true, indent = '' } = {}) {
  const widths = widthsFor(columns, rows);
  const lines = [];
  lines.push(
    indent +
      line(
        columns,
        widths,
        columns.map((one) => one.heading),
      ),
  );
  if (rule) {
    lines.push(indent + widths.map((width) => '-'.repeat(width)).join('  '));
  }
  for (const row of rows) {
    lines.push(
      indent +
        line(
          columns,
          widths,
          columns.map((one) => row[one.key] ?? ''),
        ),
    );
  }
  return lines.join('\n');
}

function line(columns, widths, cells) {
  return cells
    .map((cell, index) =>
      columns[index].align === RIGHT ? padLeft(cell, widths[index]) : padRight(cell, widths[index]),
    )
    .join('  ')
    .replace(/\s+$/, '');
}

/** A heading with a rule under it, the width of the heading. */
export function heading(text, { underline = '=' } = {}) {
  return `${text}\n${underline.repeat(text.length)}`;
}

/** A two column list of label and value, which most of the reports open with. */
export function definitionList(pairs, { indent = '' } = {}) {
  const width = pairs.reduce((best, [label]) => Math.max(best, label.length), 0);
  return pairs
    .map(([label, value]) => `${indent}${padRight(`${label}:`, width + 1)} ${value}`)
    .join('\n');
}

/** Wrap a paragraph to a width on word boundaries. */
export function wrap(text, width = 78, { indent = '' } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = indent;
  for (const word of words) {
    if (current.trim() === '') {
      current = indent + word;
      continue;
    }
    if (current.length + 1 + word.length > width) {
      lines.push(current);
      current = indent + word;
      continue;
    }
    current = `${current} ${word}`;
  }
  if (current.trim() !== '') {
    lines.push(current);
  }
  return lines.join('\n');
}

export function bullets(items, { marker = '-', indent = '' } = {}) {
  return items.map((item) => `${indent}${marker} ${item}`).join('\n');
}
