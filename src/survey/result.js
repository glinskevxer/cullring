/**
 * A bacteriological result, and the fact that most of them are not numbers.
 *
 * The most probable number method does not return a count. It returns the
 * count that best explains how many tubes went positive, and at both ends of
 * the dilution series it returns a bound instead: fewer than 1.8, or more than
 * 1600. Roughly a third of the results in a clean area are the lower bound,
 * so a program that treats them as ordinary numbers is wrong about a third of
 * its own data.
 *
 * A result therefore carries its own kind. What a censored result counts as in
 * an average is not decided here, because the answer depends on which standard
 * is being applied, and that is the survey's business rather than the result's.
 */

import { InputError } from '../core/errors.js';
import { parseCivilDate } from '../time/civil.js';
import { parseStationId } from '../core/identity.js';

export const EXACT = 'exact';
export const BELOW = 'below';
export const ABOVE = 'above';

const VALUE_PATTERN = /^([<>]?)\s*(\d+(?:\.\d+)?)$/;

/** The series this program's laboratory runs, which fixes both bounds. */
export const LOWER_LIMIT = 1.8;
export const UPPER_LIMIT = 1600;

export function mpn(value, kind = EXACT) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InputError('result.value', 'a most probable number is a positive number', { value });
  }
  if (![EXACT, BELOW, ABOVE].includes(kind)) {
    throw new InputError('result.kind', `${kind} is not a kind of result`, { kind });
  }
  return Object.freeze({ value, kind, censored: kind !== EXACT });
}

/**
 * Read the written form. The laboratory sheet writes the bounds with the sign
 * attached, so the sign is what tells the program the result is censored.
 */
export function parseMpn(text, field = 'result') {
  if (typeof text === 'number') {
    return mpn(text, EXACT);
  }
  if (typeof text !== 'string') {
    throw new InputError('result.type', `${field} must be a result such as 23 or <1.8`, {
      field,
      saw: typeof text,
    });
  }
  const match = VALUE_PATTERN.exec(text.trim());
  if (!match) {
    throw new InputError('result.format', `${field} ${text} is not a result this program reads`, {
      field,
      value: text,
    });
  }
  const value = Number(match[2]);
  if (match[1] === '<') {
    return mpn(value, BELOW);
  }
  if (match[1] === '>') {
    return mpn(value, ABOVE);
  }
  return mpn(value, EXACT);
}

export function formatMpn(result) {
  const sign = result.kind === BELOW ? '<' : result.kind === ABOVE ? '>' : '';
  return `${sign}${trim(result.value)}`;
}

/**
 * A result is only usable if it came from a station in the area, on a day, by
 * a method. The sample record binds those together so that nothing downstream
 * has to carry four parallel arrays.
 */
export function sample({ station, collectedOn, result, kind = 'fecal coliform', note = null }) {
  const stationId = parseStationId(station, 'station');
  const date =
    typeof collectedOn === 'string' ? parseCivilDate(collectedOn, 'collectedOn') : collectedOn;
  if (date === undefined || date === null || date.year === undefined) {
    throw new InputError('sample.date', 'a sample carries the day it was collected', {});
  }
  const reading =
    typeof result === 'object' && result !== null && result.kind !== undefined
      ? result
      : parseMpn(result, 'result');
  return Object.freeze({
    station: stationId.id,
    areaId: stationId.areaId,
    collectedOn: date,
    result: reading,
    kind,
    note,
  });
}

export function isCensored(result) {
  return result.censored;
}

export function atLowerLimit(result) {
  return result.kind === BELOW;
}

export function atUpperLimit(result) {
  return result.kind === ABOVE;
}

function trim(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
