/**
 * The validate command, which reads a case directory and says what is wrong
 * with it before anybody runs a report off it.
 */

import { definitionList } from '../../text/table.js';
import { contextOf, loadCase } from '../context.js';
import { asJson, countBySeverity, printFindings } from '../output.js';

export function validate(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const counts = countBySeverity(loaded.problems);
  if (options.json === true) {
    io.say(
      asJson({
        case: loaded.directory,
        areas: loaded.areas.length,
        plans: loaded.plans.length,
        stations: loaded.stations.length,
        beds: loaded.beds.length,
        harvesters: loaded.harvesters.length,
        dealers: loaded.dealers.length,
        samples: loaded.samples.length,
        landings: loaded.records.length,
        movements: loaded.book.length,
        findings: loaded.problems.list(),
      }),
    );
    return printFindings([], io);
  }
  io.say(
    definitionList([
      ['Case', loaded.directory],
      ['Areas', String(loaded.areas.length)],
      ['Plans', String(loaded.plans.length)],
      ['Stations', String(loaded.stations.length)],
      ['Beds', String(loaded.beds.length)],
      ['Harvesters', String(loaded.harvesters.length)],
      ['Dealers', String(loaded.dealers.length)],
      ['Samples', String(loaded.samples.length)],
      ['Landings', String(loaded.records.length)],
      ['Movements', String(loaded.book.length)],
      ['Findings', `${counts.total}, of which ${counts.errors} are errors`],
    ]),
  );
  return printFindings(loaded.problems, io, { quiet: options.quiet === true });
}

/** The registers a case holds, for anything that wants them without a report. */
export function openCase(options) {
  const loaded = loadCase(options.case, { zone: options.zone });
  return { loaded, context: contextOf(loaded) };
}
