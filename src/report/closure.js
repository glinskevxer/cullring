/**
 * The closure notice, which is the document that goes out to the licence
 * holders and gets pinned up at the ramps.
 *
 * It has to do three things and it is judged on all three. It has to say what
 * is shut and from when, in terms somebody standing on a dock can act on. It
 * has to cite the reading that shut it, because the first question is always
 * "how much rain was that". And it has to say what will lift it, in the unit
 * the plan is written in, because "when it reopens" is not an answer anybody
 * can plan a week around.
 *
 * The notice for a closure that has already lifted is a different document and
 * says so, since a notice that read the same either way would be pinned up
 * long after it stopped meaning anything.
 */

import { closureHistory } from '../condition/closure.js';
import { describePlan, describeTrigger } from '../condition/plan.js';
import { describeReopening } from '../condition/reopening.js';
import { formatInstant } from '../time/instant.js';
import { decimal } from '../text/format.js';
import { column, definitionList, heading, renderTable } from '../text/table.js';

export function closureNotices({ area, plan, feed, span }) {
  return closureHistory(plan, feed, span).map((closure) =>
    Object.freeze({
      area: area.id,
      name: area.name,
      plan,
      closure,
      open: closure.open,
      citation: citationOf(closure),
    }),
  );
}

function citationOf(closure) {
  const fired = closure.firedBy;
  if (fired === undefined || fired === null) {
    return 'the management plan';
  }
  if (typeof fired.measured !== 'number') {
    return describeTrigger({ kind: fired.kind, ...fired });
  }
  const where = fired.gauge ?? fired.facility ?? 'the gauge';
  return `${decimal(fired.measured, 2)} ${fired.unit} at ${where} against a trigger of ${fired.threshold}`;
}

export function renderNotice(notice, { zone = 'eastern' } = {}) {
  const title = notice.open
    ? `Closure in force: ${notice.area} ${notice.name}`
    : `Closure lifted: ${notice.area} ${notice.name}`;
  const pairs = [
    ['Area', `${notice.area} ${notice.name}`],
    ['Closed from', formatInstant(zone, notice.closure.start)],
  ];
  if (notice.closure.end === null) {
    pairs.push(['Reopens', describeReopening(notice.plan.reopening)]);
  } else {
    pairs.push(['Reopened', formatInstant(zone, notice.closure.end)]);
  }
  pairs.push(['Because', notice.citation]);
  if (notice.closure.restarts > 0) {
    pairs.push(['Clock restarted', `${notice.closure.restarts} times by further readings`]);
  }
  if (notice.plan.reference !== null) {
    pairs.push(['Under', notice.plan.reference]);
  }
  return [heading(title), '', definitionList(pairs)].join('\n');
}

const HISTORY_COLUMNS = [
  column('from', 'Closed from', { width: 24 }),
  column('to', 'Reopened', { width: 24 }),
  column('restarts', 'Restarts', { width: 8 }),
  column('cause', 'Because', { cap: 44 }),
];

export function renderClosureHistory({ area, plan, feed, span, zone = 'eastern' }) {
  const notices = closureNotices({ area, plan, feed, span });
  const rows = notices.map((notice) => ({
    from: formatInstant(zone, notice.closure.start),
    to: notice.closure.end === null ? 'still shut' : formatInstant(zone, notice.closure.end),
    restarts: String(notice.closure.restarts),
    cause: notice.citation,
  }));
  const out = [
    heading(`Closures for ${area.id} ${area.name}`),
    '',
    definitionList([
      ['Plan', describePlan(plan)],
      ['Period', `${formatInstant(zone, span.start)} to ${formatInstant(zone, span.end)}`],
      ['Closures', String(rows.length)],
    ]),
    '',
  ];
  if (rows.length === 0) {
    out.push('The area was not shut under its plan at any point in this period.');
    return out.join('\n');
  }
  out.push(renderTable(HISTORY_COLUMNS, rows));
  return out.join('\n');
}

/** How much of a period the area spent shut, which is what the annual report counts. */
export function closedSeconds({ plan, feed, span }) {
  return closureHistory(plan, feed, span).reduce((total, closure) => {
    const end = closure.end === null ? span.end : closure.end;
    return total + (end.epochSecond - closure.start.epochSecond);
  }, 0);
}

export function closedShare({ plan, feed, span }) {
  const whole = span.end.epochSecond - span.start.epochSecond;
  if (whole === 0) {
    return 0;
  }
  return closedSeconds({ plan, feed, span }) / whole;
}
