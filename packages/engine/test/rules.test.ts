import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadRules, validateRule, Rule } from "../src/rules";

describe("Rule Book & Validation", () => {
  it("successfully validates and compiles all shipped rules in data/rules.json", () => {
    const rulesPath = resolve(__dirname, "../../../data/rules.json");
    const raw = readFileSync(rulesPath, "utf-8");
    const rules: Rule[] = JSON.parse(raw);

    const { compiledRules, errors } = loadRules(rules);

    expect(errors).toHaveLength(0);
    expect(compiledRules.length).toBeGreaterThanOrEqual(10);

    for (const cr of compiledRules) {
      expect(cr.ast).toBeDefined();
      expect(cr.nfa.states.length).toBeGreaterThan(0);
      expect(cr.dfa.states.length).toBeGreaterThan(0);
      expect(cr.minDfa.states.length).toBeGreaterThan(0);
      expect(cr.minDfa.states.length).toBeLessThanOrEqual(cr.dfa.states.length);
    }
  });

  it("reports rule validation syntax error with rule ID and character column index", () => {
    const badRule: Rule = {
      id: "BAD-01",
      name: "Bad rule",
      kind: "payload",
      pattern: "foo(bar",
      severity: "high",
      explain: "Unclosed group",
    };

    expect(() => validateRule(badRule)).toThrow();
    try {
      validateRule(badRule);
    } catch (err: any) {
      expect(err.ruleId).toBe("BAD-01");
      expect(err.index).toBe(3);
    }
  });
});
