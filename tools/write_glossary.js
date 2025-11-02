#!/usr/bin/env node
/** Write docs/glossary.md from the glossary module. */
import { writeFileSync } from 'node:fs';

import { renderGlossaryDocument } from '../src/core/glossary.js';

writeFileSync('docs/glossary.md', renderGlossaryDocument(), 'utf8');
console.log('docs/glossary.md written');
