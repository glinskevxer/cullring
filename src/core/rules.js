/**
 * Every rule the programme applies, and which other rules decide what it
 * measures.
 *
 * The catalogue says what a finding code means. Nothing until now said which
 * rules exist, and in a programme whose whole difficulty is that the rules
 * select each other, that is the thing worth writing down. A sanitarian asked
 * why an area is shut wants the chain, and the chain is not visible in any one
 * module: the classification chose the standard, the standard was scored
 * against the samples, the samples were qualified by the plan's trigger, and
 * the plan exists because of the classification.
 *
 * Each rule names the codes it can raise, so a code raised by two unrelated
 * rules is caught, and the `decidedBy` list is the composition map. Neither is
 * derived from the source: both are written here and checked against it, which
 * is the only arrangement where a rule quietly losing its teeth is noticed.
 */

import { InputError } from './errors.js';
import { codes as catalogueCodes, isKnownCode } from './catalogue.js';

const RULES = new Map(
  Object.entries({
    'register holds together': {
      module: 'src/area/consistency.js',
      says: 'everything the register names exists, and every position is where it says it is',
      raises: ['register', 'locate'],
      decidedBy: [],
    },
    'the register is readable': {
      module: 'src/io/load.js',
      says: 'the case directory parses into records the rest of the programme can read',
      raises: ['case', 'csv', 'load', 'schema', 'migrate'],
      decidedBy: [],
    },
    'the classification in force': {
      module: 'src/area/effective.js',
      says: 'what class an area is in at a moment, once the plan and any order are read',
      raises: ['area', 'order'],
      decidedBy: ['the management plan', 'emergency orders'],
    },
    'the management plan': {
      module: 'src/condition/closure.js',
      says: 'whether a conditional area is shut, and what reopens it',
      raises: [],
      decidedBy: ['the classification in force'],
    },
    'emergency orders': {
      module: 'src/condition/emergency.js',
      says: 'an order beats the register and the plan for as long as it stands',
      raises: [],
      decidedBy: [],
    },
    'the survey verdict': {
      module: 'src/survey/evaluate.js',
      says: 'what class the samples support, walked from the strictest down',
      raises: ['survey', 'duplicate', 'laboratory'],
      decidedBy: ['the sampling strategy', 'the adverse condition', 'the shoreline cap'],
    },
    'the sampling strategy': {
      module: 'src/survey/strategy.js',
      says: 'which criteria are scored and how a censored result is read',
      raises: [],
      decidedBy: [],
    },
    'the adverse condition': {
      module: 'src/survey/conditions.js',
      says: 'an adverse survey may only read samples taken while the trigger was firing',
      raises: ['conditions'],
      decidedBy: ['the management plan'],
    },
    'the shoreline cap': {
      module: 'src/survey/shoreline.js',
      says: 'the survey caps what the samples can support, whatever they say',
      raises: [],
      decidedBy: [],
    },
    'the sampling programme': {
      module: 'src/survey/schedule.js',
      says: 'how often each station is sampled, and which are due',
      raises: ['schedule', 'rotation', 'review'],
      decidedBy: ['the classification in force'],
    },
    'harvest legality': {
      module: 'src/harvest/legality.js',
      says: 'whether one lot was lawfully taken, by water, person, ground, season and size',
      raises: ['harvest', 'cull', 'seed', 'limit'],
      decidedBy: [
        'the classification in force',
        'the licence',
        'the lease',
        'time to temperature',
        'the dealer certification',
      ],
    },
    'the licence': {
      module: 'src/licence/harvester.js',
      says: 'whether a licence was current, unsuspended and endorsed for the gear',
      raises: ['renewal'],
      decidedBy: [],
    },
    'the lease': {
      module: 'src/area/lease.js',
      says: 'who held the ground on the day, and whether the lease was suspended',
      raises: ['lease'],
      decidedBy: ['the classification in force'],
    },
    'time to temperature': {
      module: 'src/vibrio/compliance.js',
      says: 'how long a lot had, counted from where the gear says the clock starts',
      raises: ['vibrio'],
      decidedBy: [],
    },
    'the dealer certification': {
      module: 'src/licence/dealer.js',
      says: 'a dealer may only do what the certification lists',
      raises: ['book', 'inspection'],
      decidedBy: ['the classification in force'],
    },
    'the treatment': {
      module: 'src/treatment/depuration.js',
      says: 'restricted product is legal only after relay or depuration',
      raises: ['depuration', 'relay', 'wet'],
      decidedBy: ['the classification in force', 'the dealer certification'],
    },
    'the tag': {
      module: 'src/harvest/tag.js',
      says: 'what has to be written on a container, which depends on the form',
      raises: ['tag', 'ship'],
      decidedBy: [],
    },
    'the trace': {
      module: 'src/trace/trace.js',
      says: 'where a lot came from and everywhere it went',
      raises: ['trace', 'audit', 'advisory'],
      decidedBy: ['the tag'],
    },
    'what the case can answer': {
      module: 'src/report/coverage.js',
      says: 'which reports are narrower than they look because a register is not there',
      raises: ['coverage'],
      decidedBy: ['the register is readable'],
    },
    'the embargo': {
      module: 'src/harvest/embargo.js',
      says: 'product named by an embargo does not move until somebody signs a release',
      raises: ['embargo'],
      decidedBy: ['the trace'],
    },
  }),
);

