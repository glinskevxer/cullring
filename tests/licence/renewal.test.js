import { describe, expect, it } from 'vitest';

import {
  CURRENT_LICENCE,
  GONE,
  GRACE_DAYS,
  IN_GRACE,
  NOTICE_DAYS,
  NOT_YET_ISSUED,
  describeRenewal,
  licenceStanding,
  mayRenew,
  renewalRound,
  renewed,
} from '../../src/licence/renewal.js';
import { certificate } from '../../src/licence/education.js';
import { harvester, suspension } from '../../src/licence/harvester.js';
import { civilDate, formatCivilDate } from '../../src/time/civil.js';

const LICENCE = harvester({
  id: 'SH-2025-04412',
  name: 'R Willis',
  gears: ['tongs', 'hand'],
  issuedOn: '2025-01-01',
  expiresOn: '2025-12-31',
});

const sat = (on) => certificate({ harvester: 'SH-2025-04412', course: 'harvester', sat: on });

const CURRENT_CERT = [sat('2024-06-01')];
const LAPSED_CERT = [sat('2018-06-01')];

describe('licenceStanding', () => {
  it('reads a licence inside its term as current, with the days left', () => {
    const where = licenceStanding(LICENCE, civilDate(2025, 12, 1));
    expect(where.state).toBe(CURRENT_LICENCE);
    expect(where.daysLeft).toBe(30);
  });

  it('counts the last day of the term as inside it', () => {
    expect(licenceStanding(LICENCE, civilDate(2025, 12, 31)).state).toBe(CURRENT_LICENCE);
  });

  it('reads the day after as lapsed but inside the grace period', () => {
    const where = licenceStanding(LICENCE, civilDate(2026, 1, 1));
    expect(where.state).toBe(IN_GRACE);
    expect(formatCivilDate(where.graceEndsOn)).toBe('2026-03-31');
  });

  it('counts the last day of the grace period as inside it', () => {
    expect(licenceStanding(LICENCE, civilDate(2026, 3, 31)).state).toBe(IN_GRACE);
    expect(licenceStanding(LICENCE, civilDate(2026, 4, 1)).state).toBe(GONE);
    expect(GRACE_DAYS).toBe(90);
  });

  it('reads a day before the licence was issued', () => {
    expect(licenceStanding(LICENCE, civilDate(2024, 12, 31)).state).toBe(NOT_YET_ISSUED);
  });

  it('takes a shorter grace period when the office keeps one', () => {
    expect(licenceStanding(LICENCE, civilDate(2026, 1, 20), { graceDays: 7 }).state).toBe(GONE);
  });
});

describe('mayRenew', () => {
  it('lets a current licence with a current certificate renew', () => {
    const answer = mayRenew(LICENCE, { certificates: CURRENT_CERT, on: civilDate(2025, 12, 1) });
    expect(answer.mayRenew).toBe(true);
    expect(answer.because).toEqual([]);
  });

  it('lets a licence inside the grace period renew', () => {
    expect(
      mayRenew(LICENCE, { certificates: CURRENT_CERT, on: civilDate(2026, 2, 1) }).mayRenew,
    ).toBe(true);
  });

  it('refuses a licence whose certificate has lapsed', () => {
    const answer = mayRenew(LICENCE, { certificates: LAPSED_CERT, on: civilDate(2025, 12, 1) });
    expect(answer.mayRenew).toBe(false);
    expect(answer.because[0]).toContain('education certificate is lapsed');
  });

  it('refuses somebody who never sat it at all', () => {
    const answer = mayRenew(LICENCE, { certificates: [], on: civilDate(2025, 12, 1) });
    expect(answer.because[0]).toContain('never sat');
  });

  it('gives every reason rather than the first one it found', () => {
    const answer = mayRenew(LICENCE, { certificates: LAPSED_CERT, on: civilDate(2026, 6, 1) });
    expect(answer.because).toHaveLength(2);
  });

  it('lets a suspended licence renew, and says it is still suspended', () => {
    const banned = harvester({
      ...LICENCE,
      issuedOn: '2025-01-01',
      expiresOn: '2025-12-31',
      gears: ['tongs'],
      suspensions: [suspension({ from: '2025-06-01', to: '2026-06-01', reason: 'closed water' })],
    });
    const answer = mayRenew(banned, { certificates: CURRENT_CERT, on: civilDate(2025, 12, 1) });
    expect(answer.mayRenew).toBe(true);
    expect(answer.suspended).toBe(true);
  });
});

