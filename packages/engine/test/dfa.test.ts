import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/parser";
import { buildNFA } from "../src/nfa";
import { toDFA, dfaSimulate, dfaTrace } from "../src/dfa";

describe("DFA Subset Construction", () => {
  it("converts (a|b)*abb into a deterministic finite automaton with subset provenance", () => {
    const ast = parseRegex("(a|b)*abb");
    const nfa = buildNFA(ast);
    const dfa = toDFA(nfa);

    expect(dfa.states.length).toBeGreaterThanOrEqual(4);
    expect(dfa.startState).toBe(0);

    // Each DFA state has non-empty nfaStates subset
    for (const state of dfa.states) {
      expect(state.nfaStates.length).toBeGreaterThan(0);
    }

    // Step-by-step history is recorded
    expect(dfa.steps.length).toBeGreaterThan(0);
    expect(dfa.steps[0].type).toBe("init");

    // Execution trace
    expect(dfaSimulate(dfa, "abb")).toBe(true);
    expect(dfaSimulate(dfa, "aabb")).toBe(true);
    expect(dfaSimulate(dfa, "babb")).toBe(true);
    expect(dfaSimulate(dfa, "ababb")).toBe(true);

    expect(dfaSimulate(dfa, "ab")).toBe(false);
    expect(dfaSimulate(dfa, "abba")).toBe(false);
    expect(dfaSimulate(dfa, "")).toBe(false);
  });

  it("supports unanchored substring matching for payload intrusion rules", () => {
    // Attack payload pattern
    const ast = parseRegex("UNION SELECT");
    const nfa = buildNFA(ast);
    const unanchoredDfa = toDFA(nfa, { unanchored: true });

    // Should detect payload embedded in benign HTTP query
    const benignPrefix = "GET /search?q=apple";
    const attack1 = "GET /search?q=apple' UNION SELECT password FROM users--";
    const attack2 = "UNION SELECT 1";

    expect(dfaSimulate(unanchoredDfa, benignPrefix)).toBe(false);

    const trace1 = dfaTrace(unanchoredDfa, attack1);
    expect(trace1.accepted).toBe(true);
    expect(trace1.firstAcceptIndex).toBeGreaterThan(0);

    const trace2 = dfaTrace(unanchoredDfa, attack2);
    expect(trace2.accepted).toBe(true);
  });
});
