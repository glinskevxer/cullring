#!/usr/bin/env node
/** Write docs/findings.md from the catalogue. */
import { writeFileSync } from 'node:fs';

import { renderCatalogueDocument } from '../src/core/catalogue.js';

writeFileSync('docs/findings.md', renderCatalogueDocument(), 'utf8');
console.log('docs/findings.md written');
