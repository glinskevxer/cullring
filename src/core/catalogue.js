/**
 * Every finding code the programme can raise, with a line about each.
 *
 * The codes are what a caller matches on and what a report groups by, so they
 * are an interface and they are written down here as one. A check compares
 * this list against what the source actually raises, which catches the two
 * ways a code goes wrong: one raised and never described, and one described
 * long after the rule that raised it was deleted.
 */

import { InputError } from './errors.js';
import { ERROR, NOTE, WARNING } from './finding.js';

const CATALOGUE = new Map(
  Object.entries({
    'advisory.nowhereToSend': [
      WARNING,
      'an advisory names lots the book never shows shipped anywhere',
    ],
    'advisory.stale': [NOTE, 'every lot named is past the shelf life'],
    'area.planClosed': [NOTE, 'the area is shut under its own management plan'],
    'area.planMissing': [ERROR, 'a conditional area has no plan in force'],
    'area.planWithoutCondition': [WARNING, 'a plan is attached to an unconditional area'],
    'area.unclassified': [ERROR, 'the register does not reach the day being asked about'],
    'area.underOrder': [NOTE, 'the area is shut under an emergency order'],
    'audit.holding': [NOTE, 'a dealer is still holding lots the book has not seen leave'],
    'audit.overShipped': [ERROR, 'more containers left a dealer than ever arrived'],
    'audit.receivedUnlanded': [ERROR, 'a lot was received and the ledger holds no landing for it'],
    'audit.shippedUnreceived': [ERROR, 'a lot left a dealer who never received it'],
    'book.operationNotPermitted': [
      ERROR,
      'a dealer recorded a movement their certification does not permit',
    ],
    'book.unknownDealer': [ERROR, 'the dealer is not in the register'],
    'case.badRegister': [ERROR, 'the register file will not parse'],
    'case.unreadable': [ERROR, 'a file is too big or too deep for the programme to read'],
    'case.control': [ERROR, 'a row of the temperature control sheet cannot be read'],
    'case.noFeed': [NOTE, 'a feed is not in the case directory'],
    'case.noRegister': [ERROR, 'the case directory holds no register'],
    'conditions.noPlan': [
      ERROR,
      'an area surveyed as adverse carries no plan saying what adverse means',
    ],
    'conditions.noneQualified': [
      ERROR,
      'not one sample in an adverse survey was taken under the condition',
    ],
    'conditions.notChecked': [
      NOTE,
      'an adverse survey was read without anything to check the condition against',
    ],
    'conditions.quietDay': [
      WARNING,
      'adverse samples were collected on days the trigger was not firing',
    ],
    'conditions.unmeasured': [NOTE, 'adverse samples fall on days the instrument reported nothing'],
    'coverage.blocked': [ERROR, 'a report cannot run at all over this case'],
    'coverage.narrowed': [
      WARNING,
      'a report is narrower than it looks because a register is absent',
    ],
    'csv.empty': [WARNING, 'the sheet holds nothing'],
    'csv.row': [ERROR, 'a row could not be built into a record'],
    'csv.width': [ERROR, 'a row has the wrong number of fields'],
    'cull.overTolerance': [ERROR, 'a sample held more undersize than the tolerance allows'],
    'cull.smallSample': [NOTE, 'fewer than a hundred were measured'],
    'depuration.empty': [ERROR, 'a batch holds no lots'],
    'depuration.mixedAreas': [ERROR, 'a batch holds lots from more than one area'],
    'depuration.noRelease': [ERROR, 'a batch carries no release sample'],
    'depuration.notCertified': [ERROR, 'the processor may not depurate on that day'],
    'depuration.order': [ERROR, 'a cycle ended before it started'],
    'depuration.releaseOverLimit': [ERROR, 'the release sample is over the approved limit'],
    'depuration.short': [ERROR, 'the longest unbroken run is under the cycle'],
    'depuration.time': [ERROR, 'a cycle needs two instants'],
    'depuration.unknownProcessor': [ERROR, 'the processor is not in the register'],
    'duplicate.outOfControl': [ERROR, 'a split sample disagreed by more than the run allows'],
    'duplicate.thin': [WARNING, 'a run holds too few pairs to set a control limit'],
    'embargo.moved': [ERROR, 'product moved while an embargo stood over it'],
    'embargo.stale': [WARNING, 'an embargo has stood a long time with nobody releasing it'],
    'harvest.closedWater': [ERROR, 'the water was shut when the harvest started'],
    'harvest.dealerCannotTreat': [ERROR, 'the dealer cannot perform the treatment the lot needs'],
    'harvest.dealerNotCertified': [ERROR, 'the dealer could not receive on that day'],
    'harvest.educationLapsed': [ERROR, 'the harvester certificate has lapsed or was never sat'],
    'harvest.gearNotEndorsed': [ERROR, 'the licence is not endorsed for the gear used'],
    'harvest.groundUnleased': [WARNING, 'leased ground the register gives no holder for'],
    'harvest.leaseTrespass': [ERROR, 'the ground is leased to somebody else'],
    'harvest.licenceLapsed': [ERROR, 'the licence was not current on that day'],
    'harvest.licenceSuspended': [ERROR, 'the licence was suspended on that day'],
    'harvest.noTreatmentDealer': [ERROR, 'restricted product names no dealer'],
    'harvest.outOfSeason': [ERROR, 'the species was shut on the day the harvest was made'],
    'harvest.unknownArea': [ERROR, 'the area is not in the register'],
    'harvest.unknownDealer': [ERROR, 'the dealer is not in the register'],
    'harvest.unknownHarvester': [ERROR, 'the licence is not in the register'],
    'inspection.neverSeen': [ERROR, 'a certified dealer has never been inspected'],
    'inspection.overdue': [WARNING, 'a dealer is past due for inspection'],
    'inspection.shut': [ERROR, 'a dealer is shut until it is re-inspected'],
    'laboratory.carriage': [ERROR, 'a sample was carried outside the temperature range'],
    'laboratory.method': [ERROR, 'a method the programme does not read'],
    'laboratory.methodMismatch': [ERROR, 'a method not accepted for that analysis'],
    'laboratory.noCarriage': [WARNING, 'a submission carries no carriage temperature'],
    'laboratory.order': [ERROR, 'a sample went on the bench before it was collected'],
    'laboratory.overHeld': [ERROR, 'a sample was held longer than the method allows'],
    'laboratory.time': [ERROR, 'a submission needs two instants'],
    'lease.overlap': [ERROR, 'two leases cover the same ground at the same time'],
    'lease.renewalDue': [NOTE, 'a lease term is close to its end'],
    'lease.rentOwed': [ERROR, 'a lease is in arrears'],
    'lease.rentUnrecorded': [WARNING, 'a lease has no rent date written down'],
    'lease.suspended': [NOTE, 'a lease is over prohibited water and may not be worked'],
    'limit.overArea': [ERROR, 'a licence took more out of one area than its limit allows'],
    'limit.overDay': [ERROR, 'a licence took more in the day than the general limit allows'],
    'locate.contested': [NOTE, 'a position is claimed by two areas and the stricter one governs'],
    'locate.otherArea': [ERROR, 'a station sits inside an area it is not registered to'],
    'locate.overlap': [WARNING, 'two boundaries claim ground in common'],
    'locate.unplaced': [WARNING, 'a station is in no drawn area at all'],
    'load.absent': [NOTE, 'the register carries no list of that kind'],
    'load.entry': [ERROR, 'an entry in the register could not be built'],
    'load.shape': [ERROR, 'something in the register is not the shape it should be'],
    'migrate.current': [NOTE, 'a register is already at the current version'],
    'migrate.reopening': [NOTE, 'a bare reopening number was written out as hours'],
    'order.clearanceMet': [WARNING, 'an order in force has its clearance samples'],
    'order.stale': [WARNING, 'an order has stood a long time and nobody has lifted it'],
  }),
);
const MORE = new Map(
  Object.entries({
    'register.bedArea': [ERROR, 'a bed sits in something that is not an area'],
    'register.bedTide': [WARNING, 'a bed reads a tide station the table does not predict'],
    'register.boundaryArea': [ERROR, 'a boundary is drawn for something that is not an area'],
    'register.noPlan': [ERROR, 'a conditional area carries no plan at all'],
    'register.planArea': [ERROR, 'a plan names something that is not an area'],
    'register.sourceArea': [ERROR, 'a pollution source sits in something that is not an area'],
    'register.sourceOutside': [ERROR, 'a pollution source is outside the boundary it claims'],
    'register.stationArea': [ERROR, 'a station sits in something that is not an area'],
    'register.stationOutside': [ERROR, 'a station is outside the boundary of its own area'],
    'relay.noPermit': [ERROR, 'a relay was made under no permit'],
    'relay.notNeeded': [NOTE, 'the product came out of water needing no treatment'],
    'relay.order': [ERROR, 'a lot was lifted before it was laid'],
    'relay.tooCold': [ERROR, 'the water is too cold for the shellfish to pump'],
    'relay.tooShort': [ERROR, 'the relay ran for less than the period'],
    'relay.unknownWater': [ERROR, 'the receiving water is not in the register'],
    'relay.waterNotApproved': [ERROR, 'the receiving water was not approved throughout'],
    'relay.wrongWater': [ERROR, 'the permit names different water'],
    'renewal.blocked': [ERROR, 'a licence cannot be renewed until something else is put right'],
    'renewal.due': [NOTE, 'a licence is inside its renewal notice period'],
    'renewal.inGrace': [WARNING, 'a licence has lapsed and is inside the grace period'],
    'renewal.lapsed': [ERROR, 'a licence is past the grace period and has to be applied for again'],
    'review.due': [WARNING, 'a review has come round'],
    'review.late': [ERROR, 'a review is well past due'],
    'rotation.abandoned': [ERROR, 'a station a year past due was left off the round'],
    'rotation.neverVisited': [WARNING, 'a station has never been sampled at all'],
    'schedule.due': [WARNING, 'a station is past its sampling interval'],
    'schedule.neverVisited': [ERROR, 'a station has never been sampled'],
    'schema.aheadOfVersion': [
      WARNING,
      'a register carries keys from a later version than it declares',
    ],
    'schema.unknownKey': [ERROR, 'a register carries a key nothing reads'],
    'schema.unversioned': [NOTE, 'a register declares no version and is read as the first'],
    'schema.version': [ERROR, 'a register declares a version this programme does not keep'],
    'seed.noPermit': [ERROR, 'seed was moved under no permit'],
    'seed.oversize': [ERROR, 'what was moved is at or over the seed size, so it is not seed'],
    'seed.permitLapsed': [ERROR, 'the seed permit was not in force on the day'],
    'seed.receivingWater': [ERROR, 'seed was laid into water it may not be laid into'],
    'seed.wrongDestination': [ERROR, 'the seed permit names a different bed'],
    'seed.wrongHarvester': [ERROR, 'the seed permit is held by somebody else'],
    'seed.wrongSource': [ERROR, 'the seed permit names different water'],
    'ship.consigneeNotCertified': [ERROR, 'the consignee could not receive on that day'],
    'ship.consigneeNumber': [ERROR, 'the consignee number is not a certification number'],
    'ship.interstate': [NOTE, 'the trace ends at the state line'],
    'ship.repeatedLot': [ERROR, 'a document names a lot twice'],
    'ship.shipperNotCertified': [ERROR, 'the shipper could not ship on that day'],
    'ship.stateNotConforming': [ERROR, 'the receiving state does not keep the agreement'],
    'ship.unknownConsignee': [ERROR, 'the consignee is not in the register'],
    'ship.unknownShipper': [ERROR, 'the shipper is not in the register'],
    'survey.overLimit': [ERROR, 'a criterion is over the limit for the class held'],
    'survey.thin': [WARNING, 'the set is too small to score'],
  }),
);

