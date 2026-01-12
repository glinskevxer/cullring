import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const TOOL = join(process.cwd(), 'tools/check_readme.js');
const run = (cwd) => execFileSync(process.execPath, [TOOL], { cwd, encoding: 'utf8' });

let scratch = null;

afterEach(() => {
  if (scratch !== null) {
    rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  }
});

const copy = () => {
  scratch = mkdtempSync(join(tmpdir(), 'cullring-readme-'));
  cpSync('src', join(scratch, 'src'), { recursive: true });
  cpSync('README.md', join(scratch, 'README.md'));
  return scratch;
};

describe('the README', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('describes every package', () => {
    expect(run(process.cwd())).toMatch(/describes all \d+ packages/);
  });

  it('says why the programme is shaped the way it is before it says what is in it', () => {
    expect(readme.indexOf('Why it is shaped')).toBeLessThan(readme.indexOf('## Layout'));
  });

  it('points at the generated documents rather than repeating them', () => {
    expect(readme).toContain('docs/commands.md');
    expect(readme).toContain('docs/findings.md');
    expect(readme).toContain('docs/glossary.md');
  });

  it('says what the exit codes mean, which is the thing scripts need', () => {
    expect(readme).toMatch(/exits 0 for nothing to\s*report, 1 for a finding and 2 for a request/);
  });

  it('says the worked example is deliberately dirty', () => {
    expect(readme).toContain('deliberately dirty');
  });
});

describe('the check itself', () => {
  it('fails when a package has no row', () => {
    const where = copy();
    mkdirSync(join(where, 'src/orphanage'));
    writeFileSync(join(where, 'src/orphanage/index.js'), 'export const nothing = 1;\n');
    expect(() => run(where)).toThrow();
  });

  it('fails when a row names a package that is not there', () => {
    const where = copy();
    rmSync(join(where, 'src/geo'), { recursive: true, force: true });
    expect(() => run(where)).toThrow();
  });

  it('fails when a row says almost nothing', () => {
    const where = copy();
    const lines = readFileSync(join(where, 'README.md'), 'utf8').split('\n');
    const at = lines.findIndex((line) => line.startsWith('| `src/geo`'));
    lines[at] = '| `src/geo` | maps |';
    writeFileSync(join(where, 'README.md'), lines.join('\n'));
    expect(() => run(where)).toThrow();
  });
});
