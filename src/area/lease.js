/**
 * Shellfish leases, which are a register of their own and not a field on a bed.
 *
 * A bed carries a holder, which answers the question "who has this ground" and
 * cannot answer "who had it in August". Leases turn over. A harvest is judged
 * against the day it was made, and a bed record that only knows about today
 * will call last spring's lawful harvest a trespass the moment the ground
 * changes hands. So the holder is a fact with dates on it.
 *
 * The rule that makes this more than a date range is what happens when the
 * water under a lease is reclassified to prohibited. The lease is not
 * cancelled: the grower still holds the ground, the term still runs, and the
 * rent is still owed, because the state leased them bottom rather than a
 * guarantee about the water over it. What they may not do is harvest. So a
 * suspended lease is a third state, and the programme has to be able to say
 * it, because "not in force" would let the ground be leased to somebody else
 * and "in force" would let the grower work it.
 */

import { InputError } from '../core/errors.js';
import { findings } from '../core/finding.js';
import { requireNumber, requireString } from '../core/assert.js';
import { PROHIBITED } from './classification.js';
import { addDays, compareCivilDate, formatCivilDate, parseCivilDate } from '../time/civil.js';

export const IN_FORCE = 'in force';
export const SUSPENDED = 'suspended';
export const EXPIRED = 'expired';
export const NOT_YET = 'not yet begun';

export const STANDINGS = Object.freeze([IN_FORCE, SUSPENDED, EXPIRED, NOT_YET]);

/** How long before a term ends the office starts asking about renewal. */
export const RENEWAL_NOTICE_DAYS = 120;

export function lease({ id, bed, holder, from, to, acres = null, rentPaidThrough = null }) {
  requireString(id, 'id');
  requireString(bed, 'bed');
  requireString(holder, 'holder');
  const start = asDate(from, 'from');
  const end = asDate(to, 'to');
  if (compareCivilDate(end, start) < 0) {
    throw new InputError('lease.term', `${id} ends before it begins`, {
      lease: id,
      from: formatCivilDate(start),
      to: formatCivilDate(end),
    });
  }
  if (acres !== null) {
    requireNumber(acres, 'acres', { min: 0 });
  }
  const paid = rentPaidThrough === null ? null : asDate(rentPaidThrough, 'rentPaidThrough');
  return Object.freeze({
    id: id.trim().toUpperCase(),
    bed: bed.trim().toUpperCase(),
    holder: holder.trim().toUpperCase(),
    from: start,
    to: end,
    acres,
    rentPaidThrough: paid,
  });
}

function asDate(value, field) {
  return typeof value === 'string' ? parseCivilDate(value, field) : value;
}

/** Whether the term covers a day. The last day of the term is inside it. */
export function coversDay(one, date) {
  return compareCivilDate(date, one.from) >= 0 && compareCivilDate(date, one.to) <= 0;
}

/**
 * Where a lease stands on a day. The classification is optional: a caller who
 * does not supply one gets the term answer, and the result says the water was
 * never asked about, so nothing downstream reads a missing suspension as an
 * absent one.
 */
export function standingOf(one, { on, classification = null }) {
  if (compareCivilDate(on, one.from) < 0) {
    return Object.freeze({ standing: NOT_YET, waterAsked: classification !== null });
  }
  if (compareCivilDate(on, one.to) > 0) {
    return Object.freeze({ standing: EXPIRED, waterAsked: classification !== null });
  }
  if (classification === PROHIBITED) {
    return Object.freeze({ standing: SUSPENDED, waterAsked: true });
  }
  return Object.freeze({ standing: IN_FORCE, waterAsked: classification !== null });
}

/** Who held a bed on a day, or nothing where the register says nobody did. */
export function holderOn(leases, bedId, date) {
  const wanted = bedId.trim().toUpperCase();
  const held = leases.filter((one) => one.bed === wanted && coversDay(one, date));
  return held.length === 0 ? null : held[0].holder;
}

/** The leases one grower holds on a day, which is what a renewal letter needs. */
export function leasesFor(leases, holder, date) {
  const wanted = holder.trim().toUpperCase();
  return leases
    .filter((one) => one.holder === wanted && coversDay(one, date))
    .sort((left, right) => (left.id < right.id ? -1 : 1));
}

export function findLease(leases, id) {
  const wanted = String(id).trim().toUpperCase();
  return leases.find((one) => one.id === wanted) ?? null;
}

/**
 * Two leases over the same ground at the same time. That is a register error
 * rather than a dispute the programme can settle, so it is reported with both
 * numbers and nothing is chosen.
 */
export function overlapping(leases) {
  const clashes = [];
  const byBed = new Map();
  for (const one of leases) {
    const held = byBed.get(one.bed);
    if (held === undefined) {
      byBed.set(one.bed, [one]);
      continue;
    }
    held.push(one);
  }
  for (const [bed, held] of byBed) {
    const sorted = held.slice().sort((left, right) => compareCivilDate(left.from, right.from));
    for (let i = 1; i < sorted.length; i += 1) {
      if (compareCivilDate(sorted[i].from, sorted[i - 1].to) <= 0) {
        clashes.push(Object.freeze({ bed, first: sorted[i - 1].id, second: sorted[i].id }));
      }
    }
  }
  return clashes.sort((left, right) => (left.first < right.first ? -1 : 1));
}

/**
 * What the office has to act on. Rent is the one that is easy to get wrong: a
 * lease with no rent date recorded is not a lease in arrears, it is a lease
 * nobody has written the rent down for, and those go to different desks.
 */
export function leaseFindings(leases, { on, classificationOf = () => null }) {
  const problems = findings();

  for (const clash of overlapping(leases)) {
    problems.error(
      'lease.overlap',
      `${clash.first} and ${clash.second} are both over ${clash.bed} at the same time`,
      { bed: clash.bed, first: clash.first, second: clash.second },
    );
  }

  for (const one of leases) {
    const where = standingOf(one, { on, classification: classificationOf(one) });
    if (where.standing === EXPIRED || where.standing === NOT_YET) {
      continue;
    }
    if (where.standing === SUSPENDED) {
      problems.note(
        'lease.suspended',
        `${one.id} is over prohibited water, so the term runs and the ground may not be worked`,
        { lease: one.id, bed: one.bed, holder: one.holder },
      );
    }
    if (one.rentPaidThrough === null) {
      problems.warn('lease.rentUnrecorded', `${one.id} has no rent date written down at all`, {
        lease: one.id,
        holder: one.holder,
      });
    } else if (compareCivilDate(one.rentPaidThrough, on) < 0) {
      problems.error(
        'lease.rentOwed',
        `${one.id} is paid through ${formatCivilDate(one.rentPaidThrough)}`,
        { lease: one.id, holder: one.holder, paidThrough: formatCivilDate(one.rentPaidThrough) },
      );
    }
    if (compareCivilDate(one.to, addDays(on, RENEWAL_NOTICE_DAYS)) <= 0) {
      problems.note('lease.renewalDue', `${one.id} ends on ${formatCivilDate(one.to)}`, {
        lease: one.id,
        holder: one.holder,
        endsOn: formatCivilDate(one.to),
      });
    }
  }
  return problems;
}

export function describeLease(one, where) {
  const acres = one.acres === null ? 'unmeasured' : `${one.acres} acres`;
  return `${one.id}, ${acres} of ${one.bed} to ${one.holder}, ${where.standing} on the day asked about`;
}
