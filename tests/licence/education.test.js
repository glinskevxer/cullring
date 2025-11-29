import { describe, expect, it } from 'vitest';

import {
  CERTIFICATE_YEARS,
  CURRENT,
  DUE_SOON,
  LAPSED,
  NEVER_SAT,
  REMINDER_DAYS,
  STATES,
  certificate,
  chaseList,
  describeStanding,
  latestFor,
  mayWork,
  standing,
} from '../../src/licence/education.js';
import { HARVESTERS } from '../support/people.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';

const one = certificate({
  harvester: 'SH-2025-04412',
  course: 'shellfish sanitation',
  sat: '2024-02-19',
});

const older = certificate({
  harvester: 'SH-2025-04412',
  course: 'shellfish sanitation',
  sat: '2021-02-19',
});

const other = certificate({
  harvester: 'SH-2025-00877',
  course: 'shellfish sanitation',
  sat: '2023-11-06',
});

const HELD = [older, one, other];

describe('building a certificate', () => {
  it('works the expiry out from the day it was sat', () => {
    expect(CERTIFICATE_YEARS).toBe(3);
    expect(formatCivilDate(one.expires)).toBe('2027-02-19');
  });

  it('refuses a certificate with no course or no day', () => {
    expect(() => certificate({ harvester: 'SH-2025-04412', sat: '2024-02-19' })).toThrow(/course/);
    expect(() =>
      certificate({ harvester: 'SH-2025-04412', course: 'shellfish sanitation' }),
    ).toThrow(/day it was sat/);
  });

  it('refuses a licence number that is not one', () => {
    expect(() => certificate({ harvester: 'SP-118', course: 'x', sat: '2024-02-19' })).toThrow(
      /harvester licence number/,
    );
  });
});

describe('the most recent certificate', () => {
  it('is the one sat last, whatever order the list is in', () => {
    expect(formatCivilDate(latestFor(HELD, 'SH-2025-04412').sat)).toBe('2024-02-19');
  });

  it('is nothing for somebody with none', () => {
    expect(latestFor(HELD, 'SH-2025-01120')).toBeNull();
  });
});

describe('where a harvester stands', () => {
  it('is current well before the expiry', () => {
    const answer = standing(HELD, 'SH-2025-04412', civilDate(2025, 8, 14));
    expect(answer.state).toBe(CURRENT);
    expect(answer.daysLeft).toBeGreaterThan(REMINDER_DAYS);
  });

  it('is due soon inside the reminder period', () => {
    expect(standing(HELD, 'SH-2025-04412', civilDate(2027, 1, 15)).state).toBe(DUE_SOON);
  });

  it('is lapsed after the expiry', () => {
    const answer = standing(HELD, 'SH-2025-04412', civilDate(2027, 3, 1));
    expect(answer.state).toBe(LAPSED);
    expect(answer.daysLeft).toBeLessThan(0);
  });

  it('tells never having sat it apart from having let it lapse', () => {
    const never = standing(HELD, 'SH-2025-01120', civilDate(2025, 8, 14));
    expect(never.state).toBe(NEVER_SAT);
    expect(never.certificate).toBeNull();
    expect(NEVER_SAT).not.toBe(LAPSED);
  });

  it('only ever names one of the four states', () => {
    for (const day of [civilDate(2020, 1, 1), civilDate(2025, 8, 14), civilDate(2030, 1, 1)]) {
      expect(STATES).toContain(standing(HELD, 'SH-2025-04412', day).state);
    }
  });

  it('is current on the expiry day itself', () => {
    expect(standing(HELD, 'SH-2025-04412', civilDate(2027, 2, 19)).state).toBe(DUE_SOON);
    expect(standing(HELD, 'SH-2025-04412', civilDate(2027, 2, 20)).state).toBe(LAPSED);
  });
});

describe('whether it lets somebody work', () => {
  it('lets a current and a due soon certificate through', () => {
    expect(mayWork(HELD, 'SH-2025-04412', civilDate(2025, 8, 14))).toBe(true);
    expect(mayWork(HELD, 'SH-2025-04412', civilDate(2027, 1, 15))).toBe(true);
  });

  it('stops a lapsed one and somebody who never sat it', () => {
    expect(mayWork(HELD, 'SH-2025-04412', civilDate(2027, 3, 1))).toBe(false);
    expect(mayWork(HELD, 'SH-2025-01120', civilDate(2025, 8, 14))).toBe(false);
  });

  it('says which of the two it is', () => {
    expect(
      describeStanding('SH-2025-04412', standing(HELD, 'SH-2025-04412', civilDate(2027, 3, 1))),
    ).toMatch(/let the certificate lapse on 2027-02-19/);
    expect(
      describeStanding('SH-2025-01120', standing(HELD, 'SH-2025-01120', civilDate(2025, 8, 14))),
    ).toMatch(/has never sat the course/);
  });

  it('describes a current and a due soon certificate differently', () => {
    expect(
      describeStanding('SH-2025-04412', standing(HELD, 'SH-2025-04412', civilDate(2025, 8, 14))),
    ).toMatch(/is current until/);
    expect(
      describeStanding('SH-2025-04412', standing(HELD, 'SH-2025-04412', civilDate(2027, 1, 15))),
    ).toMatch(/days left on the certificate/);
  });
});

describe('the chase list', () => {
  it('names everybody who cannot work that day, in order', () => {
    const chased = chaseList(HELD, HARVESTERS, civilDate(2025, 8, 14));
    expect(chased.map((one_) => one_.harvester)).toEqual(['SH-2024-03310']);
  });

  it('grows once a certificate lapses', () => {
    const chased = chaseList(HELD, HARVESTERS, civilDate(2027, 3, 1));
    expect(chased.map((one_) => one_.harvester)).toContain('SH-2025-04412');
  });

  it('carries the reason and the name for the letter', () => {
    const chased = chaseList(HELD, HARVESTERS, civilDate(2025, 8, 14));
    expect(chased[0].name).toBeTruthy();
    expect(chased[0].state).toBe(NEVER_SAT);
  });
});
