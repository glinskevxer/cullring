/**
 * Loading a case directory off disk.
 *
 * The office keeps one directory per programme year. The registers are one
 * JSON file because somebody edits them by hand; the feeds are CSV because
 * they arrive by the thousand from other people's systems. A missing feed is
 * not an error: an office that has not yet loaded the tide table can still ask
 * about the standing of its areas, and refusing to start would be a worse
 * answer than doing the part that is answerable.
 *
 * What is an error is a feed that is there and unreadable, and the loader
 * reports that in the same list of findings as everything else so that one
 * command line can print all of it.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { findings } from '../core/finding.js';
import {
  loadAreas,
  loadBeds,
  loadBypasses,
  loadCertificates,
  loadDealers,
  loadHarvesters,
  loadHarvests,
  loadMovements,
  loadPlans,
  loadReadings,
  loadSamples,
  loadOrders,
  loadReviewHistory,
  loadSources,
  loadStations,
  loadTides,
} from '../io/load.js';
import { ledger } from '../trace/ledger.js';
import { parseCsv } from '../io/csv.js';
import { instantFromCivil, parseInstant } from '../time/instant.js';
import { MIDNIGHT } from '../time/civil.js';
import { LOW } from '../tide/table.js';
import { limitsFor } from '../survey/standard.js';
import { APPROVED } from '../area/classification.js';
import { FECAL_COLIFORM } from '../survey/standard.js';

export const REGISTER_FILE = 'register.json';

/** A single result is conforming at or under the approved upper limit. */
export const SINGLE_SAMPLE_LIMIT = limitsFor(APPROVED, FECAL_COLIFORM).ninetieth;

export const FEEDS = Object.freeze({
  readings: 'gauge.csv',
  bypasses: 'bypass.csv',
  tides: 'tide.csv',
  samples: 'samples.csv',
  landings: 'landings.csv',
  movements: 'ledger.csv',
  control: 'control.csv',
});

export function loadCase(directory, { zone = 'eastern' } = {}) {
  const problems = findings();
  const registerPath = join(directory, REGISTER_FILE);
  let register = {};
  if (!existsSync(registerPath)) {
    problems.error('case.noRegister', `${REGISTER_FILE} is not in ${directory}`, {
      path: registerPath,
    });
  } else {
    try {
      register = JSON.parse(readFileSync(registerPath, 'utf8'));
    } catch (error) {
      problems.error('case.badRegister', `${REGISTER_FILE} is not readable: ${error.message}`, {
        path: registerPath,
      });
    }
  }

  const areas = absorb(problems, loadAreas(register));
  const plans = absorb(problems, loadPlans(register));
  const stations = absorb(problems, loadStations(register));
  const beds = absorb(problems, loadBeds(register));
  const harvesters = absorb(problems, loadHarvesters(register));
  const dealers = absorb(problems, loadDealers(register));
  const certificates = absorb(problems, loadCertificates(register));
  const sources = absorb(problems, loadSources(register));
  const reviewHistory = absorb(problems, loadReviewHistory(register));
  const orders = absorb(problems, loadOrders(register, { zone }));

  const readings = feed(problems, directory, FEEDS.readings, (text) =>
    loadReadings(text, { zone }),
  );
  const bypasses = feed(problems, directory, FEEDS.bypasses, (text) =>
    loadBypasses(text, { zone }),
  );
  const tides = feed(problems, directory, FEEDS.tides, (text) => loadTides(text, { zone }));
  const samples = feed(problems, directory, FEEDS.samples, (text) => loadSamples(text));
  const landings = feed(problems, directory, FEEDS.landings, (text) =>
    loadHarvests(text, { zone }),
  );
  const movements = feed(problems, directory, FEEDS.movements, (text) =>
    loadMovements(text, { zone }),
  );
  const control = loadControl(problems, directory, zone);

  return Object.freeze({
    directory,
    zone,
    areas,
    plans,
    stations,
    beds,
    harvesters,
    dealers,
    certificates,
    sources,
    reviewHistory,
    orders,
    samples,
    records: landings,
    book: ledger(movements),
    underControl: control,
    feed: Object.freeze({
      readings,
      bypasses,
      tides: tideTurns(tides),
      samples: conformingSamples(samples, zone),
    }),
    tides,
    problems,
  });
}

/**
 * The closure walk reads a different feed from the survey.
 *
 * Both are called samples and they are not the same thing. The survey wants
 * every result with the station and the day it was collected on. A reopening
 * rule counted in conforming samples wants an instant and a yes or no, and
 * a result is conforming when it is at or under the single sample limit for
 * approved water. Handing the survey list to the closure walk put a record
 * with no instant on it into a list of instants, which is exactly the kind of
 * thing two fields with the same name do.
 */
export function conformingSamples(samples, zone) {
  return samples.map((one) =>
    Object.freeze({
      at: instantFromCivil(zone, one.collectedOn, MIDNIGHT),
      conforming: one.result.value <= SINGLE_SAMPLE_LIMIT,
      station: one.station,
    }),
  );
}

/**
 * A tide cycle turns at low water, so the reopening rules counted in tide
 * cycles read the low waters out of the published table.
 */
export function tideTurns(table) {
  return table
    .filter((one) => one.kind === LOW)
    .map((one) => one.at)
    .sort((left, right) => left.epochSecond - right.epochSecond);
}

/**
 * The times lots went under temperature control, which the dealers report on
 * their own sheet rather than on the landing record.
 */
function loadControl(problems, directory, zone) {
  const path = join(directory, FEEDS.control);
  const map = new Map();
  if (!existsSync(path)) {
    return map;
  }
  const read = parseCsv(readFileSync(path, 'utf8'));
  problems.absorb(read.problems);
  for (const row of read.rows) {
    try {
      map.set(row.values.lot, parseInstant(row.values.at, { zone, field: 'at' }));
    } catch (error) {
      problems.error('case.control', `${FEEDS.control} line ${row.line}: ${error.message}`, {
        line: row.line,
      });
    }
  }
  return map;
}

function feed(problems, directory, name, build) {
  const path = join(directory, name);
  if (!existsSync(path)) {
    problems.note('case.noFeed', `${name} is not in the case directory`, { file: name });
    return [];
  }
  const answer = build(readFileSync(path, 'utf8'));
  for (const finding of answer.problems.list()) {
    problems.add({ ...finding, message: `${name}: ${finding.message}` });
  }
  return answer.built;
}

function absorb(problems, answer) {
  problems.absorb(answer.problems);
  return answer.built;
}

/** Everything a rule module wants, out of a loaded case. */
export function contextOf(loaded, { from = null } = {}) {
  return {
    areas: loaded.areas,
    plans: loaded.plans,
    feed: { readings: loaded.feed.readings, bypasses: loaded.feed.bypasses },
    harvesters: loaded.harvesters,
    dealers: loaded.dealers,
    certificates: loaded.certificates,
    sources: loaded.sources,
    orders: loaded.orders,
    tides: loaded.tides,
    beds: loaded.beds,
    from,
  };
}
