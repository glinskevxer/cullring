/**
 * What a case can and cannot answer, before anybody asks it something.
 *
 * Every report in this programme is written to work with what it is given. A
 * survey with no shoreline sources scores the samples and skips the cap. A
 * landings check with no tide table starts the clock at the harvest. Each of
 * those is the right behaviour on its own and each of them produces a report
 * that looks exactly like a complete one.
 *
 * That is the failure this exists for. The reports are honest one at a time
 * and the office reads them together, and nothing in the pile says "the tide
 * table was not there, so every intertidal clock in this month is the generous
 * reading". This says it once, at the top, in the only place that can see the
 * whole case at once.
 *
 * A register that is absent is not a finding. An office with no emergency
 * orders should not be told it is missing something. What is reported is the
 * consequence: which reports are narrower than they look, and how.
 */

import { column, definitionList, heading, renderTable } from '../text/table.js';
import { findings } from '../core/finding.js';

/**
 * What each report reads, and what it does when a register is not there. The
 * `without` line is the whole point: it is what the report silently becomes.
 */
const NEEDS = Object.freeze([
  {
    report: 'standing',
    reads: ['areas', 'plans', 'readings', 'bypasses', 'orders'],
    without: {
      readings: 'no rainfall or river trigger can fire, so conditional areas read as open',
      bypasses: 'a plant bypass cannot close anything',
      orders: 'nothing is under an emergency order',
    },
  },
  {
    report: 'survey',
    reads: ['samples', 'stations', 'sources'],
    without: {
      sources: 'the shoreline cap is not applied, so the samples decide alone',
      stations: 'no station can be reported unvisited and the per station floor is not checked',
    },
  },
  {
    report: 'landings',
    reads: ['records', 'beds', 'harvesters', 'dealers', 'tides', 'certificates', 'leases'],
    without: {
      tides: 'an intertidal clock starts at the harvest, which is the generous reading',
      certificates: 'the education requirement is not checked at all',
      leases: 'the ground is read from the bed register, which holds only today',
    },
  },
  {
    report: 'trace',
    reads: ['book', 'records'],
    without: {
      book: 'nothing can be traced past the landing',
      records: 'a lot cannot be tied back to the water it came from',
    },
  },
  {
    report: 'take',
    reads: ['records', 'limits'],
    without: { limits: 'no daily limit is enforced' },
  },
  {
    report: 'programme',
    reads: ['stations', 'samples', 'reviewHistory'],
    without: {
      reviewHistory: 'review clocks run from the last reclassification rather than the last review',
    },
  },
  {
    report: 'embargoes',
    reads: ['embargoes', 'book'],
    without: { embargoes: 'nothing is held' },
  },
]);

/** The registers a loaded case actually carries, by the names the reports use. */
export function heldBy(loaded) {
  const has = (list) => Array.isArray(list) && list.length > 0;
  return Object.freeze({
    areas: has(loaded.areas),
    plans: has(loaded.plans),
    stations: has(loaded.stations),
    beds: has(loaded.beds),
    harvesters: has(loaded.harvesters),
    dealers: has(loaded.dealers),
    certificates: has(loaded.certificates),
    sources: has(loaded.sources),
    orders: has(loaded.orders),
    embargoes: has(loaded.embargoes),
    leases: has(loaded.leases),
    limits: has(loaded.limits),
    samples: has(loaded.samples),
    records: has(loaded.records),
    tides: has(loaded.tides),
    readings: has(loaded.feed?.readings),
    bypasses: has(loaded.feed?.bypasses),
    reviewHistory: Object.keys(loaded.reviewHistory ?? {}).length > 0,
    book: (loaded.book?.length ?? 0) > 0,
  });
}

/** Every register any report reads, which is what the check is measured over. */
export function everyRegister() {
  return Array.from(new Set(NEEDS.flatMap((one) => one.reads))).sort();
}

/**
 * What each report can and cannot say over this case. A report whose every
 * register is present is complete; one missing a register it can work without
 * is narrowed, and the narrowing is named; one missing a register it cannot
 * work without at all is blocked.
 */
export function coverageReport(loaded) {
  const held = heldBy(loaded);
  const problems = findings();
  const rows = NEEDS.map((one) => {
    const absent = one.reads.filter((name) => held[name] !== true);
    const narrowed = absent.filter((name) => one.without[name] !== undefined);
    const blocking = absent.filter((name) => one.without[name] === undefined);
    const state = blocking.length > 0 ? 'blocked' : narrowed.length > 0 ? 'narrowed' : 'complete';

    if (state === 'blocked') {
      problems.error(
        'coverage.blocked',
        `the ${one.report} report needs ${blocking.join(', ')} and the case holds none`,
        { report: one.report, missing: blocking },
      );
    }
    for (const name of narrowed) {
      problems.warn(
        'coverage.narrowed',
        `the ${one.report} report has no ${name}, so ${one.without[name]}`,
        { report: one.report, register: name, because: one.without[name] },
      );
    }

    return Object.freeze({
      report: one.report,
      state,
      absent: Object.freeze(absent),
      narrowed: Object.freeze(narrowed),
      blocking: Object.freeze(blocking),
      because: Object.freeze(narrowed.map((name) => one.without[name])),
    });
  });

  const registers = everyRegister();
  return Object.freeze({
    held,
    rows: Object.freeze(rows),
    registers: Object.freeze(registers),
    present: registers.filter((name) => held[name] === true).length,
    complete: rows.filter((one) => one.state === 'complete').length,
    problems,
  });
}

const COVERAGE_COLUMNS = [
  column('report', 'Report', { width: 12 }),
  column('state', 'State', { width: 10 }),
  column('absent', 'Missing', { cap: 30 }),
  column('because', 'So the report', { cap: 44 }),
];

export function renderCoverage(report) {
  const out = [
    heading('What this case can answer'),
    '',
    definitionList([
      ['Registers read by some report', String(report.registers.length)],
      ['Of those, present', String(report.present)],
      ['Reports that are complete', `${report.complete} of ${report.rows.length}`],
    ]),
    '',
    renderTable(
      COVERAGE_COLUMNS,
      report.rows.map((one) => ({
        report: one.report,
        state: one.state,
        absent: one.absent.length === 0 ? '-' : one.absent.join(', '),
        because: one.because.length === 0 ? '-' : one.because[0],
      })),
    ),
  ];
  const narrowed = report.rows.filter((one) => one.because.length > 1);
  if (narrowed.length > 0) {
    out.push('', heading('And also', { underline: '-' }), '');
    for (const one of narrowed) {
      for (const line of one.because.slice(1)) {
        out.push(`  ${one.report}: ${line}`);
      }
    }
  }
  return out.join('\n');
}

/** The one sentence that goes at the top of anything printed off a thin case. */
export function caveat(report) {
  const narrowed = report.rows.filter((one) => one.state !== 'complete');
  if (narrowed.length === 0) {
    return null;
  }
  return `${narrowed.length} of ${report.rows.length} reports are narrower than they look over this case.`;
}
