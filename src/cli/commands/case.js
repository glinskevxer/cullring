/**
 * The validate command, which reads a case directory and says what is wrong
 * with it before anybody runs a report off it.
 */

import { checkRegister } from '../../area/consistency.js';
import { civilDateAt } from '../../time/instant.js';
import { instant } from '../../time/instant.js';
import { definitionList } from '../../text/table.js';
import { contextOf, loadCase } from '../context.js';
import { asJson, countBySeverity, printFindings } from '../output.js';

export function validate(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = civilDateAt(
    loaded.zone,
    options.on === undefined || options.on === null
      ? instant(Math.floor(Date.parse('2025-09-30T12:00:00Z') / 1000))
      : instant(Math.floor(Date.parse(`${options.on}T12:00:00Z`) / 1000)),
  );
  const register = checkRegister({
    areas: loaded.areas,
    stations: loaded.stations,
    beds: loaded.beds,
    plans: loaded.plans,
    sources: loaded.sources,
    boundaries: loaded.boundaries,
    tides: loaded.tides,
    on,
  });
  loaded.problems.absorb(register.problems);
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
        boundaries: loaded.boundaries.length,
        holds: register.holds,
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
      ['Boundaries drawn', String(loaded.boundaries.length)],
      ['Register holds together', register.holds ? 'yes' : 'no'],
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
