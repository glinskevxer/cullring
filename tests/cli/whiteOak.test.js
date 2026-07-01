import { describe, expect, it } from 'vitest';

import { landings } from '../../src/cli/commands/landings.js';
import { loadCase } from '../../src/cli/context.js';
import { standing } from '../../src/cli/commands/water.js';
import { survey } from '../../src/cli/commands/survey.js';
import { take } from '../../src/cli/commands/limits.js';
import { walk } from '../../src/cli/commands/month.js';
import { coveredRegions, temperatureRegion } from '../../src/vibrio/table.js';
import { recorder } from '../support/cli.js';

const CASE = 'examples/white-oak';
const base = (extra = {}) => ({ case: CASE, zone: 'eastern', ...extra });

const run = (command, extra) => {
  const io = recorder();
  const code = command(base(extra), io);
  return { io, code };
};

describe('the second case loads whole', () => {
  const loaded = loadCase(CASE);

  it('carries four areas and two plans', () => {
    expect(loaded.areas.map((one) => one.id)).toEqual(['E-4', 'E-7', 'F-2', 'F-11']);
    expect(loaded.plans).toHaveLength(2);
  });

  it('has no findings at all against the register', () => {
    expect(loaded.problems.of('error')).toEqual([]);
  });

  it('carries every feed', () => {
    expect(loaded.samples.length).toBeGreaterThan(300);
    expect(loaded.records).toHaveLength(6);
    expect(loaded.book.length).toBe(15);
  });
});

describe('the plans, which are a different shape from the first case', () => {
  it('closes one on a river stage and reopens it on tide cycles', () => {
    const { io } = run(standing, { at: '2025-11-06 09:00', from: '2025-11-01' });
    expect(io.out).toContain('7.40 against 6.5 feet');
    expect(io.out).toContain('after 4 tide cycles');
  });

  it('closes the other on a plant bypass and reopens it on conforming samples', () => {
    const { io } = run(standing, { at: '2025-11-06 09:00', from: '2025-11-01' });
    expect(io.out).toContain('reported bypasses');
    expect(io.out).toContain('after 3 conforming samples');
  });

  it('leaves the open water open', () => {
    const { io } = run(standing, { at: '2025-11-06 09:00', from: '2025-11-01' });
    const bogue = io.out.split('\n').find((line) => line.startsWith('F-2'));
    expect(bogue).toContain('no');
  });
});

describe('the surveys, which reach three different verdicts', () => {
  const verdict = (area) => run(survey, { area, on: '2025-10-31' }).io.out;

  it('supports an upgrade where the water has cleaned up', () => {
    expect(verdict('E-4')).toContain('Proposal: upgrade');
  });

  it('is capped by the shoreline whatever the samples say', () => {
    const text = verdict('E-7');
    expect(text).toContain('Capped by the shoreline at: prohibited');
    expect(text).toContain('Proposal: downgrade');
  });

  it('holds where the water supports what it is held to', () => {
    expect(verdict('F-2')).toContain('Proposal: hold');
  });
});

describe('the landings, which break different rules from the first case', () => {
  it('catches a harvest out of water the river stage had shut', () => {
    const { io } = run(landings, { on: '2025-11-05' });
    expect(io.err + io.out).toContain('E-4 was prohibited when the harvest started');
  });

  it('catches restricted product sent to a dealer who cannot treat it', () => {
    const { io } = run(landings, { on: '2025-11-03' });
    expect(io.err + io.out).toContain('needs relay or depuration and SS-311 cannot do it');
  });

  it('catches a licence over the daily limit across two trips', () => {
    const { io } = run(take, { on: '2025-11-21' });
    expect(io.out + io.err).toContain('took 23 bushels of oyster in the day against 20');
  });

  it('leaves the two clean landings alone', () => {
    const { io } = run(landings, { on: '2025-11-17' });
    expect(io.err + io.out).not.toContain('error:');
  });
});

describe('the temperature table the second case found a hole in', () => {
  it('covers every region letter the register can hold', () => {
    for (const letter of coveredRegions()) {
      expect(() => temperatureRegion(letter)).not.toThrow();
    }
    expect(coveredRegions()).toContain('F');
  });

  it('still refuses a letter nothing covers, rather than guessing', () => {
    expect(() => temperatureRegion('Z')).toThrow(/sits in no temperature region/);
  });
});

describe('the walk over the second case', () => {
  it('seals the same way twice', () => {
    const first = run(walk, { on: '2025-11-30', digestOnly: true }).io.out;
    const second = run(walk, { on: '2025-11-30', digestOnly: true }).io.out;
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('names a piece per area', () => {
    const { io } = run(walk, { on: '2025-11-30' });
    expect(io.out).toContain('survey E-4');
    expect(io.out).toContain('survey F-11');
  });
});
