/**
 * The diff command, which walks the same case twice and says what moved.
 *
 * The two walks are of the same register at two different days, so anything
 * that comes out different is either the water doing something or the register
 * having been edited. That is the useful pair. Two walks of two different
 * registers would be a different tool and a much less useful one, because
 * everything would be different and nothing would stand out.
 *
 * A saved seal can stand in for the earlier walk, which is how this is used in
 * practice: the office seals the monthly walk, files it, and next month asks
 * what moved. A seal carries no lines, so the answer is a list of pieces, and
 * the report says that is all it had rather than showing an empty diff.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { diffReport, renderDiff } from '../../report/diff.js';
import { seal, sealFromJson, sealToJson } from '../../core/seal.js';
import { parseCivilDate } from '../../time/civil.js';
import { walkPieces } from './month.js';
import { loadCase } from '../context.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';

export function diff(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const after = readDay(options.after ?? options.on, io);
  if (after === null) {
    return REFUSED;
  }
  const afterPieces = walkPieces(loaded, after);

  const earlier = earlierWalk(options, loaded, io);
  if (earlier === null) {
    return REFUSED;
  }

  const report = diffReport({
    before: earlier.seal,
    after: seal(afterPieces),
    beforePieces: earlier.pieces,
    afterPieces,
  });

  if (options.save !== undefined && options.save !== null) {
    writeFileSync(options.save, sealToJson(seal(afterPieces)), 'utf8');
  }

  if (options.json === true) {
    io.say(
      asJson({
        same: report.same,
        before: report.beforeDigest,
        after: report.afterDigest,
        lines: report.haveText,
        pieces: report.pieces.map((one) => ({
          name: one.name,
          what: one.what,
          added: one.added,
          removed: one.removed,
        })),
      }),
    );
    return report.same ? OK : FOUND;
  }

  io.say(renderDiff(report, { context: readContext(options) }));
  return report.same ? OK : FOUND;
}

/**
 * Where the earlier walk comes from. A seal file wins over a date, because a
 * caller who gives both has a filed seal and wants it, and quietly walking the
 * date instead would compare the wrong thing without saying so.
 */
function earlierWalk(options, loaded, io) {
  if (options.seal !== undefined && options.seal !== null) {
    if (!existsSync(options.seal)) {
      io.warn(`refused: ${options.seal} is not a file`);
      return null;
    }
    try {
      return { seal: sealFromJson(readFileSync(options.seal, 'utf8')), pieces: null };
    } catch (error) {
      io.warn(`refused: ${options.seal} is not a seal: ${error.message}`);
      return null;
    }
  }
  const before = readDay(options.before, io);
  if (before === null) {
    return null;
  }
  const pieces = walkPieces(loaded, before);
  return { seal: seal(pieces), pieces };
}

function readDay(text, io) {
  if (text === undefined || text === null) {
    io.warn('refused: a diff needs two days, or a seal and a day');
    return null;
  }
  try {
    return parseCivilDate(text, 'day');
  } catch (error) {
    io.warn(`refused: ${error.message}`);
    return null;
  }
}

function readContext(options) {
  const given = Number(options.context);
  return Number.isInteger(given) && given >= 0 ? given : 2;
}
