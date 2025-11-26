import { describe, expect, it } from 'vitest';

import { bookCommand } from '../../src/cli/commands/book.js';
import { bookReport, operationFor, renderBook } from '../../src/report/book.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { civilDate } from '../../src/time/civil.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const on = civilDate(2025, 8, 14);

const report = (dealerId, day = on) =>
  bookReport({ book: loaded.book, dealers: loaded.dealers, dealerId, on: day });

describe('which operation a movement needs', () => {
  it.each([
    ['received', 'receive shellstock'],
    ['shipped', 'ship shellstock'],
    ['shucked', 'shuck'],
    ['repacked', 'repack'],
    ['depurated', 'depurate'],
  ])('reads %s as %s', (kind, operation) => {
    expect(operationFor(kind)).toBe(operation);
  });

  it('needs none for a landing, which the dealer did not do', () => {
    expect(operationFor('landed')).toBeNull();
    expect(operationFor('relayed')).toBeNull();
  });
});

describe('the book report', () => {
  it('reads the certification and what it allows that day', () => {
    const answer = report('SP-118');
    expect(answer.dealer.kind).toBe('shucker packer');
    expect(answer.allowed).toContain('shuck');
    expect(answer.allowed).not.toContain('depurate');
  });

  it('holds every entry in the dealer book', () => {
    expect(report('SP-118').entries).toHaveLength(7);
  });

  it('reconciles what came in against what went out', () => {
    const answer = report('SP-118');
    expect(answer.audit.clean).toBe(true);
    expect(answer.audit.rows.length).toBeGreaterThan(0);
  });

  it('finds a movement the certification does not permit', () => {
    const answer = report('SP-118', civilDate(2026, 8, 14));
    expect(answer.problems.has('book.operationNotPermitted')).toBe(true);
  });

  it('says nothing of the kind while the certification stands', () => {
    expect(report('SP-118').problems.has('book.operationNotPermitted')).toBe(false);
  });

  it('reports a dealer that is not in the register', () => {
    const answer = report('SP-999');
    expect(answer.dealer).toBeNull();
    expect(answer.problems.has('book.unknownDealer')).toBe(true);
    expect(renderBook(answer)).toContain('is not in the register');
  });
});

describe('the rendered book', () => {
  const text = renderBook(report('SP-118'));

  it('opens with the certification and what it allows', () => {
    expect(text).toContain('SP-118 Core Sound Packing (shucker packer)');
    expect(text).toMatch(/Allowed that day:\s+receive shellstock, ship shellstock and shuck/);
  });

  it('prints the book and the reconciliation as separate sections', () => {
    expect(text).toContain('The book');
    expect(text).toContain('Reconciliation');
  });

  it('says whether the book holds together', () => {
    expect(text).toMatch(/Book holds together: yes/);
  });

  it('is the same text twice', () => {
    expect(renderBook(report('SP-118'))).toBe(text);
  });
});

describe('the book command', () => {
  it('prints a clean book and exits clean', () => {
    const io = recorder();
    expect(bookCommand(base({ dealer: 'SS-042', on: '2025-08-14' }), io)).toBe(OK);
    expect(io.out).toContain('Reconciliation');
  });

  it('exits with a finding where the certification did not cover the movements', () => {
    const io = recorder();
    expect(bookCommand(base({ dealer: 'SP-118', on: '2026-08-14' }), io)).toBe(FOUND);
  });

  it('prints the answer as JSON when asked', () => {
    const io = recorder();
    bookCommand(base({ dealer: 'DP-003', on: '2025-08-14', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.kind).toBe('depuration processor');
    expect(answer.clean).toBe(true);
  });

  it('refuses a dealer that is not in the register', () => {
    const io = recorder();
    expect(bookCommand(base({ dealer: 'SP-999', on: '2025-08-14' }), io)).toBe(REFUSED);
  });
});
