import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';

import {
  chainFor,
  claimedFamilies,
  isClaimed,
  registryProblems,
  renderRulesDocument,
  rule,
  ruleForFamily,
  ruleNames,
  rules,
} from '../../src/core/rules.js';
import { codes, families } from '../../src/core/catalogue.js';

describe('the registry', () => {
  it('holds together', () => {
    expect(registryProblems()).toEqual([]);
  });

  it('names a module for every rule, and every one of them is there', () => {
    for (const one of rules()) {
      expect(existsSync(one.module), `${one.name} lives in ${one.module}`).toBe(true);
    }
  });

  it('claims every family the catalogue holds', () => {
    const claimed = new Set(claimedFamilies());
    for (const family of families()) {
      expect(claimed.has(family), `nothing claims ${family}`).toBe(true);
    }
  });

  it('claims no family twice', () => {
    const owners = claimedFamilies().map((family) => ruleForFamily(family));
    for (const family of claimedFamilies()) {
      const claiming = rules().filter((one) => one.raises.includes(family));
      expect(claiming, `${family} is claimed more than once`).toHaveLength(1);
    }
    expect(owners.every((one) => one !== null)).toBe(true);
  });

  it('refuses a rule it does not keep', () => {
    expect(() => rule('the weather')).toThrow(/is not a rule this programme keeps/);
  });

  it('has more rules decided by another than not, which is the whole design', () => {
    const decided = rules().filter((one) => one.decidedBy.length > 0);
    expect(decided.length).toBeGreaterThan(rules().length / 2);
  });
});

describe('chainFor', () => {
  it('walks back to the rules that decide nothing else', () => {
    const chain = chainFor('harvest legality');
    expect(chain[chain.length - 1]).toBe('harvest legality');
    expect(chain).toContain('the classification in force');
    expect(chain).toContain('emergency orders');
  });

  it('reaches the plan through the classification, which is the loop the design names', () => {
    const chain = chainFor('the adverse condition');
    expect(chain).toContain('the management plan');
    expect(chain).toContain('the classification in force');
  });

  it('is one entry for a rule nothing decides', () => {
    expect(chainFor('emergency orders')).toEqual(['emergency orders']);
  });

  it('says so rather than looping', () => {
    const chain = chainFor('the classification in force');
    expect(chain.join(' ')).not.toContain('undefined');
    expect(chain.filter((one) => one.includes('loops')).length).toBeLessThanOrEqual(1);
  });
});

describe('isClaimed', () => {
  it('says yes for every code in the catalogue', () => {
    for (const code of codes()) {
      expect(isClaimed(code), code).toBe(true);
    }
  });

  it('says no for a code nothing raises', () => {
    expect(isClaimed('weather.rain')).toBe(false);
  });
});

describe('the generated document', () => {
  const text = renderRulesDocument();

  it('names every rule', () => {
    for (const name of ruleNames()) {
      expect(text).toContain(`## ${name}`);
    }
  });

  it('says what decides what', () => {
    expect(text).toContain('- Decided by the classification in force');
    expect(text).toContain('- Decided by nothing else');
  });

  it('is the same text twice', () => {
    expect(renderRulesDocument()).toBe(text);
  });
});
