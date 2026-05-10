/**
 * Sealing a report, so two runs can be compared without reading them.
 *
 * The walk already hashed its own output, which answers one question: did the
 * whole thing come out the same. That is the wrong grain for the question the
 * office actually asks, which is what moved. A single hash over forty pages
 * says something changed and stops there, and the sanitarian then diffs forty
 * pages by eye to find the one closure that lifted a day earlier.
 *
 * So a seal is a hash of the whole and a hash per piece, and the pieces are
 * named. Two seals compare to a list of names, which is a report in itself.
 *
 * The line endings are normalised before hashing, and that is not a detail.
 * The same case walked on Windows and on Linux is the same walk, and a seal
 * that disagreed about it would be a seal nobody could use to compare two
 * offices. Trailing whitespace goes for the same reason: it is invisible in
 * the report and it is not what changed.
 */

import { createHash } from 'node:crypto';

import { InputError } from './errors.js';

export const ALGORITHM = 'sha256';

/** The one true form of a piece of text, before anything is hashed. */
export function normalise(text) {
  if (typeof text !== 'string') {
    throw new InputError('seal.text', 'a seal is taken over text', { saw: typeof text });
  }
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function digestOf(text) {
  return createHash(ALGORITHM).update(normalise(text), 'utf8').digest('hex');
}

/**
 * Seal a list of named pieces. The whole is hashed from the normalised pieces
 * joined, rather than from whatever the caller happened to print, so that the
 * whole and the parts cannot disagree about what was sealed.
 */
export function seal(pieces) {
  if (!Array.isArray(pieces)) {
    throw new InputError('seal.pieces', 'a seal is taken over a list of named pieces', {});
  }
  const named = pieces.map((piece, index) => {
    if (typeof piece?.name !== 'string' || typeof piece?.text !== 'string') {
      throw new InputError('seal.piece', `piece ${index} has no name and text`, { index });
    }
    return Object.freeze({ name: piece.name, digest: digestOf(piece.text) });
  });
  const names = named.map((one) => one.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined) {
    throw new InputError('seal.duplicate', `two pieces are both called ${duplicate}`, {
      name: duplicate,
    });
  }
  const whole = digestOf(pieces.map((piece) => normalise(piece.text)).join('\n\n'));
  return Object.freeze({
    algorithm: ALGORITHM,
    digest: whole,
    pieces: Object.freeze(named),
    count: named.length,
  });
}

export const ADDED = 'added';
export const REMOVED = 'removed';
export const CHANGED = 'changed';
export const MOVED = 'moved';

/**
 * What is different between two seals. The names are compared as a set and as
 * an order, because a piece that changed and a piece that moved are different
 * findings: one means the water did something, the other means the programme
 * did, and only the second one is a bug.
 */
export function compareSeals(before, after) {
  const first = new Map(before.pieces.map((one) => [one.name, one.digest]));
  const second = new Map(after.pieces.map((one) => [one.name, one.digest]));
  const changes = [];

  for (const [name, digest] of first) {
    if (!second.has(name)) {
      changes.push({ name, what: REMOVED });
      continue;
    }
    if (second.get(name) !== digest) {
      changes.push({ name, what: CHANGED, from: digest, to: second.get(name) });
    }
  }
  for (const name of second.keys()) {
    if (!first.has(name)) {
      changes.push({ name, what: ADDED });
    }
  }

  const shared = before.pieces.map((one) => one.name).filter((name) => second.has(name));
  const sharedAfter = after.pieces.map((one) => one.name).filter((name) => first.has(name));
  shared.forEach((name, index) => {
    if (sharedAfter[index] !== name && !changes.some((one) => one.name === name)) {
      changes.push({ name, what: MOVED, from: index, to: sharedAfter.indexOf(name) });
    }
  });

  return Object.freeze({
    same: before.digest === after.digest,
    changes: Object.freeze(changes.sort(byNameThenKind)),
    before: before.digest,
    after: after.digest,
  });
}

function byNameThenKind(left, right) {
  if (left.name !== right.name) {
    return left.name < right.name ? -1 : 1;
  }
  return left.what < right.what ? -1 : 1;
}

export function describeSealChange(change) {
  if (change.what === ADDED) {
    return `${change.name} is new`;
  }
  if (change.what === REMOVED) {
    return `${change.name} is gone`;
  }
  if (change.what === MOVED) {
    return `${change.name} moved from ${change.from + 1} to ${change.to + 1}`;
  }
  return `${change.name} changed`;
}

/**
 * The seal written out for a file. It is JSON rather than a line of text
 * because it gets read back, and a format that has to be parsed by hand is a
 * format somebody parses wrong once.
 */
export function sealToJson(one) {
  return `${JSON.stringify(
    {
      algorithm: one.algorithm,
      digest: one.digest,
      pieces: one.pieces.map((piece) => ({ name: piece.name, digest: piece.digest })),
    },
    null,
    2,
  )}\n`;
}

export function sealFromJson(text) {
  const parsed = JSON.parse(text);
  if (typeof parsed?.digest !== 'string' || !Array.isArray(parsed?.pieces)) {
    throw new InputError('seal.read', 'that is not a seal this programme wrote', {});
  }
  return Object.freeze({
    algorithm: parsed.algorithm ?? ALGORITHM,
    digest: parsed.digest,
    pieces: Object.freeze(parsed.pieces.map((one) => Object.freeze({ ...one }))),
    count: parsed.pieces.length,
  });
}
