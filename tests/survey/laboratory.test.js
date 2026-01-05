import { describe, expect, it } from 'vitest';

import {
  CARRIAGE_HIGH,
  CARRIAGE_LOW,
  FIVE_TUBE,
  HOLDING_HOURS,
  MEMBRANE,
  METHODS,
  THREE_TUBE,
  acceptedFor,
  checkSubmission,
  partition,
} from '../../src/survey/laboratory.js';
import { FECAL_COLIFORM, TOTAL_COLIFORM } from '../../src/survey/standard.js';
import { parseInstant } from '../../src/time/instant.js';

const at = (text) => parseInstant(text, { zone: 'eastern' });

const submit = (extra = {}) =>
  checkSubmission({
    station: 'B12-01',
    analysis: FECAL_COLIFORM,
    method: FIVE_TUBE,
    collectedAt: at('2025-08-14 08:00'),
    benchedAt: at('2025-08-14 16:00'),
    carriageDegrees: 4,
    ...extra,
  });

describe('the methods', () => {
  it('names the three the programme reads', () => {
    expect(METHODS).toEqual([FIVE_TUBE, THREE_TUBE, MEMBRANE]);
  });

  it('accepts the five tube series for both analyses', () => {
    expect(acceptedFor(FIVE_TUBE)).toEqual([FECAL_COLIFORM, TOTAL_COLIFORM]);
  });

  it('accepts the three tube series for total coliform only', () => {
    expect(acceptedFor(THREE_TUBE)).toEqual([TOTAL_COLIFORM]);
  });

  it('accepts membrane filtration for fecal coliform only', () => {
    expect(acceptedFor(MEMBRANE)).toEqual([FECAL_COLIFORM]);
  });

  it('refuses a method it does not read', () => {
    expect(() => acceptedFor('a hunch')).toThrow(/not a method this programme reads/);
  });
});

describe('a good submission', () => {
  it('is usable', () => {
    const answer = submit();
    expect(answer.usable).toBe(true);
    expect(answer.problems.isClean()).toBe(true);
    expect(answer.heldHours).toBe(8);
  });

  it('is usable right up to the holding time', () => {
    expect(submit({ benchedAt: at('2025-08-15 08:00') }).usable).toBe(true);
    expect(submit({ benchedAt: at('2025-08-15 09:00') }).usable).toBe(false);
    expect(HOLDING_HOURS).toBe(24);
  });

  it('is usable at either end of the carriage range', () => {
    expect(submit({ carriageDegrees: CARRIAGE_LOW }).usable).toBe(true);
    expect(submit({ carriageDegrees: CARRIAGE_HIGH }).usable).toBe(true);
  });
});

describe('what voids a result', () => {
  it('voids one held too long', () => {
    const answer = submit({ benchedAt: at('2025-08-16 08:00') });
    expect(answer.usable).toBe(false);
    expect(answer.problems.has('laboratory.overHeld')).toBe(true);
  });

  it('voids one benched before it was collected', () => {
    expect(submit({ benchedAt: at('2025-08-13 08:00') }).problems.has('laboratory.order')).toBe(
      true,
    );
  });

  it('voids one carried too warm or too cold', () => {
    expect(submit({ carriageDegrees: 18 }).problems.has('laboratory.carriage')).toBe(true);
    expect(submit({ carriageDegrees: -4 }).problems.has('laboratory.carriage')).toBe(true);
  });

  it('voids one run by a method not accepted for the analysis', () => {
    const answer = submit({ method: THREE_TUBE, analysis: FECAL_COLIFORM });
    expect(answer.problems.has('laboratory.methodMismatch')).toBe(true);
    expect(answer.usable).toBe(false);
  });

  it('accepts the same method for the analysis it is accepted for', () => {
    expect(submit({ method: THREE_TUBE, analysis: TOTAL_COLIFORM }).usable).toBe(true);
  });

  it('voids one run by a method it does not read at all', () => {
    expect(submit({ method: 'a hunch' }).problems.has('laboratory.method')).toBe(true);
  });

  it('refuses times that are not instants', () => {
    expect(submit({ benchedAt: '2025-08-14 16:00' }).problems.has('laboratory.time')).toBe(true);
  });

  it('reports everything wrong with it, not the first thing', () => {
    const answer = submit({ benchedAt: at('2025-08-16 08:00'), carriageDegrees: 18 });
    expect(answer.problems.of('error')).toHaveLength(2);
  });

  it('warns rather than voids where no carriage temperature was recorded', () => {
    const answer = submit({ carriageDegrees: null });
    expect(answer.problems.has('laboratory.noCarriage')).toBe(true);
    expect(answer.usable).toBe(true);
  });
});

describe('splitting a run', () => {
  it('keeps the usable and the voided apart, and keeps both', () => {
    const run = [submit(), submit({ benchedAt: at('2025-08-16 08:00') }), submit()];
    const answer = partition(run);
    expect(answer.usable).toHaveLength(2);
    expect(answer.voided).toHaveLength(1);
  });

  it('splits an empty run into two empty lists', () => {
    expect(partition([])).toEqual({ usable: [], voided: [] });
  });

  it('loses nothing, which is what lets a survey say why it cannot be scored', () => {
    const run = [submit(), submit({ carriageDegrees: 18 }), submit({ method: 'a hunch' })];
    const answer = partition(run);
    expect(answer.usable.length + answer.voided.length).toBe(run.length);
  });
});
