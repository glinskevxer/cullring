/**
 * Depuration, which is relay done indoors on a shorter clock.
 *
 * A batch goes into a tank of clean recirculating water under ultraviolet
 * light and stays there for forty four hours. What makes it a process rather
 * than a wait is that the forty four hours have to be continuous: a pump that
 * stops for two hours in the middle does not cost two hours, it costs the
 * whole cycle, because the shellfish shut when the flow stops and start again
 * from nothing when it comes back.
 *
 * Two other things have to hold and both are about mixing. Only a certified
 * depuration processor may run a cycle, and a batch may hold only lots of one
 * species out of one classification of water. A tank holding product from two
 * areas cannot be traced back out of, and the release sample would be a sample
 * of an average rather than of anything anybody could recall.
 *
 * The release sample is scored against the approved standard, using the same
 * table the survey uses. That is deliberate: the whole claim of depuration is
 * that the product now reads as though it came out of approved water.
 */

import { findings } from '../core/finding.js';
import { APPROVED } from '../area/classification.js';
import { DEPURATE, mayPerform } from '../licence/dealer.js';
import { describeSet } from '../survey/statistics.js';
import { FECAL_COLIFORM, limitsFor } from '../survey/standard.js';
import { AT_LIMIT } from '../survey/statistics.js';
import { civilDateAt, hoursBetween, isInstant } from '../time/instant.js';
import { mergeWindows, window } from '../time/window.js';

/** The cycle the rule names, in hours. */
export const CYCLE_HOURS = 44;

export function depurationBatch({ id, processor, lots, species, sourceClassification, tank }) {
  return Object.freeze({
    id,
    processor,
    lots: Object.freeze(lots.slice()),
    species,
    sourceClassification,
    tank,
  });
}

/**
 * The stretches of a cycle in which the process was actually running. An
 * outage list is subtracted from the cycle rather than deducted from its
 * length, because what matters is the longest unbroken run and not the total.
 */
export function runningWindows({ startedAt, endedAt, outages = [] }) {
  const whole = window(startedAt, endedAt);
  if (outages.length === 0) {
    return [whole];
  }
  const merged = mergeWindows(outages);
  const running = [];
  let cursor = startedAt;
  for (const outage of merged) {
    if (outage.start.epochSecond > cursor.epochSecond) {
      running.push(window(cursor, outage.start));
    }
    if (outage.end.epochSecond > cursor.epochSecond) {
      cursor = outage.end;
    }
  }
  if (cursor.epochSecond < endedAt.epochSecond) {
    running.push(window(cursor, endedAt));
  }
  return running;
}

export function longestRunHours(windows) {
  return windows.reduce((best, one) => Math.max(best, hoursBetween(one.start, one.end)), 0);
}

export function checkDepuration({
  batch,
  startedAt,
  endedAt,
  outages = [],
  releaseSamples = [],
  dealers = [],
  zone = 'eastern',
}) {
  const problems = findings();
  if (!isInstant(startedAt) || !isInstant(endedAt)) {
    problems.error('depuration.time', 'a cycle runs between two instants', { batch: batch.id });
    return sealed({ batch, startedAt, endedAt, problems });
  }
  if (endedAt.epochSecond < startedAt.epochSecond) {
    problems.error('depuration.order', `${batch.id} ended before it started`, { batch: batch.id });
    return sealed({ batch, startedAt, endedAt, problems });
  }
  const day = civilDateAt(zone, startedAt);
  checkProcessor(batch, dealers, day, problems);
  checkBatchIntegrity(batch, problems);
  const running = runningWindows({ startedAt, endedAt, outages });
  const longest = longestRunHours(running);
  if (longest < CYCLE_HOURS) {
    problems.error(
      'depuration.short',
      `${batch.id} ran ${round(longest)} unbroken hours against ${CYCLE_HOURS}`,
      { batch: batch.id, longest, required: CYCLE_HOURS, outages: outages.length },
    );
  }
  const release = checkRelease(batch, releaseSamples, problems);
  return sealed({
    batch,
    startedAt,
    endedAt,
    problems,
    running,
    longestRunHours: longest,
    release,
  });
}

function checkProcessor(batch, dealers, day, problems) {
  const processor = dealers.find((one) => one.id === batch.processor) ?? null;
  if (processor === null) {
    problems.error('depuration.unknownProcessor', `${batch.processor} is not in the register`, {
      batch: batch.id,
      processor: batch.processor,
    });
    return;
  }
  if (!mayPerform(processor, DEPURATE, day)) {
    problems.error('depuration.notCertified', `${batch.processor} may not depurate on that day`, {
      batch: batch.id,
      processor: batch.processor,
      kind: processor.kind,
    });
  }
}

function checkBatchIntegrity(batch, problems) {
  if (batch.lots.length === 0) {
    problems.error('depuration.empty', `${batch.id} holds no lots`, { batch: batch.id });
  }
  const areas = new Set(batch.lots.map((lot) => String(lot).split('-')[1]));
  if (areas.size > 1) {
    problems.error('depuration.mixedAreas', `${batch.id} holds lots from more than one area`, {
      batch: batch.id,
      areas: Array.from(areas).sort(),
    });
  }
}

function checkRelease(batch, releaseSamples, problems) {
  if (releaseSamples.length === 0) {
    problems.error('depuration.noRelease', `${batch.id} carries no release sample`, {
      batch: batch.id,
    });
    return null;
  }
  const limits = limitsFor(APPROVED, FECAL_COLIFORM);
  const described = describeSet(releaseSamples, AT_LIMIT);
  const met = described.geometricMean <= limits.geometricMean;
  if (!met) {
    problems.error(
      'depuration.releaseOverLimit',
      `${batch.id} released at ${round(described.geometricMean)} against ${limits.geometricMean}`,
      { batch: batch.id, geometricMean: described.geometricMean, limit: limits.geometricMean },
    );
  }
  return Object.freeze({ described, limit: limits.geometricMean, met });
}

function sealed({
  batch,
  startedAt,
  endedAt,
  problems,
  running = [],
  longestRunHours: longest = null,
  release = null,
}) {
  return Object.freeze({
    batch: batch.id,
    processor: batch.processor,
    lots: batch.lots,
    startedAt,
    endedAt,
    running: Object.freeze(running),
    longestRunHours: longest,
    release,
    released: problems.isLawful(),
    problems,
  });
}

function round(value) {
  return Math.round(value * 10) / 10;
}
