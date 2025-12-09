/**
 * Writing the registers back out.
 *
 * The office edits the register by hand, so this is not a serialisation layer:
 * it is a way of getting a register out of the programme in the same shape it
 * went in, so that a case can be copied, trimmed for a report, or handed to
 * somebody else without them needing this programme to read it.
 *
 * The test that matters is the round trip. Everything written here is read
 * back by the loader and compared, which is the only claim worth making about
 * a writer: not that it produces valid JSON, but that it produces the same
 * register.
 */

import { formatCivilDate } from '../time/civil.js';
import { toStoredForm } from '../time/instant.js';
import { writeCsv } from './csv.js';

export function writeAreas(areas) {
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    ...(area.acres === null ? {} : { acres: area.acres }),
    history: area.history.map((period) => ({
      classification: period.classification,
      from: formatCivilDate(period.from),
      ...(period.to === null ? {} : { to: formatCivilDate(period.to) }),
      basis: period.basis,
      ...(period.note === null ? {} : { note: period.note }),
    })),
  }));
}

export function writeStations(stations) {
  return stations.map((one) => ({
    id: one.id,
    latitude: one.latitude,
    longitude: one.longitude,
    depth: one.depth,
    ...(one.description === null ? {} : { description: one.description }),
    openedOn: formatCivilDate(one.openedOn),
    ...(one.retiredOn === null ? {} : { retiredOn: formatCivilDate(one.retiredOn) }),
  }));
}

export function writeBeds(beds) {
  return beds.map((one) => ({
    id: one.id,
    name: one.name,
    tideStation: one.tideStation,
    elevation: one.elevation,
    tenure: one.tenure,
    ...(one.holder === null ? {} : { holder: one.holder }),
    ...(one.acres === null ? {} : { acres: one.acres }),
  }));
}

export function writeHarvesters(harvesters) {
  return harvesters.map((one) => ({
    id: one.id,
    name: one.name,
    gears: one.gears.slice(),
    issuedOn: formatCivilDate(one.issuedOn),
    expiresOn: formatCivilDate(one.expiresOn),
    ...(one.suspensions.length === 0
      ? {}
      : {
          suspensions: one.suspensions.map((held) => ({
            from: formatCivilDate(held.from),
            ...(held.to === null ? {} : { to: formatCivilDate(held.to) }),
            ...(held.reason === null ? {} : { reason: held.reason }),
          })),
        }),
  }));
}

export function writeDealers(dealers) {
  return dealers.map((one) => ({
    id: one.id,
    name: one.name,
    ...(one.address === null ? {} : { address: one.address }),
    certifiedOn: formatCivilDate(one.certifiedOn),
    expiresOn: formatCivilDate(one.expiresOn),
    ...(one.revokedOn === null ? {} : { revokedOn: formatCivilDate(one.revokedOn) }),
  }));
}

export function writePlans(plans) {
  return plans.map((one) => ({
    area: one.area,
    trigger: writeTrigger(one.trigger),
    reopening: writeReopening(one.reopening),
    effectiveFrom: formatCivilDate(one.effectiveFrom),
    ...(one.effectiveTo === null ? {} : { effectiveTo: formatCivilDate(one.effectiveTo) }),
    zone: one.zone,
    ...(one.reference === null ? {} : { reference: one.reference }),
  }));
}

export function writeTrigger(trigger) {
  switch (trigger.kind) {
    case 'rainfall':
      return {
        kind: trigger.kind,
        gauge: trigger.gauge,
        inches: trigger.inches,
        overHours: trigger.overHours,
      };
    case 'stage crossing':
      return {
        kind: trigger.kind,
        gauge: trigger.gauge,
        feet: trigger.feet,
        overHours: trigger.overHours,
      };
    case 'bypass':
      return { kind: trigger.kind, facility: trigger.facility, withinHours: trigger.withinHours };
    default:
      return {
        kind: trigger.kind,
        from: formatCivilDate(trigger.from),
        to: formatCivilDate(trigger.to),
      };
  }
}

export function writeReopening(reopening) {
  switch (reopening.kind) {
    case 'after hours':
      return { kind: reopening.kind, hours: reopening.target.quantity };
    case 'after samples':
      return { kind: reopening.kind, count: reopening.target.quantity };
    case 'after tides':
      return { kind: reopening.kind, cycles: reopening.target.quantity };
    default:
      return { kind: reopening.kind, on: formatCivilDate(reopening.target.on) };
  }
}

export function writeSources(sources) {
  return sources.map((one) => ({
    id: one.id,
    kind: one.kind,
    areaId: one.areaId,
    latitude: one.latitude,
    longitude: one.longitude,
    size: one.size,
    surveyedOn: formatCivilDate(one.surveyedOn),
    ...(one.note === null ? {} : { note: one.note }),
  }));
}

export function writeOrders(orders, zone = 'eastern') {
  return orders.map((one) => ({
    number: one.number,
    kind: one.kind,
    areas: one.areas.slice(),
    issuedAt: toStoredForm(zone, one.issuedAt),
    ...(one.liftedAt === null ? {} : { liftedAt: toStoredForm(zone, one.liftedAt) }),
    ...(one.reason === null ? {} : { reason: one.reason }),
  }));
}

export function writeCertificates(certificates) {
  return certificates.map((one) => ({
    harvester: one.harvester,
    course: one.course,
    sat: formatCivilDate(one.sat),
    ...(one.provider === null ? {} : { provider: one.provider }),
  }));
}

export function writeInspections(inspections) {
  return inspections.map((one) => ({
    dealer: one.dealer,
    on: formatCivilDate(one.on),
    failed: one.failed.map((item) => item.id),
    ...(one.inspector === null ? {} : { inspector: one.inspector }),
    ...(one.note === null ? {} : { note: one.note }),
  }));
}

/** The whole register, in the order the file keeps it. */
export function writeRegister(loaded) {
  return {
    zone: loaded.zone,
    areas: writeAreas(loaded.areas),
    plans: writePlans(loaded.plans),
    stations: writeStations(loaded.stations),
    beds: writeBeds(loaded.beds),
    harvesters: writeHarvesters(loaded.harvesters),
    dealers: writeDealers(loaded.dealers),
    sources: writeSources(loaded.sources),
    orders: writeOrders(loaded.orders, loaded.zone),
    certificates: writeCertificates(loaded.certificates),
    inspections: writeInspections(loaded.inspections),
  };
}

/** The landings sheet, written the way the loader reads it. */
export function writeLandings(records, zone = 'eastern') {
  const headers = [
    'lot',
    'harvester',
    'bed',
    'gear',
    'species',
    'form',
    'startedAt',
    'landedAt',
    'containers',
    'dealer',
    'iced',
  ];
  return writeCsv(
    headers,
    records.map((one) => ({
      lot: one.lot,
      harvester: one.harvester,
      bed: one.bed,
      gear: one.gear,
      species: one.species,
      form: one.form,
      startedAt: toStoredForm(zone, one.startedAt),
      landedAt: toStoredForm(zone, one.landedAt),
      containers: String(one.containers),
      dealer: one.dealer ?? '',
      iced: one.iced ? 'yes' : '',
    })),
  );
}
