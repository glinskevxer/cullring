/**
 * Instants, and the durations between them.
 *
 * An instant is a whole number of seconds since the epoch wrapped in a record,
 * not a bare number, because this domain has too many quantities that are also
 * numbers. A crate temperature, a rainfall total and a coliform count are all
 * numbers, and one of them being passed where an instant belongs should not
 * quietly work.
 */

import { InputError, RuleError } from '../core/errors.js';
import {
  civilDate,
  civilTime,
  formatCivilDate,
  formatCivilTime,
  fromEpochDay,
  toEpochDay,
} from './civil.js';
import {
  CIVIL_AMBIGUOUS,
  CIVIL_GAP,
  abbreviationAt,
  lookupZone,
  offsetAt,
  resolveCivil,
} from './zone.js';

const SECONDS_PER_DAY = 86400;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;
const STAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)\s*(Z|[+-]\d{2}:?\d{2})?$/;

export function instant(epochSecond) {
  if (!Number.isInteger(epochSecond)) {
    throw new InputError('instant.parts', 'an instant is a whole number of seconds', {
      epochSecond,
    });
  }
  return Object.freeze({ epochSecond });
}

export function isInstant(value) {
  return typeof value === 'object' && value !== null && Number.isInteger(value.epochSecond);
}

export function requireInstant(value, field) {
  if (!isInstant(value)) {
    throw new InputError('instant.type', `${field} must be an instant`, { field });
  }
  return value;
}

export function addSeconds(point, seconds) {
  if (!Number.isInteger(seconds)) {
    throw new InputError('instant.parts', 'seconds added to an instant are whole', { seconds });
  }
  return instant(point.epochSecond + seconds);
}

export function addHours(point, hours) {
  if (!Number.isFinite(hours)) {
    throw new InputError('instant.parts', 'hours added to an instant are finite', { hours });
  }
  return addSeconds(point, Math.round(hours * 3600));
}

export function secondsBetween(from, to) {
  return to.epochSecond - from.epochSecond;
}

export function hoursBetween(from, to) {
  return secondsBetween(from, to) / 3600;
}

export function compareInstant(left, right) {
  if (left.epochSecond === right.epochSecond) {
    return 0;
  }
  return left.epochSecond < right.epochSecond ? -1 : 1;
}

export function isBefore(left, right) {
  return left.epochSecond < right.epochSecond;
}

export function isAfter(left, right) {
  return left.epochSecond > right.epochSecond;
}

export function earliest(points) {
  return points.reduce((best, point) => (isBefore(point, best) ? point : best));
}

export function latest(points) {
  return points.reduce((best, point) => (isAfter(point, best) ? point : best));
}

/** The civil parts an instant reads as in a zone. */
export function civilPartsAt(zoneName, point) {
  const zone = lookupZone(zoneName);
  const offset = offsetAt(zone, point.epochSecond);
  const local = point.epochSecond + offset;
  const day = Math.floor(local / SECONDS_PER_DAY);
  const rest = local - day * SECONDS_PER_DAY;
  return {
    date: fromEpochDay(day),
    time: civilTime(Math.floor(rest / 3600), Math.floor((rest % 3600) / 60), rest % 60),
    offset,
    abbreviation: abbreviationAt(zone, point.epochSecond),
  };
}

export function civilDateAt(zoneName, point) {
  return civilPartsAt(zoneName, point).date;
}

/**
 * Build an instant from civil parts in a zone. The awkward mornings are
 * refused unless the caller names a reading, and the names are about the clock
 * rather than about daylight time: a harvester writing a tag does not know
 * which side of a transition they are on, but the crew leader knows whether
 * they were the first boat out that morning or the second.
 */
