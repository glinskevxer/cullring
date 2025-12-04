import { describe, expect, it } from 'vitest';

import { inspections } from '../../src/cli/commands/inspection.js';
import {
  dueBefore,
  inspectionRound,
  nextToVisit,
  renderInspections,
} from '../../src/report/inspection.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK } from '../../src/cli/output.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 9, 30);

/** Everybody walked on the same day, so nobody is overdue and nobody is unseen. */
const recent = loaded.dealers.map((dealer) => ({
  dealer: dealer.id,
  on: civilDate(2024, 5, 1),
  failed: [],
  critical: [],
  score: 100,
  inspector: 'R. Willis',
  note: null,
}));

const round = (day = on, extra = {}) =>
  inspectionRound({ dealers: loaded.dealers, inspections: loaded.inspections, on: day, ...extra });

describe('the round', () => {
  it('gives a line per certified dealer, in number order', () => {
    expect(round().rows.map((one) => one.dealer)).toEqual(['DP-003', 'RP-007', 'SP-118', 'SS-042']);
  });

  it('leaves out a dealer whose certification has lapsed', () => {
    expect(round().rows.map((one) => one.dealer)).not.toContain('SS-099');
  });

  it('takes the most recent inspection where there are several', () => {
    expect(round().rows.find((one) => one.dealer === 'SP-118').last).toBe('2025-04-09');
  });

  it('shuts a plant that failed a critical item and gives it no due date', () => {
    const june = round(civilDate(2025, 6, 30));
    const row = june.rows.find((one) => one.dealer === 'DP-003');
    expect(row.outcome).toBe('shut until re-inspected');
    expect(row.due).toBe('-');
    expect(june.problems.has('inspection.shut')).toBe(true);
  });

  it('puts it back on the round once it has been re-inspected', () => {
    const row = round().rows.find((one) => one.dealer === 'DP-003');
    expect(row.outcome).toBe('routine');
    expect(row.due).toBe('2026-07-15');
  });

  it('counts a plant past its routine date as overdue', () => {
    const row = round().rows.find((one) => one.dealer === 'RP-007');
    expect(row.state).toBe('overdue');
    expect(Number(row.over)).toBeGreaterThan(100);
    expect(round().problems.has('inspection.overdue')).toBe(true);
  });

  it('leaves a plant inside its year alone', () => {
    expect(round().rows.find((one) => one.dealer === 'SS-042').state).toBe('current');
  });

  it('reports a certified dealer nobody has ever walked', () => {
    const answer = round(on, { inspections: [] });
    expect(answer.neverSeen).toBe(4);
    expect(answer.problems.has('inspection.neverSeen')).toBe(true);
  });
});

describe('who to visit next', () => {
  it('is the one never inspected before anybody overdue', () => {
    expect(nextToVisit(round(on, { inspections: [] })).state).toBe('never inspected');
  });

  it('is the one longest overdue where everybody has been seen', () => {
    expect(nextToVisit(round()).dealer).toBe('RP-007');
  });

  it('is nobody where every plant has been seen and none is overdue', () => {
    expect(nextToVisit(round(civilDate(2024, 6, 1), { inspections: recent }))).toBeNull();
  });

  it('lists who falls due before a date', () => {
    expect(dueBefore(round(), civilDate(2026, 5, 1)).map((one) => one.dealer)).toEqual([
      'RP-007',
      'SP-118',
      'SS-042',
    ]);
    expect(dueBefore(round(), civilDate(2024, 1, 1))).toEqual([]);
  });
});

describe('the rendered round', () => {
  const text = renderInspections(round());

  it('counts the dealers, the unseen and the overdue', () => {
    expect(text).toMatch(/Certified dealers: 4/);
    expect(text).toMatch(/Never inspected:\s+0/);
    expect(text).toMatch(/Overdue:\s+1/);
  });

  it('prints the findings underneath', () => {
    expect(text).toContain('days past due');
    expect(renderInspections(round(civilDate(2025, 6, 30)))).toContain(
      'is shut until it is re-inspected',
    );
  });

  it('is the same text twice', () => {
    expect(renderInspections(round())).toBe(text);
  });
});

describe('the inspections command', () => {
  it('exits with a finding while a plant is shut', () => {
    const io = recorder();
    expect(inspections(base({ on: '2025-06-30' }), io)).toBe(FOUND);
    expect(io.out).toContain('Inspection round');
  });

  it('names who to visit next', () => {
    const io = recorder();
    inspections(base({ on: '2025-09-30' }), io);
    expect(io.out).toMatch(/Next to visit: RP-007 Harkers Island Repack\./);
  });

  it('exits clean once every plant is on the round and none is shut', () => {
    const io = recorder();
    expect(inspections(base({ on: '2025-08-01' }), io)).toBe(OK);
  });

  it('prints the round as JSON when asked', () => {
    const io = recorder();
    inspections(base({ on: '2025-09-30', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.dealers).toBe(4);
    expect(answer.next).toBe('RP-007');
  });
});

describe('a round is asked about a day, not about the file', () => {
  it('does not read an inspection that had not happened yet', () => {
    const before = round(civilDate(2025, 5, 1)).rows.find((one) => one.dealer === 'DP-003');
    const after = round(civilDate(2025, 6, 30)).rows.find((one) => one.dealer === 'DP-003');
    expect(before.outcome).toBe('never inspected');
    expect(after.outcome).toBe('shut until re-inspected');
  });

  it('reads the earlier of two inspections when asked about a day between them', () => {
    const row = round(civilDate(2025, 3, 20)).rows.find((one) => one.dealer === 'SP-118');
    expect(row.last).toBe('2025-03-06');
  });

  it('reads the later one once the day has passed it', () => {
    const row = round(civilDate(2025, 5, 20)).rows.find((one) => one.dealer === 'SP-118');
    expect(row.last).toBe('2025-04-09');
  });
});
