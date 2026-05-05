/**
 * The migrate command, which reads a register file and writes a newer one.
 *
 * It refuses to write over the file it read unless told to in as many words.
 * A migration that overwrites by default is a migration somebody runs on the
 * wrong directory once, and the office keeps one copy of the register.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REGISTER_FILE } from '../context.js';
import { describeChange, migrate, needsMigration } from '../../io/migrate.js';
import { checkSchema } from '../../io/schema.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';
import { definitionList, heading } from '../../text/table.js';

export function migrateCommand(options, io) {
  const path = join(options.case, REGISTER_FILE);
  if (!existsSync(path)) {
    io.warn(`refused: ${REGISTER_FILE} is not in ${options.case}`);
    return REFUSED;
  }
  let register;
  try {
    register = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    io.warn(`refused: ${REGISTER_FILE} is not readable: ${error.message}`);
    return REFUSED;
  }

  const answer = migrate(register);
  if (answer.problems.hasError()) {
    for (const problem of answer.problems.list()) {
      io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
    }
    return REFUSED;
  }

  if (options.json === true) {
    io.say(
      asJson({
        case: options.case,
        from: answer.from,
        to: answer.to,
        needed: needsMigration(register),
        changes: answer.changes,
        written: false,
      }),
    );
    return answer.changes.length === 0 ? OK : FOUND;
  }

  io.say(heading(`Migrating ${path}`));
  io.say(
    definitionList([
      ['Read as', String(answer.from)],
      ['Written as', String(answer.to)],
      ['Changes', String(answer.changes.length)],
    ]),
  );
  if (answer.changes.length === 0) {
    io.say('');
    io.say('Nothing to do.');
    return OK;
  }
  io.say('');
  for (const change of answer.changes) {
    io.say(`  ${describeChange(change)}`);
  }

  if (options.write !== true) {
    io.say('');
    io.say('Nothing was written. Run it again with --write to replace the file.');
    return FOUND;
  }

  const after = checkSchema(answer.register);
  if (after.problems.hasError()) {
    io.warn('refused: the migrated register does not pass the schema check');
    for (const problem of after.problems.of('error')) {
      io.warn(`error: ${problem.code}: ${problem.message}`);
    }
    return REFUSED;
  }

  writeFileSync(path, `${JSON.stringify(answer.register, null, 2)}\n`, 'utf8');
  io.say('');
  io.say(`Written to ${path}.`);
  return FOUND;
}
