import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import * as cullring from '../../src/index.js';

const run = (cwd) =>
  execFileSync(process.execPath, [join(process.cwd(), 'tools/check_exports.js')], {
    cwd,
    encoding: 'utf8',
  });

let scratch = null;

afterEach(() => {
  if (scratch !== null) {
    rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  }
});

describe('the entry point', () => {
  it('exposes every package as a namespace', () => {
    for (const name of [
      'area',
      'cli',
      'condition',
      'core',
      'geo',
      'harvest',
      'io',
      'licence',
      'report',
      'survey',
      'text',
      'tide',
      'time',
      'trace',
      'treatment',
      'vibrio',
      'weather',
    ]) {
      expect(cullring[name]).toBeTypeOf('object');
    }
  });

  it('reaches a command body through the cli namespace', () => {
    expect(cullring.cli.commands.validate).toBeTypeOf('function');
  });

  it('reaches a rule through its own namespace', () => {
    expect(cullring.area.classification('approved').name).toBe('approved');
    expect(cullring.vibrio.hoursAllowed('warm', 8)).toBe(10);
  });
});

describe('the check itself', () => {
  it('passes over this tree', () => {
    expect(run(process.cwd())).toMatch(/every module in \d+ packages is reachable/);
  });

  it('fails when a module is not exported from its package index', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cullring-exports-'));
    cpSync('src', join(scratch, 'src'), { recursive: true });
    writeFileSync(join(scratch, 'src/geo/orphan.js'), 'export const orphan = 1;\n');
    expect(() => run(scratch)).toThrow();
  });

  it('fails when a package is not exported from the entry point', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cullring-exports-'));
    cpSync('src', join(scratch, 'src'), { recursive: true });
    mkdirSync(join(scratch, 'src/orphanage'));
    writeFileSync(join(scratch, 'src/orphanage/index.js'), 'export const nothing = 1;\n');
    expect(() => run(scratch)).toThrow();
  });

  it('fails when a package has no index at all', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cullring-exports-'));
    cpSync('src', join(scratch, 'src'), { recursive: true });
    rmSync(join(scratch, 'src/geo/index.js'));
    expect(() => run(scratch)).toThrow();
  });
});
