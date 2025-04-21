import { describe, expect, it } from 'vitest';

import {
  DEPURATE,
  OPERATIONS,
  RECEIVE,
  REPACK,
  SHIP,
  SHUCK,
  WET_STORE,
  dealer,
  dealersFor,
  describeDealer,
  findDealer,
  isCertified,
  mayPerform,
  permittedOperations,
} from '../../src/licence/dealer.js';
import { civilDate } from '../../src/time/civil.js';

const make = (id, name, extra = {}) =>
  dealer({ id, name, certifiedOn: '2025-01-01', expiresOn: '2025-12-31', ...extra });

const shipper = make('SS-042', 'Beaufort Oyster');
const shucker = make('SP-118', 'Core Sound Packing');
const repacker = make('RP-007', 'Harkers Island Repack');
const depurator = make('DP-003', 'Newport River Depuration');
const revoked = make('SS-099', 'Gone Concern', { revokedOn: '2025-06-01' });
const ALL = [shipper, shucker, repacker, depurator, revoked];

describe('the certification kind comes off the number', () => {
  it.each([
    ['SS-042', 'shellstock shipper'],
    ['SP-118', 'shucker packer'],
    ['RP-007', 'repacker'],
    ['DP-003', 'depuration processor'],
  ])('reads %s', (id, kind) => {
    expect(make(id, 'Test').kind).toBe(kind);
  });

  it('refuses a number with no kind in it', () => {
    expect(() => make('XX-001', 'Test')).toThrow(/certification number/);
  });
});

describe('what each kind may do', () => {
  it('lets a shellstock shipper receive, ship and wet store, and nothing else', () => {
    expect(permittedOperations('SS').sort()).toEqual([RECEIVE, SHIP, WET_STORE].sort());
  });

  it('lets only a shucker packer shuck', () => {
    expect(permittedOperations('SP')).toContain(SHUCK);
    for (const prefix of ['SS', 'RP', 'DP']) {
      expect(permittedOperations(prefix)).not.toContain(SHUCK);
    }
  });

  it('lets only a repacker repack', () => {
    expect(permittedOperations('RP')).toContain(REPACK);
    for (const prefix of ['SS', 'SP', 'DP']) {
      expect(permittedOperations(prefix)).not.toContain(REPACK);
    }
  });

  it('lets only a depuration processor depurate', () => {
    expect(permittedOperations('DP')).toContain(DEPURATE);
    for (const prefix of ['SS', 'SP', 'RP']) {
      expect(permittedOperations(prefix)).not.toContain(DEPURATE);
    }
  });

  it('lets every kind receive and ship, which is what makes them dealers', () => {
    for (const prefix of ['SS', 'SP', 'RP', 'DP']) {
      expect(permittedOperations(prefix)).toContain(RECEIVE);
      expect(permittedOperations(prefix)).toContain(SHIP);
    }
  });

  it('takes a dealer as well as a prefix', () => {
    expect(permittedOperations(depurator)).toContain(DEPURATE);
  });

  it('refuses a prefix that is not a kind', () => {
    expect(() => permittedOperations('ZZ')).toThrow(/not a certification kind/);
  });

  it('hands back a copy, so a caller cannot edit the table', () => {
    const list = permittedOperations('SS');
    list.push(SHUCK);
    expect(permittedOperations('SS')).not.toContain(SHUCK);
  });
});

describe('certification dates', () => {
  it('reads both ends of the year as inclusive', () => {
    expect(isCertified(shipper, civilDate(2025, 1, 1))).toBe(true);
    expect(isCertified(shipper, civilDate(2025, 12, 31))).toBe(true);
    expect(isCertified(shipper, civilDate(2026, 1, 1))).toBe(false);
  });

  it('stops on the day of revocation, not the day after', () => {
    expect(isCertified(revoked, civilDate(2025, 5, 31))).toBe(true);
    expect(isCertified(revoked, civilDate(2025, 6, 1))).toBe(false);
  });

  it('refuses a certification that expires before it was issued', () => {
    expect(() =>
      dealer({ id: 'SS-001', name: 'Test', certifiedOn: '2025-12-31', expiresOn: '2025-01-01' }),
    ).toThrow(/expire before it is issued/);
  });
});

describe('what a dealer may do on a day', () => {
  it('permits an operation the kind allows while the certification stands', () => {
    expect(mayPerform(shucker, SHUCK, civilDate(2025, 6, 10))).toBe(true);
  });

  it('refuses an operation the kind does not allow, however current the paper', () => {
    expect(mayPerform(shipper, SHUCK, civilDate(2025, 6, 10))).toBe(false);
    expect(mayPerform(shucker, DEPURATE, civilDate(2025, 6, 10))).toBe(false);
  });

  it('refuses everything once the certification has lapsed or been revoked', () => {
    expect(mayPerform(shucker, SHUCK, civilDate(2026, 6, 10))).toBe(false);
    expect(mayPerform(revoked, RECEIVE, civilDate(2025, 7, 1))).toBe(false);
  });

  it('refuses an operation that is not one, and lists the ones that are', () => {
    try {
      mayPerform(shipper, 'freeze', civilDate(2025, 6, 10));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.detail.known).toEqual(OPERATIONS.slice());
    }
  });
});

describe('finding somebody who can take a lot', () => {
  it('names the only dealer who can depurate', () => {
    expect(dealersFor(ALL, DEPURATE, civilDate(2025, 6, 10)).map((one) => one.id)).toEqual([
      'DP-003',
    ]);
  });

  it('names everybody who can receive, in number order', () => {
    expect(dealersFor(ALL, RECEIVE, civilDate(2025, 3, 1)).map((one) => one.id)).toEqual([
      'DP-003',
      'RP-007',
      'SP-118',
      'SS-042',
      'SS-099',
    ]);
  });

  it('drops the revoked one once the revocation lands', () => {
    expect(dealersFor(ALL, RECEIVE, civilDate(2025, 7, 1)).map((one) => one.id)).not.toContain(
      'SS-099',
    );
  });

  it('names nobody where nobody is certified', () => {
    expect(dealersFor(ALL, DEPURATE, civilDate(2030, 1, 1))).toEqual([]);
  });
});

describe('finding and describing', () => {
  it('finds by number and answers with nothing where there is none', () => {
    expect(findDealer(ALL, 'sp-118').name).toBe('Core Sound Packing');
    expect(findDealer(ALL, 'SP-999')).toBeNull();
  });

  it('describes a dealer the way the shipping document does', () => {
    expect(describeDealer(shucker)).toBe('SP-118 Core Sound Packing (shucker packer)');
  });
});
