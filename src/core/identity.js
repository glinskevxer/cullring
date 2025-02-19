/**
 * The identifiers the program reads, and what each one already tells you.
 *
 * None of these are opaque keys. A dealer certification number begins with the
 * two letters of the certification type, so a number on a shipping document
 * says what that dealer is allowed to do before anything is looked up. A
 * station number carries the area it sits in. A lot number carries the date it
 * was landed. This is how the paper works and the program follows it, which
 * means an identifier is checked for shape as well as for existence.
 *
 * The one thing the program will not do is infer the thing from the shape.
 * A number that looks like a shucker packer number and is not in the register
 * is not a shucker packer, it is an unknown number, and the two findings read
 * differently.
 */

import { InputError } from './errors.js';

const AREA_PATTERN = /^([A-Z])-(\d{1,2})([A-Z]?)$/;
const STATION_PATTERN = /^([A-Z])(\d{1,2})-(\d{2})$/;
const HARVESTER_PATTERN = /^SH-(\d{4})-(\d{5})$/;
const DEALER_PATTERN = /^(SS|SP|RP|DP)-(\d{3})$/;
const LOT_PATTERN = /^(\d{4})(\d{2})(\d{2})-([A-Z])(\d{1,2})-(\d{3})$/;

export const DEALER_KINDS = Object.freeze({
  SS: 'shellstock shipper',
  SP: 'shucker packer',
  RP: 'repacker',
  DP: 'depuration processor',
});

export function parseAreaId(text, field = 'area') {
  const match = AREA_PATTERN.exec(clean(text, field, 'an area is written as B-12 or B-12A'));
  if (!match) {
    throw new InputError('id.area', `${field} ${text} is not an area number`, {
      field,
      value: text,
    });
  }
  const number = Number(match[2]);
  if (number < 1) {
    throw new InputError('id.area', `${field} ${text} has no area number in it`, { field });
  }
  return Object.freeze({
    id: match[3] === '' ? `${match[1]}-${number}` : `${match[1]}-${number}${match[3]}`,
    region: match[1],
    number,
    subarea: match[3] === '' ? null : match[3],
  });
}

export function parseStationId(text, field = 'station') {
  const match = STATION_PATTERN.exec(clean(text, field, 'a station is written as B12-03'));
  if (!match) {
    throw new InputError('id.station', `${field} ${text} is not a station number`, {
      field,
      value: text,
    });
  }
  return Object.freeze({
    id: `${match[1]}${Number(match[2])}-${match[3]}`,
    region: match[1],
    areaNumber: Number(match[2]),
    areaId: `${match[1]}-${Number(match[2])}`,
    ordinal: Number(match[3]),
  });
}

export function parseHarvesterId(text, field = 'harvester') {
  const match = HARVESTER_PATTERN.exec(clean(text, field, 'a licence is written as SH-2025-04412'));
  if (!match) {
    throw new InputError('id.harvester', `${field} ${text} is not a harvester licence number`, {
      field,
      value: text,
    });
  }
  return Object.freeze({ id: match[0], issuedYear: Number(match[1]), serial: Number(match[2]) });
}

/**
 * The certification number carries its own kind. The kind is what the rules
 * about permitted operations read, so it is returned as a word rather than as
 * the two letters, which nobody outside the office can keep straight.
 */
export function parseDealerId(text, field = 'dealer') {
  const match = DEALER_PATTERN.exec(clean(text, field, 'a certification is written as SP-118'));
  if (!match) {
    throw new InputError('id.dealer', `${field} ${text} is not a certification number`, {
      field,
      value: text,
      kinds: Object.keys(DEALER_KINDS),
    });
  }
  return Object.freeze({
    id: match[0],
    prefix: match[1],
    kind: DEALER_KINDS[match[1]],
    serial: Number(match[2]),
  });
}

/**
 * A lot number is the landing date, the area, and a serial within that day.
 * The date in it is not the authority for anything: the tag is. It is here so
 * that a lot number sorts into date order and so that a lot number naming an
 * area the harvest record does not name is caught as a contradiction.
 */
export function parseLotId(text, field = 'lot') {
  const match = LOT_PATTERN.exec(clean(text, field, 'a lot is written as 20250814-B12-004'));
  if (!match) {
    throw new InputError('id.lot', `${field} ${text} is not a lot number`, { field, value: text });
  }
  const [, year, month, day, region, areaNumber, serial] = match;
  return Object.freeze({
    id: match[0],
    landedOn: Object.freeze({ year: Number(year), month: Number(month), day: Number(day) }),
    areaId: `${region}-${Number(areaNumber)}`,
    serial: Number(serial),
  });
}

export function formatLotId(landedOn, areaId, serial) {
  const area = parseAreaId(areaId);
  const stamp = `${landedOn.year}${pad(landedOn.month)}${pad(landedOn.day)}`;
  return `${stamp}-${area.region}${area.number}-${String(serial).padStart(3, '0')}`;
}

/** True when a station sits in the area, which the sampling program leans on. */
export function stationBelongsTo(stationId, areaId) {
  const station = parseStationId(stationId);
  const area = parseAreaId(areaId);
  return station.region === area.region && station.areaNumber === area.number;
}

function clean(text, field, hint) {
  if (typeof text !== 'string') {
    throw new InputError('id.type', `${field} must be written text, ${hint}`, {
      field,
      saw: typeof text,
    });
  }
  return text.trim().toUpperCase();
}

function pad(value) {
  return String(value).padStart(2, '0');
}