export function instantFromCivil(zoneName, date, time, { ambiguous = 'refuse' } = {}) {
  const zone = lookupZone(zoneName);
  const resolved = resolveCivil(zone, date, time);
  if (resolved.kind === CIVIL_GAP) {
    throw new RuleError(
      'instant.gap',
      `${formatCivilDate(date)} ${formatCivilTime(time)} did not happen in the ${zone.name} zone`,
      { zone: zone.name, date: formatCivilDate(date), time: formatCivilTime(time) },
    );
  }
  if (resolved.kind === CIVIL_AMBIGUOUS) {
    if (ambiguous === 'earlier') {
      return instant(resolved.instants[0]);
    }
    if (ambiguous === 'later') {
      return instant(resolved.instants[1]);
    }
    throw new RuleError(
      'instant.ambiguous',
      `${formatCivilDate(date)} ${formatCivilTime(time)} happened twice in the ${zone.name} zone`,
      { zone: zone.name, date: formatCivilDate(date), time: formatCivilTime(time) },
    );
  }
  return instant(resolved.instants[0]);
}

/**
 * Read a written stamp. An offset in the text wins, because a record that
 * carries its own offset is unambiguous and needs no zone at all. Without one
 * the zone is consulted and the awkward mornings apply.
 */
export function parseInstant(text, { zone = null, field = 'at', ambiguous = 'refuse' } = {}) {
  if (typeof text !== 'string') {
    throw new InputError('instant.type', `${field} must be a written timestamp`, {
      field,
      saw: typeof text,
    });
  }
  const match = STAMP_PATTERN.exec(text.trim());
  if (!match) {
    throw new InputError('instant.format', `${field} is not a timestamp this program reads`, {
      field,
      value: text,
    });
  }
  const [, datePart, timePart, offsetPart] = match;
  const date = parseDatePart(datePart, field);
  const time = parseTimePart(timePart, field);
  if (offsetPart === undefined) {
    if (zone === null) {
      throw new InputError('instant.zone', `${field} carries no offset and no zone was given`, {
        field,
        value: text,
      });
    }
    return instantFromCivil(zone, date, time, { ambiguous });
  }
  const offset = offsetPart === 'Z' ? 0 : parseOffset(offsetPart, field);
  const local =
    toEpochDay(date) * SECONDS_PER_DAY + time.hour * 3600 + time.minute * 60 + time.second;
  return instant(local - offset);
}

export function formatInstant(zoneName, point, { seconds = false, zoneLabel = true } = {}) {
  const parts = civilPartsAt(zoneName, point);
  const stamp = `${formatCivilDate(parts.date)} ${formatCivilTime(parts.time, { seconds })}`;
  return zoneLabel ? `${stamp} ${parts.abbreviation}` : stamp;
}

export function formatOffset(offsetSeconds) {
  const sign = offsetSeconds < 0 ? '-' : '+';
  const total = Math.abs(offsetSeconds);
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/** The written form the register keeps, which carries its own offset. */
export function toStoredForm(zoneName, point) {
  const parts = civilPartsAt(zoneName, point);
  const stamp = `${formatCivilDate(parts.date)}T${formatCivilTime(parts.time, { seconds: true })}`;
  return `${stamp}${formatOffset(parts.offset)}`;
}

function parseDatePart(text, field) {
  const [year, month, day] = text.split('-').map(Number);
  try {
    return civilDate(year, month, day);
  } catch (error) {
    throw new InputError('instant.format', `${field} carries a date that is not a date`, {
      field,
      value: text,
      cause: error.message,
    });
  }
}

function parseTimePart(text, field) {
  const [hour, minute, second = 0] = text.split(':').map(Number);
  try {
    return civilTime(hour, minute, second);
  } catch (error) {
    throw new InputError('instant.format', `${field} carries a time that is not a time`, {
      field,
      value: text,
      cause: error.message,
    });
  }
}

function parseOffset(text, field) {
  const match = OFFSET_PATTERN.exec(text);
  if (!match) {
    throw new InputError('instant.offset', `${field} carries an offset that is not an offset`, {
      field,
      value: text,
    });
  }
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59) {
    throw new InputError('instant.offset', `${field} carries an offset no zone on earth uses`, {
      field,
      value: text,
    });
  }
  return sign * (hours * 3600 + minutes * 60);
}
