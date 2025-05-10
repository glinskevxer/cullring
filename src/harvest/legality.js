/**
 * Whether a harvest was lawful, which is the conjunction of everything.
 *
 * This is where the registers meet. The water has to have been open to that
 * kind of taking at the moment the harvest started; the licence has to have
 * been current, unsuspended and endorsed for the gear; the ground has to have
 * been ground that harvester could work; the product has to be going somewhere
 * that can lawfully hold it; and the lot has to have got cold in time.
 *
 * Nothing here stops at the first failure. A boat that went out on a suspended
 * licence to a closed area with the wrong gear broke three rules and is told
 * about three rules, because the alternative is three trips to the office.
 *
 * The order the checks run in is not the order they matter in. It is the order
 * that produces the most useful report: what the water was, then who was on
 * it, then what happened to the product.
 */

import { findings } from '../core/finding.js';
import { PROHIBITED, harvestAllowed, treatmentRequired } from '../area/classification.js';
import { effectiveClassification } from '../area/effective.js';
import { DEPURATE, RECEIVE, findDealer, mayPerform } from '../licence/dealer.js';
import { findHarvester, isCurrent, isSuspended, mayHarvestWith } from '../licence/harvester.js';
import { civilDateAt } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';
import { mayWork } from './bed.js';
import { vibrioCheck } from '../vibrio/compliance.js';

export function checkHarvest({
  record,
  bed,
  areas,
  plans = [],
  feed = {},
  harvesters = [],
  dealers = [],
  tides = [],
  underControlAt = null,
  from = null,
}) {
  const problems = findings();
  const day = civilDateAt(record.zone, record.startedAt);
  const area = areas.find((one) => one.id === record.areaId) ?? null;

  const water = checkWater({ record, area, plans, feed, from, problems });
  checkPeople({ record, bed, harvesters, day, problems });
  checkDestination({ record, dealers, water, day, problems });
  const temperature = vibrioCheck({ record, bed, tides, underControlAt });
  problems.absorb(temperature.problems);

  return Object.freeze({
    lot: record.lot,
    on: formatCivilDate(day),
    effective: water === null ? PROHIBITED : water.effective,
    closure: water === null ? null : water.closure,
    treatment: water === null ? null : treatmentRequired(water.effective),
    temperature,
    lawful: problems.isLawful(),
    problems,
  });
}

function checkWater({ record, area, plans, feed, from, problems }) {
  if (area === null) {
    problems.error('harvest.unknownArea', `${record.areaId} is not in the register`, {
      lot: record.lot,
      area: record.areaId,
    });
    return null;
  }
  const water = effectiveClassification({
    area,
    plans,
    feed,
    at: record.startedAt,
    from,
  });
  problems.absorb(water.problems.of('error'));
  problems.absorb(water.problems.of('warning'));
  if (!harvestAllowed(water.effective)) {
    problems.error(
      'harvest.closedWater',
      `${record.areaId} was ${water.effective} when the harvest started`,
      { lot: record.lot, area: record.areaId, classification: water.effective },
    );
  }
  return water;
}

function checkPeople({ record, bed, harvesters, day, problems }) {
  const licence = findHarvester(harvesters, record.harvester);
  if (licence === null) {
    problems.error('harvest.unknownHarvester', `${record.harvester} is not in the register`, {
      lot: record.lot,
      harvester: record.harvester,
    });
    return;
  }
  if (!isCurrent(licence, day)) {
    problems.error('harvest.licenceLapsed', `${record.harvester} was not current on that day`, {
      lot: record.lot,
      harvester: record.harvester,
    });
  } else if (isSuspended(licence, day)) {
    problems.error('harvest.licenceSuspended', `${record.harvester} was suspended on that day`, {
      lot: record.lot,
      harvester: record.harvester,
    });
  } else if (!mayHarvestWith(licence, record.gear, day)) {
    problems.error(
      'harvest.gearNotEndorsed',
      `${record.harvester} is not endorsed for ${record.gear}`,
      { lot: record.lot, harvester: record.harvester, gear: record.gear },
    );
  }
  if (!mayWork(bed, record.harvester)) {
    problems.error('harvest.leaseTrespass', `${bed.id} is leased to somebody else`, {
      lot: record.lot,
      bed: bed.id,
      holder: bed.holder,
    });
  }
}

function checkDestination({ record, dealers, water, day, problems }) {
  const needed = water === null ? null : treatmentRequired(water.effective);
  if (record.dealer === null) {
    if (needed !== null) {
      problems.error(
        'harvest.noTreatmentDealer',
        `${record.lot} needs ${needed} and names no dealer`,
        { lot: record.lot, treatment: needed },
      );
    }
    return;
  }
  const buyer = findDealer(dealers, record.dealer);
  if (buyer === null) {
    problems.error('harvest.unknownDealer', `${record.dealer} is not in the register`, {
      lot: record.lot,
      dealer: record.dealer,
    });
    return;
  }
  if (!mayPerform(buyer, RECEIVE, day)) {
    problems.error('harvest.dealerNotCertified', `${record.dealer} could not receive on that day`, {
      lot: record.lot,
      dealer: record.dealer,
    });
    return;
  }
  if (needed !== null && !mayPerform(buyer, DEPURATE, day)) {
    problems.error(
      'harvest.dealerCannotTreat',
      `${record.lot} needs ${needed} and ${record.dealer} cannot do it`,
      { lot: record.lot, dealer: record.dealer, treatment: needed, kind: buyer.kind },
    );
  }
}

/** Every record in a day's landings, checked, in lot order. */
export function checkLandings(records, context) {
  return records
    .map((record) =>
      checkHarvest({
        ...context,
        record,
        bed: context.beds.find((one) => one.id === record.bed) ?? null,
      }),
    )
    .sort((left, right) => (left.lot < right.lot ? -1 : 1));
}