const STILL_MORE = new Map(
  Object.entries({
    'tag.comingled': [ERROR, 'a tag names more than one lot'],
    'tag.dealer': [ERROR, 'a tag carries a certification number that is not one'],
    'tag.form': [ERROR, 'a tag is written for a form the programme does not know'],
    'tag.lot': [ERROR, 'a tag carries a lot number that is not one'],
    'tag.missing': [ERROR, 'a tag is missing a required field'],
    'tag.statement': [ERROR, 'a shellstock tag does not carry the retention statement'],
    'trace.loop': [ERROR, 'the ledger sends a lot back to itself'],
    'trace.noLanding': [ERROR, 'the chain runs out before a landing'],
    'trace.noRecord': [WARNING, 'the origin lot has no harvest record'],
    'trace.noShipment': [NOTE, 'nothing was shipped under the lot or anything it became'],
    'trace.nothingLanded': [NOTE, 'nothing was landed out of the area in the period'],
    'vibrio.beforeClock': [ERROR, 'a lot went under control before its clock started'],
    'vibrio.noClock': [ERROR, 'the clock cannot be started for that bed'],
    'vibrio.noControl': [ERROR, 'no record of the lot going under temperature control'],
    'vibrio.noRegion': [ERROR, 'the area sits in no temperature region'],
    'vibrio.outOfSeason': [NOTE, 'the month carries no time to temperature limit'],
    'vibrio.overTime': [ERROR, 'a lot took longer than the limit to get cold'],
    'wet.needsTreatment': [ERROR, 'the product needs treating, which wet storage is not'],
    'wet.noDealer': [ERROR, 'wet storage was done by nobody in particular'],
    'wet.notPermitted': [ERROR, 'the dealer may not wet store on that day'],
    'wet.order': [ERROR, 'a lot was taken out before it went in'],
    'wet.time': [ERROR, 'wet storage needs two instants'],
    'wet.tooLong': [ERROR, 'a float ran longer than storage is allowed to'],
    'wet.unknownDealer': [ERROR, 'the dealer is not in the register'],
    'wet.unknownOrigin': [WARNING, 'nothing records what water the lot came out of'],
    'wet.unknownWater': [ERROR, 'the water is not in the register'],
    'wet.waterNotApproved': [ERROR, 'the water was not approved throughout the storage'],
  }),
);

