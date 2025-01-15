/**
 * The error types the program raises, and the codes it raises them with.
 *
 * Two kinds of failure are worth telling apart. A caller that handed over
 * something the program cannot read gets an InputError, and the message names
 * the field. A caller whose data is readable but whose situation the rules
 * forbid gets a RuleError, and the message names the rule. The command line
 * prints the two differently, because one is a typing mistake and the other is
 * a finding.
 */

export class CullringError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CullringError';
    this.code = code;
    this.detail = detail;
  }

  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

/** Something could not be read: a bad date, a missing field, an unknown word. */
export class InputError extends CullringError {
  constructor(code, message, detail = {}) {
    super(code, message, detail);
    this.name = 'InputError';
  }
}

/** Something was read but the rules do not allow it. */
export class RuleError extends CullringError {
  constructor(code, message, detail = {}) {
    super(code, message, detail);
    this.name = 'RuleError';
  }
}

/** A named thing was asked for and the register does not hold it. */
export class NotFoundError extends CullringError {
  constructor(code, message, detail = {}) {
    super(code, message, detail);
    this.name = 'NotFoundError';
  }
}

/** The program's own configuration does not hold together. */
export class ConfigError extends CullringError {
  constructor(code, message, detail = {}) {
    super(code, message, detail);
    this.name = 'ConfigError';
  }
}

/**
 * True when the value is one of ours. Used at the command line boundary, where
 * an error we raised is reported and anything else is a defect worth a stack.
 */
export function isCullringError(value) {
  return value instanceof CullringError;
}

/**
 * Reduce any thrown value to the shape the reports use. A thrown string or a
 * plain object should not crash the reporter, so anything unrecognised comes
 * back under the internal code with its own text preserved.
 */
export function describeError(value) {
  if (isCullringError(value)) {
    return value.toJSON();
  }
  if (value instanceof Error) {
    return { code: 'internal', message: value.message, detail: {} };
  }
  return { code: 'internal', message: String(value), detail: {} };
}
