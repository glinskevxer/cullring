/**
 * The export command, which writes a case back out.
 *
 * Two things ask for this. Somebody wants a copy of the register with one area
 * taken out of it, to send to a neighbouring state, and somebody wants the
 * landings for a month as a sheet they can open. Both are the same operation
 * with a filter on it, so it is one command with an area option rather than
 * two commands that would drift apart.
 *
 * It writes to standard output rather than to a file. A command that writes
 * files needs a policy about overwriting them, and the shell already has one.
 */

import { writeLandings, writeRegister } from '../../io/write.js';
import { findArea } from '../../area/growingArea.js';
import { sameCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { OK, REFUSED, asJson } from '../output.js';

export const REGISTER = 'register';
export const LANDINGS = 'landings';

export const SHAPES = Object.freeze([REGISTER, LANDINGS]);

export function exportCase(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const shape = options.shape ?? REGISTER;
  if (!SHAPES.includes(shape)) {
    io.warn(`refused: ${shape} is not a shape this command writes`);
    return REFUSED;
  }
  let held = loaded;
  if (options.area !== undefined && options.area !== null) {
    const area = findArea(loaded.areas, options.area);
    if (area === null) {
      io.warn(`refused: ${options.area} is not in the register`);
      return REFUSED;
    }
    held = narrowTo(loaded, area.id);
  }
  if (shape === LANDINGS) {
    const records =
      options.on === undefined || options.on === null
        ? held.records
        : held.records.filter((one) => sameCivilDate(one.landedOn, dayOf(options)));
    io.say(writeLandings(records, held.zone).trimEnd());
    return OK;
  }
  io.say(asJson(writeRegister(held)));
  return OK;
}

function dayOf(options) {
  const [year, month, day] = String(options.on).split('-').map(Number);
  return { year, month, day };
}

/**
 * A case with everything outside one area taken out of it. The licences and
 * the certifications stay: they are not attached to water, and a copy with the
 * dealers stripped out could not be checked against anything.
 */
export function narrowTo(loaded, areaId) {
  const beds = loaded.beds.filter((one) => one.areaId === areaId);
  const bedIds = new Set(beds.map((one) => one.id));
  return {
    ...loaded,
    areas: loaded.areas.filter((one) => one.id === areaId),
    plans: loaded.plans.filter((one) => one.area === areaId),
    stations: loaded.stations.filter((one) => one.areaId === areaId),
    beds,
    sources: loaded.sources.filter((one) => one.areaId === areaId),
    orders: loaded.orders.filter((one) => one.areas.includes(areaId)),
    records: loaded.records.filter((one) => bedIds.has(one.bed)),
    samples: loaded.samples.filter((one) => one.areaId === areaId),
  };
}
