import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { commandNames, describeProgram, renderCommandsDocument } from '../../src/cli/describe.js';

const described = describeProgram();

describe('the command tree describes itself', () => {
  it('names every command once', () => {
    const names = commandNames();
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('standing');
    expect(names).toContain('recall');
    expect(names).toContain('walk');
  });

  it('gives every command a description', () => {
    for (const command of described) {
      expect(command.description.length).toBeGreaterThan(10);
    }
  });

  it('gives every command the three common options', () => {
    for (const command of described) {
      const flags = command.options.map((one) => one.flags);
      expect(flags).toContain('-c, --case <directory>');
      expect(flags).toContain('-z, --zone <zone>');
      expect(flags).toContain('--json');
    }
  });

  it('marks the case option required and the zone option not', () => {
    const validate = described.find((one) => one.name === 'validate');
    const caseOption = validate.options.find((one) => one.flags.startsWith('-c'));
    const zoneOption = validate.options.find((one) => one.flags.startsWith('-z'));
    expect(caseOption.required).toBe(true);
    expect(zoneOption.required).toBe(false);
  });

  it('does not confuse an option that takes a value with one that is mandatory', () => {
    const validate = described.find((one) => one.name === 'validate');
    const zoneOption = validate.options.find((one) => one.flags.startsWith('-z'));
    expect(zoneOption.takesValue).toBe(true);
    expect(zoneOption.required).toBe(false);
  });

  it('carries the default of an option that has one', () => {
    const validate = described.find((one) => one.name === 'validate');
    const zoneOption = validate.options.find((one) => one.flags.startsWith('-z'));
    expect(zoneOption.default).toBe('eastern');
  });

  it('names the argument a command takes', () => {
    const trace = described.find((one) => one.name === 'trace');
    expect(trace.arguments.map((one) => one.name)).toEqual(['lot']);
    expect(trace.arguments[0].required).toBe(true);
  });

  it('gives a command with no argument an empty list', () => {
    const standing = described.find((one) => one.name === 'standing');
    expect(standing.arguments).toEqual([]);
  });
});

describe('the commands document', () => {
  it('holds a section per command', () => {
    const text = renderCommandsDocument();
    for (const name of commandNames()) {
      expect(text).toContain(`## ${name}`);
    }
  });

  it('marks a required option required and a defaulted one with its default', () => {
    const text = renderCommandsDocument();
    expect(text).toContain('`-c, --case <directory>` the case directory to read (required)');
    expect(text).toContain('`-z, --zone <zone>` the zone the office keeps (default eastern)');
  });

  it('ends with one newline', () => {
    const text = renderCommandsDocument();
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('is what is on disk, so the document cannot go stale unnoticed', () => {
    expect(readFileSync('docs/commands.md', 'utf8')).toBe(renderCommandsDocument());
  });

  it('is the same text twice', () => {
    expect(renderCommandsDocument()).toBe(renderCommandsDocument());
  });
});
