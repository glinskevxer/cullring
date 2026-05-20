/**
 * What changed between two walks of the same case.
 *
 * The seal says which pieces are different. This says what is different inside
 * them, which is the question somebody has when the monthly walk comes out
 * unlike last month's and nobody remembers touching anything.
 *
 * The line comparison is the plainest one there is: a longest common
 * subsequence over whole lines. That is the right tool because the reports are
 * generated, so a line either is what it was or is not, and a cleverer diff
 * that matched partial lines would spend its cleverness on tables where every
 * cell is padded to a column width.
 *
 * What is deliberately not here is any attempt to explain a change. The report
 * says the geometric mean line for B-12 is different and prints both. Whether
 * that is a new sample, a reclassification or somebody editing the register by
 * hand is a question for the person reading it, and a programme that guessed
 * would be wrong exactly when it mattered.
 */

import { CHANGED, compareSeals, describeSealChange, normalise } from '../core/seal.js';
import { column, definitionList, heading, renderTable } from '../text/table.js';

export const SAME = ' ';
export const GONE = '-';
export const NEW = '+';

const CHANGE_COLUMNS = [
  column('name', 'Piece', { width: 16 }),
  column('what', 'What', { width: 9 }),
  column('lines', 'Lines', { width: 16 }),
];

/**
 * The longest common subsequence of two line lists, as a list of steps. The
 * table is built in full rather than banded, because a report is a few hundred
 * lines and the simple version is the one anybody can check.
 */
export function lineDiff(before, after) {
  const left = before;
  const right = after;
  const table = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const steps = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      steps.push({ mark: SAME, text: left[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      steps.push({ mark: GONE, text: left[i] });
      i += 1;
    } else {
      steps.push({ mark: NEW, text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) {
    steps.push({ mark: GONE, text: left[i] });
    i += 1;
  }
  while (j < right.length) {
    steps.push({ mark: NEW, text: right[j] });
    j += 1;
  }
  return steps;
}

/** The steps that are not the same, with a little of what surrounds them. */
export function withContext(steps, lines = 2) {
  const wanted = new Set();
  steps.forEach((step, index) => {
    if (step.mark === SAME) {
      return;
    }
    for (let at = index - lines; at <= index + lines; at += 1) {
      if (at >= 0 && at < steps.length) {
        wanted.add(at);
      }
    }
  });
  const out = [];
  let previous = -1;
  for (const index of Array.from(wanted).sort((left, right) => left - right)) {
    if (previous >= 0 && index > previous + 1) {
      out.push({ mark: SAME, text: '...', gap: true });
    }
    out.push(steps[index]);
    previous = index;
  }
  return out;
}

/**
 * The whole comparison. Two seals give the list of pieces that moved; the two
 * texts, where a caller has them, give the lines. A caller with only the seals
 * gets the list and is told plainly that there are no lines, rather than being
 * shown an empty diff that reads like nothing changed.
 */
export function diffReport({ before, after, beforePieces = null, afterPieces = null }) {
  const seals = compareSeals(before, after);
  const haveText = beforePieces !== null && afterPieces !== null;
  const byName = (list) => new Map((list ?? []).map((one) => [one.name, one.text]));
  const first = byName(beforePieces);
  const second = byName(afterPieces);

  const pieces = seals.changes.map((change) => {
    if (change.what !== CHANGED || !haveText) {
      return Object.freeze({ ...change, steps: Object.freeze([]), added: 0, removed: 0 });
    }
    const steps = lineDiff(
      normalise(first.get(change.name) ?? '').split('\n'),
      normalise(second.get(change.name) ?? '').split('\n'),
    );
    return Object.freeze({
      ...change,
      steps: Object.freeze(steps),
      added: steps.filter((one) => one.mark === NEW).length,
      removed: steps.filter((one) => one.mark === GONE).length,
    });
  });

  return Object.freeze({
    same: seals.same,
    haveText,
    beforeDigest: seals.before,
    afterDigest: seals.after,
    pieces: Object.freeze(pieces),
  });
}

export function renderDiff(report, { context = 2 } = {}) {
  const out = [
    heading('What changed between the two walks'),
    '',
    definitionList([
      ['Before', report.beforeDigest.slice(0, 16)],
      ['After', report.afterDigest.slice(0, 16)],
      ['Pieces that moved', String(report.pieces.length)],
      ['Lines compared', report.haveText ? 'yes' : 'no, only the seals were given'],
    ]),
  ];
  if (report.same) {
    out.push('', 'The two walks are the same, piece for piece.');
    return out.join('\n');
  }

  out.push(
    '',
    renderTable(
      CHANGE_COLUMNS,
      report.pieces.map((piece) => ({
        name: piece.name,
        what: piece.what,
        lines:
          piece.what === CHANGED && report.haveText
            ? `${piece.added} in, ${piece.removed} out`
            : '-',
      })),
    ),
  );

  for (const piece of report.pieces) {
    if (piece.steps.length === 0) {
      continue;
    }
    out.push('', heading(piece.name, { underline: '-' }), '');
    for (const step of withContext(piece.steps, context)) {
      out.push(`${step.mark} ${step.text}`);
    }
  }
  return out.join('\n');
}

/** The one line a script wants, for a job that only has to say yes or no. */
export function describeDiff(report) {
  if (report.same) {
    return 'the two walks are the same';
  }
  return report.pieces.map((piece) => describeSealChange(piece)).join('; ');
}
