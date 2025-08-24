/**
 * What the command tree says about itself.
 *
 * The commands document is generated from the tree rather than written beside
 * it, and a check compares the two. A document that is written by hand goes
 * stale the first time somebody adds an option, and a stale document about a
 * command line is worse than none, because people trust it.
 */

import { build } from './program.js';
import { makeConsole } from './output.js';

export function describeProgram() {
  const program = build(makeConsole());
  return program.commands.map((command) => ({
    name: command.name(),
    description: command.description(),
    arguments: command.registeredArguments.map((one) => ({
      name: one.name(),
      required: one.required,
      description: one.description,
    })),
    options: command.options.map((one) => ({
      flags: one.flags,
      description: one.description,
      // `required` on a commander option means the option TAKES A VALUE, which
      // is true of almost all of these. `mandatory` is the one that means the
      // command refuses to run without it, and it is what the document wants.
      required: one.mandatory === true,
      takesValue: one.required === true,
      default: one.defaultValue ?? null,
    })),
  }));
}

export function commandNames() {
  return describeProgram()
    .map((one) => one.name)
    .sort();
}

export function renderCommandsDocument() {
  const lines = ['# Commands', ''];
  lines.push(
    'This file is generated from the command tree by `tools/write_commands.js`.',
    'Run that after adding a command; `tools/check_commands.js` fails the build if',
    'the two have drifted apart.',
    '',
  );
  for (const command of describeProgram()) {
    lines.push(`## ${command.name}`, '', command.description, '');
    if (command.arguments.length > 0) {
      lines.push('Arguments:', '');
      for (const one of command.arguments) {
        lines.push(`- \`${one.name}\` ${one.description}${one.required ? ' (required)' : ''}`);
      }
      lines.push('');
    }
    lines.push('Options:', '');
    for (const one of command.options) {
      const note = one.required
        ? ' (required)'
        : one.default === null
          ? ''
          : ` (default ${one.default})`;
      lines.push(`- \`${one.flags}\` ${one.description}${note}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
