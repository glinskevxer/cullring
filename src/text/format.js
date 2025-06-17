/**
 * Turning numbers into the words the office writes.
 *
 * The rule here is that nothing is rounded twice. A geometric mean of 5.5512
 * is rounded once, at the moment it is printed, and every comparison against a
 * limit is done on the number rather than on the printed form. A report that
 * rounded first would show 43 against a limit of 43 and call it a failure.
 */

export function decimal(value, places = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return value.toFixed(places);
}

export function integer(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return String(Math.round(value));
}

/** A count with its noun, pluralised the way English does it and not with an s in brackets. */
export function count(value, singular, plural = null) {
  const word = value === 1 ? singular : (plural ?? `${singular}s`);
  return `${value} ${word}`;
}

export function hours(value) {
  if (value === null || value === undefined) {
    return 'no limit';
  }
  const rounded = Math.round(value * 10) / 10;
  return count(rounded, 'hour');
}

export function inches(value) {
  return `${decimal(value, 2)} in`;
}

export function feet(value) {
  return `${decimal(value, 1)} ft`;
}

/** Yes and no, because a report full of true and false reads like a dump. */
export function yesNo(value) {
  return value ? 'yes' : 'no';
}

export function dash(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

/** Fit text to a width, cutting with an ellipsis rather than silently. */
export function fit(text, width) {
  const value = String(text ?? '');
  if (value.length <= width) {
    return value;
  }
  if (width <= 1) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 1)}\u2026`;
}

export function padRight(text, width) {
  return fit(text, width).padEnd(width, ' ');
}

export function padLeft(text, width) {
  return fit(text, width).padStart(width, ' ');
}

/** A list read out the way somebody would say it. */
export function joinWords(values, conjunction = 'and') {
  const list = values.map(String);
  if (list.length === 0) {
    return '';
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} ${conjunction} ${list[1]}`;
  }
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${list[list.length - 1]}`;
}

export function titleCase(text) {
  return String(text)
    .split(' ')
    .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}
