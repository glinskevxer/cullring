import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const attributes = readFileSync('.gitattributes', 'utf8');
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((name) => name !== '');

describe('.gitattributes', () => {
  it('is tracked, because it only works if it is checked out with the tree', () => {
    expect(tracked).toContain('.gitattributes');
  });

  it('pins the working tree to LF whatever the cloner has configured', () => {
    expect(attributes).toContain('* text=auto eol=lf');
  });

  it.each(['*.js', '*.json', '*.md', '*.yml', '*.csv', '*.sh'])('pins %s', (pattern) => {
    expect(attributes).toContain(`${pattern} text eol=lf`);
  });

  it('says why, because the failure is invisible from inside the repository', () => {
    expect(attributes).toContain('core.autocrlf');
  });
});

describe('the tree as it stands', () => {
  const BINARY = /\.(png|jpg|jpeg|gif|ico|pdf|zip|gz|woff2?|ttf)$/i;
  const text = tracked.filter((name) => !BINARY.test(name));

  it('holds no carriage return in any tracked file', () => {
    const carrying = text.filter((name) => readFileSync(name).includes(13));
    expect(carrying).toEqual([]);
  });

  it('checks a real number of files, so an empty list cannot pass by accident', () => {
    expect(text.length).toBeGreaterThan(300);
  });

  it('reads the generated documents as LF, which is what they are compared against', () => {
    for (const name of [
      'docs/commands.md',
      'docs/findings.md',
      'docs/glossary.md',
      'docs/rules.md',
    ]) {
      expect(readFileSync(name).includes(13), name).toBe(false);
    }
  });
});
