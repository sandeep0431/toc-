import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/parser";
import { buildNFA, nfaSimulate } from "../src/nfa";

/**
 * Deterministic pseudo-random number generator (Linear Congruential Generator)
 * Ensures 100% reproducible test runs without external dependencies.
 */
class LCG {
  private state: number;
  constructor(seed = 1337) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

/**
 * Corpus of at least 50 distinct regex patterns representing formal languages,
 * syntax constructs, edge cases, and real IDS security patterns.
 */
export const FUZZ_CORPUS: readonly string[] = [
  // 1-10: Classical formal language benchmarks
  "(a|b)*abb",
  "a(b|c)*d",
  "(0|1)*1(0|1)",
  "a*b*c*",
  "(a|b)(c|d)(e|f)",
  "(ab|cd)*",
  "a?b?c?",
  "a+b+c+",
  "(a|b)+c",
  "(a*)*b",

  // 11-20: Character classes and ranges
  "[a-z]+",
  "[0-9]+",
  "[a-zA-Z0-9]+",
  "[^a-z]",
  "[^0-9]+",
  "[abc]*",
  "[a-e][1-5]",
  "[0-9a-fA-F]+",
  "[^abc]+",
  "[A-Z][a-z]*",

  // 21-30: Shorthands and wildcards
  "\\d+",
  "\\w+",
  "\\s+",
  "\\d+\\.\\d+",
  "\\w+@\\w+",
  "a.c",
  ".*",
  ".+",
  "foo.bar",
  "\\d{3}",

  // 31-40: Bounded quantifiers
  "a{2,4}",
  "b{3,}",
  "c{1,3}",
  "F{3,}S",
  "P{5,}",
  "F{10,}",
  "(ab){2,3}",
  "[0-9]{2,4}",
  "x{0,2}",
  "z{1,5}",

  // 41-55: Real IDS security detection patterns
  "admin",
  "root",
  "SELECT",
  "UNION SELECT",
  "DROP TABLE",
  "' OR '1'='1",
  "../..",
  "etc/passwd",
  "<script>",
  "onerror=",
  "GET /.* HTTP",
  "Failed password for",
  "Accepted password for",
  "curl/[0-9]",
  "python-requests"
];

describe("Differential Fuzz: NFA Simulation vs Native RegExp Oracle", () => {
  it(`passes differential testing across ${FUZZ_CORPUS.length} regex patterns`, () => {
    const lcg = new LCG(42);
    const alphabetSamples = "abcdef0123456789_ -./:'\"<>=;*?+()[]{}FTPS".split("");

    let totalComparisons = 0;

    for (let pIdx = 0; pIdx < FUZZ_CORPUS.length; pIdx++) {
      const pattern = FUZZ_CORPUS[pIdx];
      const ast = parseRegex(pattern);
      const nfa = buildNFA(ast);
      const oracle = new RegExp(`^(${pattern})$`);

      // Generate a set of test strings for each pattern:
      const testStrings = new Set<string>();

      // Always include edge strings
      testStrings.add("");
      testStrings.add("a");
      testStrings.add("abb");
      testStrings.add("admin");
      testStrings.add("root");
      testStrings.add("SELECT");
      testStrings.add("UNION SELECT");
      testStrings.add("' OR '1'='1");
      testStrings.add("F");
      testStrings.add("FFF");
      testStrings.add("FFFS");
      testStrings.add("../..");
      testStrings.add("<script>");
      testStrings.add("onerror=");

      // Generate random strings of various lengths
      for (let len of [0, 1, 2, 3, 5, 8, 12]) {
        for (let iter = 0; iter < 15; iter++) {
          let s = "";
          for (let i = 0; i < len; i++) {
            s += lcg.pick(alphabetSamples);
          }
          testStrings.add(s);
        }
      }

      // Execute differential comparison
      for (const str of testStrings) {
        const expected = oracle.test(str);
        const actual = nfaSimulate(nfa, str);

        if (actual !== expected) {
          throw new Error(
            `Differential mismatch on pattern /${pattern}/ with input "${str}": NFA gave ${actual}, RegExp gave ${expected}`
          );
        }
        totalComparisons++;
      }
    }

    expect(totalComparisons).toBeGreaterThan(5000);
  });
});
