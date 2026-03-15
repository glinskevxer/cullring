import { describe, expect, it } from 'vitest';

import { where } from '../../src/cli/commands/where.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const AT = '2025-06-11 09:00';

const ask = (position, extra = {}) => {
  const io = recorder();
  const code = where(base({ position, at: AT, from: '2025-06-01', ...extra }), io);
  return { io, code };
};

describe('the where command', () => {
  it('names the area a position is squarely in', () => {
    const { io, code } = ask('34.92,-76.90');
    expect(code).toBe(OK);
    expect(io.out).toContain('C-3, Middle Sound');
    expect(io.out).toContain('Open to harvest: yes');
  });

  it('reports a closed area as found rather than as ordinary', () => {
    const { io, code } = ask('34.7112,-76.6841');
    expect(code).toBe(FOUND);
    expect(io.out).toContain('B-12, Broad Creek');
    expect(io.out).toContain('Open to harvest: no');
  });

  it('gives contested ground to the stricter area and says who else claimed it', () => {
    const { io } = ask('34.66,-76.55');
    expect(io.out).toContain('D-9, Outfall Reach');
    expect(io.out).toContain('Also claimed by: D-2');
    expect(io.out).toContain('Settled by:      the stricter classification');
  });

  it('says which layer decided, not all of them', () => {
    expect(ask('34.92,-76.90').io.out).toContain('the register, classified on the sampling survey');
    expect(ask('34.7112,-76.6841').io.out).toContain('the management plan, which is closed');
  });

  it('refuses to guess when no line holds the position', () => {
    const { io, code } = ask('30,-70');
    expect(code).toBe(FOUND);
    expect(io.out).toContain('in no area the register draws a line around');
    expect(io.err).toContain('nothing here says the water is open');
  });

  it('prints the claim and the settlement as JSON', () => {
    const { io } = ask('34.66,-76.55', { json: true });
    const answer = JSON.parse(io.out);
    expect(answer.area).toBe('D-9');
    expect(answer.claimed).toEqual(['D-2', 'D-9']);
    expect(answer.open).toBe(false);
  });

  it('reports an unplaced position as JSON with the nearest line', () => {
    const { io } = ask('30,-70', { json: true });
    const answer = JSON.parse(io.out);
    expect(answer.area).toBe(null);
    expect(answer.nearest).toBe('D-9');
    expect(answer.nauticalMiles).toBeGreaterThan(400);
  });

  it.each(['34.7112', 'north a bit', '', '91,-76.6', '34.7,-200'])('refuses %s', (position) => {
    const { io, code } = ask(position);
    expect(code).toBe(REFUSED);
    expect(io.err).toContain('latitude first');
  });
});
