import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { VERSION } from '../../src/core/version.js';
import { build } from '../../src/cli/program.js';
import { makeConsole } from '../../src/cli/output.js';

const text = readFileSync('CHANGELOG.md', 'utf8');
const commands = new Set(build(makeConsole()).commands.map((one) => one.name()));

describe('the changelog', () => {
  it('has a heading for the version the programme reports', () => {
    expect(text).toContain(`## ${VERSION}`);
  });

  it('names only commands that exist', () => {
    const named = Array.from(text.matchAll(/`([a-z][a-z]{2,})`/g))
      .map((match) => match[1])
      .filter((word) => !['npm', 'node', 'bash', 'docs', 'src', 'main', 'cullring'].includes(word));
    for (const word of named) {
      expect(commands.has(word), `the changelog names ${word}`).toBe(true);
    }
  });

  it('says what the version before this one was, so the history is not lost', () => {
    expect(text).toContain('Before 1.0.0');
  });

  it('says where to find which version wrote a report', () => {
    expect(text).toContain('--version');
    expect(text).toContain('provenance');
  });
});

describe('the commands it names', () => {
  it.each(['round', 'advisory', 'coverage', 'exceptions', 'renewals', 'leases', 'diff', 'migrate'])(
    '%s is both in the changelog and in the command tree',
    (name) => {
      expect(text).toContain(`\`${name}\``);
      expect(commands.has(name)).toBe(true);
    },
  );
});
