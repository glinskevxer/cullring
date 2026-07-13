#!/usr/bin/env node
/** Write docs/rules.md from the rule registry. */
import { writeFileSync } from 'node:fs';

import { renderRulesDocument } from '../src/core/rules.js';

writeFileSync('docs/rules.md', renderRulesDocument(), 'utf8');
console.log('docs/rules.md written');
