/**
 * The words, and where each of them comes from.
 *
 * Most of this vocabulary is the state rule book's and is not ours to change.
 * A few words are this programme's own, invented because the rule book uses a
 * phrase where the code needs a noun, and those are marked so that nobody
 * quotes them back to a sanitarian as though they were official.
 *
 * The distinction is the reason this is data rather than a markdown file. A
 * check compares the entries against the exported names, so a word the code
 * uses and the glossary does not is found, and so is the reverse.
 */

import { InputError } from './errors.js';

export const RULE_BOOK = 'rule book';
export const OURS = 'ours';

const WORDS = new Map(
  Object.entries({
    'adverse pollution condition sampling': [
      RULE_BOOK,
      'sampling done on purpose when conditions are at their worst, scored on the mean and the highest single result',
    ],
    approved: [RULE_BOOK, 'water shellfish may be taken from and sold from directly'],
    bed: [OURS, 'a named patch of ground inside an area, carrying a tide station and an elevation'],
    'conditionally approved': [
      RULE_BOOK,
      'approved water with a management plan that shuts it on a named trigger',
    ],
    'conditionally restricted': [
      RULE_BOOK,
      'restricted water with a management plan that shuts it on a named trigger',
    ],
    'control season': [OURS, 'the months in which a time to temperature limit applies at all'],
    depuration: [
      RULE_BOOK,
      'holding shellfish in treated water under ultraviolet light for a cycle',
    ],
    'estimated ninetieth percentile': [
      RULE_BOOK,
      'the upper tail of a set, estimated from the spread of the logs rather than counted',
    ],
    'growing area': [RULE_BOOK, 'a classified body of water, the unit everything else hangs off'],
    'management plan': [
      RULE_BOOK,
      'the document binding a conditional area to one trigger and one reopening rule',
    ],
    'most probable number': [
      RULE_BOOK,
      'the count that best explains how many tubes went positive, which at either end is a bound',
    ],
    prohibited: [RULE_BOOK, 'water nothing may be taken from for any purpose but seed and relay'],
    relay: [RULE_BOOK, 'moving shellfish into approved water and leaving them there for a period'],
    restricted: [RULE_BOOK, 'water whose product is legal only after relay or depuration'],
    'shellstock shipper': [
      RULE_BOOK,
      'a dealer certified to receive, ship and wet store shellstock',
    ],
    'shoreline survey': [
      RULE_BOOK,
      'the walk of the bank that records what discharges into the water',
    ],
    'shucker packer': [RULE_BOOK, 'a dealer certified to shuck as well as to receive and ship'],
    'systematic random sampling': [
      RULE_BOOK,
      'sampling on days drawn without regard to the weather, scored on the mean and the estimated tail',
    ],
    'the walk': [
      OURS,
      'stepping down the classification table until one class is met, which is how a proposal is built',
    ],
    'time to temperature': [
      RULE_BOOK,
      'the hours a lot may sit before it must be under refrigeration',
    ],
    'trailing period': [
      OURS,
      'a stretch of time ending at the moment asked about, with that moment included',
    ],
    'wet storage': [
      RULE_BOOK,
      'holding shellstock in water to keep it alive, which is not a treatment',
    ],
    'the round': [
      OURS,
      'one day of sampling: the stations the boat works next, out of everything that is due',
    ],
    embargo: [
      RULE_BOOK,
      'an order holding named product where it stands, lifted only by a person signing a release',
    ],
    'consumer advisory': [
      RULE_BOOK,
      'the notice a recall produces, worded from what shut the water and stopping at the dealer',
    ],
    lease: [
      RULE_BOOK,
      'ground let to a grower for a term, suspended rather than cancelled when the water goes prohibited',
    ],
    'the grace period': [
      RULE_BOOK,
      'the days after a licence lapses in which it can still be renewed as the same licence',
    ],
    seal: [
      OURS,
      'the hash of a report and of each of its named pieces, so two runs compare to a list of names',
    ],
    provenance: [
      OURS,
      'the version, schema, rule count and code count that decide what a report says',
    ],
    coverage: [
      OURS,
      'which reports over a case are narrower than they look because a register is not there',
    ],
    'the qualification': [
      OURS,
      'whether an adverse sample was taken while the plan trigger was actually firing',
    ],
    'contested ground': [
      OURS,
      'a position two boundaries both claim, settled by the stricter classification in force',
    ],
  }),
);

export function words() {
  return Array.from(WORDS.keys()).sort();
}

export function define(word) {
  const row = WORDS.get(word);
  if (row === undefined) {
    throw new InputError('glossary.unknown', `${word} is not in the glossary`, { word });
  }
  return Object.freeze({ word, source: row[0], meaning: row[1] });
}

export function isDefined(word) {
  return WORDS.has(word);
}

/** The words this programme invented, which are the ones worth flagging. */
export function ourWords() {
  return words().filter((word) => define(word).source === OURS);
}

export function ruleBookWords() {
  return words().filter((word) => define(word).source === RULE_BOOK);
}

export function renderGlossaryDocument() {
  const lines = ['# Glossary', ''];
  lines.push(
    'Generated by `tools/write_glossary.js` from `src/core/glossary.js`.',
    '',
    'Words marked **ours** are this programme inventing a noun where the rule',
    'book uses a phrase. Do not quote them at a sanitarian as though they were',
    'official.',
    '',
  );
  for (const word of words()) {
    const entry = define(word);
    const mark = entry.source === OURS ? ' **ours**' : '';
    lines.push(`- **${word}**${mark} ${entry.meaning}`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
