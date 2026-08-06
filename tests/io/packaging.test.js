import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VERSION } from '../../src/core/version.js';

const packaged = JSON.parse(readFileSync('package.json', 'utf8'));

describe('what ships', () => {
  it('names the files list explicitly, so nothing is shipped by accident', () => {
    expect(packaged.files).toContain('src');
    expect(packaged.files).toContain('bin');
    expect(packaged.files).toContain('examples');
  });

  it('does not ship the tests or the tools, which are for the repository', () => {
    expect(packaged.files).not.toContain('tests');
    expect(packaged.files).not.toContain('tools');
  });

  it('ships the examples, which is what the installed copy is tried against', () => {
    expect(existsSync('examples/core-sound/register.json')).toBe(true);
  });

  it('points its bin at a file that is there', () => {
    for (const path of Object.values(packaged.bin)) {
      expect(existsSync(path), path).toBe(true);
    }
  });

  it('agrees with the version the programme reports', () => {
    expect(packaged.version).toBe(VERSION);
  });
});

describe('what src imports', () => {
  const walk = (directory) =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  const sources = walk('src').filter((path) => path.endsWith('.js'));

  it('never imports a development dependency, which would install as nothing', () => {
    const dev = Object.keys(packaged.devDependencies ?? {});
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      for (const name of dev) {
        expect(text.includes(`from '${name}'`), `${path} imports ${name}`).toBe(false);
      }
    }
  });

  it('imports only node builtins and the one runtime dependency', () => {
    const allowed = new Set(Object.keys(packaged.dependencies ?? {}));
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/from '([^.'][^']*)'/g)) {
        const name = match[1];
        const bare = name.startsWith('node:') ? null : name.split('/')[0];
        if (bare !== null) {
          expect(allowed.has(bare), `${path} imports ${name}`).toBe(true);
        }
      }
    }
  });

  it('keeps to exactly one runtime dependency', () => {
    expect(Object.keys(packaged.dependencies ?? {})).toEqual(['commander']);
  });
});

describe('the docker image', () => {
  const dockerfile = readFileSync('Dockerfile', 'utf8');

  it('copies every directory the files list ships that the image needs', () => {
    for (const directory of ['bin', 'src', 'examples']) {
      expect(dockerfile).toContain(`COPY ${directory} ./${directory}`);
    }
  });

  it('does not run as root', () => {
    expect(dockerfile).toContain('USER node');
  });

  it('installs without the development dependencies', () => {
    expect(dockerfile).toContain('npm ci --omit=dev');
  });
});
