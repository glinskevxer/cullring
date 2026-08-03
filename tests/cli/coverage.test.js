import { describe, expect, it } from 'vitest';

import { coverage } from '../../src/cli/commands/coverage.js';
import { validate } from '../../src/cli/commands/case.js';
import { OK } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const second = (extra = {}) => ({ case: 'examples/white-oak', zone: 'eastern', ...extra });

const ask = (options) => {
  const io = recorder();
  const code = coverage(options, io);
  return { io, code };
};

describe('the coverage command', () => {
  it('says a full case is complete', () => {
    const { io, code } = ask(base());
    expect(code).toBe(OK);
    expect(io.out).toContain('Reports that are complete:     7 of 7');
    expect(io.out).not.toContain('narrower than they look');
  });

  it('names what a thinner case cannot say', () => {
    const { io, code } = ask(second());
    expect(code).toBe(OK);
    expect(io.out).toContain('standing      narrowed');
    expect(io.out).toContain('2 of 7 reports are narrower than they look');
  });

  it('warns rather than failing, because a thin case is still a usable one', () => {
    const { io } = ask(second());
    expect(io.err).toContain('coverage.narrowed');
    expect(io.err).not.toContain('error:');
  });

  it('prints the whole thing as JSON', () => {
    const { io } = ask(second({ json: true }));
    const answer = JSON.parse(io.out);
    expect(answer.complete).toBe(5);
    expect(answer.caveat).toContain('narrower');
    expect(answer.reports.find((one) => one.report === 'standing').missing).toEqual(['orders']);
  });

  it('gives the same answer twice', () => {
    expect(ask(second()).io.out).toBe(ask(second()).io.out);
  });
});

describe('validate, which now says when a clean case is a thin one', () => {
  it('says nothing extra about a full case', () => {
    const io = recorder();
    validate(base(), io);
    expect(io.out).not.toContain('narrower than they look');
  });

  it('says it about a thin one, and names the command that lists it', () => {
    const io = recorder();
    validate(second(), io);
    expect(io.out).toContain('narrower than they look over this case. Run coverage for the list.');
  });
});
