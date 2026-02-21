/**
 * The landings commands: a day of them, and one lot in full.
 *
 * The day view is a table with a verdict per lot. The single lot view is the
 * one somebody opens when a dealer rings up, and it prints everything the
 * programme knows about that lot in the order the questions get asked: what
 * water, whose licence, which clock, and where it went afterwards.
 */

import { checkHarvest } from '../../harvest/legality.js';
import { tagFor, checkTag } from '../../harvest/tag.js';
import { findBed } from '../../harvest/bed.js';
import { landingsReport, landingsSummary, renderLandings } from '../../report/landings.js';
import { sheetFor } from '../../report/sheet.js';
import { traceForward } from '../../trace/trace.js';
import { formatCivilDate, sameCivilDate } from '../../time/civil.js';
import { civilDateAt, formatInstant } from '../../time/instant.js';
import { describeClockStart } from '../../vibrio/clock.js';
import { loadCase, contextOf } from '../context.js';
import { dayOf, walkStart } from '../moment.js';
import { OK, REFUSED, asJson } from '../output.js';
import { hours, joinWords, yesNo } from '../../text/format.js';
import { definitionList, heading } from '../../text/table.js';

export function landings(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const chosen = loaded.records.filter((one) => sameCivilDate(one.landedOn, on));
  const report = landingsReport({
    records: chosen,
    beds: loaded.beds,
    context: contextOf(loaded, {
      from: walkStart(options, loaded.zone, { epochSecond: startOfDay(loaded, on) }),
    }),
    underControl: loaded.underControl,
  });
  if (options.csv === true) {
    io.say(sheetFor(report).trimEnd());
    return report.unlawful > 0 ? 1 : OK;
  }
  if (options.json === true) {
    io.say(asJson({ on: formatCivilDate(on), ...landingsSummary(report) }));
    return report.unlawful > 0 ? 1 : OK;
  }
  io.say(renderLandings(report, { on, zone: loaded.zone }));
  return report.unlawful > 0 ? 1 : OK;
}

function startOfDay(loaded, on) {
  const first = loaded.records.find((one) => sameCivilDate(one.landedOn, on));
  return first === undefined ? 0 : first.startedAt.epochSecond;
}

export function lot(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const record = loaded.records.find((one) => one.lot === options.lot) ?? null;
  if (record === null) {
    io.warn(`refused: ${options.lot} is not in the landings`);
    return REFUSED;
  }
  const bed = findBed(loaded.beds, record.bed);
  const answer = checkHarvest({
    ...contextOf(loaded, { from: walkStart(options, loaded.zone, record.startedAt) }),
    record,
    bed,
    underControlAt: loaded.underControl.get(record.lot) ?? null,
  });
  const onward = traceForward(loaded.book, record.lot);
  const tag = checkTag(tagFor(record));
  if (options.json === true) {
    io.say(
      asJson({
        lot: record.lot,
        area: record.areaId,
        bed: record.bed,
        effective: answer.effective,
        lawful: answer.lawful,
        clock: answer.temperature.clockStart.basis,
        elapsedHours: answer.temperature.elapsedHours,
        limitHours: answer.temperature.limitHours,
        reached: onward.reached,
        parties: onward.parties,
        findings: answer.problems.list(),
      }),
    );
    return answer.lawful ? OK : 1;
  }
  io.say(
    [
      heading(`Lot ${record.lot}`),
      '',
      definitionList([
        ['Area', `${record.areaId}, ${answer.effective} at the time`],
        ['Bed', `${record.bed} (${bed === null ? 'not in the register' : bed.name})`],
        ['Harvester', record.harvester],
        ['Gear', record.gear],
        ['Started', formatInstant(loaded.zone, record.startedAt)],
        ['Landed', formatInstant(loaded.zone, record.landedAt)],
        ['Containers', String(record.containers)],
        ['Iced on board', yesNo(record.iced)],
        ['Clock', describeClockStart(answer.temperature.clockStart)],
        ['Elapsed', hours(answer.temperature.elapsedHours)],
        ['Limit', hours(answer.temperature.limitHours)],
        ['Tag', tag.lawful ? 'complete' : 'incomplete'],
        ['Became', onward.reached.length > 1 ? joinWords(onward.reached.slice(1), 'then') : '-'],
        ['Went to', onward.parties.length === 0 ? 'nothing recorded' : joinWords(onward.parties)],
        ['Lawful', yesNo(answer.lawful)],
      ]),
    ].join('\n'),
  );
  for (const finding of answer.problems.list()) {
    io.warn(`${finding.severity}: ${finding.code}: ${finding.message}`);
  }
  return answer.lawful ? OK : 1;
}

/** The days the landings sheet holds, so somebody can ask which to look at. */
export function landingDays(loaded) {
  const seen = new Set(loaded.records.map((one) => formatCivilDate(one.landedOn)));
  return Array.from(seen).sort();
}

export function dayOfInstant(loaded, at) {
  return civilDateAt(loaded.zone, at);
}
