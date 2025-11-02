#!/usr/bin/env node
/**
 * Hold the glossary to the document and to the classification table.
 *
 * The five classifications are the words everything else is built on, so a
 * glossary that has lost one of them is worse than no glossary. Beyond that
 * the check is a comparison against the generated document, because a glossary
 * nobody regenerated is a glossary that describes last year's programme.
 */
import { readFileSync } from 'node:fs';

import { CLASSIFICATIONS } from '../src/area/classification.js';
import { isDefined, renderGlossaryDocument, words } from '../src/core/glossary.js';

const problems = [];

for (const name of CLASSIFICATIONS) {
  if (!isDefined(name)) {
    problems.push(`the glossary does not define the classification ${name}`);
  }
}

let held = '';
try {
  held = readFileSync('docs/glossary.md', 'utf8');
} catch {
  problems.push('docs/glossary.md is missing; run tools/write_glossary.js');
}
if (held !== '' && held !== renderGlossaryDocument()) {
  problems.push('docs/glossary.md is stale; run tools/write_glossary.js');
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
console.log(`${words().length} glossary entries, and every classification is one of them`);
