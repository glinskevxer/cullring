/**
 * A harvest record, which is what the tag on the bag is a summary of.
 *
 * Everything the program can say about a lot is worked out from this record
 * and the registers. The record itself asserts almost nothing: it holds what
 * somebody wrote down, checks that the pieces are the shape they claim to be,
 * and leaves every judgement to the rules.
 *
 * Two times are kept and they are not interchangeable. The harvest ran from
 * when the first bag came aboard to when the boat reached the dock, and the
 * rules read both: the classification question is asked about the start,
 * because that is when the shellfish were taken out of the water, and the
 * temperature question is asked about the end, because that is when the
 * cooling could first have begun.
 */

import { InputError } from '../core/errors.js';
import { requireNumber } from '../core/assert.js';
import { formatLotId, parseDealerId, parseHarvesterId, parseLotId } from '../core/identity.js';
import { requireGear } from '../licence/harvester.js';
import { civilDateAt, compareInstant, isInstant, secondsBetween } from '../time/instant.js';
import { formatCivilDate } from '../time/civil.js';
import { parseBedId } from './bed.js';

export const OYSTER = 'oyster';
export const HARD_CLAM = 'hard clam';
export const BAY_SCALLOP = 'bay scallop';

export const SPECIES = Object.freeze([OYSTER, HARD_CLAM, BAY_SCALLOP]);

export const SHELLSTOCK = 'shellstock';
export const SHUCKED = 'shucked';

export const FORMS = Object.freeze([SHELLSTOCK, SHUCKED]);

export function harvestRecord({
  lot = null,
  harvester,
  bed,
  gear,
  species = OYSTER,
  startedAt,
  landedAt,
  containers,
  dealer = null,
  form = SHELLSTOCK,
  iced = false,
  zone = 'eastern',
}) {
  const licence = parseHarvesterId(harvester, 'harvester');
  const ground = parseBedId(bed, 'bed');
  requireGear(gear, 'gear');
  if (!SPECIES.includes(species)) {
    throw new InputError('harvest.species', `${species} is not a species this program handles`, {
      species,
      known: SPECIES.slice(),
    });
  }
  if (!FORMS.includes(form)) {
    throw new InputError('harvest.form', `${form} is not a form product is landed in`, {
      form,
      known: FORMS.slice(),
    });
  }
  if (!isInstant(startedAt) || !isInstant(landedAt)) {
    throw new InputError(
      'harvest.time',
      'a harvest carries the moment it started and the moment it landed',
      {},
    );
  }
  if (compareInstant(landedAt, startedAt) < 0) {
    throw new InputError('harvest.time', 'a harvest cannot land before it started', {
      harvester: licence.id,
    });
  }
  requireNumber(containers, 'containers', { min: 1, integer: true });
  const landedOnDay = civilDateAt(zone, landedAt);
  const number =
    lot === null ? formatLotId(landedOnDay, ground.areaId, 1) : parseLotId(lot, 'lot').id;
  const parsedLot = parseLotId(number, 'lot');
  if (parsedLot.areaId !== ground.areaId) {
    throw new InputError('harvest.lotArea', `lot ${number} names an area the bed is not in`, {
      lot: number,
      lotArea: parsedLot.areaId,
      bedArea: ground.areaId,
    });
  }
  return Object.freeze({
    lot: number,
    harvester: licence.id,
    bed: ground.id,
    areaId: ground.areaId,
    gear,
    species,
    form,
    startedAt,
    landedAt,
    landedOn: landedOnDay,
    containers,
    dealer: dealer === null ? null : parseDealerId(dealer, 'dealer').id,
    iced,
    zone,
  });
}

export function harvestSeconds(record) {
  return secondsBetween(record.startedAt, record.landedAt);
}

export function describeHarvest(record) {
  return `${record.lot}: ${record.containers} of ${record.species} off ${record.bed} on ${formatCivilDate(record.landedOn)}`;
}

export function recordsForArea(records, areaId) {
  return records.filter((one) => one.areaId === areaId);
}

export function recordsForHarvester(records, harvesterId) {
  const wanted = parseHarvesterId(harvesterId, 'harvester').id;
  return records.filter((one) => one.harvester === wanted);
}

export function sortRecords(records) {
  return records.slice().sort((left, right) => compareInstant(left.landedAt, right.landedAt));
}
