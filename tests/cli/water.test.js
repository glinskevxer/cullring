import { describe, expect, it } from 'vitest';

import { closures, notice, standing } from '../../src/cli/commands/water.js';
import { validate } from '../../src/cli/commands/case.js';
import { OK, REFUSED } from '../../src/cli/output.js';
import { base, recorder } from '../support/cli.js';

const june = { at: '2025-06-11 09:00', from: '2025-06-01' };

describe('validate', () => {
  it('prints the counts and says nothing is wrong with the worked example', () => {
    const io = recorder();
    expect(validate(base(), io)).toBe(OK);
    expect(io.out).toMatch(/Areas:\s+5/);
    expect(io.out).toMatch(/Findings:\s+0, of which 0 are errors/);
    expect(io.err).toBe('');
  });

  it('prints the same counts as JSON when asked', () => {
    const io = recorder();
    expect(validate(base({ json: true }), io)).toBe(OK);
    const answer = JSON.parse(io.out);
    expect(answer.areas).toBe(5);
    expect(answer.findings).toEqual([]);
  });

  it('says what is wrong with a directory that has no register', () => {
    const io = recorder();
    expect(validate(base({ case: 'examples' }), io)).toBe(1);
    expect(io.err).toMatch(/case\.noRegister/);
  });

  it('keeps quiet about the findings when told to', () => {
    const io = recorder();
    validate(base({ case: 'examples', quiet: true }), io);
    expect(io.err).toBe('');
  });
});

describe('standing', () => {
  it('prints a line per area with the class in force', () => {
    const io = recorder();
    expect(standing(base(june), io)).toBe(OK);
    expect(io.out).toContain('Growing area standing');
    expect(io.out).toContain('B-12');
    expect(io.out).toContain('C-3');
  });

  it('shows the two conditional areas shut by their own gauges', () => {
    const io = recorder();
    standing(base(june), io);
    expect(io.out).toMatch(/B-12 .*1\.90 against 1 inches/);
    expect(io.out).toMatch(/B-14 .*0\.80 against 0\.75 inches/);
  });

  it('shows each of them reopening on its own instrument', () => {
    const io = recorder();
    standing(base(june), io);
    expect(io.out).toContain('after 72 hours');
    expect(io.out).toContain('after 2 conforming samples');
  });

  it('shows them open again once the closures have lifted', () => {
    const io = recorder();
    standing(base({ at: '2025-06-30 09:00', from: '2025-06-01' }), io);
    expect(io.out).toMatch(/Closed under a plan: 0/);
  });

  it('prints a summary as JSON when asked', () => {
    const io = recorder();
    standing(base({ ...june, json: true }), io);
    expect(JSON.parse(io.out)).toMatchObject({ areas: 5, closed: 2 });
  });

  it('refuses without a moment', () => {
    const io = recorder();
    expect(() => standing(base(), io)).toThrow(/needs a moment/);
  });
});

describe('closures', () => {
  it('lists the closures of one area in the period', () => {
    const io = recorder();
    expect(closures(base({ area: 'B-14', at: '2025-06-30 00:00', from: '2025-06-01' }), io)).toBe(
      OK,
    );
    expect(io.out).toContain('Closures for B-14 Cedar Bay');
    expect(io.out).toMatch(/Closures: 1/);
  });

  it('names both instruments of the plan', () => {
    const io = recorder();
    closures(base({ area: 'B-14', at: '2025-06-30 00:00', from: '2025-06-01' }), io);
    expect(io.out).toContain('closes on 0.75 inches at MLC');
    expect(io.out).toContain('reopens after 2 conforming samples');
  });

  it('says plainly where an area carries no plan', () => {
    const io = recorder();
    expect(closures(base({ area: 'C-3', at: '2025-06-30 00:00', from: '2025-06-01' }), io)).toBe(
      OK,
    );
    expect(io.out).toContain('carries no management plan');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(closures(base({ area: 'Z-9', at: '2025-06-30 00:00' }), io)).toBe(REFUSED);
    expect(io.err).toContain('is not in the register');
  });
});

describe('notice', () => {
  it('prints the last notice of the period', () => {
    const io = recorder();
    expect(notice(base({ area: 'B-12', at: '2025-06-20 09:00', from: '2025-06-01' }), io)).toBe(OK);
    expect(io.out).toContain('Closure lifted: B-12 Broad Creek');
    expect(io.out).toMatch(/Because:\s+1\.90 inches at BRD/);
  });

  it('says a closure is in force while it is', () => {
    const io = recorder();
    notice(base({ area: 'B-12', at: '2025-06-11 09:00', from: '2025-06-01' }), io);
    expect(io.out).toContain('Closure in force');
    expect(io.out).toMatch(/Reopens:\s+after 72 hours/);
  });

  it('says plainly when the area has not been shut in the period', () => {
    const io = recorder();
    expect(notice(base({ area: 'B-12', at: '2025-08-20 09:00', from: '2025-08-01' }), io)).toBe(OK);
    expect(io.out).toContain('has not been shut under its plan');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(notice(base({ area: 'Z-9', at: '2025-06-20 09:00' }), io)).toBe(REFUSED);
  });
});
