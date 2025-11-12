/**
 * The survey command, and the selection that has to happen before it.
 *
 * A survey is not "every result the office holds for this area". It is the
 * results from that area's stations, of the analysis being scored, inside the
 * window the strategy reaches back over. Getting the selection wrong is how an
 * area gets reclassified on eight year old data, so the selection is done here
 * where it can be seen rather than inside the scoring.
 */

import { classificationOn, findArea } from '../../area/growingArea.js';
import { countsByStation } from '../../area/station.js';
import { renderSurvey, surveyReport } from '../../report/survey.js';
import { compareStrategies } from '../../report/survey.js';
import { FECAL_COLIFORM, analysis } from '../../survey/standard.js';
import { STRATEGIES, SYSTEMATIC_RANDOM, strategy, windowYears } from '../../survey/strategy.js';
import { addDays, compareCivilDate, formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { OK, REFUSED, asJson } from '../output.js';
import { decimal } from '../../text/format.js';
import { RIGHT, column, heading, renderTable } from '../../text/table.js';

/** The results a strategy is allowed to reach for, on a day, for an area. */
export function selectSamples(samples, { areaId, on, strategyName, analysisName }) {
  const years = windowYears(strategyName);
  const floor = addDays(on, -Math.round(years * 365.25));
  return samples.filter(
    (one) =>
      one.areaId === areaId &&
      one.kind === analysisName &&
      compareCivilDate(one.collectedOn, floor) >= 0 &&
      compareCivilDate(one.collectedOn, on) <= 0,
  );
}

export function survey(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return REFUSED;
  }
  const on = dayOf(options, loaded.zone);
  const analysisName = analysis(options.analysis ?? FECAL_COLIFORM, 'analysis');
  const strategyName = strategy(options.strategy ?? SYSTEMATIC_RANDOM, 'strategy').name;
  const heldTo = options.heldTo ?? classificationOn(area, on);
  if (heldTo === null) {
    io.warn(`refused: ${area.id} has no classification of record on ${formatCivilDate(on)}`);
    return REFUSED;
  }
  const selected = selectSamples(loaded.samples, {
    areaId: area.id,
    on,
    strategyName,
    analysisName,
  });
  const report = surveyReport({
    area,
    results: selected.map((one) => one.result),
    heldTo,
    analysis: analysisName,
    strategy: strategyName,
    samples: selected,
    stations: loaded.stations,
    sources: loaded.sources,
    on,
  });
  if (options.json === true) {
    io.say(
      asJson({
        area: area.id,
        heldTo,
        analysis: analysisName,
        strategy: strategyName,
        on: formatCivilDate(on),
        results: selected.length,
        supported: report.supported,
        cap: report.cap,
        trend: report.trend.direction,
        watch: report.watch.watch,
        proposal: report.proposal,
        perStation: countsByStation(selected),
      }),
    );
    return OK;
  }
  io.say(renderSurvey(report));
  if (options.both === true) {
    io.say('');
    io.say(renderComparison(area, selected, heldTo, analysisName, on));
  }
  return OK;
}

const COMPARISON_COLUMNS = [
  column('strategy', 'Strategy', { cap: 28 }),
  column('geometricMean', 'Geo mean', { align: RIGHT, width: 9 }),
  column('criteria', 'Criteria', { cap: 46 }),
  column('supported', 'Supports', { cap: 22 }),
];

function renderComparison(area, selected, heldTo, analysisName, on) {
  const rows = compareStrategies(
    {
      area,
      results: selected.map((one) => one.result),
      heldTo,
      analysis: analysisName,
      samples: selected,
      on,
    },
    STRATEGIES.slice(),
  ).map((one) => ({
    strategy: one.strategy,
    geometricMean: decimal(one.geometricMean, 2),
    criteria: one.criteria.map((entry) => entry.criterion).join(', '),
    supported: one.supported ?? 'nothing',
  }));
  return [
    heading('The same results under both strategies', { underline: '-' }),
    '',
    renderTable(COMPARISON_COLUMNS, rows),
  ].join('\n');
}
