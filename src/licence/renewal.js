/**
 * Renewing a harvester licence, and the two things that decide whether it can
 * be renewed at all.
 *
 * The licence year runs to a fixed date, and a licence not renewed by then
 * stops. What it does not do is disappear: there is a grace period during
 * which the same licence can be renewed and keeps its number, and after that
 * the grower has to apply as a new harvester. The difference matters to a
 * grower who has been fishing thirty years, and it is the sort of thing a
 * programme gets wrong by treating an expiry as a single date.
 *
 * The gate on renewal is the education certificate. A licence cannot be
 * renewed by somebody whose certificate has lapsed, which makes the two
 * registers depend on each other in a way neither of them can see alone: the
 * education register decides who may renew, and the licence register decides
 * who is required to hold a certificate at all. Asking either one on its own
 * gives an answer that looks complete and is not.
 *
 * A suspension is deliberately not a bar. A suspended licence can be renewed
 * and stays suspended, because the suspension has its own end date and letting
 * a renewal wipe it would turn a penalty into a paperwork exercise.
 */

import { findings } from '../core/finding.js';
import { CURRENT, DUE_SOON, standing as educationStanding } from './education.js';
import { isSuspended } from './harvester.js';
import { addDays, compareCivilDate, daysBetween, formatCivilDate } from '../time/civil.js';

/** How long after a licence lapses it can still be renewed as the same licence. */
export const GRACE_DAYS = 90;

/** How far ahead the office writes to a grower about renewal. */
export const NOTICE_DAYS = 45;

export const CURRENT_LICENCE = 'current';
export const IN_GRACE = 'lapsed but inside the grace period';
export const GONE = 'lapsed beyond the grace period';
export const NOT_YET_ISSUED = 'not yet issued';

/** Where a licence stands on a day, told in four states rather than two. */
export function licenceStanding(licence, on, { graceDays = GRACE_DAYS } = {}) {
  if (compareCivilDate(on, licence.issuedOn) < 0) {
    return Object.freeze({ state: NOT_YET_ISSUED, daysLeft: null, graceEndsOn: null });
  }
  if (compareCivilDate(on, licence.expiresOn) <= 0) {
    return Object.freeze({
      state: CURRENT_LICENCE,
      daysLeft: daysBetween(on, licence.expiresOn),
      graceEndsOn: addDays(licence.expiresOn, graceDays),
    });
  }
  const graceEndsOn = addDays(licence.expiresOn, graceDays);
  if (compareCivilDate(on, graceEndsOn) <= 0) {
    return Object.freeze({
      state: IN_GRACE,
      daysLeft: daysBetween(on, graceEndsOn),
      graceEndsOn,
    });
  }
  return Object.freeze({ state: GONE, daysLeft: 0, graceEndsOn });
}

/**
 * Whether a licence may be renewed on a day, and why not where it may not.
 * The reasons are a list rather than the first one found, because a grower
 * with a lapsed certificate and a licence out of grace has two things to do
 * and being told one at a time is how a season gets missed.
 */
export function mayRenew(licence, { certificates = [], on, graceDays = GRACE_DAYS }) {
  const where = licenceStanding(licence, on, { graceDays });
  const education = educationStanding(certificates, licence.id, on);
  const because = [];

  if (where.state === GONE) {
    because.push('the grace period has run out, so this is a new application');
  }
  if (where.state === NOT_YET_ISSUED) {
    because.push('the licence has not been issued yet');
  }
  if (education.state !== CURRENT && education.state !== DUE_SOON) {
    because.push(`the education certificate is ${education.state}`);
  }

  return Object.freeze({
    mayRenew: because.length === 0,
    standing: where,
    education,
    because: Object.freeze(because),
    suspended: isSuspended(licence, on),
  });
}

/**
 * The renewal round: who has to be written to, and what the letter has to say.
 *
 * A grower whose certificate lapses before their licence does gets one letter
 * about both, because two letters a month apart is how the certificate gets
 * left until the counter on the last day of the season.
 */
export function renewalRound(licences, { certificates = [], on, noticeDays = NOTICE_DAYS }) {
  const problems = findings();
  const rows = [];

  for (const licence of licences) {
    const answer = mayRenew(licence, { certificates, on });
    const where = answer.standing;
    if (where.state === NOT_YET_ISSUED) {
      continue;
    }
    const dueSoon = where.state === CURRENT_LICENCE && where.daysLeft <= noticeDays;
    if (!dueSoon && where.state === CURRENT_LICENCE) {
      continue;
    }

    rows.push(
      Object.freeze({
        harvester: licence.id,
        name: licence.name,
        state: where.state,
        expiresOn: formatCivilDate(licence.expiresOn),
        graceEndsOn: where.graceEndsOn === null ? null : formatCivilDate(where.graceEndsOn),
        education: answer.education.state,
        mayRenew: answer.mayRenew,
        because: answer.because,
      }),
    );

    if (where.state === IN_GRACE) {
      problems.warn(
        'renewal.inGrace',
        `${licence.id} lapsed on ${formatCivilDate(licence.expiresOn)} and has until ${formatCivilDate(where.graceEndsOn)}`,
        { harvester: licence.id, expiresOn: formatCivilDate(licence.expiresOn) },
      );
    }
    if (where.state === GONE) {
      problems.error(
        'renewal.lapsed',
        `${licence.id} is past the grace period and has to apply again`,
        { harvester: licence.id, expiresOn: formatCivilDate(licence.expiresOn) },
      );
    }
    if (!answer.mayRenew && where.state !== GONE) {
      problems.error(
        'renewal.blocked',
        `${licence.id} cannot renew: ${answer.because.join('; ')}`,
        { harvester: licence.id, because: answer.because.slice() },
      );
    }
    if (dueSoon && answer.mayRenew) {
      problems.note(
        'renewal.due',
        `${licence.id} renews by ${formatCivilDate(licence.expiresOn)}`,
        {
          harvester: licence.id,
          daysLeft: where.daysLeft,
        },
      );
    }
  }

  return Object.freeze({
    on,
    rows: Object.freeze(rows.sort((left, right) => (left.harvester < right.harvester ? -1 : 1))),
    problems,
  });
}

/**
 * Renew a licence, which is a new term on the same number.
 *
 * The new term runs from the end of the old one rather than from the day the
 * renewal is paid for. A grower who renews inside the grace period gets a
 * licence that covers the gap and nothing more, so being late costs the gap
 * and does not buy the weeks back at the far end.
 *
 * It is a pure function: the register is a file the office writes, and a
 * renewal that mutated a licence in place would be one nobody could show the
 * before of.
 */
export function renewed(licence, { on, years = 1, certificates = [] }) {
  const answer = mayRenew(licence, { certificates, on });
  if (!answer.mayRenew) {
    return Object.freeze({ licence: null, renewed: false, because: answer.because });
  }
  return Object.freeze({
    licence: Object.freeze({
      ...licence,
      expiresOn: addDays(licence.expiresOn, Math.round(years * 365)),
    }),
    renewed: true,
    because: Object.freeze([]),
  });
}

export function describeRenewal(row) {
  if (row.mayRenew) {
    return `${row.harvester} may renew, and the licence runs to ${row.expiresOn}`;
  }
  return `${row.harvester} may not renew: ${row.because.join('; ')}`;
}
