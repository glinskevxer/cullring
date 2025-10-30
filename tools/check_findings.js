#!/usr/bin/env node
/**
 * Hold the catalogue to what the source actually raises.
 *
 * Two things go wrong with a list of codes kept by hand. A rule raises a code
 * nobody wrote down, so a caller matching on it finds nothing in the
 * documentation. And a code stays in the list years after the rule that raised
 * it was deleted, so somebody writes a handler for a finding that can never
 * arrive. Both are found by comparing the list against a scan of the source,
 * and neither shows up in a test run.
 *
 * The scan is a regular expression over the calls that raise a finding. That
 * is crude, and it is crude on purpose: a cleverer scan would need the code to
 * be reachable, and an unreachable rule is a different problem this check is
 * not trying to have an opinion about.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

import { codes, isKnownCode } from '../src/core/catalogue.js';
import { renderCatalogueDocument } from '../src/core/catalogue.js';

const RAISED = /\.(?:error|warn|note)\(\s*'([a-z]+\.[A-Za-z]+)'/g;
const IGNORE = new Set(['src/core/catalogue.js']);

const raised = new Set();
for (const file of walk('src')) {
  const relative = file.split(sep).join('/');
  if (IGNORE.has(relative)) {
    continue;
  }
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(RAISED)) {
    raised.add(match[1]);
  }
}

const problems = [];
for (const code of Array.from(raised).sort()) {
  if (!isKnownCode(code)) {
    problems.push(`${code} is raised in the source and is not in the catalogue`);
  }
}
for (const code of codes()) {
  if (!raised.has(code)) {
    problems.push(`${code} is in the catalogue and is raised nowhere`);
  }
}

let held = '';
try {
  held = readFileSync('docs/findings.md', 'utf8');
} catch {
  problems.push('docs/findings.md is missing; run tools/write_findings.js');
}
if (held !== '' && held !== renderCatalogueDocument()) {
  problems.push('docs/findings.md is stale; run tools/write_findings.js');
}

function walk(directory) {
  const out = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
      continue;
    }
    if (name.endsWith('.js')) {
      out.push(path);
    }
  }
  return out;
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
console.log(`${codes().length} finding codes, all raised and all described`);
