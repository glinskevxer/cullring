#!/usr/bin/env node
/**
 * Hold the README's layout table to the packages that exist.
 *
 * The table is the first thing anybody reads and the last thing anybody
 * updates. A package added without a row leaves a reader with a directory
 * nothing explains, and a row left behind after a package is folded away sends
 * them looking for something that is not there. Neither shows up in a test run
 * and both are cheap to check.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const readme = readFileSync('README.md', 'utf8');

const packages = readdirSync(ROOT)
  .filter((name) => statSync(join(ROOT, name)).isDirectory())
  .sort();

const rows = readme
  .split('\n')
  .filter((line) => line.trim().startsWith('| `src/'))
  .map((line) => line.split('|')[1].trim().replaceAll('`', ''));

const listed = rows.map((path) => path.slice(ROOT.length + 1)).sort();
const problems = [];

for (const name of packages) {
  if (!listed.includes(name)) {
    problems.push(`the README layout table has no row for src/${name}`);
  }
}
for (const name of listed) {
  if (!packages.includes(name)) {
    problems.push(`the README layout table has a row for src/${name}, which is not there`);
  }
}
for (const row of readme.split('\n').filter((line) => line.trim().startsWith('| `src/'))) {
  const description = row.split('|')[2].trim();
  if (description.length < 12) {
    problems.push(`the README row for ${row.split('|')[1].trim()} says almost nothing`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
console.log(`the README describes all ${packages.length} packages`);
