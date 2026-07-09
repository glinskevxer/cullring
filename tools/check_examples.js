/**
 * Hold every case directory under examples/ to what it is supposed to say.
 *
 * A worked example is documentation that runs, and documentation rots. This is
 * the job that notices. It is not the unit suite: it does not know what the
 * right answer is, it knows what each example was written to demonstrate, and
 * it fails when an example stops demonstrating it.
 *
 * The expectations are deliberately thin. A case is expected to load whole, to
 * carry the registers it was built to carry, and to raise the codes it was
 * built to raise. Anything finer belongs in a test, where the failure message
 * can say what went wrong rather than which count moved.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { checkRegister } from '../src/area/consistency.js';
import { loadCase } from '../src/cli/context.js';
import { civilDate } from '../src/time/civil.js';

/** What each example is for. A case with no entry here is a case nobody checks. */
const EXPECTED = new Map([
  [
    'core-sound',
    {
      areas: 5,
      plans: 2,
      landings: 11,
      leases: 3,
      on: civilDate(2025, 8, 31),
      demonstrates: ['locate.overlap', 'locate.contested'],
      neverRaises: ['load.entry', 'load.shape', 'case.badRegister'],
    },
  ],
  [
    'white-oak',
    {
      areas: 4,
      plans: 2,
      landings: 6,
      leases: 1,
      on: civilDate(2025, 11, 30),
      demonstrates: [],
      neverRaises: ['load.entry', 'load.shape', 'case.badRegister', 'schema.unknownKey'],
    },
  ],
]);

const problems = [];

function complain(directory, message) {
  problems.push(`${directory}: ${message}`);
}

const root = 'examples';
const directories = readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory());

if (directories.length === 0) {
  console.error('there are no examples at all');
  process.exit(1);
}

for (const name of directories) {
  const expected = EXPECTED.get(name);
  if (expected === undefined) {
    complain(name, 'is an example nothing in this check knows about');
    continue;
  }
  const loaded = loadCase(join(root, name));
  // The register check is run here as well as the load, because an example is
  // often written to demonstrate something only the register check can see.
  const register = checkRegister({
    areas: loaded.areas,
    stations: loaded.stations,
    beds: loaded.beds,
    plans: loaded.plans,
    sources: loaded.sources,
    boundaries: loaded.boundaries,
    tides: loaded.tides,
    on: expected.on,
  });
  const raised = new Set(
    [...loaded.problems.list(), ...register.problems.list()].map((one) => one.code),
  );

  for (const [what, wanted] of [
    ['areas', expected.areas],
    ['plans', expected.plans],
    ['leases', expected.leases],
  ]) {
    if (loaded[what].length !== wanted) {
      complain(name, `holds ${loaded[what].length} ${what}, and was written to hold ${wanted}`);
    }
  }
  if (loaded.records.length !== expected.landings) {
    complain(
      name,
      `holds ${loaded.records.length} landings, and was written to hold ${expected.landings}`,
    );
  }
  for (const code of expected.demonstrates) {
    if (!raised.has(code)) {
      complain(name, `was written to demonstrate ${code} and no longer raises it`);
    }
  }
  for (const code of expected.neverRaises) {
    if (raised.has(code)) {
      complain(name, `raises ${code}, which means the case no longer loads whole`);
    }
  }
}

for (const name of EXPECTED.keys()) {
  if (!directories.includes(name)) {
    complain(name, 'is checked here and is not in examples/');
  }
}

if (problems.length > 0) {
  for (const line of problems) {
    console.error(line);
  }
  process.exit(1);
}

console.log(`${directories.length} worked examples, all saying what they were written to say`);
