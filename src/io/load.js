/**
 * Building the registers out of what the office keeps on disk.
 *
 * The shape of these files is not interesting and is deliberately not clever:
 * the areas, the plans and the licences are JSON because somebody edits them
 * by hand a few times a year, and the readings, the samples, the landings and
 * the dealers' books are CSV because they arrive from other people's systems
 * by the thousand.
 *
 * Every loader has the same manners. It builds what it can, it never throws on
 * content, and every row it could not build comes back as a finding with the
 * line number on it. A register with three bad rows is still a register, and
 * the office would rather run the report and see the three.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { classificationPeriod, growingArea } from '../area/growingArea.js';
import { station } from '../area/station.js';
import { emergencyOrder } from '../condition/emergency.js';
import { managementPlan } from '../condition/plan.js';
import { season } from '../condition/season.js';
import { afterHours, afterSamples, afterTides, onDate } from '../condition/reopening.js';
import {
  bypassTrigger,
  rainfallTrigger,
  seasonTrigger,
  stageTrigger,
} from '../condition/trigger.js';
import { bed } from '../harvest/bed.js';
import { boundary } from '../geo/polygon.js';
import { harvestRecord } from '../harvest/record.js';
import { dealer } from '../licence/dealer.js';
import { certificate } from '../licence/education.js';
import { inspection } from '../licence/inspection.js';
import { harvester, suspension } from '../licence/harvester.js';
import { sample } from '../survey/result.js';
import { pollutionSource } from '../survey/shoreline.js';
import { extreme } from '../tide/table.js';
import { movement } from '../trace/ledger.js';
import { reading } from '../weather/gauge.js';
import { parseInstant } from '../time/instant.js';
import { parseCivilDate } from '../time/civil.js';
import { parseCsv, readRows } from './csv.js';

export function loadAreas(source) {
  return loadList(source, 'areas', (entry) =>
    growingArea({
      ...entry,
      history: entry.history.map((period) => classificationPeriod(period)),
    }),
  );
}

export function loadStations(source) {
  return loadList(source, 'stations', (entry) => station(entry));
}

export function loadBeds(source) {
  return loadList(source, 'beds', (entry) => bed(entry));
}

export function loadHarvesters(source) {
  return loadList(source, 'harvesters', (entry) =>
    harvester({
      ...entry,
      suspensions: (entry.suspensions ?? []).map((one) => suspension(one)),
    }),
  );
}

export function loadCertificates(source) {
  return loadList(source, 'certificates', (entry) => certificate(entry));
}

export function loadInspections(source) {
  return loadList(source, 'inspections', (entry) => inspection(entry));
}

export function loadDealers(source) {
  return loadList(source, 'dealers', (entry) => dealer(entry));
}

/**
 * The review dates, which are a record keyed by area rather than a list. They
 * are the one part of the register that is optional in full: an office that
 * has never written them down still gets a schedule worked out from the last
 * reclassification, and the report prints the date it used.
 */
export function loadReviewHistory(source) {
  const problems = findings();
  const held = (source ?? {}).reviewHistory;
  if (held === undefined) {
    problems.note('load.absent', 'the register carries no reviewHistory', {
      field: 'reviewHistory',
    });
    return Object.freeze({ built: Object.freeze({}), problems });
  }
  if (typeof held !== 'object' || Array.isArray(held)) {
    problems.error('load.shape', 'reviewHistory is not a record', { field: 'reviewHistory' });
    return Object.freeze({ built: Object.freeze({}), problems });
  }
  const out = {};
  for (const [area, dates] of Object.entries(held)) {
    try {
      out[area] = Object.freeze({
        lastReview: parseCivilDate(dates.lastReview, 'lastReview'),
        lastSurvey: parseCivilDate(dates.lastSurvey, 'lastSurvey'),
        lastPlanReview:
          dates.lastPlanReview === undefined || dates.lastPlanReview === null
            ? null
            : parseCivilDate(dates.lastPlanReview, 'lastPlanReview'),
      });
    } catch (error) {
      problems.error('load.entry', `reviewHistory[${area}]: ${error.message}`, { area });
    }
  }
  return Object.freeze({ built: Object.freeze(out), problems });
}

/**
 * The emergency orders. Their times are instants rather than civil dates,
 * because an order is signed at a moment and a boat that went out an hour
 * before it was signed did nothing wrong.
 */
export function loadOrders(source, { zone = 'eastern' } = {}) {
  return loadList(source, 'orders', (entry) =>
    emergencyOrder({
      ...entry,
      issuedAt: parseInstant(entry.issuedAt, { zone, field: 'issuedAt' }),
      liftedAt:
        entry.liftedAt === undefined || entry.liftedAt === null
          ? null
          : parseInstant(entry.liftedAt, { zone, field: 'liftedAt' }),
    }),
  );
}

export function loadBoundaries(source) {
  return loadList(source, 'boundaries', (entry) => boundary(entry));
}

export function loadSeasons(source) {
  return loadList(source, 'seasons', (entry) => season(entry));
}

export function loadSources(source) {
  return loadList(source, 'sources', (entry) => pollutionSource(entry));
}

