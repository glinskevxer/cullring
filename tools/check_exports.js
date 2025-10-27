#!/usr/bin/env node
/**
 * Every module has to be reachable from the package entry point.
 *
 * A module nobody exports is a module nobody imports, and a module nobody
 * imports is either dead or reachable only through a path the author did not
 * mean. Both are worth failing the build over, and neither shows up in a test
 * run: the tests import the file directly and it passes on its own.
 *
 * The check is two hops. Every file in a package has to appear in that
 * package's index, and every package index has to appear in src/index.js.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const problems = [];

const packages = readdirSync(ROOT).filter((name) => statSync(join(ROOT, name)).isDirectory());
const entry = readFileSync(join(ROOT, 'index.js'), 'utf8');

for (const name of packages) {
  if (!entry.includes(`./${name}/index.js`)) {
    problems.push(`src/index.js does not export the ${name} package`);
    continue;
  }
  checkDirectory(join(ROOT, name), `src/${name}`);
}

/**
 * A directory has an index, the index names every file beside it, and it names
 * every subdirectory's index. Nested packages are checked the same way, which
 * is how the command bodies under src/cli stay reachable.
 */
function checkDirectory(path, label) {
  let index = '';
  try {
    index = readFileSync(join(path, 'index.js'), 'utf8');
  } catch {
    problems.push(`${label} has no index.js`);
    return;
  }
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) {
      if (!index.includes(`./${name}/index.js`)) {
        problems.push(`${label}/index.js does not export the ${name} package`);
        continue;
      }
      checkDirectory(child, `${label}/${name}`);
      continue;
    }
    if (!name.endsWith('.js') || name === 'index.js') {
      continue;
    }
    if (!index.includes(`./${name}`)) {
      problems.push(`${label}/index.js does not export ${name}`);
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
console.log(`every module in ${packages.length} packages is reachable from src/index.js`);
