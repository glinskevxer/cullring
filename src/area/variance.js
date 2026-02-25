/**
 * Variances, which are a rule saying a rule does not apply here.
 *
 * The commission grants an area a variance when the general rule produces a
 * silly answer on that ground: a bed that grows a stunted oyster gets a
 * smaller cull size, a bed nobody can reach in winter gets a longer sampling
 * interval. A variance is not an exemption. It replaces one number with
 * another, it is granted for a term, and it names the rule it replaces so that
 * nobody has to guess what it covers.
 *
 * The kinds are a closed list on purpose. A variance framework that could
 * replace any number would be a way of writing the rule book twice, and the
 * office would end up with an area whose classification was granted by
 * variance.
 */

import { InputError } from '../core/errors.js';
import { requireNumber, requireString } from '../core/assert.js';
import { parseAreaId } from '../core/identity.js';
import { compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';

export const CULL_SIZE = 'cull size';
export const SAMPLING_INTERVAL = 'sampling interval';
export const HOLDING_HOURS = 'holding hours';

export const VARIANCE_KINDS = Object.freeze([CULL_SIZE, SAMPLING_INTERVAL, HOLDING_HOURS]);

/** What each kind replaces, and the sane range for its replacement. */
const BOUNDS = new Map([
  [CULL_SIZE, { field: 'inches', min: 0.5, max: 6 }],
  [SAMPLING_INTERVAL, { field: 'days', min: 7, max: 365 }],
  [HOLDING_HOURS, { field: 'hours', min: 6, max: 48 }],
]);

export function boundsFor(kind) {
  const row = BOUNDS.get(kind);
  if (row === undefined) {
    throw new InputError('variance.kind', `${kind} is not a kind of variance`, {
      kind,
      known: VARIANCE_KINDS.slice(),
    });
  }
  return Object.freeze({ ...row });
}

export function variance({
  area,
  kind,
  value,
  species = null,
  grantedOn,
  expiresOn,
  reference = null,
}) {
  const areaId = parseAreaId(area, 'area').id;
  const bounds = boundsFor(kind);
  requireNumber(value, bounds.field, { min: bounds.min, max: bounds.max });
  const granted = asDate(grantedOn, 'grantedOn');
  const expires = asDate(expiresOn, 'expiresOn');
  if (compareCivilDate(expires, granted) < 0) {
    throw new InputError('variance.dates', 'a variance cannot expire before it is granted', {
      area: areaId,
      kind,
    });
  }
  if (reference !== null) {
    requireString(reference, 'reference');
  }
  return Object.freeze({
    area: areaId,
    kind,
    value,
    field: bounds.field,
    species,
    grantedOn: granted,
    expiresOn: expires,
    reference,
  });
}

export function inForce(one, on) {
  return compareCivilDate(on, one.grantedOn) >= 0 && compareCivilDate(on, one.expiresOn) <= 0;
}

/**
 * The variance in force for a kind on an area on a day, or nothing. A variance
 * naming a species beats one that does not, the same way an area limit beats a
 * general one, and two in force for the same kind and species is a defect in
 * the register rather than a choice.
 */
export function varianceFor(variances, { area, kind, species = null, on }) {
  const areaId = parseAreaId(area, 'area').id;
  const held = variances.filter(
    (one) => one.area === areaId && one.kind === kind && inForce(one, on),
  );
  const specific = held.filter((one) => one.species !== null && one.species === species);
  if (specific.length > 1) {
    throw new InputError('variance.overlap', `${areaId} holds two ${kind} variances at once`, {
      area: areaId,
      kind,
      species,
    });
  }
  if (specific.length === 1) {
    return specific[0];
  }
  const general = held.filter((one) => one.species === null);
  if (general.length > 1) {
    throw new InputError('variance.overlap', `${areaId} holds two ${kind} variances at once`, {
      area: areaId,
      kind,
    });
  }
  return general.length === 1 ? general[0] : null;
}

/** The number a rule should use: the variance where there is one, else the standard. */
export function valueOr(variances, { area, kind, species = null, on }, standard) {
  const found = varianceFor(variances, { area, kind, species, on });
  return found === null ? standard : found.value;
}

export function variancesFor(variances, area) {
  const areaId = parseAreaId(area, 'area').id;
  return variances
    .filter((one) => one.area === areaId)
    .sort((left, right) => compareCivilDate(left.grantedOn, right.grantedOn));
}

export function describeVariance(one) {
  const who = one.species === null ? '' : ` for ${one.species}`;
  return `${one.area}: ${one.kind}${who} of ${one.value} ${one.field}, to ${formatCivilDate(one.expiresOn)}`;
}

function asDate(value, field) {
  if (typeof value === 'string') {
    return parseCivilDate(value, field);
  }
  if (value === undefined || value === null || value.year === undefined) {
    throw new InputError('variance.dates', `${field} is required`, { field });
  }
  return value;
}
