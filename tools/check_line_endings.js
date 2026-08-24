#!/usr/bin/env node
/**
 * No tracked file carries a carriage return.
 *
 * This is here because of a failure that is invisible from inside the
 * repository. Git for Windows sets `core.autocrlf = true` in its system
 * config, so a clone on a fresh Windows machine rewrites every text file to
 * CRLF on the way out. Nothing has changed, every commit is untouched, and the
 * format check fails on all of it, along with every test that compares a file
 * against text the programme built.
 *
 * `.gitattributes` is what actually prevents it. This is the check that proves
 * `.gitattributes` is still doing its job, because the failure only appears in
 * a working tree somebody else checked out, and the one place it will never
 * appear is the working tree of the person who added the file.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BINARY = /\.(png|jpg|jpeg|gif|ico|pdf|zip|gz|woff2?|ttf)$/i;

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((name) => name !== '' && !BINARY.test(name));

const carrying = [];
for (const name of tracked) {
  const text = readFileSync(name);
  const at = text.indexOf(13);
  if (at >= 0) {
    const line = text.subarray(0, at).toString('utf8').split('\n').length;
    carrying.push(`${name}:${line}`);
  }
}

if (carrying.length > 0) {
  console.error(`${carrying.length} tracked files carry a carriage return:`);
  for (const name of carrying.slice(0, 20)) {
    console.error(`  ${name}`);
  }
  if (carrying.length > 20) {
    console.error(`  and ${carrying.length - 20} more`);
  }
  console.error('check .gitattributes, then re-check out the tree');
  process.exit(1);
}

console.log(`${tracked.length} tracked files, none of them carrying a carriage return`);
