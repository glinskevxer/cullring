/**
 * Civil dates and civil times, with no dependency on the machine's clock or
 * its timezone.
 *
 * The rules in this domain are written in civil terms. A conditional plan
 * closes an area for seventy two hours, a survey is stale after three years,
 * and the Vibrio table is read by the month the harvest happened in. None of
 * that is a question about instants until a zone is supplied, and the zone is
 * a property of the area rather than of the process running the program. So
 * the civil layer is kept separate and knows nothing about offsets.
 *
 * Day numbering is the proleptic Gregorian calendar counted from 1970-01-01,
 * computed arithmetically rather than through the platform Date, because a
 * Date built from local parts on a machine set to Kathmandu is not the same
 * date it was built from.
 */

import { InputError } from '../core/errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return MONTH_LENGTHS[month - 1];
}

/**
 * Build a civil date, refusing anything the calendar does not hold. The 31st
 * of September is a typing mistake and the program says so rather than rolling
 * it forward into October, which is what a Date would do.
 */
export function civilDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new InputError('date.parts', 'a civil date is built from whole numbers', {
      year,
      month,
      day,
    });
  }
  if (month < 1 || month > 12) {
    throw new InputError('date.month', `month ${month} is not a month`, { month });
  }
  const limit = daysInMonth(year, month);
  if (day < 1 || day > limit) {
    throw new InputError('date.day', `${year}-${pad(month)} has no day ${day}`, {
      year,
      month,
      day,
      limit,
    });
  }
  return Object.freeze({ year, month, day });
}

export function parseCivilDate(text, field = 'date') {
  if (typeof text !== 'string') {
    throw new InputError('date.type', `${field} must be written as YYYY-MM-DD`, {
      field,
      saw: typeof text,
    });
  }
  const match = DATE_PATTERN.exec(text.trim());
  if (!match) {
    throw new InputError('date.format', `${field} must be written as YYYY-MM-DD, saw ${text}`, {
      field,
      value: text,
    });
  }
  return civilDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function formatCivilDate(date) {
  return `${String(date.year).padStart(4, '0')}-${pad(date.month)}-${pad(date.day)}`;
}

/**
 * Days since 1970-01-01, by the shift the calendar itself suggests: move the
 * start of the year to March so that the leap day lands at the end and the
 * month lengths fall into a repeating pattern.
 */
export function toEpochDay(date) {
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const mp = (date.month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + date.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(days) {
  if (!Number.isInteger(days)) {
    throw new InputError('date.parts', 'a day number is a whole number', { days });
  }
  const z = days + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return civilDate(month <= 2 ? y + 1 : y, month, day);
}

export function addDays(date, count) {
  if (!Number.isInteger(count)) {
    throw new InputError('date.parts', 'days added to a date are whole', { count });
  }
  return fromEpochDay(toEpochDay(date) + count);
}

export function daysBetween(from, to) {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareCivilDate(left, right) {
  const a = toEpochDay(left);
  const b = toEpochDay(right);
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function sameCivilDate(left, right) {
  return compareCivilDate(left, right) === 0;
}

export function dayOfWeek(date) {
  return (((toEpochDay(date) + 4) % 7) + 7) % 7;
}

export function weekdayName(date) {
  return WEEKDAY_NAMES[dayOfWeek(date)];
}

export function monthName(month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new InputError('date.month', `month ${month} is not a month`, { month });
  }
  return MONTH_NAMES[month - 1];
}

/** The 1-based day of the year, which the sampling program counts in. */
export function dayOfYear(date) {
  return daysBetween(civilDate(date.year, 1, 1), date) + 1;
}

/**
 * A civil time of day. Seconds are kept because a harvest is recorded to the
 * minute and a tide to the minute, but the temperature clock is read in whole
 * hours and rounding it early would lose the boundary case.
 */
export function civilTime(hour, minute, second = 0) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
    throw new InputError('time.parts', 'a civil time is built from whole numbers', {
      hour,
      minute,
      second,
    });
  }
  if (hour < 0 || hour > 23) {
    throw new InputError('time.hour', `hour ${hour} is not an hour of the day`, { hour });
  }
  if (minute < 0 || minute > 59) {
    throw new InputError('time.minute', `minute ${minute} is not a minute`, { minute });
  }
  if (second < 0 || second > 59) {
    throw new InputError('time.second', `second ${second} is not a second`, { second });
  }
  return Object.freeze({ hour, minute, second });
}

export function parseCivilTime(text, field = 'time') {
  if (typeof text !== 'string') {
    throw new InputError('time.type', `${field} must be written as HH:MM`, {
      field,
      saw: typeof text,
    });
  }
  const match = TIME_PATTERN.exec(text.trim());
  if (!match) {
    throw new InputError('time.format', `${field} must be written as HH:MM, saw ${text}`, {
      field,
      value: text,
    });
  }
  return civilTime(
    Number(match[1]),
    Number(match[2]),
    match[3] === undefined ? 0 : Number(match[3]),
  );
}

export function formatCivilTime(time, { seconds = false } = {}) {
  const base = `${pad(time.hour)}:${pad(time.minute)}`;
  return seconds ? `${base}:${pad(time.second)}` : base;
}

export function secondOfDay(time) {
  return time.hour * 3600 + time.minute * 60 + time.second;
}

export const MIDNIGHT = civilTime(0, 0, 0);

function pad(value) {
  return String(value).padStart(2, '0');
}
