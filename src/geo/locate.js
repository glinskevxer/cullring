/**
 * Which area a position is in, when more than one boundary says it is theirs.
 *
 * Boundaries are drawn on a chart by people, over decades, and they overlap.
 * Two areas were split out of one and both kept the parent's western line. A
 * creek was given to the area that manages the plant upstream and never taken
 * off the area that holds the mouth. Neither is a drafting error anybody is
 * going to fix, so the programme has to be able to answer the question anyway.
 *
 * It answers it the only way that is defensible: where two classified areas
 * both claim a position, the stricter classification governs. That is not a
 * geometric rule and it cannot be, because the geometry is what is in dispute.
 * It also means the answer moves when either area is reclassified, so the
 * result carries the day it was worked out for and the areas it was contested
 * between, and a caller that wants the geometry alone can ask for that instead.
 */

import { findings } from '../core/finding.js';
import { classificationOn, findArea } from '../area/growingArea.js';
import { rankOf } from '../area/classification.js';
import { toPoint } from './point.js';
import { contains, nearestCornerMetres, onEdge } from './polygon.js';

/** How far outside a line a position may sit and still be called inside it. */
export const EDGE_METRES = 25;

export const IN_ONE = 'in one drawn area';
export const CONTESTED = 'claimed by more than one area';
export const UNPLACED = 'in no area the register draws';

/** Every boundary that holds the position, by area, in register order. */
export function claimants(boundaries, position, { edgeMetres = EDGE_METRES } = {}) {
  const where = toPoint(position, 'position');
  return boundaries
    .filter((drawn) => contains(drawn, where, { edgeMetres }))
    .map((drawn) => drawn.areaId);
}

/**
 * The area that governs a position on a day. Contested positions are settled
 * by classification and then, only if that ties, by area id, so that two runs
 * of the same case give the same answer.
 */
export function locate(position, { boundaries = [], areas = [], on, edgeMetres = EDGE_METRES }) {
  const where = toPoint(position, 'position');
  const claimed = claimants(boundaries, where, { edgeMetres });

  if (claimed.length === 0) {
    return Object.freeze({
      position: where,
      verdict: UNPLACED,
      areaId: null,
      classification: null,
      claimed: Object.freeze([]),
      settledBy: null,
      on,
    });
  }

  const ranked = claimed
    .map((areaId) => {
      const area = findArea(areas, areaId);
      const held = area === null ? null : classificationOn(area, on);
      return { areaId, classification: held, rank: held === null ? -1 : rankOf(held) };
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return right.rank - left.rank;
      }
      return left.areaId < right.areaId ? -1 : 1;
    });

  const governing = ranked[0];
  return Object.freeze({
    position: where,
    verdict: claimed.length === 1 ? IN_ONE : CONTESTED,
    areaId: governing.areaId,
    classification: governing.classification,
    claimed: Object.freeze(claimed.slice()),
    settledBy: claimed.length === 1 ? null : settlement(ranked),
    on,
  });
}

/** Whether the strictest claim stood alone, or the id had to break a tie. */
function settlement(ranked) {
  return ranked.length > 1 && ranked[0].rank === ranked[1].rank
    ? 'the lower area id, because the classifications tie'
    : 'the stricter classification';
}

/**
 * Every pair of boundaries that claim ground in common, found by testing each
 * one's corners against the other. That is a sample rather than a proof: two
 * shapes can cross without either one's corner falling inside the other. It is
 * said out loud in the result, because a coverage report that quietly implies
 * it looked at the whole plane is worse than one that says what it tried.
 *
 * A corner that lands on the other boundary's line does not count. Two areas
 * that share a line are adjacent, which is what most of the register is, and a
 * check that called every neighbour an overlap would fire on nearly every pair
 * and be read by nobody.
 */
export function overlappingPairs(boundaries, { edgeMetres = EDGE_METRES } = {}) {
  const pairs = [];
  for (let i = 0; i < boundaries.length; i += 1) {
    for (let j = i + 1; j < boundaries.length; j += 1) {
      const left = boundaries[i];
      const right = boundaries[j];
      const inRight = left.vertices.filter((corner) =>
        strictlyInside(right, corner, edgeMetres),
      ).length;
      const inLeft = right.vertices.filter((corner) =>
        strictlyInside(left, corner, edgeMetres),
      ).length;
      if (inRight > 0 || inLeft > 0) {
        pairs.push(
          Object.freeze({
            left: left.areaId,
            right: right.areaId,
            corners: inRight + inLeft,
            tested: 'corners only',
          }),
        );
      }
    }
  }
  return pairs;
}

/**
 * Stations that sit inside somebody else's boundary. The register check
 * already reports a station outside the area it is registered to. This is the
 * stronger version of that finding: the position is not merely off the line,
 * it is squarely in another classified area, which means the samples have been
 * scored against the wrong standard for as long as the station has existed.
 */
export function misplacedStations({
  stations = [],
  boundaries = [],
  areas = [],
  on,
  edgeMetres = EDGE_METRES,
}) {
  const problems = findings();
  for (const station of stations) {
    if (station.latitude === undefined || station.longitude === undefined) {
      continue;
    }
    const placed = locate(station, { boundaries, areas, on, edgeMetres });
    if (placed.verdict === UNPLACED) {
      const drawn = boundaries.find((one) => one.areaId === station.areaId);
      problems.warn(
        'locate.unplaced',
        `station ${station.id} is in no drawn area at all`,
        drawn === undefined
          ? { station: station.id, area: station.areaId }
          : {
              station: station.id,
              area: station.areaId,
              cornerFeet: Math.round(nearestCornerMetres(drawn, station) / 0.3048),
            },
      );
      continue;
    }
    if (!placed.claimed.includes(station.areaId)) {
      problems.error(
        'locate.otherArea',
        `station ${station.id} is registered to ${station.areaId} and sits in ${placed.areaId}`,
        { station: station.id, registered: station.areaId, drawn: placed.areaId },
      );
      continue;
    }
    if (placed.verdict === CONTESTED && placed.areaId !== station.areaId) {
      problems.note(
        'locate.contested',
        `station ${station.id} is claimed by ${placed.claimed.join(' and ')}, and ${placed.areaId} governs`,
        { station: station.id, claimed: placed.claimed.slice(), governing: placed.areaId },
      );
    }
  }
  return problems;
}

/** The overlap findings for a whole register, which the validate report prints. */
export function overlapFindings(boundaries, { edgeMetres = EDGE_METRES } = {}) {
  const problems = findings();
  for (const pair of overlappingPairs(boundaries, { edgeMetres })) {
    problems.warn(
      'locate.overlap',
      `${pair.left} and ${pair.right} both claim ground, so a position in it is settled by classification`,
      { left: pair.left, right: pair.right, corners: pair.corners },
    );
  }
  return problems;
}

/** Inside the line rather than on it, which is the difference between an overlap and a neighbour. */
function strictlyInside(shape, corner, edgeMetres) {
  return contains(shape, corner, { edgeMetres }) && !onEdge(shape, corner, edgeMetres);
}
