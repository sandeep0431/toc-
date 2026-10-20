import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/parser";
import { buildNFA, epsilonClosure, nfaSimulate } from "../src/nfa";

describe("Thompson's Construction NFA", () => {
  it("guarantees exactly one start state and one accept state", () => {
    const ast = parseRegex("(a|b)*abb");
    const nfa = buildNFA(ast);

    expect(typeof nfa.startState).toBe("number");
    expect(typeof nfa.acceptState).toBe("number");
    expect(nfa.startState).not.toBe(nfa.acceptState);

    // State IDs are monotonic 0, 1, ..., N-1
    for (let i = 0; i < nfa.states.length; i++) {
      expect(nfa.states[i].id).toBe(i);
      expect(nfa.states[i].provenance).toBeTruthy();
    }
  });

  it("calculates reflexive transitive epsilon closure", () => {
    const ast = parseRegex("a|b");
    const nfa = buildNFA(ast);
    const startClosure = epsilonClosure(nfa, [nfa.startState]);

    expect(startClosure.has(nfa.startState)).toBe(true);
    expect(startClosure.size).toBeGreaterThan(1); // reachable branches
  });

  it("accurately accepts matching strings and rejects non-matching strings", () => {
    const ast = parseRegex("(a|b)*abb");
    const nfa = buildNFA(ast);

    expect(nfaSimulate(nfa, "abb")).toBe(true);
    expect(nfaSimulate(nfa, "aabb")).toBe(true);
    expect(nfaSimulate(nfa, "babb")).toBe(true);
    expect(nfaSimulate(nfa, "ababb")).toBe(true);
    expect(nfaSimulate(nfa, "bbabb")).toBe(true);

    expect(nfaSimulate(nfa, "ab")).toBe(false);
    expect(nfaSimulate(nfa, "abba")).toBe(false);
    expect(nfaSimulate(nfa, "")).toBe(false);
    expect(nfaSimulate(nfa, "b")).toBe(false);
  });

  it("handles complex combinations with plus and optional", () => {
    const ast = parseRegex("a+b?c*");
    const nfa = buildNFA(ast);

    expect(nfaSimulate(nfa, "a")).toBe(true);
    expect(nfaSimulate(nfa, "abc")).toBe(true);
    expect(nfaSimulate(nfa, "ac")).toBe(true);
    expect(nfaSimulate(nfa, "aaaacccc")).toBe(true);
    expect(nfaSimulate(nfa, "")).toBe(false);
    expect(nfaSimulate(nfa, "b")).toBe(false);
  });
});
