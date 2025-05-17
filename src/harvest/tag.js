/**
 * The tag, which is the only thing that survives to the trace.
 *
 * Everything else in this program is a record in an office. The tag is a piece
 * of plastic wired to a bag, and when a case is reported six weeks later it is
 * the tag, or a dealer's copy of one, that says which water the shellfish came
 * out of. What was never written on it is not recoverable, and the trace has
 * to be able to say that rather than guess.
 *
 * Which fields are required is decided by the form the product is in.
 * Shellstock carries the harvest side of the story: where it came from, when,
 * and who took it. A shucked container carries the packing side: who packed
 * it, how much is in it, and the date it must be sold by. They are different
 * documents that happen to be the same size, and a check that asked for the
 * union of both fields would fail every real tag in the state.
 *
 * A tag naming more than one lot is refused outright. Comingling is the thing
 * that makes a trace impossible, and the program will not record it in a shape
 * that suggests it is allowed.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { parseDealerId, parseLotId } from '../core/identity.js';
import { formatCivilDate, parseCivilDate } from '../time/civil.js';
import { SHELLSTOCK, SHUCKED } from './record.js';

export const SHELLSTOCK_FIELDS = Object.freeze([
  'dealer',
  'lot',
  'harvestedOn',
  'areaId',
  'species',
  'quantity',
]);

export const SHUCKED_FIELDS = Object.freeze([
  'dealer',
  'lot',
  'packedOn',
  'sellBy',
  'species',
  'containerSize',
]);

/** The wording the rule requires on every shellstock tag, and only those. */
export const RETENTION_STATEMENT =
  'This tag is required to be attached until the container is empty and thereafter kept for 90 days.';

export function requiredFields(form) {
  if (form === SHELLSTOCK) {
    return SHELLSTOCK_FIELDS.slice();
  }
  if (form === SHUCKED) {
    return SHUCKED_FIELDS.slice();
  }
  throw new InputError('tag.form', `${form} is not a form a tag is written for`, {
    form,
    known: [SHELLSTOCK, SHUCKED],
  });
}

/**
 * Build the tag a record implies. It is deliberately not the same as reading a
 * tag somebody wrote: this is what the tag should say, and the check compares
 * the two.
 */
export function tagFor(
  record,
  { dealer = null, packedOn = null, sellBy = null, containerSize = null } = {},
) {
  const fields = requiredFields(record.form);
  const written = {
    dealer: dealer ?? record.dealer,
    lot: record.lot,
    species: record.species,
  };
  if (record.form === SHELLSTOCK) {
    written.harvestedOn = formatCivilDate(record.landedOn);
    written.areaId = record.areaId;
    written.quantity = `${record.containers} containers`;
    written.statement = RETENTION_STATEMENT;
  } else {
    written.packedOn = packedOn === null ? null : asWritten(packedOn, 'packedOn');
    written.sellBy = sellBy === null ? null : asWritten(sellBy, 'sellBy');
    written.containerSize = containerSize;
  }
  return Object.freeze({ form: record.form, fields: Object.freeze(fields), ...written });
}

/**
 * Check a tag as written. Missing fields are reported one by one, because a
 * tag with three blanks on it is three findings and the printer has to fix all
 * three.
 */
export function checkTag(tag, { form = null } = {}) {
  const problems = findings();
  const kind = form ?? tag.form;
  let fields;
  try {
    fields = requiredFields(kind);
  } catch (error) {
    problems.error('tag.form', error.message, { form: kind });
    return Object.freeze({ form: kind, lawful: false, problems });
  }
  for (const field of fields) {
    const value = tag[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      problems.error('tag.missing', `the tag carries no ${field}`, { field, form: kind });
    }
  }
  if (kind === SHELLSTOCK && tag.statement !== RETENTION_STATEMENT) {
    problems.error('tag.statement', 'the tag does not carry the retention statement', {
      form: kind,
    });
  }
  if (tag.lot !== undefined && tag.lot !== null) {
    checkLot(tag.lot, problems);
  }
  if (tag.dealer !== undefined && tag.dealer !== null) {
    try {
      parseDealerId(tag.dealer, 'dealer');
    } catch (error) {
      problems.error('tag.dealer', error.message, { dealer: tag.dealer });
    }
  }
  return Object.freeze({ form: kind, lawful: problems.isLawful(), problems });
}

function checkLot(value, problems) {
  const written = String(value);
  if (written.includes(',') || written.includes('/')) {
    problems.error('tag.comingled', 'the tag names more than one lot', { lot: written });
    return;
  }
  try {
    parseLotId(written, 'lot');
  } catch (error) {
    problems.error('tag.lot', error.message, { lot: written });
  }
}

/** The lot a tag points at, or nothing where it cannot be read as one. */
export function lotOf(tag) {
  if (tag.lot === undefined || tag.lot === null) {
    return null;
  }
  try {
    return parseLotId(String(tag.lot), 'lot').id;
  } catch {
    return null;
  }
}

function asWritten(value, field) {
  if (typeof value === 'string') {
    return formatCivilDate(parseCivilDate(value, field));
  }
  return formatCivilDate(value);
}
