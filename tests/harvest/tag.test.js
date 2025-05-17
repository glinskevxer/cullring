import { describe, expect, it } from 'vitest';

import {
  RETENTION_STATEMENT,
  SHELLSTOCK_FIELDS,
  SHUCKED_FIELDS,
  checkTag,
  lotOf,
  requiredFields,
  tagFor,
} from '../../src/harvest/tag.js';
import { SHELLSTOCK, SHUCKED } from '../../src/harvest/record.js';
import { at, tonged } from '../support/water.js';

const shellstock = tonged({ dealer: 'SS-042' });
const shucked = tonged({ dealer: 'SP-118', form: SHUCKED, lot: '20250814-B12-003' });

describe('which fields a tag needs', () => {
  it('asks the harvest side of the story for shellstock', () => {
    expect(requiredFields(SHELLSTOCK)).toEqual(SHELLSTOCK_FIELDS.slice());
    expect(requiredFields(SHELLSTOCK)).toContain('areaId');
    expect(requiredFields(SHELLSTOCK)).toContain('harvestedOn');
  });

  it('asks the packing side for a shucked container', () => {
    expect(requiredFields(SHUCKED)).toEqual(SHUCKED_FIELDS.slice());
    expect(requiredFields(SHUCKED)).toContain('sellBy');
    expect(requiredFields(SHUCKED)).toContain('containerSize');
  });

  it('does not ask a shucked container for the harvest area', () => {
    expect(requiredFields(SHUCKED)).not.toContain('areaId');
  });

  it('does not ask shellstock for a sell by date', () => {
    expect(requiredFields(SHELLSTOCK)).not.toContain('sellBy');
  });

  it('refuses a form it does not write tags for', () => {
    expect(() => requiredFields('frozen')).toThrow(/not a form a tag is written for/);
  });

  it('hands back a copy each time', () => {
    const list = requiredFields(SHELLSTOCK);
    list.push('made up');
    expect(requiredFields(SHELLSTOCK)).toHaveLength(SHELLSTOCK_FIELDS.length);
  });
});

describe('the tag a record implies', () => {
  it('carries the harvest facts for shellstock, and the statement', () => {
    const tag = tagFor(shellstock);
    expect(tag.lot).toBe('20250814-B12-002');
    expect(tag.areaId).toBe('B-12');
    expect(tag.harvestedOn).toBe('2025-08-14');
    expect(tag.quantity).toBe('12 containers');
    expect(tag.statement).toBe(RETENTION_STATEMENT);
  });

  it('carries the packing facts for a shucked container', () => {
    const tag = tagFor(shucked, {
      packedOn: '2025-08-14',
      sellBy: '2025-08-28',
      containerSize: 'pint',
    });
    expect(tag.packedOn).toBe('2025-08-14');
    expect(tag.sellBy).toBe('2025-08-28');
    expect(tag.containerSize).toBe('pint');
    expect(tag.areaId).toBeUndefined();
  });

  it('takes the dealer off the record when none is given', () => {
    expect(tagFor(shellstock).dealer).toBe('SS-042');
    expect(tagFor(shellstock, { dealer: 'RP-007' }).dealer).toBe('RP-007');
  });

  it('leaves the packing dates blank when nobody supplied them', () => {
    const tag = tagFor(shucked);
    expect(tag.packedOn).toBeNull();
    expect(tag.sellBy).toBeNull();
  });
});

describe('checking a tag as written', () => {
  it('passes a complete shellstock tag', () => {
    expect(checkTag(tagFor(shellstock)).lawful).toBe(true);
  });

  it('passes a complete shucked tag', () => {
    const tag = tagFor(shucked, {
      packedOn: '2025-08-14',
      sellBy: '2025-08-28',
      containerSize: 'pint',
    });
    expect(checkTag(tag).lawful).toBe(true);
  });

  it('reports one finding for each blank, not one for the tag', () => {
    const answer = checkTag({ form: SHUCKED, lot: '20250814-B12-003', species: 'oyster' });
    expect(answer.problems.of('error')).toHaveLength(4);
    expect(answer.problems.list().every((one) => one.code === 'tag.missing')).toBe(true);
  });

  it('treats blank space as a blank', () => {
    const tag = { ...tagFor(shellstock), areaId: '   ' };
    expect(checkTag(tag).problems.has('tag.missing')).toBe(true);
  });

  it('refuses a shellstock tag with the statement missing or altered', () => {
    expect(
      checkTag({ ...tagFor(shellstock), statement: undefined }).problems.has('tag.statement'),
    ).toBe(true);
    expect(
      checkTag({ ...tagFor(shellstock), statement: 'keep this tag' }).problems.has('tag.statement'),
    ).toBe(true);
  });

  it('does not ask a shucked tag for the statement', () => {
    const tag = tagFor(shucked, {
      packedOn: '2025-08-14',
      sellBy: '2025-08-28',
      containerSize: 'pint',
    });
    expect(checkTag(tag).problems.has('tag.statement')).toBe(false);
  });

  it('refuses a tag naming more than one lot', () => {
    const tag = { ...tagFor(shellstock), lot: '20250814-B12-002,20250814-B12-003' };
    const answer = checkTag(tag);
    expect(answer.problems.has('tag.comingled')).toBe(true);
    expect(answer.lawful).toBe(false);
  });

  it('refuses a lot number that is not one', () => {
    expect(checkTag({ ...tagFor(shellstock), lot: 'yesterday' }).problems.has('tag.lot')).toBe(
      true,
    );
  });

  it('refuses a certification number that is not one', () => {
    expect(
      checkTag({ ...tagFor(shellstock), dealer: 'Beaufort Oyster' }).problems.has('tag.dealer'),
    ).toBe(true);
  });

  it('refuses a tag whose form it cannot read', () => {
    const answer = checkTag({ form: 'frozen', lot: '20250814-B12-002' });
    expect(answer.lawful).toBe(false);
    expect(answer.problems.has('tag.form')).toBe(true);
  });

  it('takes the form as an argument when the tag does not carry one', () => {
    const tag = { ...tagFor(shellstock) };
    delete tag.form;
    expect(checkTag(tag, { form: SHELLSTOCK }).lawful).toBe(true);
  });
});

describe('reading the lot off a tag', () => {
  it('finds it where the tag carries one', () => {
    expect(lotOf(tagFor(shellstock))).toBe('20250814-B12-002');
  });

  it('answers with nothing where the tag is blank or unreadable', () => {
    expect(lotOf({})).toBeNull();
    expect(lotOf({ lot: 'yesterday' })).toBeNull();
    expect(lotOf({ lot: null })).toBeNull();
  });

  it('answers with nothing for a comingled tag, which is the honest answer', () => {
    expect(lotOf({ lot: '20250814-B12-002,20250814-B12-003' })).toBeNull();
  });

  it('is not confused by a tag written for another day', () => {
    const other = tagFor(
      tonged({
        startedAt: at('2025-09-01 07:00'),
        landedAt: at('2025-09-01 09:00'),
        lot: '20250901-B12-002',
      }),
    );
    expect(lotOf(other)).toBe('20250901-B12-002');
  });
});
