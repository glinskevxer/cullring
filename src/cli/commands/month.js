/**
 * The month command, and the walk that runs everything.
 *
 * The month report is the one that leaves the building. The walk is for the
 * office: it runs every report over the case in one go, so that a change to
 * the register can be checked against everything at once rather than command
 * by command. The walk is also what the build runs, which is why it prints a
 * digest at the end: two walks over the same case have to agree byte for byte
 * or something in here is reading the clock.
 */

import { createHash } from 'node:crypto';

import { monthReport, renderMonth } from '../../report/month.js';
import { renderStanding } from '../../report/standing.js';
import { renderSurvey, surveyReport } from '../../report/survey.js';
import { classificationOn } from '../../area/growingArea.js';
import { selectSamples } from './survey.js';
import { SYSTEMATIC_RANDOM } from '../../survey/strategy.js';
import { FECAL_COLIFORM } from '../../survey/standard.js';
import { MIDNIGHT, civilDate, parseCivilDate } from '../../time/civil.js';
import { instantFromCivil } from '../../time/instant.js';
import { loadCase, contextOf } from '../context.js';
import { OK, asJson } from '../output.js';
import { heading } from '../../text/table.js';

export function month(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const { year, month: number } = readMonth(options);
  const report = monthReport({
    year,
    month: number,
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    records: loaded.records,
    beds: loaded.beds,
    context: contextOf(loaded),
    underControl: loaded.underControl,
    zone: loaded.zone,
  });
  if (options.json === true) {
    io.say(
      asJson({
        year,
        month: number,
        landings: report.landingsSummary,
        closures: report.closures.length,
        standing: report.standing,
      }),
    );
    return OK;
  }
  io.say(renderMonth(report));
  return OK;
}

export function readMonth(options) {
  const on = parseCivilDate(options.on, 'on');
  return { year: on.year, month: on.month };
}

/**
 * Every report the programme writes, over one case, at one moment. The digest
 * at the end is the cheapest possible test that nothing in here reads the
 * clock or a hash seed.
 */
export function walk(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = parseCivilDate(options.on, 'on');
  const pieces = [];

  pieces.push(
    renderStanding({
      areas: loaded.areas,
      plans: loaded.plans,
      feed: loaded.feed,
      at: momentOfDay(loaded, on),
      zone: loaded.zone,
      from: momentOfDay(loaded, civilDate(on.year, on.month, 1)),
    }),
  );

  for (const area of loaded.areas) {
    const heldTo = classificationOn(area, on);
    if (heldTo === null) {
      continue;
    }
    const selected = selectSamples(loaded.samples, {
      areaId: area.id,
      on,
      strategyName: SYSTEMATIC_RANDOM,
      analysisName: FECAL_COLIFORM,
    });
    pieces.push(
      renderSurvey(
        surveyReport({
          area,
          results: selected.map((one) => one.result),
          heldTo,
          samples: selected,
          stations: loaded.stations,
          sources: loaded.sources,
          on,
        }),
      ),
    );
  }

  const report = monthReport({
    year: on.year,
    month: on.month,
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    records: loaded.records,
    beds: loaded.beds,
    context: contextOf(loaded),
    underControl: loaded.underControl,
    zone: loaded.zone,
  });
  pieces.push(renderMonth(report));

  const text = pieces.join('\n\n');
  const digest = createHash('sha256').update(text, 'utf8').digest('hex');
  if (options.digestOnly === true) {
    io.say(digest);
    return OK;
  }
  io.say(text);
  io.say('');
  io.say(heading('Seal', { underline: '-' }));
  io.say('');
  io.say(`sha256 ${digest}`);
  return OK;
}

function momentOfDay(loaded, date) {
  return instantFromCivil(loaded.zone, date, MIDNIGHT);
}