describe('renewalRound', () => {
  const round = (on, certificates = CURRENT_CERT, licences = [LICENCE]) =>
    renewalRound(licences, { certificates, on });

  it('says nothing about a licence with most of its year left', () => {
    const answer = round(civilDate(2025, 6, 1));
    expect(answer.rows).toEqual([]);
    expect(answer.problems.isClean()).toBe(true);
  });

  it('writes to a grower inside the notice period', () => {
    const answer = round(civilDate(2025, 12, 1));
    expect(answer.rows).toHaveLength(1);
    expect(answer.problems.codes()).toEqual(['renewal.due']);
    expect(NOTICE_DAYS).toBe(45);
  });

  it('warns once a licence is in grace, with both dates', () => {
    const answer = round(civilDate(2026, 2, 1));
    expect(answer.problems.codes()).toEqual(['renewal.inGrace']);
    expect(answer.problems.list()[0].message).toContain('has until 2026-03-31');
  });

  it('calls a licence past the grace period a new application', () => {
    const answer = round(civilDate(2026, 6, 1));
    expect(answer.problems.codes()).toContain('renewal.lapsed');
    expect(answer.rows[0].mayRenew).toBe(false);
  });

  it('does not also say blocked about one that is simply gone', () => {
    expect(round(civilDate(2026, 6, 1)).problems.codes()).not.toContain('renewal.blocked');
  });

  it('says one letter is needed about both the licence and the certificate', () => {
    const answer = round(civilDate(2025, 12, 1), LAPSED_CERT);
    expect(answer.problems.codes()).toEqual(['renewal.blocked']);
    expect(answer.rows[0].education).toBe('lapsed');
  });

  it('leaves out a licence that has not been issued yet', () => {
    const future = harvester({
      id: 'SH-2026-00001',
      name: 'A Newcomer',
      gears: ['hand'],
      issuedOn: '2026-01-01',
      expiresOn: '2026-12-31',
    });
    expect(round(civilDate(2025, 12, 1), CURRENT_CERT, [future]).rows).toEqual([]);
  });

  it('sorts the round by licence number', () => {
    const other = harvester({
      id: 'SH-2025-01120',
      name: 'B Gaskill',
      gears: ['hand'],
      issuedOn: '2025-01-01',
      expiresOn: '2025-12-31',
    });
    const answer = round(civilDate(2025, 12, 1), CURRENT_CERT, [LICENCE, other]);
    expect(answer.rows.map((one) => one.harvester)).toEqual(['SH-2025-01120', 'SH-2025-04412']);
  });
});

describe('renewed', () => {
  it('gives a new term on the same number', () => {
    const answer = renewed(LICENCE, { on: civilDate(2025, 12, 1), certificates: CURRENT_CERT });
    expect(answer.renewed).toBe(true);
    expect(answer.licence.id).toBe('SH-2025-04412');
    expect(formatCivilDate(answer.licence.expiresOn)).toBe('2026-12-31');
  });

  it('runs the new term from the lapse rather than from today, so nobody gains a month', () => {
    const answer = renewed(LICENCE, { on: civilDate(2026, 2, 1), certificates: CURRENT_CERT });
    expect(formatCivilDate(answer.licence.expiresOn)).toBe('2026-12-31');
  });

  it('never touches the licence it was handed', () => {
    renewed(LICENCE, { on: civilDate(2025, 12, 1), certificates: CURRENT_CERT });
    expect(formatCivilDate(LICENCE.expiresOn)).toBe('2025-12-31');
  });

  it('refuses and says why', () => {
    const answer = renewed(LICENCE, { on: civilDate(2025, 12, 1), certificates: LAPSED_CERT });
    expect(answer.renewed).toBe(false);
    expect(answer.licence).toBe(null);
    expect(answer.because[0]).toContain('education certificate');
  });

  it('takes a longer term when the office sells one', () => {
    const answer = renewed(LICENCE, {
      on: civilDate(2025, 12, 1),
      certificates: CURRENT_CERT,
      years: 3,
    });
    expect(formatCivilDate(answer.licence.expiresOn)).toBe('2028-12-30');
  });

  it('describes a row in a line', () => {
    const answer = renewalRound([LICENCE], {
      certificates: LAPSED_CERT,
      on: civilDate(2025, 12, 1),
    });
    expect(describeRenewal(answer.rows[0])).toContain('may not renew');
  });
});
