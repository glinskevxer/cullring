/**
 * The exception report: everything wrong with one case, on one page.
 *
 * Every other report answers a question about one thing. This one answers the
 * question the office actually starts the week with, which is what is wrong
 * anywhere, and it is a different report rather than a loop over the others
 * because the useful part is the grouping.
 *
 * Findings are grouped twice. By family, because a case with forty findings in
 * one family has one problem and a case with four findings in ten families has
 * ten. And by severity, because an office that treats forty notes and one
 * error as forty one things to do will do the notes first, they being easier.
 *
 * What this deliberately does not do is decide what to fix. It ranks by count
 * and by severity, and the ranking is arithmetic rather than judgement, so
 * nobody reads it as the programme having an opinion about their week.
 */

import { ERROR, WARNING, tallyByCode } from '../core/finding.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';
import { describeCode, isKnownCode } from '../core/catalogue.js';

const FAMILY_COLUMNS = [
  column('family', 'Family', { width: 12 }),
  column('errors', 'Errors', { align: RIGHT, width: 7 }),
  column('warnings', 'Warnings', { align: RIGHT, width: 9 }),
  column('notes', 'Notes', { align: RIGHT, width: 6 }),
  column('worst', 'Worst code in it', { width: 26 }),
];

const CODE_COLUMNS = [
  column('code', 'Code', { width: 26 }),
  column('count', 'Times', { align: RIGHT, width: 6 }),
  column('says', 'What it means', { cap: 44 }),
];

/** The part of a code before the dot, which is the module that raised it. */
export function familyOf(code) {
  const at = code.indexOf('.');
  return at < 0 ? code : code.slice(0, at);
}

/**
 * Group a list of findings. The count per severity is kept per family rather
 * than summed, because one error in a family of thirty notes is the line worth
 * reading and a total would bury it.
 */
export function groupFindings(list) {
  const held = typeof list.list === 'function' ? list.list() : list;
  const families = new Map();
  for (const one of held) {
    const name = familyOf(one.code);
    const family = families.get(name) ?? {
      family: name,
      errors: 0,
      warnings: 0,
      notes: 0,
      worst: null,
    };
    if (one.severity === ERROR) {
      family.errors += 1;
    } else if (one.severity === WARNING) {
      family.warnings += 1;
    } else {
      family.notes += 1;
    }
    if (family.worst === null || rank(one.severity) < rank(family.worst.severity)) {
      family.worst = one;
    }
    families.set(name, family);
  }
  return Array.from(families.values())
    .map((one) => Object.freeze({ ...one, worst: one.worst.code }))
    .sort(byTrouble);
}

function rank(severity) {
  return severity === ERROR ? 0 : severity === WARNING ? 1 : 2;
}

function byTrouble(left, right) {
  if (left.errors !== right.errors) {
    return right.errors - left.errors;
  }
  if (left.warnings !== right.warnings) {
    return right.warnings - left.warnings;
  }
  if (left.notes !== right.notes) {
    return right.notes - left.notes;
  }
  return left.family < right.family ? -1 : 1;
}

/** The codes seen, most often first, with the line the catalogue keeps for each. */
export function codeRows(list) {
  const tally = tallyByCode(list);
  return Array.from(tally.entries())
    .map(([code, count]) =>
      Object.freeze({
        code,
        count,
        says: isKnownCode(code) ? describeCode(code).description : 'nothing in the catalogue',
      }),
    )
    .sort((left, right) =>
      left.count === right.count ? (left.code < right.code ? -1 : 1) : right.count - left.count,
    );
}

/**
 * The whole report. Every finding the case carries is handed in rather than
 * gathered here, because gathering means running every check, and a report
 * that quietly reran the checks would give a different answer from the reports
 * it is supposed to be summarising.
 */
export function exceptionReport({ on, findings: list, counts = {} }) {
  const held = typeof list.list === 'function' ? list.list() : list;
  const families = groupFindings(held);
  const codes = codeRows(held);
  return Object.freeze({
    on,
    total: held.length,
    errors: held.filter((one) => one.severity === ERROR).length,
    warnings: held.filter((one) => one.severity === WARNING).length,
    notes: held.filter((one) => one.severity === 'note').length,
    families: Object.freeze(families),
    codes: Object.freeze(codes),
    counts: Object.freeze({ ...counts }),
    clean: held.length === 0,
  });
}

export function renderException(report, { limit = 12 } = {}) {
  const out = [
    heading(`Exceptions as at ${report.on}`),
    '',
    definitionList([
      ['Findings', String(report.total)],
      ['Errors', String(report.errors)],
      ['Warnings', String(report.warnings)],
      ['Notes', String(report.notes)],
      ['Families touched', String(report.families.length)],
      ...Object.entries(report.counts).map(([what, howMany]) => [what, String(howMany)]),
    ]),
  ];
  if (report.clean) {
    out.push('', 'Nothing to report. That is unusual enough to be worth checking.');
    return out.join('\n');
  }
  out.push('', heading('By family', { underline: '-' }), '');
  out.push(
    renderTable(
      FAMILY_COLUMNS,
      report.families.map((one) => ({
        family: one.family,
        errors: String(one.errors),
        warnings: String(one.warnings),
        notes: String(one.notes),
        worst: one.worst,
      })),
    ),
  );
  out.push('', heading('By code', { underline: '-' }), '');
  out.push(
    renderTable(
      CODE_COLUMNS,
      report.codes.slice(0, limit).map((one) => ({
        code: one.code,
        count: String(one.count),
        says: one.says,
      })),
    ),
  );
  if (report.codes.length > limit) {
    out.push('', `${report.codes.length - limit} more codes are not shown.`);
  }
  return out.join('\n');
}

/**
 * The one number a manager asks for. It is not a score: it is the count of
 * errors, and it is named so that nobody reads a low number as a good week.
 */
export function errorCount(report) {
  return report.errors;
}
