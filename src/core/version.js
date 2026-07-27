/**
 * What version of the programme wrote a report, and the three things about it
 * that can change what the report says.
 *
 * A sealed walk is only useful if two of them can be compared, and two walks
 * of the same case can differ for two quite different reasons: the water did
 * something, or the programme changed. A seal that records only the text
 * cannot tell those apart, and the difference is the whole question when a
 * grower asks why the answer moved.
 *
 * So a walk carries its provenance, and the provenance is the smallest set of
 * things that actually decide an answer. The programme version. The register
 * schema it reads, because a case migrated between two walks is a different
 * case. And the count of finding codes, which is a coarse but honest proxy for
 * "the rules changed": a release that adds a rule adds at least one code, and
 * one that does not is a release that cannot have changed a verdict.
 *
 * The version is written here rather than read from package.json, because the
 * package file is not shipped with the reports and a report that cannot say
 * what wrote it is a report nobody can reproduce.
 */

import { SCHEMA_VERSION } from '../io/schema.js';
import { codes } from './catalogue.js';
import { ruleNames } from './rules.js';

export const VERSION = '1.0.0';

export const NAME = 'cullring';

/** The provenance of a report, as a record a caller can print or seal. */
export function provenance() {
  return Object.freeze({
    programme: NAME,
    version: VERSION,
    schema: SCHEMA_VERSION,
    codes: codes().length,
    rules: ruleNames().length,
  });
}

/** The one line a report prints at the bottom, which is what gets sealed. */
export function provenanceLine(one = provenance()) {
  return `${one.programme} ${one.version}, register schema ${one.schema}, ${one.rules} rules and ${one.codes} finding codes`;
}

/**
 * What is different between two provenances. It is a list of words rather than
 * a boolean, because "the programme changed" is not an answer anybody can act
 * on and "the schema went from 1 to 2" is.
 */
export function compareProvenance(before, after) {
  const changes = [];
  if (before.version !== after.version) {
    changes.push(`the programme went from ${before.version} to ${after.version}`);
  }
  if (before.schema !== after.schema) {
    changes.push(`the register schema went from ${before.schema} to ${after.schema}`);
  }
  if (before.rules !== after.rules) {
    changes.push(`the rules went from ${before.rules} to ${after.rules}`);
  }
  if (before.codes !== after.codes) {
    changes.push(`the finding codes went from ${before.codes} to ${after.codes}`);
  }
  return Object.freeze({ same: changes.length === 0, changes: Object.freeze(changes) });
}

/**
 * Whether two reports are comparable at all. They are where the programme did
 * not change; where it did, they are still worth comparing and the reader has
 * to be told, which is a different thing from refusing.
 */
export function comparable(before, after) {
  const answer = compareProvenance(before, after);
  if (answer.same) {
    return Object.freeze({ comparable: true, warn: null });
  }
  return Object.freeze({
    comparable: true,
    warn: `these were written by different programmes: ${answer.changes.join(', ')}`,
  });
}
