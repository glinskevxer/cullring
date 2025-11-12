/**
 * The survey report, which is the paper a reclassification is proposed on.
 *
 * It prints the same set of results twice when the office asks for it, once
 * under each strategy, because the strategy is what chooses the criteria and
 * the censoring policy and the two readings are genuinely different numbers.
 * Showing them side by side is the only way anybody outside the office
 * believes that.
 *
 * The proposal at the bottom is the walk, and it says what the water supports
 * rather than what it currently is. Where those differ the report says so in
 * one line, because that line is the whole reason the survey was run.
 */

import { compareClassification } from '../area/classification.js';
import { countsByStation, unvisited } from '../area/station.js';
import { evaluateSurvey } from '../survey/evaluate.js';
import { areaCap, capped, describeSource, sourcesIn } from '../survey/shoreline.js';
import { WORSENING, describeTrend, trendFor } from '../survey/trend.js';
import { FECAL_COLIFORM } from '../survey/standard.js';
import { SYSTEMATIC_RANDOM, shortNameOf } from '../survey/strategy.js';
import { formatCivilDate } from '../time/civil.js';
import { decimal, joinWords, yesNo } from '../text/format.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

const CRITERION_COLUMNS = [
  column('criterion', 'Criterion', { cap: 32 }),
  column('value', 'Read', { align: RIGHT, width: 9 }),
  column('limit', 'Limit', { align: RIGHT, width: 7 }),
  column('met', 'Met', { width: 3 }),
];

export function surveyReport({
  area,
  results,
  heldTo,
  analysis = FECAL_COLIFORM,
  strategy = SYSTEMATIC_RANDOM,
  samples = [],
  stations = [],
  sources = [],
  on,
}) {
  const perStation = samples.length > 0 ? countsByStation(samples) : {};
  const verdict = evaluateSurvey({ results, heldTo, analysis, strategy, perStation });
  const missed = stations.length > 0 ? unvisited(stations, area.id, samples, on) : [];
  const reaching = sourcesIn(sources, area.id);
  const cap = areaCap(
    reaching,
    stations.filter((one) => one.areaId === area.id),
  );
  const supported = verdict.supported === null ? null : capped(verdict.supported, cap);
  const trend = trendFor({ samples, on, strategyName: strategy });
  return Object.freeze({
    area: area.id,
    name: area.name,
    heldTo,
    analysis,
    strategy,
    on,
    verdict,
    perStation,
    unvisited: Object.freeze(missed),
    sources: Object.freeze(reaching),
    cap,
    supported,
    trend,
    proposal: proposalOf(supported, heldTo),
    watch: watchOf(supported, heldTo, trend),
  });
}

/**
 * The proposal is built from the CAPPED class rather than from the
 * bacteriological one, because the shoreline evidence is evidence. An area
 * whose numbers support approved and whose stations sit inside an outfall zone
 * is not a candidate for approved, and a proposal that said otherwise would be
 * the office arguing against its own survey.
 */
/**
 * Whether to watch an area that is passing. A proposal answers what to do
 * about water that has failed; this answers what to do about water that has
 * not failed yet and is heading that way. The two are kept apart because the
 * office acts on them differently: a proposal goes to the committee and a
 * watch goes on the sampling round.
 */
function watchOf(supported, heldTo, trend) {
  if (supported === null || trend.direction !== WORSENING) {
    return Object.freeze({ watch: false, reason: null });
  }
  if (compareClassification(supported, heldTo) > 0) {
    return Object.freeze({
      watch: false,
      reason: 'the water has already failed, so this is a proposal rather than a watch',
    });
  }
  return Object.freeze({ watch: true, reason: describeTrend(trend) });
}

function proposalOf(supported, heldTo) {
  if (supported === null) {
    return Object.freeze({ kind: 'none', reason: 'the set is too thin to support anything' });
  }
  const direction = compareClassification(supported, heldTo);
  if (direction === 0) {
    return Object.freeze({
      kind: 'hold',
      to: heldTo,
      reason: 'the water supports what it is held to',
    });
  }
  return Object.freeze({
    kind: direction > 0 ? 'downgrade' : 'upgrade',
    to: supported,
    reason:
      direction > 0 ? `the water no longer supports ${heldTo}` : `the water supports ${supported}`,
  });
}

export function renderSurvey(report) {
  const out = [
    heading(`Survey of ${report.area} ${report.name}`),
    '',
    definitionList([
      ['Held to', report.heldTo],
      ['Analysis', report.analysis],
      ['Strategy', `${report.strategy} (${shortNameOf(report.strategy)})`],
      ['As at', formatCivilDate(report.on)],
      ['Results', String(report.verdict.sufficiency.total)],
    ]),
    '',
  ];
  if (!report.verdict.sufficiency.sufficient) {
    out.push(
      `The set holds ${report.verdict.sufficiency.total} results against a floor of ${report.verdict.sufficiency.required}.`,
    );
    if (report.verdict.sufficiency.thinStations.length > 0) {
      out.push(`Thin at ${joinWords(report.verdict.sufficiency.thinStations)}.`);
    }
    out.push('', 'No classification is proposed.');
    pushUnvisited(out, report);
    return out.join('\n');
  }
  out.push(heading('Against the class it is held to', { underline: '-' }), '');
  out.push(renderTable(CRITERION_COLUMNS, criterionRows(report.verdict.held)));
  out.push('', heading('The walk', { underline: '-' }), '');
  out.push(
    renderTable(
      [column('classification', 'Class', { cap: 26 }), column('met', 'Met', { width: 3 })],
      report.verdict.walk.steps.map((step) => ({
        classification: step.classification,
        met: yesNo(step.met),
      })),
    ),
  );
  out.push('', `Supported by the samples: ${report.verdict.supported}`);
  if (report.cap !== null) {
    out.push(`Capped by the shoreline at: ${report.cap}`);
    for (const one of report.sources) {
      out.push(`  ${describeSource(one)}`);
    }
  }
  out.push(`Supported: ${report.supported}`);
  out.push(`Proposal: ${report.proposal.kind}, ${report.proposal.reason}.`);
  out.push(`Trend: ${describeTrend(report.trend)}.`);
  if (report.watch.watch) {
    out.push(`Watch: yes, ${report.watch.reason}.`);
  }
  pushUnvisited(out, report);
  return out.join('\n');
}

/**
 * Which stations the survey never reached. It is printed whether or not the
 * set was big enough, because a thin set is usually thin for exactly this
 * reason and the sanitarian wants to know which boat run to repeat.
 */
function pushUnvisited(out, report) {
  if (report.unvisited.length > 0) {
    out.push('', `Not visited this period: ${joinWords(report.unvisited)}.`);
  }
}

function criterionRows(score) {
  return score.criteria.map((entry) => ({
    criterion: entry.criterion,
    value: decimal(entry.value, 1),
    limit: String(entry.limit),
    met: yesNo(entry.met),
  }));
}

/**
 * The same results read under both strategies, which is the comparison the
 * office puts in front of the advisory committee.
 */
export function compareStrategies(base, strategies) {
  return strategies.map((strategy) => {
    const report = surveyReport({ ...base, strategy });
    return Object.freeze({
      strategy,
      supported: report.verdict.supported,
      criteria: report.verdict.held === null ? [] : report.verdict.held.criteria,
      geometricMean:
        report.verdict.held === null ? null : report.verdict.held.described.geometricMean,
    });
  });
}
