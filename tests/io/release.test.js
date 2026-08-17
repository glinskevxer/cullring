import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

import { VERSION, provenanceLine } from '../../src/core/version.js';
import { build } from '../../src/cli/program.js';
import { makeConsole } from '../../src/cli/output.js';

const packaged = JSON.parse(readFileSync('package.json', 'utf8'));
const readme = readFileSync('README.md', 'utf8');

describe('the release', () => {
  it('reports one version everywhere it is asked', () => {
    expect(packaged.version).toBe(VERSION);
    expect(build(makeConsole()).version()).toBe(VERSION);
    expect(provenanceLine()).toContain(VERSION);
  });

  it('has a changelog entry for it', () => {
    expect(readFileSync('CHANGELOG.md', 'utf8')).toContain(`## ${VERSION}`);
  });

  it('ships every document the README points at', () => {
    for (const match of readme.matchAll(/\]\((docs\/[a-z]+\.md)\)/g)) {
      expect(existsSync(match[1]), match[1]).toBe(true);
    }
  });

  it('names the node it needs, and it is one that exists', () => {
    expect(packaged.engines.node).toMatch(/>=\s*20/);
  });

  it('carries a script for every check the walk runs', () => {
    const walk = readFileSync('tools/walk.sh', 'utf8');
    for (const match of walk.matchAll(/node tools\/(check_[a-z]+)\.js/g)) {
      const name = `check:${match[1].replace('check_', '')}`;
      expect(Object.keys(packaged.scripts), name).toContain(name);
    }
  });

  it('runs every check in the walk from continuous integration too', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    const walk = readFileSync('tools/walk.sh', 'utf8');
    for (const match of walk.matchAll(/node tools\/(check_[a-z]+)\.js/g)) {
      const name = `check:${match[1].replace('check_', '')}`;
      expect(ci, name).toContain(`npm run ${name}`);
    }
  });
});

describe('the README', () => {
  it('opens on what the programme is, not on how to install it', () => {
    expect(readme.split('\n')[2]).toContain('shellfish sanitation');
  });

  it('points at the rules document, which is the one worth arguing with', () => {
    expect(readme).toContain('docs/rules.md');
  });

  it('tells somebody to start with coverage', () => {
    expect(readme).toContain('Start with `coverage`');
  });

  it('names both worked examples', () => {
    expect(readme).toContain('core-sound');
    expect(readme).toContain('white-oak');
  });
});

describe('the command tree', () => {
  const program = build(makeConsole());

  it('gives every command a description', () => {
    for (const one of program.commands) {
      expect(one.description().length, one.name()).toBeGreaterThan(10);
    }
  });

  it('gives every command a case directory to read', () => {
    for (const one of program.commands) {
      if (one.name() === 'help') {
        continue;
      }
      const flags = one.options.map((option) => option.long);
      expect(flags, one.name()).toContain('--case');
    }
  });

  it('has grown past thirty commands and every one of them is documented', () => {
    const document = readFileSync('docs/commands.md', 'utf8');
    expect(program.commands.length).toBeGreaterThan(30);
    for (const one of program.commands) {
      if (one.name() === 'help') {
        continue;
      }
      expect(document, one.name()).toContain(`## ${one.name()}`);
    }
  });
});
