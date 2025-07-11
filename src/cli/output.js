/**
 * What the command line prints, and how it decides to stop.
 *
 * Two rules hold everywhere. Findings go to standard error and reports go to
 * standard output, so a report can be piped into a file without the findings
 * ending up in it. And the exit code says what happened rather than merely
 * whether the program crashed: nothing to report is 0, findings that are only
 * warnings is 0, an error finding is 1, and a request the program could not
 * carry out at all is 2.
 */

import { ERROR, WARNING } from '../core/finding.js';
import { describeError } from '../core/errors.js';

export const OK = 0;
export const FOUND = 1;
export const REFUSED = 2;

export function makeConsole({ out = process.stdout, err = process.stderr } = {}) {
  return {
    say(text) {
      out.write(`${text}\n`);
    },
    warn(text) {
      err.write(`${text}\n`);
    },
  };
}

export function printFindings(list, io, { quiet = false } = {}) {
  const held = typeof list.list === 'function' ? list.list() : list;
  if (held.length === 0) {
    return OK;
  }
  if (!quiet) {
    for (const finding of held) {
      io.warn(`${finding.severity}: ${finding.code}: ${finding.message}`);
    }
  }
  return held.some((one) => one.severity === ERROR) ? FOUND : OK;
}

export function countBySeverity(list) {
  const held = typeof list.list === 'function' ? list.list() : list;
  return {
    errors: held.filter((one) => one.severity === ERROR).length,
    warnings: held.filter((one) => one.severity === WARNING).length,
    total: held.length,
  };
}

/**
 * Run a command body, turning anything it throws into a refusal rather than a
 * stack trace. A defect still prints its message, because a defect the user
 * cannot describe is a defect nobody will report.
 */
export function guard(io, body) {
  try {
    return body();
  } catch (error) {
    const described = describeError(error);
    io.warn(`refused: ${described.code}: ${described.message}`);
    return REFUSED;
  }
}

/** Format a value as JSON the way the machine readable flag prints it. */
export function asJson(value) {
  return JSON.stringify(value, jsonReplacer, 2);
}

function jsonReplacer(key, value) {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Set) {
    return Array.from(value);
  }
  return value;
}
