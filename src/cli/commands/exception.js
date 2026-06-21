/**
 * The exceptions command, which is the only thing in the programme that runs
 * every check over a whole case at once.
 *
 * The gathering lives here rather than in the report, because gathering means
 * choosing which checks to run and at what moment, and those are decisions a
 * command makes from what somebody typed. The report is handed a finished list
 * and groups it.
 *
 * The order of the checks is the order the office would do them in, and it is
 * not arbitrary: the register check comes first because everything downstream
 * reads the register, and a case that does not hold together will produce a
 * page of findings that are all the same problem wearing different codes.
 */

import { checkRegister } from '../../area/consistency.js';
import { checkHarvest } from '../../harvest/legality.js';
import {
  checkMovements,
  reviewFindings as embargoReviews,
  standing,
} from '../../harvest/embargo.js';
import { errorCount, exceptionReport, renderException } from '../../report/exception.js';
import { findBed, parseBedId } from '../../harvest/bed.js';
import { findings } from '../../core/finding.js';
import { inspectionRound } from '../../report/inspection.js';
import { leaseFindings } from '../../area/lease.js';
import { classificationOn, findArea } from '../../area/growingArea.js';
import { programmeReport } from '../../report/programme.js';
import { renewalRound } from '../../licence/renewal.js';
import { roundReport } from '../../report/round.js';
import { MIDNIGHT, formatCivilDate } from '../../time/civil.js';
import { instantFromCivil } from '../../time/instant.js';
import { contextOf, loadCase } from '../context.js';
import { historyOf } from './programme.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, asJson } from '../output.js';

export function exceptions(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const at = instantFromCivil(loaded.zone, on, MIDNIGHT);
  const problems = findings();

  problems.absorb(loaded.problems);
  problems.absorb(
    checkRegister({
      areas: loaded.areas,
      stations: loaded.stations,
      beds: loaded.beds,
      plans: loaded.plans,
      sources: loaded.sources,
      boundaries: loaded.boundaries,
      tides: loaded.tides,
      on,
    }).problems,
  );
  problems.absorb(
    programmeReport({
      areas: loaded.areas,
      stations: loaded.stations,
      samples: loaded.samples,
      on,
      history: historyOf(loaded),
    }).problems,
  );
  problems.absorb(
    roundReport({
      areas: loaded.areas,
      stations: loaded.stations,
      samples: loaded.samples,
      on,
    }).problems,
  );
  problems.absorb(
    inspectionRound({ dealers: loaded.dealers, inspections: loaded.inspections, on }).problems,
  );
  problems.absorb(
    leaseFindings(loaded.leases, {
      on,
      classificationOf: (one) => waterUnder(loaded, one, on),
    }),
  );
  problems.absorb(
    renewalRound(loaded.harvesters, { certificates: loaded.certificates ?? [], on }).problems,
  );

  const held = standing(loaded.embargoes, at);
  const embargoContext = { book: loaded.book, records: loaded.records, beds: loaded.beds, at };
  problems.absorb(checkMovements(held, embargoContext));
  problems.absorb(embargoReviews(held, at));

  for (const record of loaded.records) {
    const bed = findBed(loaded.beds, record.bed);
    if (bed === null) {
      continue;
    }
    problems.absorb(
      checkHarvest({
        ...contextOf(loaded),
        record,
        bed,
        underControlAt: loaded.underControl.get(record.lot) ?? null,
      }).problems,
    );
  }

  const report = exceptionReport({
    on: formatCivilDate(on),
    findings: problems,
    counts: {
      Areas: loaded.areas.length,
      Landings: loaded.records.length,
      Leases: loaded.leases.length,
      Licences: loaded.harvesters.length,
    },
  });

  if (options.json === true) {
    io.say(
      asJson({
        on: report.on,
        total: report.total,
        errors: report.errors,
        families: report.families,
        codes: report.codes,
      }),
    );
    return errorCount(report) > 0 ? FOUND : OK;
  }

  io.say(renderException(report, { limit: readLimit(options) }));
  return errorCount(report) > 0 ? FOUND : OK;
}

function waterUnder(loaded, one, on) {
  try {
    const area = findArea(loaded.areas, parseBedId(one.bed, 'bed').areaId);
    return area === null ? null : classificationOn(area, on);
  } catch {
    return null;
  }
}

function readLimit(options) {
  const given = Number(options.codes);
  return Number.isInteger(given) && given > 0 ? given : 12;
}
