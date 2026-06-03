/**
 * The leases command: who holds what ground on a day, and what the office has
 * to chase.
 *
 * The day matters more here than anywhere else in the programme, because a
 * lease register read as at today will answer a question about last August
 * wrongly and confidently.
 */

import { RIGHT, column, definitionList, heading, renderTable } from '../../text/table.js';
import { IN_FORCE, SUSPENDED, leaseFindings, leasesFor, standingOf } from '../../area/lease.js';
import { classificationOn, findArea } from '../../area/growingArea.js';
import { formatCivilDate } from '../../time/civil.js';
import { parseBedId } from '../../harvest/bed.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

const LEASE_COLUMNS = [
  column('id', 'Lease', { width: 9 }),
  column('bed', 'Ground', { width: 9 }),
  column('holder', 'Held by', { width: 15 }),
  column('acres', 'Acres', { align: RIGHT, width: 6 }),
  column('term', 'Term', { width: 25 }),
  column('standing', 'On the day', { width: 14 }),
  column('rent', 'Rent paid to', { width: 13 }),
];

export function leases(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const classificationOf = (one) => waterUnder(loaded, one, on);

  let held = loaded.leases;
  if (options.holder !== undefined && options.holder !== null) {
    held = leasesFor(loaded.leases, options.holder, on);
    if (held.length === 0) {
      io.warn(`refused: ${options.holder} holds nothing on ${formatCivilDate(on)}`);
      return REFUSED;
    }
  }

  const rows = held.map((one) => {
    const where = standingOf(one, { on, classification: classificationOf(one) });
    return {
      id: one.id,
      bed: one.bed,
      holder: one.holder,
      acres: one.acres === null ? '-' : String(one.acres),
      term: `${formatCivilDate(one.from)} to ${formatCivilDate(one.to)}`,
      standing: where.standing,
      rent: one.rentPaidThrough === null ? 'unrecorded' : formatCivilDate(one.rentPaidThrough),
      where,
      lease: one,
    };
  });
  const problems = leaseFindings(held, { on, classificationOf });

  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(on),
        leases: rows.map((row) => ({
          id: row.id,
          bed: row.bed,
          holder: row.holder,
          acres: row.lease.acres,
          standing: row.standing,
          rentPaidThrough: row.rent,
        })),
        findings: problems.list(),
      }),
    );
    return problems.hasError() ? FOUND : OK;
  }

  io.say(heading(`Leases on ${formatCivilDate(on)}`));
  io.say('');
  io.say(
    definitionList([
      ['Leases on file', String(rows.length)],
      ['In force', String(rows.filter((row) => row.standing === IN_FORCE).length)],
      ['Suspended', String(rows.filter((row) => row.standing === SUSPENDED).length)],
      [
        'Acres under lease',
        String(
          rows
            .filter((row) => row.standing !== 'expired' && row.standing !== 'not yet begun')
            .reduce((sum, row) => sum + (row.lease.acres ?? 0), 0),
        ),
      ],
    ]),
  );
  io.say('');
  io.say(renderTable(LEASE_COLUMNS, rows));
  for (const problem of problems.list()) {
    io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
  }
  return problems.hasError() ? FOUND : OK;
}

/** The classification of the water over a lease, which is what suspends it. */
function waterUnder(loaded, one, on) {
  try {
    const area = findArea(loaded.areas, parseBedId(one.bed, 'bed').areaId);
    return area === null ? null : classificationOn(area, on);
  } catch {
    return null;
  }
}
