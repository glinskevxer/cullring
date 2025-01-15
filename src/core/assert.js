/**
 * Small guards used at the edge of every module.
 *
 * These exist so that a module can state what it needs in one line and get a
 * message naming the field rather than a TypeError naming a property of
 * undefined three frames down. They are deliberately narrow: there is no
 * schema language here and there is not going to be one.
 */

import { InputError } from './errors.js';

export function required(value, field) {
  if (value === undefined || value === null) {
    throw new InputError('field.missing', `${field} is required`, { field });
  }
  return value;
}

export function requireString(value, field, { allowEmpty = false } = {}) {
  required(value, field);
  if (typeof value !== 'string') {
    throw new InputError('field.type', `${field} must be text`, { field, saw: typeof value });
  }
  if (!allowEmpty && value.trim() === '') {
    throw new InputError('field.empty', `${field} must not be empty`, { field });
  }
  return value;
}

export function requireNumber(value, field, { min, max, integer = false } = {}) {
  required(value, field);
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new InputError('field.type', `${field} must be a number`, { field, saw: typeof value });
  }
  if (!Number.isFinite(value)) {
    throw new InputError('field.range', `${field} must be finite`, { field, value });
  }
  if (integer && !Number.isInteger(value)) {
    throw new InputError('field.integer', `${field} must be a whole number`, { field, value });
  }
  if (min !== undefined && value < min) {
    throw new InputError('field.range', `${field} must be at least ${min}`, { field, value, min });
  }
  if (max !== undefined && value > max) {
    throw new InputError('field.range', `${field} must be at most ${max}`, { field, value, max });
  }
  return value;
}

export function requireOneOf(value, field, allowed) {
  required(value, field);
  const list = Array.from(allowed);
  if (!list.includes(value)) {
    throw new InputError('field.choice', `${field} must be one of ${list.join(', ')}`, {
      field,
      value,
      allowed: list,
    });
  }
  return value;
}

export function requireArray(value, field, { min = 0 } = {}) {
  required(value, field);
  if (!Array.isArray(value)) {
    throw new InputError('field.type', `${field} must be a list`, { field, saw: typeof value });
  }
  if (value.length < min) {
    throw new InputError('field.range', `${field} needs at least ${min} entries`, {
      field,
      count: value.length,
      min,
    });
  }
  return value;
}

export function requireObject(value, field) {
  required(value, field);
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('field.type', `${field} must be a record`, { field, saw: typeof value });
  }
  return value;
}

/**
 * An internal contract. Unlike the guards above this is never a user's fault,
 * so it carries no field name and reads as a defect when it fires.
 */
export function invariant(condition, message) {
  if (!condition) {
    throw new Error(`invariant: ${message}`);
  }
}
