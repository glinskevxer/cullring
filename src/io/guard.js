/**
 * Limits on what the programme will read, and why a programme like this needs
 * them at all.
 *
 * Nothing here is a security measure. The office reads its own files, and a
 * hostile input model would be dishonest about who is on the other end. What
 * actually happens is duller and more common: somebody exports a sheet from a
 * spreadsheet that has been clicked once too often and it arrives with nine
 * hundred thousand blank rows, or a register is written by a script with a
 * loop in it and nests two thousand deep.
 *
 * Without a limit those files do not fail. They take four minutes, then eight,
 * then the process dies with a stack trace about heap memory, and the person
 * on the dock is told nothing useful. With a limit they fail in a second with
 * a sentence naming the file and the number.
 *
 * Every limit is generous on purpose. The largest real sheet this programme
 * has seen is a few thousand rows, and the floor here is well above anything
 * an office produces, so a file that trips one is a file that is wrong.
 */

import { InputError } from '../core/errors.js';

export const LIMITS = Object.freeze({
  /** Bytes in one feed file. A season of tide predictions is under a megabyte. */
  feedBytes: 32 * 1024 * 1024,
  /** Bytes in the register. It is a register, not a database. */
  registerBytes: 16 * 1024 * 1024,
  /** Rows in one sheet, after the header. */
  rows: 500000,
  /** Characters in one field. A note is a sentence, not a document. */
  fieldLength: 4096,
  /** How deep a register may nest. The deepest real shape is about five. */
  depth: 40,
  /** Entries in one list in the register. */
  listLength: 100000,
});

/** How many bytes a string takes, which is not how many characters it has. */
export function byteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}

export function guardBytes(text, { what, limit = LIMITS.feedBytes }) {
  const size = byteLength(text);
  if (size > limit) {
    throw new InputError(
      'guard.tooBig',
      `${what} is ${describeSize(size)}, over the ${describeSize(limit)} limit`,
      {
        what,
        bytes: size,
        limit,
      },
    );
  }
  return text;
}

export function guardRows(count, { what, limit = LIMITS.rows }) {
  if (count > limit) {
    throw new InputError(
      'guard.tooManyRows',
      `${what} holds ${count} rows, over the limit of ${limit}`,
      {
        what,
        rows: count,
        limit,
      },
    );
  }
  return count;
}

export function guardField(text, { what, line = null, limit = LIMITS.fieldLength }) {
  if (typeof text === 'string' && text.length > limit) {
    throw new InputError(
      'guard.longField',
      `${what} holds a field of ${text.length} characters, over the limit of ${limit}`,
      { what, line, length: text.length, limit },
    );
  }
  return text;
}

function describeSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * How deep a value nests, stopping as soon as it is deeper than the limit
 * rather than measuring the whole thing. A structure built to be deep is
 * built to make the measuring expensive too.
 */
export function depthOf(value, limit = LIMITS.depth) {
  let deepest = 0;
  const stack = [{ value, depth: 1 }];
  while (stack.length > 0) {
    const { value: here, depth } = stack.pop();
    if (depth > deepest) {
      deepest = depth;
    }
    if (deepest > limit) {
      return deepest;
    }
    if (here === null || typeof here !== 'object') {
      continue;
    }
    for (const child of Array.isArray(here) ? here : Object.values(here)) {
      stack.push({ value: child, depth: depth + 1 });
    }
  }
  return deepest;
}

/**
 * A register, before anything reads it. This is the one guard that has to run
 * before parsing rather than after, so it takes the text as well as the value:
 * a file too big to hold is a file that must not be parsed to find that out.
 */
export function guardRegister(text) {
  guardBytes(text, { what: 'the register', limit: LIMITS.registerBytes });
  const parsed = JSON.parse(text);
  const depth = depthOf(parsed);
  if (depth > LIMITS.depth) {
    throw new InputError(
      'guard.tooDeep',
      `the register nests ${depth} deep, over the limit of ${LIMITS.depth}`,
      {
        depth,
        limit: LIMITS.depth,
      },
    );
  }
  for (const [key, value] of Object.entries(parsed ?? {})) {
    if (Array.isArray(value) && value.length > LIMITS.listLength) {
      throw new InputError(
        'guard.tooManyRows',
        `the register holds ${value.length} entries under ${key}, over the limit of ${LIMITS.listLength}`,
        { what: key, rows: value.length, limit: LIMITS.listLength },
      );
    }
  }
  return parsed;
}

/**
 * A feed file, before it is parsed. The row count is estimated from the
 * newlines rather than by splitting, because splitting is the expensive part
 * and a file with a million rows should not be split to be refused.
 */
export function guardFeed(text, what) {
  guardBytes(text, { what, limit: LIMITS.feedBytes });
  let newlines = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      newlines += 1;
      if (newlines > LIMITS.rows) {
        throw new InputError(
          'guard.tooManyRows',
          `${what} holds more than ${LIMITS.rows} lines, which is over the limit`,
          { what, limit: LIMITS.rows },
        );
      }
    }
  }
  return text;
}

/** Every limit, in a shape a report can print without knowing their names. */
export function describeLimits() {
  return Object.freeze([
    ['A feed file', describeSize(LIMITS.feedBytes)],
    ['The register', describeSize(LIMITS.registerBytes)],
    ['Rows in a sheet', String(LIMITS.rows)],
    ['Characters in a field', String(LIMITS.fieldLength)],
    ['Depth of the register', String(LIMITS.depth)],
    ['Entries in one register list', String(LIMITS.listLength)],
  ]);
}
