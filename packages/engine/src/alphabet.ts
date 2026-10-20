/**
 * alphabet.ts: Alphabet definition and disjoint character set algebra.
 *
 * Formal Theory:
 * An alphabet Σ is a finite non-empty set of symbols.
 * Here, Σ comprises printable ASCII (32–126), horizontal tab (\t, 9),
 * and a designated OTHER sentinel (-1) representing any out-of-alphabet character.
 * Transitions in automata are stored on canonical disjoint character sets (CharSet)
 * rather than individual characters, keeping state transition graphs compact.
 */

export const OTHER_SYMBOL = -1;
export const TAB_CODE = 9;
export const PRINTABLE_ASCII_START = 32; // ' '
export const PRINTABLE_ASCII_END = 126;  // '~'

/** An inclusive range [start, end] of character codes */
export type CharRange = readonly [start: number, end: number];

/** A canonical CharSet: sorted, non-overlapping, non-adjacent ranges */
export type CharSet = readonly CharRange[];

/** Map a JavaScript character to its alphabet code (9, 32-126, or OTHER_SYMBOL) */
export function charToSymbol(ch: string): number {
  if (ch.length === 0) return OTHER_SYMBOL;
  const code = ch.charCodeAt(0);
  if (code === TAB_CODE) return TAB_CODE;
  if (code >= PRINTABLE_ASCII_START && code <= PRINTABLE_ASCII_END) {
    return code;
  }
  return OTHER_SYMBOL;
}

/** Check if a symbol code is within the defined alphabet (including OTHER) */
export function isValidSymbol(code: number): boolean {
  return (
    code === OTHER_SYMBOL ||
    code === TAB_CODE ||
    (code >= PRINTABLE_ASCII_START && code <= PRINTABLE_ASCII_END)
  );
}

/** Canonical empty set */
export const EMPTY_CHAR_SET: CharSet = Object.freeze([]);

