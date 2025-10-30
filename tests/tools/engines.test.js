import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The three places a node version is written down, held to each other.
 *
 * They drift silently: somebody bumps the CI matrix, the Dockerfile keeps the
 * old base, and the image runs a version nothing tested. Nothing else in the
 * build would notice, so this is written as a test rather than as a comment in
 * one of the three files.
 */

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');

const matrix = Array.from(workflow.matchAll(/'(\d+)\.\d+\.\d+'/g)).map((one) => Number(one[1]));

describe('the node version the package declares', () => {
  it('is a floor with no ceiling, so a new major needs no change here', () => {
    expect(packageJson.engines.node).toBe('>=20.11');
  });

  it('is met by every version the test matrix runs', () => {
    expect(matrix.length).toBeGreaterThan(1);
    for (const major of matrix) {
      expect(major).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('the CI matrix', () => {
  it('runs the oldest supported major and a current one', () => {
    expect(matrix).toContain(20);
    expect(matrix).toContain(22);
  });

  it('names an exact version for each, so a patch bump is a commit', () => {
    expect(workflow).toContain("'20.18.2'");
    expect(workflow).toContain("'22.13.1'");
  });
});

describe('the image', () => {
  it('is built on a major the matrix tests', () => {
    const base = /^FROM node:(\d+)-/m.exec(dockerfile);
    expect(base).not.toBeNull();
    expect(matrix).toContain(Number(base[1]));
  });

  it('installs without the development dependencies', () => {
    expect(dockerfile).toContain('npm ci --omit=dev');
  });

  it('copies the worked example, because the smoke test runs against it', () => {
    expect(dockerfile).toContain('COPY examples ./examples');
  });

  it('has the command line as its entry point', () => {
    expect(dockerfile).toContain('ENTRYPOINT ["node", "bin/cullring.js"]');
  });
});

describe('the one runtime dependency', () => {
  it('is commander and nothing else', () => {
    expect(Object.keys(packageJson.dependencies)).toEqual(['commander']);
  });

  it('is pinned exactly, not to a range', () => {
    for (const version of Object.values(packageJson.dependencies)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    for (const version of Object.values(packageJson.devDependencies)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe('the CI jobs', () => {
  it('covers lint, tests, coverage, audit, documents, the walk and the image', () => {
    for (const job of [
      'lint:',
      'test:',
      'coverage:',
      'audit:',
      'documents:',
      'worked-example:',
      'image:',
    ]) {
      expect(workflow).toContain(job);
    }
  });

  it('runs the walk out of a script rather than inline in the yaml', () => {
    expect(workflow).toContain('bash tools/walk.sh');
  });

  it('runs both document checks', () => {
    expect(workflow).toContain('npm run check:commands');
    expect(workflow).toContain('npm run check:exports');
    expect(workflow).toContain('npm run check:findings');
  });
});
