/**
 * cullring, the shellfish sanitation programme.
 *
 * Every package is exposed as a namespace rather than a flat set of names.
 * There are well over a hundred exported functions in here and a flat surface
 * would have collided on contains, standing, latestFor and checkRegister
 * inside the first year, so the namespace is the interface and
 * tools/check_exports.js holds it to the tree.
 *
 * The order below is alphabetical rather than layered on purpose. The layering
 * is in docs/design.md, where it can be explained; a list of exports that tried
 * to show it would only go stale.
 */

export * as area from './area/index.js';
export * as cli from './cli/index.js';
export * as condition from './condition/index.js';
export * as core from './core/index.js';
export * as geo from './geo/index.js';
export * as harvest from './harvest/index.js';
export * as io from './io/index.js';
export * as licence from './licence/index.js';
export * as report from './report/index.js';
export * as survey from './survey/index.js';
export * as text from './text/index.js';
export * as tide from './tide/index.js';
export * as time from './time/index.js';
export * as trace from './trace/index.js';
export * as treatment from './treatment/index.js';
export * as vibrio from './vibrio/index.js';
export * as weather from './weather/index.js';
