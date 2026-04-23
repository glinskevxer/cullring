/**
 * The advisory command, which writes the notice a recall produces.
 *
 * The reason is asked for rather than guessed. The programme could go and look
 * at what shut the water, and it would be right most of the time, but an
 * advisory goes out over somebody's name and the word on it decides whether
 * people throw their dinner away. That is a decision a person makes.
 */

import {
  GRADES,
  advisory as buildAdvisory,
  distributionList,
  renderAdvisory,
} from '../../trace/advisory.js';
import { findArea } from '../../area/growingArea.js';
import { formatCivilDate } from '../../time/civil.js';
import { formatInstant } from '../../time/instant.js';
import { loadCase } from '../context.js';
import { momentOf } from '../moment.js';
import { periodOf } from './trace.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';
import { definitionList, heading } from '../../text/table.js';

/** The reasons the office writes on an advisory, which pick the wording. */
export const REASONS = Object.freeze([
  'biotoxin',
  'illness',
  'closed water',
  'unpermitted dealer',
  'no tag',
]);

export function advisoryCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return REFUSED;
  }
  const reason = options.reason ?? null;
  if (reason === null || !REASONS.includes(reason)) {
    io.warn(`refused: a reason is one of ${REASONS.join(', ')}`);
    return REFUSED;
  }
  const span = periodOf(options, loaded.zone);
  const issuedAt = momentOf(options, loaded.zone);
  const one = buildAdvisory(loaded.book, {
    areaId: area.id,
    span,
    records: loaded.records,
    reason,
    issuedAt,
    zone: loaded.zone,
  });
  const list = distributionList(one);

  if (options.json === true) {
    io.say(
      asJson({
        area: area.id,
        on: formatCivilDate(one.on),
        issuedAt: formatInstant(loaded.zone, issuedAt),
        grade: one.grade,
        reason,
        lots: one.lots,
        parties: one.parties,
        dealers: list.dealers,
        findings: one.problems.list(),
      }),
    );
    return one.lots.length === 0 ? OK : FOUND;
  }

  io.say(renderAdvisory(one));
  if (options.list === true) {
    io.say('');
    io.say(heading('Who has to be told', { underline: '-' }));
    io.say(
      definitionList([
        ['Dealers', list.dealers.length === 0 ? 'none' : list.dealers.join(', ')],
        ['Parties', list.parties.length === 0 ? 'none' : list.parties.join(', ')],
        ['Calls to make', String(list.total)],
      ]),
    );
  }
  for (const problem of one.problems.list()) {
    io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
  }
  return one.lots.length === 0 ? OK : FOUND;
}

/** The grades, for anything that wants to check one it was handed. */
export function grades() {
  return GRADES.slice();
}
