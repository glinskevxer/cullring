#!/usr/bin/env node
/** Write docs/commands.md from the command tree. */
import { writeFileSync } from 'node:fs';

import { renderCommandsDocument } from '../src/cli/describe.js';

writeFileSync('docs/commands.md', renderCommandsDocument(), 'utf8');
console.log('docs/commands.md written');
