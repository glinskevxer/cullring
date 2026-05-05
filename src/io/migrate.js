/**
 * Bringing an old register file forward, and the one thing that actually
 * changed between the two versions.
 *
 * Version two added keys, and added keys need no migration at all: a file
 * without seasons is a file from an office that kept none, and stamping it
 * with a version is the whole job.
 *
 * The exception is the reopening. Version one wrote it as a bare number, and
 * a bare number was read as hours, because hours was the only clock the
 * programme had. Then it grew four more, and now a bare number is a question
 * nobody can answer: seventy two of what. Every reading of it is a conversion
 * between clocks and the programme refuses those. So the loader will not take
 * a bare number, and this is the only place that knows what one used to mean.
 *
 * The migration is written out rather than done on the way in for the same
 * reason: an office that runs it gets a file it can read, and a diff it can
 * put in front of somebody. A conversion that happens silently at load time is
 * one nobody ever checks.
 */

import { findings } from '../core/finding.js';
import { SCHEMA_VERSION, readVersion } from './schema.js';

/** What a bare reopening number meant, back when there was only one clock. */
export const BARE_NUMBER_MEANT = 'hours';

/**
 * Migrate a register. The result is a new object: the file handed in is never
 * touched, so a caller that decides not to write it out has lost nothing.
 */
export function migrate(register) {
  const problems = findings();
  const read = readVersion(register);
  problems.absorb(read.problems.of('error'));
  if (read.version === null) {
    return Object.freeze({
      register,
      from: null,
      to: null,
      changes: Object.freeze([]),
      problems,
    });
  }
  if (read.version >= SCHEMA_VERSION) {
    problems.note('migrate.current', `the register is already version ${read.version}`, {
      version: read.version,
    });
    return Object.freeze({
      register,
      from: read.version,
      to: read.version,
      changes: Object.freeze([]),
      problems,
    });
  }

  const changes = [];
  const out = { version: SCHEMA_VERSION };
  for (const [key, value] of Object.entries(register)) {
    if (key === 'version') {
      continue;
    }
    out[key] = value;
  }
  changes.push({ what: 'version', from: read.version, to: SCHEMA_VERSION });

  if (Array.isArray(register.plans)) {
    out.plans = register.plans.map((plan, index) => {
      if (typeof plan.reopening !== 'number') {
        return plan;
      }
      changes.push({
        what: 'reopening',
        plan: plan.area ?? `plans[${index}]`,
        from: plan.reopening,
        to: `${plan.reopening} hours`,
      });
      problems.note(
        'migrate.reopening',
        `${plan.area ?? `plans[${index}]`} reopened after ${plan.reopening}, which is read as ${plan.reopening} ${BARE_NUMBER_MEANT}`,
        { plan: plan.area ?? null, was: plan.reopening },
      );
      return { ...plan, reopening: { kind: 'after hours', hours: plan.reopening } };
    });
  }

  return Object.freeze({
    register: out,
    from: read.version,
    to: SCHEMA_VERSION,
    changes: Object.freeze(changes),
    problems,
  });
}

/** Whether a register would change at all, which is the question before writing. */
export function needsMigration(register) {
  const read = readVersion(register);
  return read.version !== null && read.version < SCHEMA_VERSION;
}

export function describeChange(change) {
  if (change.what === 'version') {
    return `version ${change.from} becomes ${change.to}`;
  }
  return `${change.plan} reopens after ${change.from}, written out as ${change.to}`;
}
