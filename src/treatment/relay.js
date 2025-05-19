/**
 * Relay, which is moving restricted product into clean water and waiting.
 *
 * The waiting is the treatment. Shellfish pump their own volume many times an
 * hour and given long enough in water that meets the approved standard they
 * clean themselves out. How long is long enough depends on how cold the water
 * is, because a cold oyster barely pumps at all: fourteen days in the warm
 * months, twenty one when the water is under fifty degrees, and no relay at
 * all below forty one, where nothing useful happens however long you wait.
 *
 * The part that catches people is the receiving water. It has to be approved
 * for the whole period and not merely on the day the shellfish went in. A
 * conditional area that shuts on the tenth day has not held the lot in
 * approved water for fourteen days, and the count starts again. That check
 * reads the closure walk, which is why relay lives downstream of it.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireNumber } from '../core/assert.js';
import { APPROVED, treatmentRequired } from '../area/classification.js';
import { effectiveClassification } from '../area/effective.js';
import { addSeconds, civilDateAt, hoursBetween, isInstant } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';

/** Below this the shellfish are not pumping and no relay counts at all. */
export const NO_PUMPING_BELOW = 41;

/** At or above this the shorter period applies. */
export const WARM_WATER_AT = 50;

export const WARM_DAYS = 14;
export const COLD_DAYS = 21;

/**
 * The number of days a relay has to run, or nothing where the water is too
 * cold for a relay to do anything. Water temperature is the property of the
 * receiving area over the period, not of the day the shellfish went in.
 */
export function relayDays(waterTemperature) {
  requireNumber(waterTemperature, 'waterTemperature');
  if (waterTemperature < NO_PUMPING_BELOW) {
    return null;
  }
  return waterTemperature >= WARM_WATER_AT ? WARM_DAYS : COLD_DAYS;
}

export function relayPermit({ number, harvester, fromArea, toArea, issuedOn, expiresOn }) {
  if (typeof number !== 'string' || number.trim() === '') {
    throw new InputError('relay.permit', 'a relay permit carries a number', {});
  }
  return Object.freeze({
    number: number.trim().toUpperCase(),
    harvester,
    fromArea,
    toArea,
    issuedOn,
    expiresOn,
  });
}

/**
 * Check one relay. The lot, where it went, when it went in, when it came out,
 * and the water temperature over the period.
 */
export function checkRelay({
  record,
  permit = null,
  toArea,
  laidAt,
  liftedAt,
  waterTemperature,
  areas,
  plans = [],
  feed = {},
  from = null,
  harvestedAs = null,
}) {
  const problems = findings();
  if (!isInstant(laidAt) || !isInstant(liftedAt)) {
    throw new InputError('relay.time', 'a relay runs between two instants', {});
  }
  if (liftedAt.epochSecond < laidAt.epochSecond) {
    problems.error('relay.order', `${record.lot} was lifted before it was laid`, {
      lot: record.lot,
    });
    return sealed({ record, toArea, laidAt, liftedAt, problems });
  }
  if (harvestedAs !== null && treatmentRequired(harvestedAs) === null) {
    problems.note('relay.notNeeded', `${record.lot} came out of water that needed no treatment`, {
      lot: record.lot,
      classification: harvestedAs,
    });
  }
  if (permit === null) {
    problems.error('relay.noPermit', `${record.lot} was relayed under no permit`, {
      lot: record.lot,
    });
  } else if (permit.toArea !== toArea) {
    problems.error(
      'relay.wrongWater',
      `the permit names ${permit.toArea} and the lot went to ${toArea}`,
      {
        lot: record.lot,
        permitted: permit.toArea,
        actual: toArea,
      },
    );
  }
  const required = relayDays(waterTemperature);
  if (required === null) {
    problems.error(
      'relay.tooCold',
      `at ${waterTemperature} degrees the shellfish are not pumping, so no relay counts`,
      { lot: record.lot, waterTemperature, floor: NO_PUMPING_BELOW },
    );
    return sealed({ record, toArea, laidAt, liftedAt, problems, waterTemperature });
  }
  const heldDays = hoursBetween(laidAt, liftedAt) / 24;
  if (heldDays < required) {
    problems.error(
      'relay.tooShort',
      `${record.lot} was held ${round(heldDays)} days against ${required}`,
      { lot: record.lot, heldDays, required, waterTemperature },
    );
  }
  checkReceivingWater({ toArea, laidAt, liftedAt, areas, plans, feed, from, record, problems });
  return sealed({
    record,
    toArea,
    laidAt,
    liftedAt,
    problems,
    waterTemperature,
    required,
    heldDays,
  });
}

/**
 * The receiving water has to be approved throughout. The period is sampled at
 * the start, the end, and every midnight in between, which is the finest grain
 * anything in the register changes at.
 */
function checkReceivingWater({
  toArea,
  laidAt,
  liftedAt,
  areas,
  plans,
  feed,
  from,
  record,
  problems,
}) {
  const area = areas.find((one) => one.id === toArea) ?? null;
  if (area === null) {
    problems.error('relay.unknownWater', `${toArea} is not in the register`, { area: toArea });
    return;
  }
  const failures = [];
  let cursor = laidAt;
  while (cursor.epochSecond <= liftedAt.epochSecond) {
    const standing = effectiveClassification({ area, plans, feed, at: cursor, from });
    if (standing.effective !== APPROVED) {
      failures.push({ at: cursor, was: standing.effective });
    }
    cursor = addSeconds(cursor, 86400);
  }
  if (failures.length > 0) {
    const first = failures[0];
    problems.error(
      'relay.waterNotApproved',
      `${toArea} was ${first.was} on ${formatCivilDate(civilDateAt(area.zone, first.at))} during the relay`,
      { lot: record.lot, area: toArea, days: failures.length },
    );
  }
}

function sealed({
  record,
  toArea,
  laidAt,
  liftedAt,
  problems,
  waterTemperature = null,
  required = null,
  heldDays = null,
}) {
  return Object.freeze({
    lot: record.lot,
    toArea,
    laidAt,
    liftedAt,
    waterTemperature,
    requiredDays: required,
    heldDays,
    released: problems.isLawful(),
    problems,
  });
}

function round(value) {
  return Math.round(value * 10) / 10;
}
