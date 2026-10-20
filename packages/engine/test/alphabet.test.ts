import { describe, it, expect } from "vitest";
import {
  charSetNormalize,
  charSetUnion,
  charSetIntersect,
  charSetDifference,
  charSetNegate,
  charSetContains,
  charSetFromChar,
  charSetFromRange,
  labelOf,
  DIGIT_CHAR_SET,
  WORD_CHAR_SET,
  WHITESPACE_CHAR_SET,
  UNIVERSAL_CHAR_SET,
  charToSymbol,
  OTHER_SYMBOL,
} from "../src/alphabet";

describe("Alphabet and CharSet Algebra", () => {
  it("normalizes overlapping and adjacent ranges", () => {
    // [0, 5] and [6, 10] are adjacent -> [0, 10]
    const normalized = charSetNormalize([[0, 5], [6, 10], [3, 8]]);
    expect(normalized).toEqual([[0, 10]]);
  });

  it("handles character conversion to alphabet codes", () => {
    expect(charToSymbol("a")).toBe(97);
    expect(charToSymbol("\t")).toBe(9);
    expect(charToSymbol(" ")).toBe(32);
    expect(charToSymbol("~")).toBe(126);
    expect(charToSymbol("\x00")).toBe(OTHER_SYMBOL); // non-printable ASCII
    expect(charToSymbol("🔥")).toBe(OTHER_SYMBOL);   // Unicode emoji
  });

  it("computes union correctly", () => {
    const a = charSetFromRange(97, 100); // a-d
    const b = charSetFromRange(99, 105); // c-i
    const u = charSetUnion(a, b);
    expect(u).toEqual([[97, 105]]);
  });

  it("computes intersection correctly", () => {
    const a = charSetFromRange(97, 105); // a-i
    const b = charSetFromRange(100, 110); // d-n
    const inter = charSetIntersect(a, b);
    expect(inter).toEqual([[100, 105]]);
  });

  it("computes set difference correctly", () => {
    const a = charSetFromRange(97, 105); // a-i: 97 to 105
    const b = charSetFromRange(100, 102); // d-f: 100 to 102
    const diff = charSetDifference(a, b);
    expect(diff).toEqual([[97, 99], [103, 105]]);
  });

  it("contains returns true for included characters and false otherwise", () => {
    const set = charSetFromRange(48, 57); // '0'-'9'
    expect(charSetContains(set, 48)).toBe(true);
    expect(charSetContains(set, 57)).toBe(true);
    expect(charSetContains(set, 50)).toBe(true);
    expect(charSetContains(set, 65)).toBe(false);
  });

  it("renders clean labels for diagram plates", () => {
    expect(labelOf(charSetFromChar(97))).toBe("a");
    expect(labelOf(charSetFromChar(9))).toBe("\\t");
    expect(labelOf(charSetFromRange(97, 122))).toBe("[a-z]");
    expect(labelOf(DIGIT_CHAR_SET)).toBe("\\d");
    expect(labelOf(WORD_CHAR_SET)).toBe("\\w");
    expect(labelOf(WHITESPACE_CHAR_SET)).toBe("\\s");
    expect(labelOf(UNIVERSAL_CHAR_SET)).toBe(".");
    expect(labelOf(charSetNegate(charSetFromChar(39)))).toBe("[^']"); // [^']
  });
});
