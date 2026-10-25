import { describe, it, expect } from "vitest";
import { parseAnyLog } from "../src/normalize";
import { loadRules, Rule, compileRule } from "../src/rules";
import { scan } from "../src/detect";
import { run } from "../src/matcher";
import { simulatePDA } from "../src/pda";
import rulesJson from "../../../data/rules.json";

describe("Webpage Input Responsiveness & Universal Parser", () => {
  const rules = rulesJson as Rule[];
  const { compiledRules } = loadRules(rules);

  it("parses arbitrary custom SQLi and XSS test inputs without skipping", () => {
    const customInput = [
      "GET /search?id=1 UNION SELECT password FROM users HTTP/1.1",
      "GET /login?user=admin' OR '1'='1 HTTP/1.1",
      "<script>alert(1)</script>",
      "../../etc/passwd",
    ].join("\n");

    const { events, skippedCount } = parseAnyLog(customInput);

    expect(skippedCount).toBe(0);
    expect(events).toHaveLength(4);

    // Verify scan detects all 4 attacks on the custom test input
    const alerts = scan(events, compiledRules);
    const ruleIds = alerts.map((a) => a.ruleId);

    expect(ruleIds).toContain("SQLI-UNION");
    expect(ruleIds).toContain("SQLI-TAUTOLOGY");
    expect(ruleIds).toContain("XSS-SCRIPT");
    expect(ruleIds).toContain("TRAV-01");
  });

  it("parses arbitrary sequence tokens and detects sequence attacks", () => {
    const customSeqLog = [
      "Oct 20 10:00:00 server sshd[1]: Failed password for root from 1.2.3.4",
      "Oct 20 10:00:01 server sshd[1]: Failed password for root from 1.2.3.4",
      "Oct 20 10:00:02 server sshd[1]: Failed password for root from 1.2.3.4",
      "Oct 20 10:00:03 server sshd[1]: Accepted password for root from 1.2.3.4",
    ].join("\n");

    const { events, skippedCount } = parseAnyLog(customSeqLog);
    expect(skippedCount).toBe(0);
    expect(events).toHaveLength(4);

    const alerts = scan(events, compiledRules);
    const brute = alerts.find((a) => a.ruleId === "BRUTE-01");
    expect(brute).toBeDefined();
    expect(brute?.lineNumbers).toEqual([1, 2, 3, 4]);
  });

  it("interactive probe input correctly accepts and rejects against compiled DFA", () => {
    const bruteRule = rules.find((r) => r.id === "BRUTE-01")!;
    const compiled = compileRule(bruteRule);

    // Test valid sequence FFFS
    const traceAccepted = run(compiled.minDfa, "FFFS");
    expect(traceAccepted.accepted).toBe(true);
    expect(traceAccepted.states.length).toBeGreaterThan(1);

    // Test non-matching sequence FF
    const traceRejected = run(compiled.minDfa, "FF");
    expect(traceRejected.accepted).toBe(false);
  });

  it("PDA stack checker updates with different input delimiters", () => {
    const valid = simulatePDA("(([]))");
    expect(valid.accepted).toBe(true);

    const invalid = simulatePDA("([)]");
    expect(invalid.accepted).toBe(false);
    expect(invalid.errorMessage).toBeDefined();
  });
});
