import { describe, expect, it } from 'vitest';

import { embargoes } from '../../src/cli/commands/embargo.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const AT = '2025-09-03 09:00';

const ask = (extra = {}) => {
  const io = recorder();
  const code = embargoes(base({ at: AT, ...extra }), io);
  return { io, code };
};

describe('loading the embargoes', () => {
  const loaded = loadCase(CASE);

  it('reads both out of the register', () => {
    expect(loaded.embargoes.map((one) => one.number)).toEqual(['EMB-2025-11', 'EMB-2025-12']);
  });

  it('keeps the release and who signed it', () => {
    const released = loaded.embargoes[1];
    expect(released.releasedBy).toBe('D Meekins');
    expect(released.releasedAt).not.toBe(null);
  });

  it('reads a water embargo period as instants', () => {
    expect(loaded.embargoes[1].span.start.epochSecond).toBeLessThan(
      loaded.embargoes[1].span.end.epochSecond,
    );
  });
});

describe('the embargoes command', () => {
  it('lists what is standing', () => {
    const { io, code } = ask();
    expect(code).toBe(OK);
    expect(io.out).toContain('EMB-2025-11');
    expect(io.out).toContain('EMB-2025-12');
  });

  it('shows one lot caught by two embargoes, which needs two releases', () => {
    const { io } = ask();
    const rows = io.out.split('\n').filter((line) => line.includes('20250814-D2-001'));
    expect(rows).toHaveLength(2);
  });

  it('says plainly when nothing is held', () => {
    const { io, code } = ask({ at: '2025-01-01 09:00' });
    expect(code).toBe(OK);
    expect(io.out).toContain('Nothing is held.');
  });

  it('drops the released one once its release lands', () => {
    const { io } = ask({ at: '2025-09-10 09:00' });
    expect(io.out).toContain('EMB-2025-11');
    expect(io.out).not.toContain('EMB-2025-12');
  });

  it('reports one embargo when given its number', () => {
    const { io, code } = ask({ number: 'emb-2025-11' });
    expect(code).toBe(FOUND);
    expect(io.out).toContain('Reaches:       by lot');
    expect(io.out).toContain('Released:      not released');
  });

  it('refuses a number the register does not hold', () => {
    const { io, code } = ask({ number: 'EMB-9999' });
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('is not an embargo the register holds');
  });

  it('prints the standing list as JSON', () => {
    const { io } = ask({ json: true });
    const answer = JSON.parse(io.out);
    expect(answer.standing).toHaveLength(2);
    expect(answer.standing[0].lots).toEqual(['20250814-D2-001']);
  });

  it('warns once an embargo has stood a month with nobody releasing it', () => {
    const { io } = ask({ at: '2025-10-15 09:00' });
    expect(io.err).toContain('embargo.stale');
  });
});
