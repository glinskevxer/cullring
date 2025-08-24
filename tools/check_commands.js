#!/usr/bin/env node
/**
 * Fail if docs/commands.md has drifted from the command tree.
 *
 * The document is generated, so the check is a comparison rather than a
 * parser. What makes it worth having is that it fails on the commit that adds
 * a command rather than on the day somebody reads the document.
 */
import { readFileSync } from 'node:fs';

import { renderCommandsDocument } from '../src/cli/describe.js';

const wanted = renderCommandsDocument();
let held = '';
try {
  held = readFileSync('docs/commands.md', 'utf8');
} catch {
  console.error('docs/commands.md is missing; run tools/write_commands.js');
  process.exit(1);
}

if (held !== wanted) {
  console.error('docs/commands.md is stale; run tools/write_commands.js');
  const heldLines = held.split('\n');
  const wantedLines = wanted.split('\n');
  for (let index = 0; index < Math.max(heldLines.length, wantedLines.length); index += 1) {
    if (heldLines[index] !== wantedLines[index]) {
      console.error(`  line ${index + 1}`);
      console.error(`    held:   ${heldLines[index] ?? '(end of file)'}`);
      console.error(`    wanted: ${wantedLines[index] ?? '(end of file)'}`);
      break;
    }
  }
  process.exit(1);
}
console.log(`docs/commands.md is current, covering ${wanted.split('\n## ').length - 1} commands`);