/** Normalizes a list of ranges into sorted, non-overlapping, non-adjacent ranges */
export function charSetNormalize(ranges: readonly CharRange[]): CharSet {
  if (ranges.length === 0) return EMPTY_CHAR_SET;

  // Filter invalid ranges (start > end) and clone
  const valid = ranges
    .filter(([start, end]) => start <= end)
    .map(([s, e]) => [s, e] as [number, number]);

  if (valid.length === 0) return EMPTY_CHAR_SET;

  // Sort by start, then by end
  valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const result: CharRange[] = [];
  let currentStart = valid[0][0];
  let currentEnd = valid[0][1];

  for (let i = 1; i < valid.length; i++) {
    const [nextStart, nextEnd] = valid[i];
    // Check if overlapping or adjacent (e.g. [0, 5] and [6, 10])
    // Note: for OTHER (-1), adjacent to 0 is not applicable in our discrete alphabet,
    // but arithmetic (nextStart <= currentEnd + 1) works correctly for integers.
    if (nextStart <= currentEnd + 1) {
      if (nextEnd > currentEnd) {
        currentEnd = nextEnd;
      }
    } else {
      result.push(Object.freeze([currentStart, currentEnd]));
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  result.push(Object.freeze([currentStart, currentEnd]));
  return Object.freeze(result);
}

/** Construct a CharSet matching a single character code */
export function charSetFromChar(code: number): CharSet {
  return Object.freeze([[code, code]]);
}

/** Construct a CharSet from an inclusive character range */
export function charSetFromRange(start: number, end: number): CharSet {
  if (start > end) return EMPTY_CHAR_SET;
  return Object.freeze([[start, end]]);
}

/** Check if a canonical CharSet contains a given symbol code */
export function charSetContains(set: CharSet, code: number): boolean {
  for (let i = 0; i < set.length; i++) {
    const [start, end] = set[i];
    if (code >= start && code <= end) return true;
    if (code < start) return false;
  }
  return false;
}

/** Set union of two CharSets */
export function charSetUnion(a: CharSet, b: CharSet): CharSet {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return charSetNormalize([...a, ...b]);
}

/** Set intersection of two CharSets */
export function charSetIntersect(a: CharSet, b: CharSet): CharSet {
  if (a.length === 0 || b.length === 0) return EMPTY_CHAR_SET;

  const result: CharRange[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const [aStart, aEnd] = a[i];
    const [bStart, bEnd] = b[j];

    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);

    if (start <= end) {
      result.push(Object.freeze([start, end]));
    }

    if (aEnd < bEnd) {
      i++;
    } else {
      j++;
    }
  }

  return charSetNormalize(result);
}

/** The universal set covering the entire Tripwire alphabet */
export const UNIVERSAL_CHAR_SET: CharSet = Object.freeze([
  [-1, -1],
  [TAB_CODE, TAB_CODE],
  [PRINTABLE_ASCII_START, PRINTABLE_ASCII_END],
]);

/** Set difference: A \ B */
export function charSetDifference(a: CharSet, b: CharSet): CharSet {
  if (a.length === 0) return EMPTY_CHAR_SET;
  if (b.length === 0) return a;

  const result: CharRange[] = [];

  for (const [aStart, aEnd] of a) {
    let curStart = aStart;
    for (const [bStart, bEnd] of b) {
      if (bEnd < curStart) continue;
      if (bStart > aEnd) break;

      if (bStart > curStart) {
        result.push(Object.freeze([curStart, Math.min(bStart - 1, aEnd)]));
      }
      curStart = Math.max(curStart, bEnd + 1);
      if (curStart > aEnd) break;
    }
    if (curStart <= aEnd) {
      result.push(Object.freeze([curStart, aEnd]));
    }
  }

  return charSetNormalize(result);
}

/** Set complement / negation relative to UNIVERSAL_CHAR_SET */
export function charSetNegate(set: CharSet): CharSet {
  return charSetDifference(UNIVERSAL_CHAR_SET, set);
}

/** Check equality between two canonical CharSets */
export function charSetEquals(a: CharSet, b: CharSet): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

// Built-in shorthand character sets
export const DIGIT_CHAR_SET: CharSet = charSetFromRange(48, 57); // '0'-'9'
export const LOWER_CHAR_SET: CharSet = charSetFromRange(97, 122); // 'a'-'z'
export const UPPER_CHAR_SET: CharSet = charSetFromRange(65, 90); // 'A'-'Z'
export const ALPHA_CHAR_SET: CharSet = charSetUnion(LOWER_CHAR_SET, UPPER_CHAR_SET);
export const WORD_CHAR_SET: CharSet = charSetNormalize([
  [48, 57],   // 0-9
  [65, 90],   // A-Z
  [95, 95],   // _
  [97, 122],  // a-z
]);
export const WHITESPACE_CHAR_SET: CharSet = charSetNormalize([
  [TAB_CODE, TAB_CODE],
  [32, 32],   // space
]);
/** Dot matches all characters except newline (\r, \n); in our alphabet, all valid symbols */
export const DOT_CHAR_SET: CharSet = UNIVERSAL_CHAR_SET;

/** Format a single character code for human-readable display */
function formatCharCode(code: number): string {
  if (code === OTHER_SYMBOL) return "<other>";
  if (code === TAB_CODE) return "\\t";
  if (code === 32) return "\\s";
  if (code === 92) return "\\\\";
  if (code >= PRINTABLE_ASCII_START && code <= PRINTABLE_ASCII_END) {
    return String.fromCharCode(code);
  }
  return `\\x${code.toString(16).padStart(2, "0")}`;
}

/**
 * Returns a concise, readable string label for a CharSet (e.g., "[a-z]", "\d", "[^']", "F").
 * Used for Track Diagram SVG edge plates.
 */
export function labelOf(set: CharSet): string {
  if (set.length === 0) return "∅";
  if (charSetEquals(set, UNIVERSAL_CHAR_SET)) return ".";
  if (charSetEquals(set, DIGIT_CHAR_SET)) return "\\d";
  if (charSetEquals(set, WORD_CHAR_SET)) return "\\w";
  if (charSetEquals(set, WHITESPACE_CHAR_SET)) return "\\s";

  // Check if negation of a single character e.g. [^'] or [^"]
  const negated = charSetNegate(set);
  if (negated.length === 1 && negated[0][0] === negated[0][1]) {
    return `[^${formatCharCode(negated[0][0])}]`;
  }

  // Single character check
  if (set.length === 1 && set[0][0] === set[0][1]) {
    return formatCharCode(set[0][0]);
  }

  // Bracket representation
  let body = "";
  for (const [start, end] of set) {
    if (start === OTHER_SYMBOL && end === OTHER_SYMBOL) {
      body += "●"; // symbol for out-of-alphabet
    } else if (start === end) {
      body += formatCharCode(start);
    } else if (end === start + 1) {
      body += `${formatCharCode(start)}${formatCharCode(end)}`;
    } else {
      body += `${formatCharCode(start)}-${formatCharCode(end)}`;
    }
  }

  return `[${body}]`;
}