for (const source of [MORE, STILL_MORE]) {
  for (const [code, row] of source) {
    CATALOGUE.set(code, row);
  }
}

export function codes() {
  return Array.from(CATALOGUE.keys()).sort();
}

export function describeCode(code) {
  const row = CATALOGUE.get(code);
  if (row === undefined) {
    throw new InputError('catalogue.unknown', `${code} is not a finding this programme raises`, {
      code,
    });
  }
  return Object.freeze({ code, severity: row[0], description: row[1] });
}

export function isKnownCode(code) {
  return CATALOGUE.has(code);
}

/** The codes in one family, which is how a report groups them. */
export function family(prefix) {
  return codes().filter((code) => code.startsWith(`${prefix}.`));
}

export function families() {
  return Array.from(new Set(codes().map((code) => code.split('.')[0]))).sort();
}

export function renderCatalogueDocument() {
  const lines = ['# Findings', ''];
  lines.push(
    'Every code the programme can raise. Generated by `tools/write_findings.js`;',
    '`tools/check_findings.js` fails the build if the source and this list drift.',
    '',
  );
  for (const prefix of families()) {
    lines.push(`## ${prefix}`, '');
    for (const code of family(prefix)) {
      const row = describeCode(code);
      lines.push(`- \`${code}\` (${row.severity}) ${row.description}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