export function ruleNames() {
  return Array.from(RULES.keys()).sort();
}

export function rule(name) {
  const found = RULES.get(name);
  if (found === undefined) {
    throw new InputError('rules.unknown', `${name} is not a rule this programme keeps`, { name });
  }
  return Object.freeze({ name, ...found });
}

export function rules() {
  return ruleNames().map((name) => rule(name));
}

/** The rule that owns a finding family, or nothing where none does. */
export function ruleForFamily(family) {
  for (const one of rules()) {
    if (one.raises.includes(family)) {
      return one.name;
    }
  }
  return null;
}

/** Every family the registry claims, which is what the catalogue is held to. */
export function claimedFamilies() {
  return Array.from(new Set(rules().flatMap((one) => one.raises))).sort();
}

/**
 * What is wrong with the registry itself. It is a check rather than a set of
 * throws in the builder because all three of these go wrong by omission, and
 * an omission cannot throw.
 */
export function registryProblems() {
  const trouble = [];
  const names = new Set(ruleNames());
  const seen = new Map();

  for (const one of rules()) {
    for (const dependency of one.decidedBy) {
      if (!names.has(dependency)) {
        trouble.push(`${one.name} is decided by ${dependency}, which is not a rule`);
      }
      if (dependency === one.name) {
        trouble.push(`${one.name} is decided by itself`);
      }
    }
    for (const family of one.raises) {
      const owner = seen.get(family);
      if (owner !== undefined) {
        trouble.push(`the ${family} family is claimed by both ${owner} and ${one.name}`);
      }
      seen.set(family, one.name);
    }
  }

  const claimed = new Set(claimedFamilies());
  for (const code of catalogueCodes()) {
    const family = code.slice(0, code.indexOf('.') < 0 ? code.length : code.indexOf('.'));
    if (!claimed.has(family)) {
      trouble.push(`${code} is in the catalogue and no rule claims the ${family} family`);
    }
  }
  for (const family of claimed) {
    if (!catalogueCodes().some((code) => code.startsWith(`${family}.`))) {
      trouble.push(`the ${family} family is claimed by a rule and the catalogue holds none of it`);
    }
  }

  return trouble.sort();
}

/**
 * The chain behind one rule, deepest first, which is what an appeal is argued
 * over. A rule that reaches itself through the chain is a design mistake and
 * the walk says so rather than looping.
 */
export function chainFor(name, seen = new Set()) {
  if (seen.has(name)) {
    return [`${name} (already reached, so the chain loops)`];
  }
  seen.add(name);
  const one = rule(name);
  const out = [];
  for (const dependency of one.decidedBy) {
    out.push(...chainFor(dependency, seen));
  }
  out.push(name);
  return Array.from(new Set(out));
}

/** The document under docs/, written from the registry and checked against it. */
export function renderRulesDocument() {
  const out = [
    '# The rules',
    '',
    'Generated from `src/core/rules.js` by `npm run write:rules`. Every rule the',
    'programme applies, the finding families it raises, and the rules that decide',
    'what it measures.',
    '',
  ];
  for (const one of rules()) {
    out.push(`## ${one.name}`);
    out.push('');
    out.push(one.says);
    out.push('');
    out.push(`- Lives in \`${one.module}\``);
    out.push(
      one.raises.length === 0
        ? '- Raises nothing of its own'
        : `- Raises ${one.raises.map((family) => `\`${family}.*\``).join(', ')}`,
    );
    out.push(
      one.decidedBy.length === 0
        ? '- Decided by nothing else'
        : `- Decided by ${one.decidedBy.join(', ')}`,
    );
    out.push('');
  }
  return out.join('\n');
}

/** True where the code names a family some rule claims. */
export function isClaimed(code) {
  if (!isKnownCode(code)) {
    return false;
  }
  const at = code.indexOf('.');
  return claimedFamilies().includes(at < 0 ? code : code.slice(0, at));
}
