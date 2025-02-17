/**
 * Findings, and the list a check hands back.
 *
 * Nothing in the rule layer throws when it disagrees with a record. A harvest
 * that broke three rules broke three rules, and stopping at the first one
 * would send the harvester back out to be told about the second. So a check
 * collects findings and the caller decides what a list of them means.
 *
 * Severity is not a comment. An error means the thing under examination is not
 * lawful. A warning means it is lawful and somebody should look. A note means
 * the program had to make an assumption and is saying so out loud, which is
 * the only way an assumption ever gets found.
 */

import { requireString } from './assert.js';
import { InputError } from './errors.js';

export const ERROR = 'error';
export const WARNING = 'warning';
export const NOTE = 'note';

export const SEVERITIES = Object.freeze([ERROR, WARNING, NOTE]);

const RANK = Object.freeze({ [ERROR]: 0, [WARNING]: 1, [NOTE]: 2 });

export function finding(severity, code, message, detail = {}) {
  if (!SEVERITIES.includes(severity)) {
    throw new InputError('finding.severity', `${severity} is not a severity`, {
      severity,
      known: SEVERITIES.slice(),
    });
  }
  requireString(code, 'code');
  requireString(message, 'message');
  return Object.freeze({ severity, code, message, detail: Object.freeze({ ...detail }) });
}

export const asError = (code, message, detail) => finding(ERROR, code, message, detail);
export const asWarning = (code, message, detail) => finding(WARNING, code, message, detail);
export const asNote = (code, message, detail) => finding(NOTE, code, message, detail);

export function compareFinding(left, right) {
  if (RANK[left.severity] !== RANK[right.severity]) {
    return RANK[left.severity] - RANK[right.severity];
  }
  if (left.code !== right.code) {
    return left.code < right.code ? -1 : 1;
  }
  if (left.message === right.message) {
    return 0;
  }
  return left.message < right.message ? -1 : 1;
}

/**
 * A collector. It is a plain builder rather than a class hierarchy because
 * every caller does the same three things with it: add, ask whether anything
 * is wrong, and hand the list to a report.
 */
export function findings(initial = []) {
  const held = [];
  for (const item of initial) {
    held.push(item);
  }

  const api = {
    add(item) {
      held.push(item);
      return api;
    },
    error(code, message, detail) {
      return api.add(asError(code, message, detail));
    },
    warn(code, message, detail) {
      return api.add(asWarning(code, message, detail));
    },
    note(code, message, detail) {
      return api.add(asNote(code, message, detail));
    },
    absorb(other) {
      for (const item of toList(other)) {
        held.push(item);
      }
      return api;
    },
    get length() {
      return held.length;
    },
    list() {
      return held.slice().sort(compareFinding);
    },
    raw() {
      return held.slice();
    },
    of(severity) {
      return api.list().filter((item) => item.severity === severity);
    },
    codes() {
      return Array.from(new Set(api.list().map((item) => item.code)));
    },
    has(code) {
      return held.some((item) => item.code === code);
    },
    hasError() {
      return held.some((item) => item.severity === ERROR);
    },
    isClean() {
      return held.length === 0;
    },
    isLawful() {
      return !api.hasError();
    },
    worst() {
      if (held.length === 0) {
        return null;
      }
      return api.list()[0].severity;
    },
  };
  return api;
}

export function toList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === 'object' && typeof value.raw === 'function') {
    return value.raw();
  }
  throw new InputError('finding.list', 'expected a list of findings or a collector', {});
}

/** Group by code, which is how the monthly report counts them. */
export function tallyByCode(value) {
  const tally = new Map();
  for (const item of toList(value)) {
    tally.set(item.code, (tally.get(item.code) ?? 0) + 1);
  }
  return tally;
}

export function summarise(value) {
  const list = toList(value);
  return {
    total: list.length,
    errors: list.filter((item) => item.severity === ERROR).length,
    warnings: list.filter((item) => item.severity === WARNING).length,
    notes: list.filter((item) => item.severity === NOTE).length,
  };
}
