#!/usr/bin/env node
/**
 * Hold the rule registry to the catalogue, to the source, and to itself.
 *
 * The registry is written by hand, which is the point: it says what the rules
 * are and which of them decide what the others measure, and neither of those
 * can be derived from the source. What can be derived is whether it is still
 * true, and there are four ways it stops being true.
 *
 * A rule names a module that has been moved or deleted. A rule claims a
 * finding family the catalogue no longer holds, or the catalogue grows a
 * family no rule claims, which means a whole area of the programme is doing
 * something nothing describes. Two rules claim the same family, which makes
 * the ownership meaningless. And a rule is decided by a rule that does not
 * exist, usually because it was renamed on one side only.
 */
import { existsSync } from 'node:fs';

import { registryProblems, renderRulesDocument, rules } from '../src/core/rules.js';
import { readFileSync } from 'node:fs';

const problems = registryProblems();

for (const one of rules()) {
  if (!existsSync(one.module)) {
    problems.push(`${one.name} lives in ${one.module}, which is not there`);
  }
}

const written = existsSync('docs/rules.md') ? readFileSync('docs/rules.md', 'utf8') : null;
if (written === null) {
  problems.push('docs/rules.md has never been written; run npm run write:rules');
} else if (written !== renderRulesDocument()) {
  problems.push('docs/rules.md is out of date; run npm run write:rules');
}

if (problems.length > 0) {
  for (const line of problems) {
    console.error(line);
  }
  process.exit(1);
}

const decided = rules().filter((one) => one.decidedBy.length > 0).length;
console.log(
  `${rules().length} rules, ${decided} of them decided by another, and docs/rules.md is current`,
);
