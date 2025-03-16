import { parseMpn } from '../../src/survey/result.js';

/** Read a written column off a laboratory sheet the way the office keeps it. */
export const read = (list) => list.map((text) => parseMpn(text));

/** Repeat one written value, for a set whose spread is deliberately nil. */
export const flat = (text, count) => read(new Array(count).fill(text));

/** Thirty routine results from water that comfortably meets the approved standard. */
export const CLEAN_THIRTY = read([
  '<1.8',
  '<1.8',
  '4.5',
  '2',
  '7.8',
  '<1.8',
  '13',
  '2',
  '4.5',
  '<1.8',
  '7.8',
  '2',
  '4.5',
  '<1.8',
  '9.2',
  '2',
  '<1.8',
  '4.5',
  '7.8',
  '2',
  '13',
  '<1.8',
  '4.5',
  '2',
  '7.8',
  '<1.8',
  '9.2',
  '4.5',
  '2',
  '<1.8',
]);

/** Thirty results that clear the restricted standard and nothing tighter. */
export const MIDDLING_THIRTY = read([
  '49',
  '79',
  '23',
  '110',
  '49',
  '33',
  '79',
  '170',
  '49',
  '23',
  '110',
  '79',
  '49',
  '33',
  '23',
  '79',
  '49',
  '170',
  '110',
  '33',
  '49',
  '79',
  '23',
  '110',
  '49',
  '33',
  '79',
  '49',
  '23',
  '79',
]);

/** Thirty results no standard in the book will take. */
export const FOUL_THIRTY = read([
  '1600',
  '900',
  '1600',
  '540',
  '1600',
  '900',
  '1600',
  '350',
  '900',
  '1600',
  '540',
  '1600',
  '900',
  '1600',
  '350',
  '900',
  '1600',
  '540',
  '1600',
  '900',
  '1600',
  '350',
  '900',
  '1600',
  '540',
  '1600',
  '900',
  '1600',
  '350',
  '900',
]);

/** Six per station across five stations, which clears both per station floors. */
export const EVEN_STATIONS = {
  'B12-01': 6,
  'B12-02': 6,
  'B12-03': 6,
  'B12-04': 6,
  'B12-05': 6,
};
