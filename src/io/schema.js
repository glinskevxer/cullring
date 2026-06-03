/**
 * What a register file is allowed to hold, and which version of the file it is.
 *
 * The loader reads a key if it is there and notes it if it is not, which is
 * the right behaviour for a file the office keeps by hand: an office with no
 * emergency orders should not have to write an empty list. What it cannot do
 * is tell a missing key from a mistyped one. A register with `embargos` in it
 * loads perfectly, holds no embargoes, and reports that it carries none. That
 * has to be caught here, at the only place that knows what the whole set of
 * keys is.
 *
 * The version exists for the same reason. Keys were added over time and a file
 * written before they existed is not wrong, it is old, and the difference
 * matters when the check has to decide between "this office keeps no seasons"
 * and "this file predates seasons". An unversioned file is version one, which
 * is stated rather than guessed, because every file written before versioning
 * is by definition the version that came before it.
 */

import { findings } from '../core/finding.js';

export const SCHEMA_VERSION = 2;

/** The keys each version of the file knows about. Later versions add, never rename. */
const VERSIONS = new Map([
  [
    1,
    Object.freeze([
      'programme',
      'zone',
      'areas',
      'plans',
      'stations',
      'beds',
      'harvesters',
      'dealers',
      'certificates',
      'inspections',
      'sources',
      'boundaries',
      'orders',
      'reviewHistory',
    ]),
  ],
  [2, Object.freeze(['seasons', 'limits', 'variances', 'embargoes', 'leases'])],
]);

/**
 * The key that says which version this is. It is not owned by a version: a
 * file written under version one may still declare that it is one, and calling
 * that key ahead of its own file would be an odd thing to say.
 */
const ALWAYS = Object.freeze(['version']);

/** Every key any version knows, which is what an unknown key is measured against. */
export function knownKeys(version = SCHEMA_VERSION) {
  const keys = [...ALWAYS];
  for (const [at, added] of VERSIONS) {
    if (at <= version) {
      keys.push(...added);
    }
  }
  return Object.freeze(keys.slice().sort());
}

/** The keys a version added, which is what makes a file too new to be its own version. */
export function keysAddedIn(version) {
  return VERSIONS.get(version) ?? Object.freeze([]);
}

/**
 * The version a file declares, or one where it declares nothing. A file that
 * declares something that is not a version this programme keeps is refused
 * rather than read as the nearest one, because reading a version four file as
 * a version two is exactly how a key gets silently dropped.
 */
export function readVersion(source) {
  const problems = findings();
  const declared = (source ?? {}).version;
  if (declared === undefined || declared === null) {
    problems.note('schema.unversioned', 'the register declares no version, so it is read as 1', {
      read: 1,
    });
    return Object.freeze({ version: 1, declared: false, problems });
  }
  if (!Number.isInteger(declared) || !VERSIONS.has(declared)) {
    problems.error('schema.version', `${declared} is not a register version this programme keeps`, {
      declared,
      known: Array.from(VERSIONS.keys()),
    });
    return Object.freeze({ version: null, declared: true, problems });
  }
  return Object.freeze({ version: declared, declared: true, problems });
}

/** How close two key names are, used only to guess what somebody meant to type. */
export function looksLike(key, candidates) {
  const lower = key.toLowerCase();
  let best = null;
  for (const candidate of candidates) {
    const other = candidate.toLowerCase();
    if (other === lower) {
      return candidate;
    }
    const distance = editDistance(lower, other);
    if (
      distance <= Math.max(1, Math.floor(other.length / 4)) &&
      (best === null || distance < best.distance)
    ) {
      best = { candidate, distance };
    }
  }
  return best === null ? null : best.candidate;
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (unused, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/**
 * Check a register against the schema. Three things are reported and they are
 * different problems with different fixes.
 *
 * A key nothing knows about is a typo or a key from a newer programme, and it
 * is loud, because the register loaded fine and lost whatever was in it.
 *
 * A key from a later version in a file that declares an earlier one is a file
 * somebody hand-edited without moving the version, which is harmless today and
 * is the thing that makes the version useless tomorrow.
 *
 * A key the version knows and the file does not carry is nothing at all. An
 * office with no emergency orders writes no orders.
 */
export function checkSchema(source) {
  const problems = findings();
  const read = readVersion(source);
  problems.absorb(read.problems);
  if (read.version === null) {
    return Object.freeze({
      version: null,
      unknown: Object.freeze([]),
      tooNew: Object.freeze([]),
      problems,
    });
  }
  const all = knownKeys(SCHEMA_VERSION);
  const known = new Set(knownKeys(read.version));
  const unknown = [];
  const tooNew = [];

  for (const key of Object.keys(source ?? {})) {
    if (known.has(key)) {
      continue;
    }
    if (all.includes(key)) {
      tooNew.push(key);
      continue;
    }
    unknown.push(key);
  }

  for (const key of unknown) {
    const guess = looksLike(key, all);
    problems.error(
      'schema.unknownKey',
      guess === null
        ? `the register carries ${key}, which nothing reads`
        : `the register carries ${key}, which nothing reads; did you mean ${guess}`,
      { key, guess },
    );
  }
  for (const key of tooNew) {
    problems.warn(
      'schema.aheadOfVersion',
      `the register declares version ${read.version} and carries ${key}, which came in later`,
      { key, version: read.version, since: versionOf(key) },
    );
  }

  return Object.freeze({
    version: read.version,
    unknown: Object.freeze(unknown.sort()),
    tooNew: Object.freeze(tooNew.sort()),
    problems,
  });
}

/** Which version first knew a key, for the message that says a file is behind. */
export function versionOf(key) {
  for (const [at, added] of VERSIONS) {
    if (added.includes(key)) {
      return at;
    }
  }
  return null;
}
