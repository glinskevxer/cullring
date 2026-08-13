import { describe, expect, it } from 'vitest';

import { dayOf, momentOf, spanOf, walkStart } from '../../src/cli/moment.js';
import { formatInstant, isInstant, parseInstant } from '../../src/time/instant.js';
import { formatCivilDate } from '../../src/time/civil.js';

describe('momentOf', () => {
  it('reads the moment somebody typed', () => {
    const at = momentOf({ at: '2025-08-14 09:00' }, 'eastern');
    expect(formatInstant('eastern', at)).toContain('2025-08-14 09:00');
  });

  it('refuses to guess when none was given', () => {
    expect(() => momentOf({}, 'eastern')).toThrow(/needs a moment, given as --at/);
  });
});

describe('dayOf', () => {
  it('takes the day when one is given', () => {
    expect(formatCivilDate(dayOf({ on: '2025-08-14' }, 'eastern'))).toBe('2025-08-14');
  });

  it('falls back to the day the moment falls in, in the office zone', () => {
    expect(formatCivilDate(dayOf({ at: '2025-08-14 23:30' }, 'eastern'))).toBe('2025-08-14');
  });

  it('refuses when it has neither', () => {
    expect(() => dayOf({}, 'eastern')).toThrow(/needs a moment/);
  });
});

describe('spanOf', () => {
  it('carries both the moment and where the walk starts', () => {
    const span = spanOf({ at: '2025-08-14 09:00' }, 'eastern');
    expect(isInstant(span.at)).toBe(true);
    expect(span.from.epochSecond).toBeLessThan(span.at.epochSecond);
  });
});

describe('what walkStart hands back', () => {
  it('is a built instant, not a bare object, so nothing downstream can mutate it', () => {
    const at = parseInstant('2025-08-14 09:00', { zone: 'eastern' });
    const start = walkStart({}, 'eastern', at);
    expect(isInstant(start)).toBe(true);
    expect(Object.isFrozen(start)).toBe(true);
  });

  it('still defaults to thirty days back', () => {
    const at = parseInstant('2025-08-14 09:00', { zone: 'eastern' });
    expect(walkStart({}, 'eastern', at).epochSecond).toBe(at.epochSecond - 30 * 86400);
  });

  it('takes a day when one is given', () => {
    const at = parseInstant('2025-08-14 09:00', { zone: 'eastern' });
    const start = walkStart({ from: '2025-08-01' }, 'eastern', at);
    expect(formatInstant('eastern', start)).toContain('2025-08-01 00:00');
  });
});
