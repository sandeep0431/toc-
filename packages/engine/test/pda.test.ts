import { describe, it, expect } from "vitest";
import { simulatePDA } from "../src/pda";

describe("Pushdown Automaton (PDA) Balanced Delimiters", () => {
  it("accepts balanced parentheses and nested brackets", () => {
    const trace = simulatePDA("(SELECT * FROM (SELECT id FROM users WHERE a = [1, 2]))");
    expect(trace.accepted).toBe(true);
    expect(trace.errorIndex).toBeNull();
    expect(trace.finalStack).toEqual(["$"]);
  });

  it("rejects mismatched brackets with column error index", () => {
    // Column index 5 has ']' instead of ')'
    const trace = simulatePDA("func(]");
    expect(trace.accepted).toBe(false);
    expect(trace.errorIndex).toBe(5);
    expect(trace.errorMessage).toContain("Mismatched closing delimiter");
  });

  it("rejects unclosed quotes and brackets at end of string", () => {
    const trace = simulatePDA("SELECT 'unclosed string");
    expect(trace.accepted).toBe(false);
    expect(trace.errorMessage).toContain("Unclosed delimiter");
  });

  it("tracks dynamic stack growth and shrink operations", () => {
    const trace = simulatePDA("((a))");
    expect(trace.accepted).toBe(true);
    const actions = trace.steps.map((s) => s.action);
    expect(actions).toContain("push");
    expect(actions).toContain("pop");
  });
});
