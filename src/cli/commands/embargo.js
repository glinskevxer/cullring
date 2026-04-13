/**
 * The embargo command: what is held, what it reaches, and what moved anyway.
 *
 * It answers the two questions in the order the office asks them. A number
 * given on the command line is one embargo and its lots. No number is the
 * whole standing list, with the movements that broke any of them underneath,
 * because a held lot that shipped is the finding somebody has to act on today.
 */

import { LEFT, column, definitionList, heading, renderTable } from '../../text/table.js';
import {
  checkMovements,
  findEmbargo,
  lotsHeld,
  reviewFindings,
  standing,
} from '../../harvest/embargo.js';
import { formatInstant } from '../../time/instant.js';
import { loadCase } from '../context.js';
import { momentOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

const HELD_COLUMNS = [
  column('number', 'Number', { width: 13 }),
  column('reach', 'Reaches', { width: 10 }),
  column('names', 'Names', { align: LEFT, cap: 30 }),
  column('issued', 'Issued', { width: 22 }),
  column('lots', 'Lots held', { align: LEFT, cap: 34 }),
];

export function embargoes(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const at = momentOf(options, loaded.zone);
  const context = {
    book: loaded.book,
    records: loaded.records,
    beds: loaded.beds,
    at,
  };

  if (options.number !== undefined && options.number !== null) {
    const one = findEmbargo(loaded.embargoes, options.number);
    if (one === null) {
      io.warn(`refused: ${options.number} is not an embargo the register holds`);
      return REFUSED;
    }
    return reportOne(one, context, loaded, options, io);
  }

  const held = standing(loaded.embargoes, at);
  const broken = checkMovements(held, context);
  const stale = reviewFindings(held, at);

  if (options.json === true) {
    io.say(
      asJson({
        at: formatInstant(loaded.zone, at),
        standing: held.map((one) => ({
          number: one.number,
          reach: one.reach,
          lots: lotsHeld(one, context),
        })),
        findings: [...broken.list(), ...stale.list()],
      }),
    );
    return broken.hasError() ? FOUND : OK;
  }

  io.say(heading(`Embargoes standing at ${formatInstant(loaded.zone, at)}`));
  if (held.length === 0) {
    io.say('');
    io.say('Nothing is held.');
    return OK;
  }
  io.say('');
  io.say(
    renderTable(
      HELD_COLUMNS,
      held.map((one) => ({
        number: one.number,
        reach: one.reach.replace('by ', ''),
        names: namesOf(one),
        issued: formatInstant(loaded.zone, one.issuedAt),
        lots: lotsHeld(one, context).join(', ') || 'nothing yet',
      })),
    ),
  );
  for (const problem of [...broken.list(), ...stale.list()]) {
    io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
  }
  return broken.hasError() ? FOUND : OK;
}

function reportOne(one, context, loaded, options, io) {
  const lots = lotsHeld(one, context);
  if (options.json === true) {
    io.say(
      asJson({
        number: one.number,
        reach: one.reach,
        names: namesOf(one),
        issuedAt: formatInstant(loaded.zone, one.issuedAt),
        releasedAt: one.releasedAt === null ? null : formatInstant(loaded.zone, one.releasedAt),
        releasedBy: one.releasedBy,
        lots,
      }),
    );
    return lots.length > 0 ? FOUND : OK;
  }
  io.say(heading(`${one.number}`));
  io.say(
    definitionList([
      ['Reaches', one.reach],
      ['Names', namesOf(one)],
      ['Issued', formatInstant(loaded.zone, one.issuedAt)],
      [
        'Released',
        one.releasedAt === null
          ? 'not released'
          : `${formatInstant(loaded.zone, one.releasedAt)} by ${one.releasedBy}`,
      ],
      ['Reason', one.reason ?? 'none written down'],
      ['Lots held now', lots.length === 0 ? 'none' : lots.join(', ')],
    ]),
  );
  return lots.length > 0 ? FOUND : OK;
}

function namesOf(one) {
  if (one.reach === 'by lot') {
    return one.lots.join(', ');
  }
  if (one.reach === 'by dealer') {
    return one.dealers.join(', ');
  }
  return one.area;
}
