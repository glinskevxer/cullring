/**
 * An index over the movement ledger, and why the ledger does not build one.
 *
 * Every step of a trace asks the book two questions: which movement minted
 * this lot number, and which movements this lot number minted. The ledger
 * answers both by sorting itself and walking the whole thing, which is right
 * for a book of two hundred movements and wrong for a recall over a season.
 * A trace of a chain twelve deep over a book of forty thousand movements sorts
 * forty thousand rows twelve times, and a recall does that once per landing.
 *
 * The index is a separate thing rather than a cache inside the ledger for one
 * reason: the ledger can be added to, and a cache that has to be invalidated
 * is a cache that is stale exactly once, in the middle of a recall, on the day
 * it matters. An index is built from a book, is honest about being a snapshot,
 * and refuses to answer if the book has grown underneath it.
 */

import { InputError } from '../core/errors.js';
import { parseLotId } from '../core/identity.js';

/**
 * Build the index. Three maps, all built in one pass: what each lot number
 * came from, what each turned into, and every movement touching each lot.
 */
export function indexLedger(book) {
  if (book === null || book === undefined || typeof book.all !== 'function') {
    throw new InputError('index.book', 'an index is built over a ledger', {});
  }
  const movements = book.all();
  const parents = new Map();
  const children = new Map();
  const touching = new Map();

  const push = (map, key, value) => {
    const held = map.get(key);
    if (held === undefined) {
      map.set(key, [value]);
      return;
    }
    held.push(value);
  };

  for (const one of movements) {
    push(touching, one.lot, one);
    if (one.becomes === null || one.becomes === undefined) {
      continue;
    }
    push(touching, one.becomes, one);
    push(children, one.lot, one.becomes);
    if (parents.has(one.becomes)) {
      push(parents, one.becomes, one.lot);
    } else {
      parents.set(one.becomes, [one.lot]);
    }
  }

  const size = book.length;

  const guard = () => {
    if (book.length !== size) {
      throw new InputError(
        'index.stale',
        'the ledger has been added to since this index was built',
        { was: size, now: book.length },
      );
    }
  };

  return Object.freeze({
    size,
    lots: touching.size,
    parentOf(lot) {
      guard();
      const held = parents.get(parseLotId(lot, 'lot').id);
      return held === undefined ? null : held[0];
    },
    parentsOf(lot) {
      guard();
      return (parents.get(parseLotId(lot, 'lot').id) ?? []).slice();
    },
    childrenOf(lot) {
      guard();
      return (children.get(parseLotId(lot, 'lot').id) ?? []).slice();
    },
    forLot(lot) {
      guard();
      return (touching.get(parseLotId(lot, 'lot').id) ?? []).slice();
    },
    has(lot) {
      guard();
      return touching.has(parseLotId(lot, 'lot').id);
    },
  });
}

/**
 * Lot numbers minted by more than one movement. That is not a rule the ledger
 * can enforce as movements arrive, because the second one may be the correction
 * of the first, and it is exactly what a trace back cannot resolve: two parents
 * means the walk has to pick, and there is nothing in the book to pick on.
 */
export function forkedLots(index, lots) {
  return lots.filter((lot) => index.parentsOf(lot).length > 1).sort();
}
