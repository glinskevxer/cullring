import { describe, expect, it } from 'vitest';

import { landingDays, landings, lot } from '../../src/cli/commands/landings.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

const august = { on: '2025-08-14', from: '2025-08-01' };

describe('the landings command', () => {
  it('prints the lots landed on the day', () => {
    const io = recorder();
    landings(base(august), io);
    expect(io.out).toMatch(/Lots:\s+4/);
    expect(io.out).toContain('20250814-B12-001');
    expect(io.out).toContain('20250814-D2-001');
  });

  it('leaves out lots landed on other days', () => {
    const io = recorder();
    landings(base(august), io);
    expect(io.out).not.toContain('20250815-B12-001');
  });

  it('exits with a finding code where a lot broke a rule', () => {
    const io = recorder();
    expect(landings(base(august), io)).toBe(FOUND);
  });

  it('exits clean on a day where nothing was found', () => {
    const io = recorder();
    expect(landings(base({ on: '2025-08-20', from: '2025-08-01' }), io)).toBe(OK);
    expect(io.out).toMatch(/With findings: 0/);
  });

  it.each([
    ['2025-08-15', 'was shut on that day'],
    ['2025-08-16', 'D-9 was prohibited when the harvest started'],
    ['2025-08-18', 'was not current on that day'],
    ['2025-08-19', 'C3-MSL was held by SH-2025-04412 that day'],
  ])('finds what is wrong with %s', (day, message) => {
    const io = recorder();
    expect(landings(base({ on: day, from: '2025-08-01' }), io)).toBe(FOUND);
    expect(io.out).toContain(message);
  });

  it('reads a different clock for the wading lot than for the boat lot', () => {
    const io = recorder();
    landings(base(august), io);
    expect(io.out).toMatch(/20250814-B12-001.*first tide exposure/);
    expect(io.out).toMatch(/20250814-B12-002.*harvest/);
  });

  it('reads a longer limit for the iced lot than for the one that was not iced', () => {
    const io = recorder();
    landings(base(august), io);
    expect(io.out).toMatch(/20250814-B12-001.*10 hours/);
    expect(io.out).toMatch(/20250814-B12-002.*12 hours/);
  });

  it('prints the findings in full underneath', () => {
    const io = recorder();
    landings(base(august), io);
    expect(io.out).toContain('needs relay or depuration');
    expect(io.out).toContain('took 13.5 hours against a limit of 12');
  });

  it('prints a summary as JSON when asked', () => {
    const io = recorder();
    landings(base({ ...august, json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.on).toBe('2025-08-14');
    expect(answer.lots).toBe(4);
    expect(answer.codes['vibrio.overTime']).toBe(1);
  });

  it('prints an empty day without falling over', () => {
    const io = recorder();
    expect(landings(base({ on: '2025-01-01', from: '2025-01-01' }), io)).toBe(OK);
    expect(io.out).toMatch(/Lots:\s+0/);
  });
});

describe('the lot command', () => {
  it('prints everything the programme knows about one lot', () => {
    const io = recorder();
    expect(lot(base({ lot: '20250814-D2-001', from: '2025-08-01' }), io)).toBe(FOUND);
    expect(io.out).toContain('Lot 20250814-D2-001');
    expect(io.out).toMatch(/Area:\s+D-2, restricted at the time/);
    expect(io.out).toMatch(/Bed:\s+D2-TGB \(Turnagain lease\)/);
  });

  it('names the clock, the elapsed time and the limit', () => {
    const io = recorder();
    lot(base({ lot: '20250814-D2-001', from: '2025-08-01' }), io);
    expect(io.out).toMatch(/Elapsed:\s+13\.5 hours/);
    expect(io.out).toMatch(/Limit:\s+12 hours/);
  });

  it('prints the findings to standard error, not into the report', () => {
    const io = recorder();
    lot(base({ lot: '20250814-D2-001', from: '2025-08-01' }), io);
    expect(io.err).toContain('harvest.dealerCannotTreat');
    expect(io.out).not.toContain('harvest.dealerCannotTreat');
  });

  it('follows a lot that was renumbered downstream', () => {
    const io = recorder();
    expect(lot(base({ lot: '20250814-C3-001', from: '2025-08-01' }), io)).toBe(OK);
    expect(io.out).toMatch(/Became:\s+20250815-C3-101/);
    expect(io.out).toMatch(/Went to:\s+Piedmont Fish House/);
  });

  it('says plainly where nothing was recorded downstream', () => {
    const io = recorder();
    lot(base({ lot: '20250814-D2-001', from: '2025-08-01' }), io);
    expect(io.out).toMatch(/Went to:\s+nothing recorded/);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    lot(base({ lot: '20250814-C3-001', from: '2025-08-01', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.lot).toBe('20250814-C3-001');
    expect(answer.parties).toEqual(['Piedmont Fish House']);
    expect(answer.lawful).toBe(true);
  });

  it('refuses a lot that is not in the landings', () => {
    const io = recorder();
    expect(lot(base({ lot: '20250101-B12-999' }), io)).toBe(REFUSED);
    expect(io.err).toContain('is not in the landings');
  });
});

describe('the days a case holds', () => {
  it('lists them in order, once each', () => {
    const days = landingDays(loadCase(CASE));
    expect(days[0]).toBe('2025-08-14');
    expect(new Set(days).size).toBe(days.length);
    expect(days).toEqual(days.slice().sort());
  });
});
