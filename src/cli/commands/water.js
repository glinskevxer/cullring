/**
 * The commands about water: what is open, what shut it, and what will lift it.
 */

import { findArea } from '../../area/growingArea.js';
import { planInForce } from '../../condition/plan.js';
import { closureNotices, renderClosureHistory, renderNotice } from '../../report/closure.js';
import { renderStanding, standingSummary } from '../../report/standing.js';
import { window } from '../../time/window.js';
import { loadCase } from '../context.js';
import { dayOf, spanOf } from '../moment.js';
import { OK, REFUSED, asJson } from '../output.js';

export function standing(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const { at, from } = spanOf(options, loaded.zone);
  const arguments_ = {
    areas: loaded.areas,
    plans: loaded.plans,
    feed: loaded.feed,
    at,
    from,
  };
  if (options.json === true) {
    io.say(asJson(standingSummary(arguments_)));
    return OK;
  }
  io.say(renderStanding({ ...arguments_, zone: loaded.zone }));
  return OK;
}

export function closures(options, io) {
  const found = openArea(options, io);
  if (found === null) {
    return REFUSED;
  }
  const { loaded, area, plan, at, from } = found;
  if (plan === null) {
    io.say(`${area.id} ${area.name} carries no management plan on that day.`);
    return OK;
  }
  io.say(
    renderClosureHistory({
      area,
      plan,
      feed: loaded.feed,
      span: window(from, at),
      zone: loaded.zone,
    }),
  );
  return OK;
}

export function notice(options, io) {
  const found = openArea(options, io);
  if (found === null) {
    return REFUSED;
  }
  const { loaded, area, plan, at, from } = found;
  if (plan === null) {
    io.say(`${area.id} ${area.name} carries no management plan on that day.`);
    return OK;
  }
  const notices = closureNotices({ area, plan, feed: loaded.feed, span: window(from, at) });
  if (notices.length === 0) {
    io.say(`${area.id} ${area.name} has not been shut under its plan in this period.`);
    return OK;
  }
  io.say(renderNotice(notices[notices.length - 1], { zone: loaded.zone }));
  return OK;
}

function openArea(options, io) {
  const loaded = loadCase(options.case, { zone: options.zone });
  const area = findArea(loaded.areas, options.area);
  if (area === null) {
    io.warn(`refused: ${options.area} is not in the register`);
    return null;
  }
  const { at, from } = spanOf(options, loaded.zone);
  const plan = planInForce(loaded.plans, area.id, dayOf(options, loaded.zone));
  return { loaded, area, plan, at, from };
}
