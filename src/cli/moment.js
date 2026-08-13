/**
 * Reading the moment options every command takes.
 *
 * Three of them recur and they are not the same thing. `--at` is the instant
 * the question is asked about. `--on` is the civil day, which some questions
 * are asked in and which is derived from `--at` when it is not given. `--from`
 * is where a walk over the feed starts, and it matters more than it looks:
 * a closure walk that starts on the day being asked about cannot see a closure
 * that began a week earlier and is still in force.
 */

import { InputError } from '../core/errors.js';
import { MIDNIGHT, parseCivilDate } from '../time/civil.js';
import { civilDateAt, instant, instantFromCivil, parseInstant } from '../time/instant.js';

export function momentOf(options, zone) {
  if (options.at === undefined || options.at === null) {
    throw new InputError('cli.at', 'this command needs a moment, given as --at', {});
  }
  return parseInstant(options.at, { zone, field: 'at' });
}

export function dayOf(options, zone) {
  if (options.on !== undefined && options.on !== null) {
    return parseCivilDate(options.on, 'on');
  }
  return civilDateAt(zone, momentOf(options, zone));
}

/**
 * Where a walk over the feed starts. Defaulting this to the moment itself
 * would be the quiet wrong answer, so it defaults to thirty days back, which
 * covers every reopening rule the programme writes.
 */
export function walkStart(options, zone, at) {
  if (options.from !== undefined && options.from !== null) {
    return instantFromCivil(zone, parseCivilDate(options.from, 'from'), MIDNIGHT);
  }
  return instant(at.epochSecond - 30 * 86400);
}

export function spanOf(options, zone) {
  const at = momentOf(options, zone);
  return { at, from: walkStart(options, zone, at) };
}
