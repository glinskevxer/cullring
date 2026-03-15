/**
 * The where command: hand it a position and it says which water that is.
 *
 * This is the question a patrol boat asks over the radio, and the answer is
 * not purely geometric. Where two areas both claim a position the stricter
 * classification governs, so the answer depends on the day and it says which
 * day it was worked out for. Where nothing claims it, the command says that
 * rather than picking the nearest line, because the nearest line is exactly
 * the guess that puts a lot in the wrong area.
 */

import { CONTESTED, UNPLACED, locate } from '../../geo/locate.js';
import { describePosition, distanceNauticalMiles } from '../../geo/point.js';
import { effectiveClassification } from '../../area/effective.js';
import { findArea } from '../../area/growingArea.js';
import { formatCivilDate } from '../../time/civil.js';
import { harvestAllowed } from '../../area/classification.js';
import { dayOf, momentOf, walkStart } from '../moment.js';
import { loadCase } from '../context.js';
import { FOUND, OK, REFUSED, asJson } from '../output.js';
import { definitionList, heading } from '../../text/table.js';
import { decimal } from '../../text/format.js';

export function where(options, io) {
  const position = readPosition(options);
  if (position === null) {
    io.warn('refused: a position is written 34.7112,-76.6841, latitude first');
    return REFUSED;
  }
  const loaded = loadCase(options.case, { zone: options.zone });
  const on = dayOf(options, loaded.zone);
  const at = momentOf(options, loaded.zone);
  const placed = locate(position, {
    boundaries: loaded.boundaries,
    areas: loaded.areas,
    on,
  });

  if (placed.verdict === UNPLACED) {
    return reportUnplaced(placed, loaded, options, io);
  }

  const area = findArea(loaded.areas, placed.areaId);
  const standing = effectiveClassification({
    area,
    plans: loaded.plans,
    feed: loaded.feed,
    orders: loaded.orders,
    at,
    from: walkStart(options, loaded.zone, at),
  });
  const open = harvestAllowed(standing.effective) && !standing.closed;

  if (options.json === true) {
    io.say(
      asJson({
        position: { latitude: position.latitude, longitude: position.longitude },
        on: formatCivilDate(on),
        area: area.id,
        name: area.name,
        claimed: placed.claimed,
        settledBy: placed.settledBy,
        classification: standing.effective,
        open,
        closed: standing.closed,
        because: becauseOf(standing),
      }),
    );
    return open ? OK : FOUND;
  }

  io.say(heading(`${describePosition(position)} on ${formatCivilDate(on)}`));
  const lines = [
    ['Area', `${area.id}, ${area.name}`],
    ['Classification', standing.effective],
    ['Open to harvest', open ? 'yes' : 'no'],
    ['Because', becauseOf(standing)],
  ];
  if (placed.verdict === CONTESTED) {
    lines.push(['Also claimed by', placed.claimed.filter((one) => one !== area.id).join(', ')]);
    lines.push(['Settled by', placed.settledBy]);
  }
  io.say(definitionList(lines));
  return open ? OK : FOUND;
}

function reportUnplaced(placed, loaded, options, io) {
  const near = nearestDrawn(loaded.boundaries, placed.position);
  if (options.json === true) {
    io.say(
      asJson({
        position: {
          latitude: placed.position.latitude,
          longitude: placed.position.longitude,
        },
        area: null,
        nearest: near === null ? null : near.areaId,
        nauticalMiles: near === null ? null : Number(decimal(near.miles, 2)),
      }),
    );
    return FOUND;
  }
  io.say('That position is in no area the register draws a line around.');
  if (near !== null) {
    io.say(
      `The nearest drawn corner is ${decimal(near.miles, 2)} nautical miles into ${near.areaId}.`,
    );
  }
  io.warn('note: nothing was classified, so nothing here says the water is open');
  return FOUND;
}

function nearestDrawn(boundaries, position) {
  let best = null;
  for (const drawn of boundaries) {
    for (const corner of drawn.vertices) {
      const miles = distanceNauticalMiles(position, corner);
      if (best === null || miles < best.miles) {
        best = { areaId: drawn.areaId, miles };
      }
    }
  }
  return best;
}

/**
 * A position arrives as one argument rather than two, because a longitude in
 * this state starts with a minus sign and a command line reads that as an
 * option before anybody gets a chance to say it is a number.
 */
function readPosition(options) {
  if (typeof options.position !== 'string') {
    return null;
  }
  const parts = options.position.split(/[,s]+/).filter((one) => one !== '');
  if (parts.length !== 2) {
    return null;
  }
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

const BASIS_WORDS = Object.freeze({
  survey: 'the sampling survey',
  shoreline: 'the shoreline survey',
  emergency: 'an emergency',
  order: 'an order of the division',
});

/** The one line the radio wants: which layer decided, not all four of them. */
function becauseOf(standing) {
  if (standing.order !== null) {
    return 'an emergency order, ' + standing.order.number;
  }
  if (standing.closed) {
    return 'the management plan, which is closed';
  }
  if (standing.plan !== null) {
    return 'the management plan, which is open';
  }
  return `the register, classified on ${BASIS_WORDS[standing.basis]}`;
}
