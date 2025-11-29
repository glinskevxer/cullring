/**
 * The education requirement, which is a clock on a person rather than on water.
 *
 * A harvester has to sit the shellfish sanitation course once and refresh it
 * every three years. It is the only requirement in the programme attached to
 * somebody rather than to a place or a lot, and it is checked at the same
 * moment as the licence because that is the only moment anybody looks.
 *
 * The wrinkle is what a lapsed certificate does. It does not void the licence:
 * the licence is a fee somebody paid and it runs to its own date. It stops the
 * harvester working until they sit the course again, which is a different
 * thing and reads differently on the notice.
 */

import { InputError } from '../core/errors.js';
import { requireString } from '../core/assert.js';
import { parseHarvesterId } from '../core/identity.js';
import {
  addDays,
  compareCivilDate,
  daysBetween,
  formatCivilDate,
  parseCivilDate,
} from '../time/civil.js';

/** How long a certificate stands before it has to be refreshed. */
export const CERTIFICATE_YEARS = 3;

/** How long before it lapses the office starts reminding people. */
export const REMINDER_DAYS = 60;

export function certificate({ harvester, course, sat, provider = null }) {
  const licence = parseHarvesterId(harvester, 'harvester');
  requireString(course, 'course');
  const on = typeof sat === 'string' ? parseCivilDate(sat, 'sat') : sat;
  if (on === undefined || on === null || on.year === undefined) {
    throw new InputError('education.sat', 'a certificate carries the day it was sat', {
      harvester: licence.id,
    });
  }
  return Object.freeze({
    harvester: licence.id,
    course: course.trim(),
    sat: on,
    expires: addDays(on, Math.round(CERTIFICATE_YEARS * 365.25)),
    provider,
  });
}

/** The most recent certificate for a harvester, or nothing. */
export function latestFor(certificates, harvesterId) {
  const wanted = parseHarvesterId(harvesterId, 'harvester').id;
  const held = certificates
    .filter((one) => one.harvester === wanted)
    .sort((left, right) => compareCivilDate(left.sat, right.sat));
  return held.length === 0 ? null : held[held.length - 1];
}

export const NEVER_SAT = 'never sat';
export const CURRENT = 'current';
export const DUE_SOON = 'due soon';
export const LAPSED = 'lapsed';

export const STATES = Object.freeze([NEVER_SAT, CURRENT, DUE_SOON, LAPSED]);

/**
 * Where a harvester stands on the day. Never having sat the course and having
 * let it lapse are told apart, because the first is somebody who should not
 * have been licensed and the second is somebody who forgot.
 */
export function standing(certificates, harvesterId, on) {
  const latest = latestFor(certificates, harvesterId);
  if (latest === null) {
    return Object.freeze({ state: NEVER_SAT, certificate: null, daysLeft: null });
  }
  const left = daysBetween(on, latest.expires);
  if (left < 0) {
    return Object.freeze({ state: LAPSED, certificate: latest, daysLeft: left });
  }
  return Object.freeze({
    state: left <= REMINDER_DAYS ? DUE_SOON : CURRENT,
    certificate: latest,
    daysLeft: left,
  });
}

/** Whether the education requirement lets this harvester work that day. */
export function mayWork(certificates, harvesterId, on) {
  const state = standing(certificates, harvesterId, on).state;
  return state === CURRENT || state === DUE_SOON;
}

export function describeStanding(harvesterId, answer) {
  switch (answer.state) {
    case NEVER_SAT:
      return `${harvesterId} has never sat the course`;
    case LAPSED:
      return `${harvesterId} let the certificate lapse on ${formatCivilDate(answer.certificate.expires)}`;
    case DUE_SOON:
      return `${harvesterId} has ${answer.daysLeft} days left on the certificate`;
    default:
      return `${harvesterId} is current until ${formatCivilDate(answer.certificate.expires)}`;
  }
}

/** Everybody who cannot work on the day, which is the list the office chases. */
export function chaseList(certificates, harvesters, on) {
  return harvesters
    .filter((one) => !mayWork(certificates, one.id, on))
    .map((one) =>
      Object.freeze({ harvester: one.id, name: one.name, ...standing(certificates, one.id, on) }),
    )
    .sort((left, right) => (left.harvester < right.harvester ? -1 : 1));
}
