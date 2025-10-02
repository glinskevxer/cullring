import { describe, expect, it } from 'vitest';

import { historyOf, programme } from '../../src/cli/commands/programme.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK } from '../../src/cli/output.js';
import { CASE, base, recorder } from '../support/cli.js';

describe('the review history a case carries', () => {
  it('is read off the register', () => {
    const history = historyOf(loadCase(CASE));
    expect(Object.keys(history).sort()).toEqual(['B-12', 'B-14', 'C-3', 'D-2', 'D-9']);
    expect(history['B-12'].lastReview.year).toBe(2025);
  });

  it('reads a missing plan review date as nothing rather than as a date', () => {
    const history = historyOf(loadCase(CASE));
    expect(history['B-14'].lastPlanReview).toBeNull();
    expect(history['B-12'].lastPlanReview).not.toBeNull();
  });

  it('is an empty record for a case that carries none', () => {
    expect(historyOf({})).toEqual({});
  });
});

describe('the programme command', () => {
  it('counts the reviews and the stations', () => {
    const io = recorder();
    expect(programme(base({ on: '2025-09-30' }), io)).toBe(FOUND);
    expect(io.out).toMatch(/Reviews tracked:\s+12/);
    expect(io.out).toMatch(/Stations tracked:\s+8/);
  });

  it('uses the recorded review dates rather than the reclassification date', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30' }), io);
    expect(io.out).toContain('2025-03-14');
    expect(io.out).toMatch(/Reviews late:\s+3/);
  });

  it('counts the boat visits the current classification costs', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30' }), io);
    expect(io.out).toMatch(/Visits a year at this classification: 78/);
  });

  it('samples a conditional area twice as often as a plain one', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30' }), io);
    expect(io.out).toMatch(/B12-01\s+CA\s+12/);
    expect(io.out).toMatch(/C3-01\s+APP\s+6/);
  });

  it('takes a prohibited area off the round', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30' }), io);
    expect(io.out).not.toMatch(/D9-\d+\s+PRO/);
  });

  it('names the next thing due anywhere', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30' }), io);
    expect(io.out).toMatch(/Next due anywhere: D-9 annual review on 2022-08-30\./);
  });

  it('exits with a finding code while something is late', () => {
    const io = recorder();
    expect(programme(base({ on: '2025-09-30' }), io)).toBe(FOUND);
  });

  it('exits clean on a day where nothing is late yet', () => {
    const io = recorder();
    expect(programme(base({ on: '2021-09-30' }), io)).toBe(OK);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    programme(base({ on: '2025-09-30', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.on).toBe('2025-09-30');
    expect(answer.boatVisits).toBe(78);
    expect(answer.next.area).toBe('D-9');
  });
});
