#!/usr/bin/env node
/**
 * Hold the changelog to the version the programme reports.
 *
 * A changelog goes wrong in one direction almost every time: the version is
 * bumped and the entry is written next week, which means the release that
 * went out has no entry and the entry that exists describes something nobody
 * shipped. So the only thing checked here is the thing that catches that: the
 * version the programme reports has a heading of its own.
 *
 * The command list is checked too, because a changelog naming a command that
 * does not exist is worse than one naming none: it sends somebody looking.
 */
import { readFileSync } from 'node:fs';

import { VERSION } from '../src/core/version.js';
import { build } from '../src/cli/program.js';
import { makeConsole } from '../src/cli/output.js';

const text = readFileSync('CHANGELOG.md', 'utf8');
const problems = [];

if (!text.includes(`\n## ${VERSION}\n`)) {
  problems.push(`the changelog has no heading for ${VERSION}, which is the version reported`);
}

const known = new Set(build(makeConsole()).commands.map((one) => one.name()));
for (const match of text.matchAll(/`([a-z][a-z-]{2,})`/g)) {
  const word = match[1];
  if (word.includes('-') || word === 'cullring') {
    continue;
  }
  if (/^(npm|node|bash|docs|src|tools|main)$/.test(word)) {
    continue;
  }
  if (!known.has(word)) {
    problems.push(`the changelog names \`${word}\`, which is not a command`);
  }
}

if (problems.length > 0) {
  for (const line of Array.from(new Set(problems))) {
    console.error(line);
  }
  process.exit(1);
}

const headings = text.match(/^## /gm) ?? [];
console.log(`the changelog covers ${VERSION} over ${headings.length} headings`);
