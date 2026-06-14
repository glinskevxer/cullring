/**
 * The renewals command, which is the letter run.
 *
 * It prints one row per grower the office has to write to, and the row says
 * what the letter is about. A grower whose licence and certificate both need
 * attention appears once, because that is one envelope.
 */

import { LEFT, column, definitionList, heading, renderTable } from '../../text/table.js';
import { GONE, IN_GRACE, mayRenew, renewalRound } from '../../licence/renewal.js';
import { findHarvester } from '../../licence/harvester.js';
import { formatCivilDate } from '../../time/civil.js';
import { loadCase } from '../context.js';
import { dayOf } from '../moment.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

const ROUND_COLUMNS = [
  column('harvester', 'Licence', { width: 15 }),
  column('name', 'Name', { width: 16 }),
  column('state', 'Licence stands', { width: 32 }),
  column('expires', 'Expires', { width: 11 }),
  column('education', 'Certificate', { width: 12 }),
  column('may', 'May renew', { align: LEFT, width: 10 }),
];

export function renewals(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);

  if (options.harvester !== undefined && options.harvester !== null) {
    return reportOne(loaded, on, options, io);
  }

  const round = renewalRound(loaded.harvesters, {
    certificates: loaded.certificates ?? [],
    on,
    ...(options.notice === undefined ? {} : { noticeDays: Number(options.notice) }),
  });

  if (options.json === true) {
    io.say(
      asJson({
        on: formatCivilDate(on),
        letters: round.rows.length,
        rows: round.rows,
        findings: round.problems.list(),
      }),
    );
    return round.problems.hasError() ? FOUND : OK;
  }

  io.say(heading(`Renewals as at ${formatCivilDate(on)}`));
  io.say('');
  io.say(
    definitionList([
      ['Licences on file', String(loaded.harvesters.length)],
      ['Letters to write', String(round.rows.length)],
      ['In the grace period', String(round.rows.filter((one) => one.state === IN_GRACE).length)],
      ['Past the grace period', String(round.rows.filter((one) => one.state === GONE).length)],
    ]),
  );
  if (round.rows.length === 0) {
    io.say('');
    io.say('Nobody has to be written to.');
    return OK;
  }
  io.say('');
  io.say(
    renderTable(
      ROUND_COLUMNS,
      round.rows.map((row) => ({
        harvester: row.harvester,
        name: row.name,
        state: row.state,
        expires: row.expiresOn,
        education: row.education,
        may: row.mayRenew ? 'yes' : 'no',
      })),
    ),
  );
  for (const problem of round.problems.list()) {
    io.warn(`${problem.severity}: ${problem.code}: ${problem.message}`);
  }
  return round.problems.hasError() ? FOUND : OK;
}

function reportOne(loaded, on, options, io) {
  const found = findHarvester(loaded.harvesters, options.harvester);
  if (found === null) {
    io.warn(`refused: ${options.harvester} is not in the register`);
    return REFUSED;
  }
  const answer = mayRenew(found, { certificates: loaded.certificates ?? [], on });
  if (options.json === true) {
    io.say(
      asJson({
        harvester: found.id,
        on: formatCivilDate(on),
        standing: answer.standing.state,
        daysLeft: answer.standing.daysLeft,
        graceEndsOn:
          answer.standing.graceEndsOn === null
            ? null
            : formatCivilDate(answer.standing.graceEndsOn),
        education: answer.education.state,
        suspended: answer.suspended,
        mayRenew: answer.mayRenew,
        because: answer.because,
      }),
    );
    return answer.mayRenew ? OK : FOUND;
  }
  io.say(heading(`${found.id} ${found.name}`));
  io.say(
    definitionList([
      ['Expires', formatCivilDate(found.expiresOn)],
      ['On', formatCivilDate(on)],
      ['Licence stands', answer.standing.state],
      [
        'Grace runs to',
        answer.standing.graceEndsOn === null ? '-' : formatCivilDate(answer.standing.graceEndsOn),
      ],
      ['Certificate', answer.education.state],
      ['Suspended', answer.suspended ? 'yes, and renewal does not lift it' : 'no'],
      ['May renew', answer.mayRenew ? 'yes' : `no: ${answer.because.join('; ')}`],
    ]),
  );
  return answer.mayRenew ? OK : FOUND;
}
