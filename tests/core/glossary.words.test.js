import { describe, expect, it } from 'vitest';

import { OURS, RULE_BOOK, define, ourWords, words } from '../../src/core/glossary.js';
import { CLASSIFICATIONS } from '../../src/area/classification.js';

describe('the words the recent work invented', () => {
  it.each(['the round', 'seal', 'provenance', 'coverage', 'the qualification', 'contested ground'])(
    '%s is marked as ours, so nobody quotes it at a sanitarian',
    (word) => {
      expect(words()).toContain(word);
      expect(ourWords()).toContain(word);
    },
  );

  it.each(['embargo', 'consumer advisory', 'lease', 'the grace period'])(
    '%s is the rule book, not ours',
    (word) => {
      expect(words()).toContain(word);
      expect(define(word).source).toBe(RULE_BOOK);
    },
  );

  it('says what a lease does when the water goes prohibited, which is the rule people get wrong', () => {
    expect(define('lease').meaning).toContain('suspended rather than cancelled');
  });

  it('says an embargo is lifted by a person, which is what makes it not a closure', () => {
    expect(define('embargo').meaning).toContain('signing a release');
  });

  it('says the qualification is about the trigger firing, not about the weather', () => {
    expect(define('the qualification').meaning).toContain('trigger was actually firing');
  });
});

describe('the glossary as a whole', () => {
  it('still holds every classification', () => {
    for (const name of CLASSIFICATIONS) {
      expect(words()).toContain(name);
    }
  });

  it('marks every word one way or the other', () => {
    for (const word of words()) {
      expect([OURS, RULE_BOOK]).toContain(define(word).source);
    }
  });

  it('keeps more of the rule book than of its own inventions', () => {
    const ours = ourWords().length;
    expect(ours).toBeLessThan(words().length - ours);
  });
});
