import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/parser";
import { buildNFA } from "../src/nfa";
import { toDFA, dfaSimulate } from "../src/dfa";
import { minimizeDFA } from "../src/minimize";

describe("Hopcroft's DFA Minimization", () => {
  it("theorem: (a|b)*abb minimizes to exactly 4 states", () => {
    const ast = parseRegex("(a|b)*abb");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);
    const { dfa: minDfa, partitionsHistory } = minimizeDFA(dfa);

    // Textbook theorem: minimal DFA for (a|b)*abb has exactly 4 states
    expect(minDfa.states.length).toBe(4);
    expect(partitionsHistory.length).toBeGreaterThan(0);
  });

  it("theorem: a(b|c)*d minimizes to documented state count of 3 states", () => {
    const ast = parseRegex("a(b|c)*d");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);
    const { dfa: minDfa } = minimizeDFA(dfa);

    expect(minDfa.states.length).toBe(3);
  });

  it("theorem: (0|1)*1(0|1) minimizes to documented state count of 4 states", () => {
    const ast = parseRegex("(0|1)*1(0|1)");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);
    const { dfa: minDfa } = minimizeDFA(dfa);

    expect(minDfa.states.length).toBe(4);
  });

  it("theorem: minimization is idempotent (minimizing twice changes nothing)", () => {
    const ast = parseRegex("(a|b)*abb|a(b|c)*d");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);

    const { dfa: minOnce } = minimizeDFA(dfa);
    const { dfa: minTwice } = minimizeDFA(minOnce);

    expect(minTwice.states.length).toBe(minOnce.states.length);
    expect(minTwice.transitions.length).toBe(minOnce.transitions.length);
  });

  it("theorem: minimized DFA accepts the exact same language as the unminimized DFA", () => {
    const ast = parseRegex("(a|b)*abb");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);
    const { dfa: minDfa } = minimizeDFA(dfa);

    const testSamples = [
      "abb", "aabb", "babb", "ababb", "bbabb", "aaabb",
      "ab", "a", "b", "abba", "", "bba", "bab"
    ];

    for (const sample of testSamples) {
      expect(dfaSimulate(minDfa, sample)).toBe(dfaSimulate(dfa, sample));
    }
  });
});
