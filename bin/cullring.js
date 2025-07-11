#!/usr/bin/env node
import { run } from '../src/cli/program.js';

process.exitCode = run(process.argv);
