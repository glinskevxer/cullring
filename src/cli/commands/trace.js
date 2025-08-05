/**
 * The trace commands, which are the ones that get read outside this office.
 *
 * Backwards from a lot to the water, forwards from a lot to the consignees,
 * and the recall, which is the forward walk run over everything that came out
 * of one area in a period. The recall is the one that matters at two in the
 * morning, so it takes the same options as everything else rather than a
 * special shape of its own.
 */

import { recall, traceBack, traceForward } from '../../trace/trace.js';
import { renderRecall, renderTraceBack, renderTraceForward } from '../../report/trace.js';
import { findArea } from '../../area/growingArea.js';
import { MIDNIGHT, addDays, parseCivilDate } from '../../time/civil.js';
import { instantFromCivil } from '../../time/instant.js';
import { window } from '../../time/window.js';
import { loadCase } from '../context.js';
import { OK, REFUSED, asJson } from '../output.js';

export function trace(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  if (!loaded.book.lots().includes(options.lot)) {
    io.warn(`refused: ${options.lot} is not in the ledger`);
    return REFUSED;
  }
  const walk = traceBack(loaded.book, options.lot, { records: loaded.records });
  if (options.json === true) {
    io.say(
      asJson({
        lot: walk.lot,
        chain: walk.chain,
        origin: walk.origin,
        area: walk.areaId,
        bed: walk.bed,
        harvestedOn: walk.harvestedOn,
        stoppedAt: walk.stoppedAt,
        complete: walk.complete,
        findings: walk.problems.list(),
      }),
    );
    return walk.complete ? OK : 1;
  }
  io.say(renderTraceBack(loaded.book, options.lot, { records: loaded.records, zone: loaded.zone }));
  return walk.complete ? OK : 1;
}

export function forward(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  if (!loaded.book.lots().includes(options.lot)) {
    io.warn(`refused: ${options.lot} is not in the ledger`);
    return REFUSED;
  }
  const walk = traceForward(loaded.book, options.lot);
  if (options.json === true) {
    io.say(
      asJson({
        lot: walk.lot,
        reached: walk.reached,
        parties: walk.parties,
        shipments: walk.shipments.map((one) => ({
          lot: one.lot,
          dealer: one.dealer,
          toParty: one.toParty,
        })),
      }),
    );
    return OK;
  }
  io.say(renderTraceForward(loaded.book, options.lot, { zone: loaded.zone }));
  return OK;
}

export function recallCommand(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return REFUSED;
  }
  const span = periodOf(options, loaded.zone);
  const answer = recall(loaded.book, {
    areaId: area.id,
    span,
    records: loaded.records,
  });
  if (options.json === true) {
    io.say(
      asJson({
        area: area.id,
        lots: answer.lots,
        parties: answer.parties,
        findings: answer.problems.list(),
      }),
    );
    return answer.lots.length === 0 ? OK : 1;
  }
  io.say(
    renderRecall(loaded.book, {
      areaId: area.id,
      span,
      records: loaded.records,
      zone: loaded.zone,
    }),
  );
  return answer.lots.length === 0 ? OK : 1;
}

/**
 * The period a recall covers. It defaults to the whole day named rather than
 * to a moment, because a recall asked about the fourteenth means the whole of
 * the fourteenth and nobody types midnight to midnight.
 */
export function periodOf(options, zone) {
  const from = parseCivilDate(options.from ?? options.on, 'from');
  const to =
    options.to === undefined || options.to === null
      ? addDays(from, 1)
      : addDays(parseCivilDate(options.to, 'to'), 1);
  return window(instantFromCivil(zone, from, MIDNIGHT), instantFromCivil(zone, to, MIDNIGHT));
}
