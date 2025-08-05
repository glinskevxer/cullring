/**
 * The command tree.
 *
 * Every command takes the same three global options, because every question
 * this programme is asked is about a case directory, a zone and a moment. The
 * bodies live in `./commands` and know nothing about argument parsing, so the
 * tests exercise the bodies and this file only has to be right about names.
 */

import { Command } from 'commander';

import { validate } from './commands/case.js';
import { landings, lot } from './commands/landings.js';
import { survey } from './commands/survey.js';
import { forward, recallCommand, trace } from './commands/trace.js';
import { closures, notice, standing } from './commands/water.js';
import { REFUSED, guard, makeConsole } from './output.js';

export function build(io) {
  const program = new Command();
  program
    .name('cullring')
    .description('shellfish sanitation: classification, closures, landings and trace')
    .version('1.0.0')
    .showHelpAfterError();

  const common = (command) =>
    command
      .requiredOption('-c, --case <directory>', 'the case directory to read')
      .option('-z, --zone <zone>', 'the zone the office keeps', 'eastern')
      .option('--json', 'print the answer as JSON');

  common(program.command('validate'))
    .description('read a case directory and report what is wrong with it')
    .option('-q, --quiet', 'print the counts but not the findings')
    .action((options) => {
      exit(io, () => validate(options, io));
    });

  common(program.command('standing'))
    .description('the classification in force for every area at a moment')
    .requiredOption('-a, --at <stamp>', 'the moment to ask about')
    .option('-f, --from <date>', 'the day the walk over the feed starts')
    .action((options) => {
      exit(io, () => standing(options, io));
    });

  common(program.command('closures'))
    .description('every closure of one area in a period')
    .argument('<area>', 'the area number')
    .requiredOption('-a, --at <stamp>', 'the end of the period')
    .option('-f, --from <date>', 'the day the period starts')
    .option('-o, --on <date>', 'the day the plan is read as in force on')
    .action((area, options) => {
      exit(io, () => closures({ ...options, area }, io));
    });

  common(program.command('notice'))
    .description('the closure notice for one area')
    .argument('<area>', 'the area number')
    .requiredOption('-a, --at <stamp>', 'the moment to ask about')
    .option('-f, --from <date>', 'the day the walk over the feed starts')
    .option('-o, --on <date>', 'the day the plan is read as in force on')
    .action((area, options) => {
      exit(io, () => notice({ ...options, area }, io));
    });

  common(program.command('survey'))
    .description('score the results for an area and propose a classification')
    .argument('<area>', 'the area number')
    .requiredOption('-o, --on <date>', 'the day the survey is scored as at')
    .option('-s, --strategy <name>', 'systematic random or adverse pollution condition')
    .option('-n, --analysis <name>', 'fecal coliform or total coliform')
    .option('-t, --held-to <class>', 'the class to score against, if not the register one')
    .option('-b, --both', 'print the same results under both strategies')
    .action((area, options) => {
      exit(io, () => survey({ ...options, area }, io));
    });

  common(program.command('landings'))
    .description('every lot landed on a day, checked against every register')
    .requiredOption('-o, --on <date>', 'the day to look at')
    .option('-f, --from <date>', 'the day the walk over the feed starts')
    .action((options) => {
      exit(io, () => landings(options, io));
    });

  common(program.command('lot'))
    .description('everything the programme knows about one lot')
    .argument('<lot>', 'the lot number')
    .option('-f, --from <date>', 'the day the walk over the feed starts')
    .action((number, options) => {
      exit(io, () => lot({ ...options, lot: number }, io));
    });

  common(program.command('trace'))
    .description('walk back from a lot number to the water it came out of')
    .argument('<lot>', 'the lot number')
    .action((number, options) => {
      exit(io, () => trace({ ...options, lot: number }, io));
    });

  common(program.command('forward'))
    .description('walk forward from a lot number to everywhere it went')
    .argument('<lot>', 'the lot number')
    .action((number, options) => {
      exit(io, () => forward({ ...options, lot: number }, io));
    });

  common(program.command('recall'))
    .description('everything landed out of an area in a period, and where it went')
    .argument('<area>', 'the area number')
    .requiredOption('-o, --on <date>', 'the first day of the period')
    .option('-t, --to <date>', 'the last day of the period')
    .action((area, options) => {
      exit(io, () => recallCommand({ ...options, area }, io));
    });

  return program;
}

let lastCode = 0;

function exit(io, body) {
  lastCode = guard(io, body);
}

export function run(argv, io = makeConsole()) {
  lastCode = 0;
  const program = build(io);
  program.exitOverride();
  try {
    program.parse(argv);
  } catch (error) {
    if (error.exitCode === 0) {
      return 0;
    }
    return REFUSED;
  }
  return lastCode;
}
