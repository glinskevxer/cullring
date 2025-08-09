/**
 * The register commands, which answer questions about people and ground
 * rather than about water.
 *
 * Each one prints what the register holds and then what the register implies,
 * because the implication is the part somebody rang up about. A dealer's row
 * is not interesting; what that dealer may lawfully do with a restricted lot
 * on a Tuesday is.
 */

import { bedsIn, findBed } from '../../harvest/bed.js';
import { recordsForHarvester } from '../../harvest/record.js';
import {
  OPERATIONS,
  describeDealer,
  findDealer,
  isCertified,
  mayPerform,
  permittedOperations,
} from '../../licence/dealer.js';
import {
  GEARS,
  findHarvester,
  isCurrent,
  isIntertidalGear,
  isSuspended,
  mayHarvestWith,
} from '../../licence/harvester.js';
import { findArea } from '../../area/growingArea.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { OK, REFUSED, asJson } from '../output.js';
import { decimal, joinWords, yesNo } from '../../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../../text/table.js';

export function dealerCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const found = findDealer(loaded.dealers, options.dealer);
  if (found === null) {
    io.warn(`refused: ${options.dealer} is not in the register`);
    return REFUSED;
  }
  const on = dayOf(options, loaded.zone);
  const permitted = permittedOperations(found);
  const allowed = OPERATIONS.filter((operation) => mayPerform(found, operation, on));
  if (options.json === true) {
    io.say(
      asJson({
        dealer: found.id,
        kind: found.kind,
        on: formatCivilDate(on),
        certified: isCertified(found, on),
        permitted,
        allowedToday: allowed,
      }),
    );
    return OK;
  }
  io.say(
    [
      heading(describeDealer(found)),
      '',
      definitionList([
        ['Certification', found.id],
        ['Kind', found.kind],
        ['Certified from', formatCivilDate(found.certifiedOn)],
        ['Expires', formatCivilDate(found.expiresOn)],
        ['Revoked', found.revokedOn === null ? '-' : formatCivilDate(found.revokedOn)],
        ['On', formatCivilDate(on)],
        ['Certified that day', yesNo(isCertified(found, on))],
        ['The kind permits', joinWords(permitted)],
        ['Allowed that day', allowed.length === 0 ? 'nothing' : joinWords(allowed)],
      ]),
    ].join('\n'),
  );
  return OK;
}

export function harvesterCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const found = findHarvester(loaded.harvesters, options.harvester);
  if (found === null) {
    io.warn(`refused: ${options.harvester} is not in the register`);
    return REFUSED;
  }
  const on = dayOf(options, loaded.zone);
  const landed = recordsForHarvester(loaded.records, found.id);
  // Sorted rather than left in table order, so the line reads the same as the
  // endorsement line above it and does not move if the gear table is reordered.
  const usable = GEARS.filter((gear) => mayHarvestWith(found, gear, on)).sort();
  if (options.json === true) {
    io.say(
      asJson({
        harvester: found.id,
        name: found.name,
        on: formatCivilDate(on),
        current: isCurrent(found, on),
        suspended: isSuspended(found, on),
        endorsed: found.gears,
        usableToday: usable,
        lots: landed.map((one) => one.lot),
      }),
    );
    return OK;
  }
  io.say(
    [
      heading(`${found.id} ${found.name}`),
      '',
      definitionList([
        ['Issued', formatCivilDate(found.issuedOn)],
        ['Expires', formatCivilDate(found.expiresOn)],
        ['On', formatCivilDate(on)],
        ['Current', yesNo(isCurrent(found, on))],
        ['Suspended', yesNo(isSuspended(found, on))],
        ['Endorsed for', joinWords(found.gears)],
        ['May use that day', usable.length === 0 ? 'nothing' : joinWords(usable)],
        ['Lots landed', landed.length === 0 ? '-' : joinWords(landed.map((one) => one.lot))],
      ]),
    ].join('\n'),
  );
  return OK;
}

const BED_COLUMNS = [
  column('id', 'Bed', { width: 8 }),
  column('name', 'Name', { cap: 24 }),
  column('station', 'Tide', { width: 5 }),
  column('elevation', 'Elev', { align: RIGHT, width: 6 }),
  column('tenure', 'Tenure', { width: 7 }),
  column('holder', 'Holder', { width: 14 }),
  column('dries', 'Dries', { width: 5 }),
];

export function bedsCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return REFUSED;
  }
  const rows = bedsIn(loaded.beds, area.id).map((one) => ({
    id: one.id,
    name: one.name,
    station: one.tideStation,
    elevation: decimal(one.elevation, 1),
    tenure: one.tenure,
    holder: one.holder ?? '-',
    dries: yesNo(one.elevation > 0),
  }));
  if (options.json === true) {
    io.say(asJson({ area: area.id, beds: rows }));
    return OK;
  }
  io.say(
    [heading(`Beds in ${area.id} ${area.name}`), '', renderTable(BED_COLUMNS, rows)].join('\n'),
  );
  return OK;
}

/** Which gears would run the clock from the tide on a given bed. */
export function tideClockGears(bed) {
  return GEARS.filter((gear) => isIntertidalGear(gear) && bed.elevation > 0);
}

export function findBedOrNull(loaded, id) {
  return findBed(loaded.beds, id);
}
