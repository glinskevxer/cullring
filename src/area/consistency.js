/**
 * Whether the register holds together, which nothing else asks.
 *
 * Every other check in the programme reads the register to answer a question
 * about water or a lot. This one asks about the register itself, and it is the
 * only place that would ever notice a station typed into the wrong area: the
 * sampling programme would happily sample it, the survey would happily score
 * it, and the area would be reclassified on ten years of somebody else's data.
 *
 * The checks are all of one shape: something names something else, and the
 * thing named either exists or does not. Where a boundary is drawn the check
 * is stronger, because then the position can be argued with as well as the
 * name.
 */

import { findings } from '../core/finding.js';
import { parseAreaId } from '../core/identity.js';
import { boundaryFor, contains, nearestCornerMetres } from '../geo/polygon.js';
import { metresToFeet } from '../geo/point.js';
import { misplacedStations, overlapFindings } from '../geo/locate.js';
import { classificationOn } from './growingArea.js';
import { isConditional } from './classification.js';

/** How far outside a boundary a station has to be before it is worth a finding. */
export const EDGE_TOLERANCE_METRES = 25;

export function checkRegister({
  areas,
  stations = [],
  beds = [],
  plans = [],
  sources = [],
  boundaries = [],
  tides = [],
  on,
}) {
  const problems = findings();
  const known = new Set(areas.map((one) => one.id));
  const predicted = new Set(tides.map((one) => one.station));

  for (const plan of plans) {
    if (!known.has(plan.area)) {
      problems.error('register.planArea', `a plan names ${plan.area}, which is not an area`, {
        area: plan.area,
      });
    }
  }

  for (const area of areas) {
    const held = classificationOn(area, on);
    if (held !== null && isConditional(held) && !plans.some((plan) => plan.area === area.id)) {
      problems.error('register.noPlan', `${area.id} is ${held} and carries no plan at all`, {
        area: area.id,
        classification: held,
      });
    }
  }

  for (const station of stations) {
    if (!known.has(station.areaId)) {
      problems.error(
        'register.stationArea',
        `${station.id} sits in ${station.areaId}, which is not an area`,
        { station: station.id, area: station.areaId },
      );
      continue;
    }
    const strayed = outsideBy(boundaries, station.areaId, station);
    if (strayed !== null) {
      problems.error(
        'register.stationOutside',
        `${station.id} is outside the boundary of ${station.areaId}, about ${strayed} feet from the nearest corner`,
        { station: station.id, area: station.areaId, feet: strayed },
      );
    }
  }

  for (const bed of beds) {
    if (!known.has(bed.areaId)) {
      problems.error('register.bedArea', `${bed.id} sits in ${bed.areaId}, which is not an area`, {
        bed: bed.id,
        area: bed.areaId,
      });
    }
    if (predicted.size > 0 && !predicted.has(bed.tideStation)) {
      problems.warn(
        'register.bedTide',
        `${bed.id} reads ${bed.tideStation}, which the tide table does not predict`,
        { bed: bed.id, station: bed.tideStation },
      );
    }
  }

  for (const source of sources) {
    if (!known.has(parseAreaId(source.areaId, 'areaId').id)) {
      problems.error(
        'register.sourceArea',
        `${source.id} sits in ${source.areaId}, which is not an area`,
        { source: source.id, area: source.areaId },
      );
      continue;
    }
    const strayed = outsideBy(boundaries, source.areaId, source);
    if (strayed !== null) {
      problems.error(
        'register.sourceOutside',
        `${source.id} is outside the boundary of ${source.areaId}, about ${strayed} feet from the nearest corner`,
        { source: source.id, area: source.areaId, feet: strayed },
      );
    }
  }

  for (const drawn of boundaries) {
    if (!known.has(drawn.areaId)) {
      problems.error(
        'register.boundaryArea',
        `a boundary is drawn for ${drawn.areaId}, which is not an area`,
        { area: drawn.areaId },
      );
    }
  }

  problems.absorb(overlapFindings(boundaries, { edgeMetres: EDGE_TOLERANCE_METRES }));
  problems.absorb(
    misplacedStations({
      stations,
      boundaries,
      areas,
      on,
      edgeMetres: EDGE_TOLERANCE_METRES,
    }),
  );

  return Object.freeze({
    on,
    areas: areas.length,
    checked: stations.length + beds.length + sources.length,
    boundaries: boundaries.length,
    holds: problems.isLawful(),
    problems,
  });
}

/**
 * How far outside its own boundary a position is, in feet, or nothing where it
 * is inside or where no boundary is drawn. An area with nothing drawn cannot
 * be argued with, and that is not a pass: it is a register where this check
 * has nothing to say, which the coverage figure reports separately.
 *
 * The finding codes are written out in full at each call site rather than
 * built from the kind. A code assembled by interpolation cannot be found by
 * anybody grepping for it, which includes the check that holds the catalogue
 * to the source, and that check found this.
 */
function outsideBy(boundaries, areaId, position) {
  const drawn = boundaryFor(boundaries, areaId);
  if (drawn === null) {
    return null;
  }
  if (contains(drawn, position, { edgeMetres: EDGE_TOLERANCE_METRES })) {
    return null;
  }
  return Math.round(metresToFeet(nearestCornerMetres(drawn, position)));
}

/** How much of the register can be argued with by position rather than by name. */
export function boundaryCoverage(areas, boundaries) {
  const drawn = new Set(boundaries.map((one) => one.areaId));
  const covered = areas.filter((one) => drawn.has(one.id));
  return Object.freeze({
    areas: areas.length,
    drawn: covered.length,
    missing: areas.filter((one) => !drawn.has(one.id)).map((one) => one.id),
    share: areas.length === 0 ? 0 : covered.length / areas.length,
  });
}
