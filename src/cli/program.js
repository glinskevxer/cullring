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
import { annual } from './commands/annual.js';
import { bookCommand } from './commands/book.js';
import { chart } from './commands/chart.js';
import { exportCase } from './commands/export.js';
import { forecastCommand } from './commands/forecast.js';
import { inspections } from './commands/inspection.js';
import { landings, lot } from './commands/landings.js';
import { take } from './commands/limits.js';
import { bedsCommand, dealerCommand, harvesterCommand } from './commands/registers.js';
import { month, walk } from './commands/month.js';
import { orders } from './commands/orders.js';
import { programme } from './commands/programme.js';
import { survey } from './commands/survey.js';
import { tideCommand, vibrioCommand } from './commands/tide.js';
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
      .option('--json', 'print the answer as JSON')
      .option('--csv', 'print the rows as a sheet');

  common(program.command('validate'))
    .description('read a case directory and report what is wrong with it')
    .option('-q, --quiet', 'print the counts but not the findings')
    .option('-o, --on <date>', 'the day the register is checked as at')
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

  common(program.command('dealer'))
    .description('a dealer certification and what it permits on a day')
    .argument('<dealer>', 'the certification number')
    .requiredOption('-o, --on <date>', 'the day to ask about')
    .action((number, options) => {
      exit(io, () => dealerCommand({ ...options, dealer: number }, io));
    });

  common(program.command('harvester'))
    .description('a harvester licence and what it permits on a day')
    .argument('<harvester>', 'the licence number')
    .requiredOption('-o, --on <date>', 'the day to ask about')
    .action((number, options) => {
      exit(io, () => harvesterCommand({ ...options, harvester: number }, io));
    });

  common(program.command('beds'))
    .description('the beds in an area, with the tide station each is read against')
    .argument('<area>', 'the area number')
    .action((area, options) => {
      exit(io, () => bedsCommand({ ...options, area }, io));
    });

  common(program.command('tide'))
    .description('when a bed comes out of the water on a day')
    .argument('<bed>', 'the bed number')
    .requiredOption('-o, --on <date>', 'the day to ask about')
    .action((bed, options) => {
      exit(io, () => tideCommand({ ...options, bed }, io));
    });

  common(program.command('vibrio'))
    .description('the time to temperature table for the region an area sits in')
    .argument('<area>', 'the area number')
    .action((area, options) => {
      exit(io, () => vibrioCommand({ ...options, area }, io));
    });

  common(program.command('month'))
    .description('the monthly programme report')
    .requiredOption('-o, --on <date>', 'any day in the month')
    .action((options) => {
      exit(io, () => month(options, io));
    });

  common(program.command('walk'))
    .description('every report over one case, with a seal at the end')
    .requiredOption('-o, --on <date>', 'the day the walk is run as at')
    .option('--digest-only', 'print only the seal')
    .action((options) => {
      exit(io, () => walk(options, io));
    });

  common(program.command('programme'))
    .description('which reviews are overdue and which stations are due a visit')
    .requiredOption('-o, --on <date>', 'the day to ask about')
    .action((options) => {
      exit(io, () => programme(options, io));
    });

  common(program.command('orders'))
    .description('the emergency orders, and whether any could be lifted')
    .requiredOption('-a, --at <stamp>', 'the moment to ask about')
    .option('-r, --area <area>', 'only the orders over one area')
    .action((options) => {
      exit(io, () => orders(options, io));
    });

  common(program.command('book'))
    .description('a dealer book, what it permits, and whether it reconciles')
    .argument('<dealer>', 'the certification number')
    .requiredOption('-o, --on <date>', 'the day to read the certification on')
    .action((number, options) => {
      exit(io, () => bookCommand({ ...options, dealer: number }, io));
    });

  common(program.command('inspections'))
    .description('the inspection round, and which plant to walk next')
    .requiredOption('-o, --on <date>', 'the day to ask about')
    .action((options) => {
      exit(io, () => inspections(options, io));
    });

  common(program.command('export'))
    .description('write a case back out, whole or narrowed to one area')
    .option('-s, --shape <shape>', 'register or landings', 'register')
    .option('-r, --area <area>', 'only this area')
    .option('-o, --on <date>', 'only landings on this day')
    .action((options) => {
      exit(io, () => exportCase(options, io));
    });

  common(program.command('chart'))
    .description('one page about one area: history, plans, stations, beds and the bank')
    .argument('<area>', 'the area number')
    .requiredOption('-o, --on <date>', 'the day to read the classification on')
    .action((area, options) => {
      exit(io, () => chart({ ...options, area }, io));
    });

  common(program.command('take'))
    .description('what each licence landed on a day, against the limits')
    .requiredOption('-o, --on <date>', 'the day to look at')
    .action((options) => {
      exit(io, () => take(options, io));
    });

  common(program.command('forecast'))
    .description('which plans the loaded forecast would close, and when')
    .action((options) => {
      exit(io, () => forecastCommand(options, io));
    });

  common(program.command('annual'))
    .description('the annual report, counted from the registers rather than kept running')
    .argument('<year>', 'the programme year')
    .action((year, options) => {
      exit(io, () => annual({ ...options, year }, io));
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
