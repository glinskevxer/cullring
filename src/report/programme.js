/**
 * What the office owes the water, rather than what the water owes the office.
 *
 * Every other report in here answers a question about a lot or an area. This
 * one answers a question about the programme: which reviews are overdue, which
 * stations have not been visited, and what the next quarter costs in boat
 * time. It is the report that gets an area re-sampled before it gets
 * reclassified for want of data.
 */

import { classificationOn } from '../area/growingArea.js';
import { stationsInService } from '../area/station.js';
import { reviewFindings, reviewsFor, soonestDue } from '../area/review.js';
import { annualVisits, scheduleFor } from '../survey/schedule.js';
import { findings } from '../core/finding.js';
import { formatCivilDate } from '../time/civil.js';
import { shortName } from '../area/classification.js';
import { RIGHT, column, definitionList, heading, renderTable } from '../text/table.js';

const REVIEW_COLUMNS = [
  column('area', 'Area', { width: 6 }),
  column('kind', 'Review', { cap: 22 }),
  column('last', 'Last done', { width: 10 }),
  column('due', 'Due', { width: 10 }),
  column('state', 'State', { width: 7 }),
  column('over', 'Days over', { align: RIGHT, width: 9 }),
];

const STATION_COLUMNS = [
  column('station', 'Station', { width: 8 }),
  column('class', 'Class', { width: 5 }),
  column('perYear', 'A year', { align: RIGHT, width: 6 }),
  column('last', 'Last visit', { width: 10 }),
  column('due', 'Next due', { width: 10 }),
  column('state', 'State', { width: 13 }),
];

export function programmeReport({ areas, stations, samples, on, history = {} }) {
  const problems = findings();
  const reviews = [];
  const schedule = [];
  let boatVisits = 0;

  for (const area of areas) {
    const held = classificationOn(area, on);
    if (held === null) {
      continue;
    }
    const dates = history[area.id] ?? {};
    const states = reviewsFor(area, {
      on,
      lastReview: dates.lastReview ?? area.history[area.history.length - 1].from,
      lastSurvey: dates.lastSurvey ?? area.history[area.history.length - 1].from,
      lastPlanReview: dates.lastPlanReview ?? null,
    });
    problems.absorb(reviewFindings(area, states));
    for (const state of states) {
      reviews.push({
        area: area.id,
        kind: state.kind,
        last: formatCivilDate(state.lastDone),
        due: formatCivilDate(state.due),
        state: state.state,
        over: String(state.overdueDays),
      });
    }
    const inService = stationsInService(stations, area.id, on);
    boatVisits += annualVisits(held, inService.length);
    for (const row of scheduleFor({
      area,
      classificationName: held,
      stations: inService,
      samples,
      on,
    })) {
      schedule.push({
        station: row.station,
        class: shortName(row.classification),
        perYear: String(row.perYear),
        last: row.lastVisited === null ? '-' : formatCivilDate(row.lastVisited),
        due: row.due === null ? '-' : formatCivilDate(row.due),
        state: row.state,
        row,
      });
      if (row.state === 'due') {
        problems.warn('schedule.due', `${row.station} is ${row.overdueDays} days past due`, {
          station: row.station,
          overdueDays: row.overdueDays,
        });
      }
      if (row.state === 'never visited') {
        problems.error('schedule.neverVisited', `${row.station} has never been visited`, {
          station: row.station,
        });
      }
    }
  }

  return Object.freeze({
    on,
    reviews: Object.freeze(reviews),
    schedule: Object.freeze(schedule),
    boatVisits,
    problems,
  });
}

export function renderProgramme(report) {
  const late = report.reviews.filter((one) => one.state === 'late').length;
  const due = report.schedule.filter((one) => one.state === 'due').length;
  const out = [
    heading('Programme standing'),
    '',
    definitionList([
      ['As at', formatCivilDate(report.on)],
      ['Reviews tracked', String(report.reviews.length)],
      ['Reviews late', String(late)],
      ['Stations tracked', String(report.schedule.length)],
      ['Stations due', String(due)],
      ['Visits a year at this classification', String(report.boatVisits)],
    ]),
    '',
    heading('Reviews', { underline: '-' }),
    '',
    renderTable(REVIEW_COLUMNS, report.reviews),
    '',
    heading('Stations', { underline: '-' }),
    '',
    renderTable(STATION_COLUMNS, report.schedule),
  ];
  if (report.problems.length > 0) {
    out.push('', heading('Findings', { underline: '-' }), '');
    for (const finding of report.problems.list()) {
      out.push(`${finding.severity}: ${finding.message}`);
    }
  }
  return out.join('\n');
}

/** The next thing due anywhere, which is what the wall planner wants. */
export function nextThingDue(areas, on, history = {}) {
  const soonest = [];
  for (const area of areas) {
    if (classificationOn(area, on) === null) {
      continue;
    }
    const dates = history[area.id] ?? {};
    const states = reviewsFor(area, {
      on,
      lastReview: dates.lastReview ?? area.history[area.history.length - 1].from,
      lastSurvey: dates.lastSurvey ?? area.history[area.history.length - 1].from,
      lastPlanReview: dates.lastPlanReview ?? null,
    });
    const best = soonestDue(states);
    if (best !== null) {
      soonest.push({ area: area.id, ...best });
    }
  }
  if (soonest.length === 0) {
    return null;
  }
  return soonest.reduce((best, one) =>
    one.due.year === best.due.year
      ? one.due.month === best.due.month
        ? one.due.day < best.due.day
          ? one
          : best
        : one.due.month < best.due.month
          ? one
          : best
      : one.due.year < best.due.year
        ? one
        : best,
  );
}
