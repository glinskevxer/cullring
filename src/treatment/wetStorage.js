/**
 * Wet storage, which is holding shellstock in water without treating it.
 *
 * A dealer puts oysters back in the water to keep them alive and to let them
 * spit out the mud. That is not depuration and it is not relay, and the rule
 * is written to stop it being mistaken for either: product from restricted
 * water may not be wet stored at all, because coming out of clean water after
 * a night is not evidence about anything.
 *
 * Two facts decide whether a float is lawful. Where it is, which has to be
 * approved water for the whole time the product is in it, and what went in,
 * which has to have come from water that needed no treatment. The programme
 * checks both, and it refuses the second even where the first holds, because
 * that is the confusion the rule exists to prevent.
 */

import { findings } from '../core/finding.js';
import { APPROVED, treatmentRequired } from '../area/classification.js';
import { WET_STORE, mayPerform } from '../licence/dealer.js';
import { effectiveClassification } from '../area/effective.js';
import { addSeconds, civilDateAt, hoursBetween, isInstant } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';

/** Longer than this and it stops being storage and starts being growing. */
export const MAXIMUM_DAYS = 14;

export function checkWetStorage({
  lot,
  dealer,
  areaId,
  harvestedAs,
  placedAt,
  removedAt,
  areas,
  plans = [],
  feed = {},
  dealers = [],
  from = null,
}) {
  const problems = findings();
  if (!isInstant(placedAt) || !isInstant(removedAt)) {
    problems.error('wet.time', 'wet storage runs between two instants', { lot });
    return sealed({ lot, dealer, areaId, placedAt, removedAt, problems });
  }
  if (removedAt.epochSecond < placedAt.epochSecond) {
    problems.error('wet.order', `${lot} was taken out before it went in`, { lot });
    return sealed({ lot, dealer, areaId, placedAt, removedAt, problems });
  }
  const days = hoursBetween(placedAt, removedAt) / 24;
  if (days > MAXIMUM_DAYS) {
    problems.error('wet.tooLong', `${lot} was held ${round(days)} days against ${MAXIMUM_DAYS}`, {
      lot,
      days,
      limit: MAXIMUM_DAYS,
    });
  }
  checkProduct(lot, harvestedAs, problems);
  checkDealer(lot, dealer, dealers, placedAt, problems);
  checkWater({ lot, areaId, areas, plans, feed, placedAt, removedAt, from, problems });
  return sealed({ lot, dealer, areaId, placedAt, removedAt, days, problems });
}

/**
 * The rule this module exists for. Restricted product cannot be wet stored,
 * and the finding says why rather than merely refusing, because everybody who
 * gets it asks the same question next.
 */
function checkProduct(lot, harvestedAs, problems) {
  if (harvestedAs === null || harvestedAs === undefined) {
    problems.warn('wet.unknownOrigin', `nothing records what water ${lot} came out of`, { lot });
    return;
  }
  if (treatmentRequired(harvestedAs) !== null) {
    problems.error(
      'wet.needsTreatment',
      `${lot} came out of ${harvestedAs} water and needs treating, which wet storage is not`,
      { lot, classification: harvestedAs },
    );
  }
}

function checkDealer(lot, dealerId, dealers, placedAt, problems) {
  if (dealerId === null || dealerId === undefined) {
    problems.error('wet.noDealer', `${lot} was wet stored by nobody in particular`, { lot });
    return;
  }
  const found = dealers.find((one) => one.id === dealerId) ?? null;
  if (found === null) {
    problems.error('wet.unknownDealer', `${dealerId} is not in the register`, { lot, dealerId });
    return;
  }
  const day = civilDateAt('eastern', placedAt);
  if (!mayPerform(found, WET_STORE, day)) {
    problems.error('wet.notPermitted', `${dealerId} may not wet store on that day`, {
      lot,
      dealerId,
      kind: found.kind,
    });
  }
}

function checkWater({ lot, areaId, areas, plans, feed, placedAt, removedAt, from, problems }) {
  const area = areas.find((one) => one.id === areaId) ?? null;
  if (area === null) {
    problems.error('wet.unknownWater', `${areaId} is not in the register`, { lot, areaId });
    return;
  }
  let cursor = placedAt;
  const failures = [];
  while (cursor.epochSecond <= removedAt.epochSecond) {
    const standing = effectiveClassification({ area, plans, feed, at: cursor, from });
    if (standing.effective !== APPROVED) {
      failures.push({ at: cursor, was: standing.effective });
    }
    cursor = addSeconds(cursor, 86400);
  }
  if (failures.length > 0) {
    const first = failures[0];
    problems.error(
      'wet.waterNotApproved',
      `${areaId} was ${first.was} on ${formatCivilDate(civilDateAt(area.zone, first.at))} during the storage`,
      { lot, areaId, days: failures.length },
    );
  }
}

function sealed({ lot, dealer, areaId, placedAt, removedAt, days = null, problems }) {
  return Object.freeze({
    lot,
    dealer,
    areaId,
    placedAt,
    removedAt,
    days,
    lawful: problems.isLawful(),
    problems,
  });
}

function round(value) {
  return Math.round(value * 10) / 10;
}
