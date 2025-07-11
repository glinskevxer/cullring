/** A console that keeps what was written, for testing a command body. */
export function recorder() {
  const out = [];
  const err = [];
  return {
    say(text) {
      out.push(text);
    },
    warn(text) {
      err.push(text);
    },
    get out() {
      return out.join('\n');
    },
    get err() {
      return err.join('\n');
    },
    get lines() {
      return out.join('\n').split('\n');
    },
  };
}

export const CASE = 'examples/core-sound';

export const base = (extra = {}) => ({ case: CASE, zone: 'eastern', ...extra });
