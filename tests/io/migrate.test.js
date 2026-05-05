import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BARE_NUMBER_MEANT,
  describeChange,
  migrate,
  needsMigration,
} from '../../src/io/migrate.js';
import { SCHEMA_VERSION } from '../../src/io/schema.js';
import { migrateCommand } from '../../src/cli/commands/migrate.js';
import { buildReopening } from '../../src/io/load.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { recorder } from '../support/cli.js';

const OLD = Object.freeze({
  programme: 'Core Sound',
  areas: [],
  plans: [
    { area: 'B-12', trigger: { kind: 'rainfall' }, reopening: 72, effectiveFrom: '2024-01-01' },
    {
      area: 'B-14',
      trigger: { kind: 'rainfall' },
      reopening: { kind: 'after samples', count: 2 },
      effectiveFrom: '2024-01-01',
    },
  ],
});

describe('needsMigration', () => {
  it('says yes to an unversioned file', () => {
    expect(needsMigration(OLD)).toBe(true);
  });

  it('says no to a current one', () => {
    expect(needsMigration({ version: SCHEMA_VERSION })).toBe(false);
  });

  it('says no to a file it cannot read the version of', () => {
    expect(needsMigration({ version: 9 })).toBe(false);
  });
});

describe('migrate', () => {
  it('stamps the version and leaves everything else alone', () => {
    const answer = migrate(OLD);
    expect(answer.register.version).toBe(SCHEMA_VERSION);
    expect(answer.register.programme).toBe('Core Sound');
    expect(answer.from).toBe(1);
  });

  it('never touches the file it was handed', () => {
    migrate(OLD);
    expect(OLD.plans[0].reopening).toBe(72);
    expect(OLD.version).toBeUndefined();
  });

  it('writes a bare reopening number out as the clock it always meant', () => {
    const answer = migrate(OLD);
    expect(answer.register.plans[0].reopening).toEqual({ kind: 'after hours', hours: 72 });
    expect(BARE_NUMBER_MEANT).toBe('hours');
  });

  it('leaves a reopening that already names its clock', () => {
    expect(migrate(OLD).register.plans[1].reopening).toEqual({ kind: 'after samples', count: 2 });
  });

  it('lists every change so somebody can be shown it', () => {
    const answer = migrate(OLD);
    expect(answer.changes.map((one) => one.what)).toEqual(['version', 'reopening']);
    expect(describeChange(answer.changes[0])).toBe('version 1 becomes 2');
    expect(describeChange(answer.changes[1])).toContain('B-12 reopens after 72');
  });

  it('says so and does nothing when the file is already current', () => {
    const answer = migrate({ version: SCHEMA_VERSION, areas: [] });
    expect(answer.changes).toEqual([]);
    expect(answer.problems.codes()).toEqual(['migrate.current']);
  });

  it('refuses a version it cannot read rather than guessing at it', () => {
    const answer = migrate({ version: 9 });
    expect(answer.to).toBe(null);
    expect(answer.problems.hasError()).toBe(true);
  });

  it('copes with a file that carries no plans at all', () => {
    expect(migrate({ areas: [] }).register.plans).toBeUndefined();
  });
});

describe('the loader and the bare number', () => {
  it('refuses one, and names the way out', () => {
    expect(() => buildReopening(72)).toThrow(/run migrate on it/);
  });

  it('takes the migrated form', () => {
    expect(buildReopening(migrate(OLD).register.plans[0].reopening).kind).toBe('after hours');
  });
});

describe('the migrate command', () => {
  const withCase = (register) => {
    const directory = mkdtempSync(join(tmpdir(), 'cullring-'));
    writeFileSync(join(directory, 'register.json'), JSON.stringify(register), 'utf8');
    return directory;
  };

  it('says what it would change and writes nothing', () => {
    const directory = withCase(OLD);
    const io = recorder();
    expect(migrateCommand({ case: directory }, io)).toBe(FOUND);
    expect(io.out).toContain('version 1 becomes 2');
    expect(io.out).toContain('Nothing was written.');
    expect(
      JSON.parse(readFileSync(join(directory, 'register.json'), 'utf8')).version,
    ).toBeUndefined();
  });

  it('replaces the file when told to in as many words', () => {
    const directory = withCase(OLD);
    const io = recorder();
    expect(migrateCommand({ case: directory, write: true }, io)).toBe(FOUND);
    const after = JSON.parse(readFileSync(join(directory, 'register.json'), 'utf8'));
    expect(after.version).toBe(SCHEMA_VERSION);
    expect(after.plans[0].reopening).toEqual({ kind: 'after hours', hours: 72 });
    expect(io.out).toContain('Written to');
  });

  it('is worth running twice, and the second time does nothing', () => {
    const directory = withCase(OLD);
    migrateCommand({ case: directory, write: true }, recorder());
    const io = recorder();
    expect(migrateCommand({ case: directory, write: true }, io)).toBe(OK);
    expect(io.out).toContain('Nothing to do.');
  });

  it('refuses a directory with no register in it', () => {
    const io = recorder();
    expect(migrateCommand({ case: mkdtempSync(join(tmpdir(), 'cullring-')) }, io)).toBe(REFUSED);
    expect(io.err).toContain('is not in');
  });

  it('refuses a register it cannot parse', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cullring-'));
    writeFileSync(join(directory, 'register.json'), '{ not json', 'utf8');
    const io = recorder();
    expect(migrateCommand({ case: directory }, io)).toBe(REFUSED);
    expect(io.err).toContain('is not readable');
  });

  it('refuses a version it cannot read', () => {
    const directory = withCase({ version: 9 });
    const io = recorder();
    expect(migrateCommand({ case: directory }, io)).toBe(REFUSED);
    expect(io.err).toContain('schema.version');
  });

  it('prints what it would do as JSON without writing', () => {
    const directory = withCase(OLD);
    const io = recorder();
    migrateCommand({ case: directory, json: true }, io);
    const answer = JSON.parse(io.out);
    expect(answer.from).toBe(1);
    expect(answer.written).toBe(false);
    expect(answer.changes).toHaveLength(2);
  });
});