export function loadPlans(source) {
  return loadList(source, 'plans', (entry) =>
    managementPlan({
      ...entry,
      trigger: buildTrigger(entry.trigger),
      reopening: buildReopening(entry.reopening),
    }),
  );
}

export function buildTrigger(spec) {
  if (spec === undefined || spec === null || typeof spec.kind !== 'string') {
    throw new InputError('load.trigger', 'a plan carries a trigger with a kind', {});
  }
  switch (spec.kind) {
    case 'rainfall':
      return rainfallTrigger(spec);
    case 'stage crossing':
      return stageTrigger(spec);
    case 'bypass':
      return bypassTrigger(spec);
    case 'season':
      return seasonTrigger(spec);
    default:
      throw new InputError('load.trigger', `${spec.kind} is not a trigger`, { kind: spec.kind });
  }
}

export function buildReopening(spec) {
  if (spec === undefined || spec === null || typeof spec.kind !== 'string') {
    throw new InputError('load.reopening', 'a plan carries a reopening rule with a kind', {});
  }
  switch (spec.kind) {
    case 'after hours':
      return afterHours(spec.hours);
    case 'after samples':
      return afterSamples(spec.count);
    case 'after tides':
      return afterTides(spec.cycles);
    case 'on date':
      return onDate(spec.on);
    default:
      throw new InputError('load.reopening', `${spec.kind} is not a reopening rule`, {
        kind: spec.kind,
      });
  }
}

function loadList(source, field, build) {
  const problems = findings();
  const entries = Array.isArray(source) ? source : (source ?? {})[field];
  if (entries === undefined) {
    problems.note('load.absent', `the register carries no ${field}`, { field });
    return Object.freeze({ built: Object.freeze([]), problems });
  }
  if (!Array.isArray(entries)) {
    problems.error('load.shape', `${field} is not a list`, { field });
    return Object.freeze({ built: Object.freeze([]), problems });
  }
  const built = [];
  entries.forEach((entry, index) => {
    try {
      built.push(build(entry));
    } catch (error) {
      problems.error('load.entry', `${field}[${index}]: ${error.message}`, {
        field,
        index,
        cause: error.code ?? 'unknown',
      });
    }
  });
  return Object.freeze({ built: Object.freeze(built), problems });
}

/**
 * The CSV feeds. Each one names the columns it needs and nothing else, so a
 * sheet carrying extra columns from somebody else's system loads without
 * complaint and a sheet missing one fails on the row rather than on the file.
 */

export function loadReadings(text, { zone = 'eastern' } = {}) {
  return readRows(parseCsv(text), (values) =>
    reading({
      gauge: values.gauge,
      at: parseInstant(values.at, { zone, field: 'at' }),
      value: Number(values.value),
    }),
  );
}

export function loadBypasses(text, { zone = 'eastern' } = {}) {
  return readRows(parseCsv(text), (values) =>
    Object.freeze({
      facility: values.facility,
      at: parseInstant(values.at, { zone, field: 'at' }),
      note: values.note ?? null,
    }),
  );
}

export function loadTides(text, { zone = 'eastern' } = {}) {
  return readRows(parseCsv(text), (values) =>
    extreme({
      station: values.station,
      at: parseInstant(values.at, { zone, field: 'at' }),
      kind: values.kind,
      height: Number(values.height),
    }),
  );
}

export function loadSamples(text) {
  return readRows(parseCsv(text), (values) =>
    sample({
      station: values.station,
      collectedOn: values.collectedOn,
      result: values.result,
      kind: values.kind === undefined || values.kind === '' ? undefined : values.kind,
    }),
  );
}

export function loadHarvests(text, { zone = 'eastern' } = {}) {
  return readRows(parseCsv(text), (values) =>
    harvestRecord({
      lot: blankToNull(values.lot),
      harvester: values.harvester,
      bed: values.bed,
      gear: values.gear,
      species: blankToNull(values.species) ?? undefined,
      form: blankToNull(values.form) ?? undefined,
      startedAt: parseInstant(values.startedAt, { zone, field: 'startedAt' }),
      landedAt: parseInstant(values.landedAt, { zone, field: 'landedAt' }),
      containers: Number(values.containers),
      dealer: blankToNull(values.dealer),
      iced: readFlag(values.iced),
      zone,
    }),
  );
}

export function loadMovements(text, { zone = 'eastern' } = {}) {
  return readRows(parseCsv(text), (values) =>
    movement({
      kind: values.kind,
      lot: values.lot,
      becomes: blankToNull(values.becomes),
      at: parseInstant(values.at, { zone, field: 'at' }),
      dealer: blankToNull(values.dealer),
      containers:
        values.containers === undefined || values.containers === ''
          ? null
          : Number(values.containers),
      toParty: blankToNull(values.toParty),
      note: blankToNull(values.note),
    }),
  );
}

/** True only for the words the sheets actually carry, and false for a blank. */
export function readFlag(value) {
  if (value === undefined || value === null) {
    return false;
  }
  return ['y', 'yes', 'true', '1', 'iced'].includes(String(value).trim().toLowerCase());
}

function blankToNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  return value;
}
