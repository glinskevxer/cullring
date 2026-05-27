import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { diff } from '../../src/cli/commands/diff.js';
import { walk, walkPieces } from '../../src/cli/commands/month.js';
import { loadCase } from '../../src/cli/context.js';
import { seal, sealToJson } from '../../src/core/seal.js';
import { civilDate } from '../../src/time/civil.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const ask = (extra = {}) => {
  const io = recorder();
  const code = diff(base({ before: '2025-07-31', after: '2025-08-31', ...extra }), io);
  return { io, code };
};

const scratch = () => mkdtempSync(join(tmpdir(), 'cullring-'));

describe('walkPieces', () => {
  it('names a piece per report and one per area', () => {
    const pieces = walkPieces(loadCase(CASE), civilDate(2025, 8, 31));
    expect(pieces[0].name).toBe('standing');
    expect(pieces.map((one) => one.name)).toContain('survey B-12');
    expect(pieces[pieces.length - 1].name).toBe('month');
  });

  it('gives the same pieces twice, which is what the walk seals', () => {
    const first = walkPieces(loadCase(CASE), civilDate(2025, 8, 31));
    const second = walkPieces(loadCase(CASE), civilDate(2025, 8, 31));
    expect(seal(first).digest).toBe(seal(second).digest);
  });
});

describe('the diff command', () => {
  it('says what moved between two days', () => {
    const { io, code } = ask();
    expect(code).toBe(FOUND);
    expect(io.out).toContain('Pieces that moved: 7');
    expect(io.out).toContain('+ Programme report for August 2025');
  });

  it('says the same day is the same walk', () => {
    const { io, code } = ask({ before: '2025-08-31' });
    expect(code).toBe(OK);
    expect(io.out).toContain('the same, piece for piece');
  });

  it('reads a filed seal in place of the earlier walk', () => {
    const path = join(scratch(), 'july.json');
    writeFileSync(
      path,
      sealToJson(seal(walkPieces(loadCase(CASE), civilDate(2025, 7, 31)))),
      'utf8',
    );
    const { io, code } = ask({ before: undefined, seal: path });
    expect(code).toBe(FOUND);
    expect(io.out).toContain('no, only the seals were given');
  });

  it('writes the later walk out as a seal when asked', () => {
    const path = join(scratch(), 'august.json');
    ask({ save: path });
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.pieces.map((one) => one.name)).toContain('month');
    expect(written.digest).toHaveLength(64);
  });

  it('takes the filed seal over a date when given both, rather than quietly picking', () => {
    const path = join(scratch(), 'july.json');
    writeFileSync(
      path,
      sealToJson(seal(walkPieces(loadCase(CASE), civilDate(2025, 7, 31)))),
      'utf8',
    );
    expect(ask({ seal: path }).io.out).toContain('only the seals were given');
  });

  it('refuses a seal file that is not there', () => {
    const { io, code } = ask({ seal: join(scratch(), 'nothing.json') });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('is not a file');
  });

  it('refuses a file that is not a seal', () => {
    const path = join(scratch(), 'notes.txt');
    writeFileSync(path, 'just some notes', 'utf8');
    const { io, code } = ask({ seal: path });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('is not a seal');
  });

  it('refuses a diff with only one day', () => {
    const { io, code } = ask({ before: undefined });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('needs two days');
  });

  it('refuses a day it cannot read', () => {
    expect(ask({ after: 'last Tuesday' }).code).toBe(REFUSED);
  });

  it('prints the moved pieces as JSON', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.same).toBe(false);
    expect(answer.pieces.find((one) => one.name === 'standing').added).toBe(1);
  });

  it('shows more of the report when asked for more context', () => {
    const tight = ask({ context: '0' }).io.out.split('\n').length;
    const loose = ask({ context: '4' }).io.out.split('\n').length;
    expect(loose).toBeGreaterThan(tight);
  });
});

describe('the walk it is built on', () => {
  it('still prints and still seals', () => {
    const io = recorder();
    expect(walk(base({ on: '2025-08-31' }), io)).toBe(OK);
    expect(io.out).toContain('sha256 ');
    expect(io.out).toContain('  month');
  });
});
