import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/parser";
import { buildNFA, nfaSimulate } from "../src/nfa";
import { toDFA, dfaSimulate } from "../src/dfa";
import { minimizeDFA } from "../src/minimize";
import { FUZZ_CORPUS } from "./differential-nfa.test";

class LCG {
  private state: number;
  constructor(seed = 9999) {
    this.state = seed;
  }
  nextInt(min: number, max: number): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    const r = this.state / 4294967296;
    return Math.floor(r * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

describe("Differential Fuzz: NFA vs DFA vs Minimized DFA vs RegExp", () => {
  it(`theorem: NFA, DFA, and Minimized DFA are pairwise language-equivalent across all ${FUZZ_CORPUS.length} patterns`, () => {
    const lcg = new LCG(777);
    const alphabetSamples = "abcdef0123456789_ -./:'\"<>=;*?+()[]{}FTPS".split("");

    let totalComparisons = 0;

    for (let pIdx = 0; pIdx < FUZZ_CORPUS.length; pIdx++) {
      const pattern = FUZZ_CORPUS[pIdx];
      const ast = parseRegex(pattern);
      const nfa = buildNFA(ast);
      const dfa = toDFA(nfa);
      const { dfa: minDfa } = minimizeDFA(dfa);
      const oracle = new RegExp(`^(${pattern})$`);

      const testStrings = new Set<string>();
      testStrings.add("");
      testStrings.add("a");
      testStrings.add("abb");
      testStrings.add("admin");
      testStrings.add("SELECT");
      testStrings.add("UNION SELECT");
      testStrings.add("FFF");
      testStrings.add("FFFS");
      testStrings.add("<script>");

      for (const len of [0, 1, 2, 3, 6, 10]) {
        for (let iter = 0; iter < 12; iter++) {
          let s = "";
          for (let i = 0; i < len; i++) {
            s += lcg.pick(alphabetSamples);
          }
          testStrings.add(s);
        }
      }

      for (const str of testStrings) {
        const expectedOracle = oracle.test(str);
        const actualNFA = nfaSimulate(nfa, str);
        const actualDFA = dfaSimulate(dfa, str);
        const actualMinDFA = dfaSimulate(minDfa, str);

        if (
          actualNFA !== expectedOracle ||
          actualDFA !== expectedOracle ||
          actualMinDFA !== expectedOracle
        ) {
          throw new Error(
            `Equivalence violation on pattern /${pattern}/ with input "${str}": Oracle=${expectedOracle}, NFA=${actualNFA}, DFA=${actualDFA}, MinDFA=${actualMinDFA}`
          );
        }
        totalComparisons++;
      }
    }

    expect(totalComparisons).toBeGreaterThan(3000);
  });
});
