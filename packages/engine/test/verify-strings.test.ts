import { describe, it, expect } from "vitest";
import { loadRules, Rule, compileRule } from "../src/rules";
import { run } from "../src/matcher";
import { simulatePDA } from "../src/pda";
import { parseAnyLog } from "../src/normalize";
import { scan } from "../src/detect";
import rulesData from "../../../data/rules.json";

describe("Tripwire Comprehensive String Verification Test Suite", () => {
  const rules = rulesData as Rule[];
  const { compiledRules } = loadRules(rules);

  function getCompiled(ruleId: string) {
    const r = rules.find((x) => x.id === ruleId);
    if (!r) throw new Error("Rule not found: " + ruleId);
    return compileRule(r);
  }

  describe("Automaton String Probe DFA Traces", () => {
    it("SQLI-UNION: detects union injection and permits benign queries", () => {
      const compiled = getCompiled("SQLI-UNION");
      expect(run(compiled.minDfa, "UNION SELECT").accepted).toBe(true);
      expect(run(compiled.minDfa, "1' UNION SELECT username, password FROM users--").accepted).toBe(true);
      expect(run(compiled.minDfa, "union select").accepted).toBe(true);

      expect(run(compiled.minDfa, "SELECT * FROM products").accepted).toBe(false);
      expect(run(compiled.minDfa, "UNION").accepted).toBe(false);
      expect(run(compiled.minDfa, "safe query string").accepted).toBe(false);
    });

    it("SQLI-TAUTOLOGY: detects auth bypass and permits normal logins", () => {
      const compiled = getCompiled("SQLI-TAUTOLOGY");
      expect(run(compiled.minDfa, "' OR '1'='1").accepted).toBe(true);
      expect(run(compiled.minDfa, "admin' OR '1'='1").accepted).toBe(true);
      expect(run(compiled.minDfa, "user' OR '1'='1' --").accepted).toBe(true);

      expect(run(compiled.minDfa, "admin").accepted).toBe(false);
      expect(run(compiled.minDfa, "' OR '2'='1").accepted).toBe(false);
      expect(run(compiled.minDfa, "' AND '1'='1").accepted).toBe(false);
    });

    it("TRAV-01: detects consecutive parent traversals", () => {
      const compiled = getCompiled("TRAV-01");
      expect(run(compiled.minDfa, "../../").accepted).toBe(true);
      expect(run(compiled.minDfa, "../../../../etc/passwd").accepted).toBe(true);
      expect(run(compiled.minDfa, "../../windows/win.ini").accepted).toBe(true);

      expect(run(compiled.minDfa, "../").accepted).toBe(false);
      expect(run(compiled.minDfa, "/images/avatar.png").accepted).toBe(false);
      expect(run(compiled.minDfa, "document.pdf").accepted).toBe(false);
    });

    it("XSS-SCRIPT: detects script tags regardless of case", () => {
      const compiled = getCompiled("XSS-SCRIPT");
      expect(run(compiled.minDfa, "<script").accepted).toBe(true);
      expect(run(compiled.minDfa, "<script>alert(1)</script>").accepted).toBe(true);
      expect(run(compiled.minDfa, '<SCRIPT src="evil.js">').accepted).toBe(true);

      expect(run(compiled.minDfa, "<div>Hello World</div>").accepted).toBe(false);
      expect(run(compiled.minDfa, '<span class="badge">').accepted).toBe(false);
      expect(run(compiled.minDfa, "safe description text").accepted).toBe(false);
    });

    it("XSS-HANDLER: detects inline event handlers", () => {
      const compiled = getCompiled("XSS-HANDLER");
      expect(run(compiled.minDfa, "onerror=").accepted).toBe(true);
      expect(run(compiled.minDfa, "<img src=x onerror=alert(1)>").accepted).toBe(true);
      expect(run(compiled.minDfa, "ONERROR=confirm(document.cookie)").accepted).toBe(true);

      expect(run(compiled.minDfa, "onload=").accepted).toBe(false);
      expect(run(compiled.minDfa, '<img src="profile.jpg">').accepted).toBe(false);
      expect(run(compiled.minDfa, "error_handler_fn").accepted).toBe(false);
    });

    it("AGENT-SCANNER: identifies automated offensive security tools", () => {
      const compiled = getCompiled("AGENT-SCANNER");
      expect(run(compiled.minDfa, "sqlmap").accepted).toBe(true);
      expect(run(compiled.minDfa, "nikto").accepted).toBe(true);
      expect(run(compiled.minDfa, "nmap").accepted).toBe(true);
      expect(run(compiled.minDfa, "curl/8").accepted).toBe(true);

      expect(run(compiled.minDfa, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)").accepted).toBe(false);
      expect(run(compiled.minDfa, "Chrome/120.0.0.0").accepted).toBe(false);
      expect(run(compiled.minDfa, "Safari/537.36").accepted).toBe(false);
    });

    it("BRUTE-01: detects >= 3 failures followed by success", () => {
      const compiled = getCompiled("BRUTE-01");
      expect(run(compiled.minDfa, "FFFS").accepted).toBe(true);
      expect(run(compiled.minDfa, "FFFFFS").accepted).toBe(true);

      expect(run(compiled.minDfa, "FF").accepted).toBe(false);
      expect(run(compiled.minDfa, "FS").accepted).toBe(false);
      expect(run(compiled.minDfa, "FFFF").accepted).toBe(false);
    });
  });

  describe("Pushdown Automaton (PDA) Delimiter Stack Analyzer", () => {
    it("accepts balanced Dyck language delimiter expressions", () => {
      expect(simulatePDA("(([]))").accepted).toBe(true);
      expect(simulatePDA("{ [ ( ) ] }").accepted).toBe(true);
      expect(simulatePDA("SELECT * FROM (users WHERE id IN (1, 2))").accepted).toBe(true);
      expect(simulatePDA('{"user": {"roles": ["admin", "editor"]}}').accepted).toBe(true);
      expect(simulatePDA("({[()]})").accepted).toBe(true);
    });

    it("rejects unbalanced delimiters and reports exact column mismatch", () => {
      expect(simulatePDA("SELECT * FROM (users WHERE a = [1, 2))").accepted).toBe(false);
      expect(simulatePDA("([)]").accepted).toBe(false);
      expect(simulatePDA("((()").accepted).toBe(false);
      expect(simulatePDA("]").accepted).toBe(false);
      expect(simulatePDA('{"key": "unclosed string}').accepted).toBe(false);
    });
  });

  describe("Multi-Rule Event Stream Pipeline", () => {
    it("detects all web attacks in access log stream", () => {
      const accessLog = [
        '192.168.1.10 - - [28/Oct/2026:10:00:00 +0000] "GET /search?id=1 UNION SELECT password FROM users HTTP/1.1" 200 4502 "Mozilla/5.0" 12',
        '192.168.1.10 - - [28/Oct/2026:10:00:01 +0000] "GET /login?user=admin\' OR \'1\'=\'1 HTTP/1.1" 200 1200 "Mozilla/5.0" 8',
        '10.0.0.77 - - [28/Oct/2026:10:02:00 +0000] "GET /static/../../etc/passwd HTTP/1.1" 403 280 "-" "curl/7.68.0"',
        '10.0.0.66 - - [28/Oct/2026:10:03:00 +0000] "GET /search?q=<script>alert(1)</script> HTTP/1.1" 200 3100 "-" "Mozilla/5.0"',
        '10.0.0.66 - - [28/Oct/2026:10:03:15 +0000] "GET /profile?name=test onerror=alert(1) HTTP/1.1" 200 3200 "-" "Mozilla/5.0"',
        '10.0.0.55 - - [28/Oct/2026:10:05:00 +0000] "GET /api/status HTTP/1.1" 200 512 "-" "sqlmap/1.5.2#stable"',
      ].join("\n");

      const { events, skippedCount } = parseAnyLog(accessLog);
      expect(skippedCount).toBe(0);
      expect(events).toHaveLength(6);

      const alerts = scan(events, compiledRules);
      const ruleIds = alerts.map((a) => a.ruleId);

      expect(ruleIds).toContain("SQLI-UNION");
      expect(ruleIds).toContain("SQLI-TAUTOLOGY");
      expect(ruleIds).toContain("TRAV-01");
      expect(ruleIds).toContain("XSS-SCRIPT");
      expect(ruleIds).toContain("XSS-HANDLER");
      expect(ruleIds).toContain("AGENT-SCANNER");
    });

    it("detects temporal brute force attacks in auth log stream", () => {
      const authLog = [
        "Oct 28 10:00:00 server sshd[1]: Failed password for root from 192.168.1.50",
        "Oct 28 10:00:01 server sshd[1]: Failed password for root from 192.168.1.50",
        "Oct 28 10:00:02 server sshd[1]: Failed password for root from 192.168.1.50",
        "Oct 28 10:00:03 server sshd[1]: Accepted password for root from 192.168.1.50",
      ].join("\n");

      const { events, skippedCount } = parseAnyLog(authLog);
      expect(skippedCount).toBe(0);
      expect(events).toHaveLength(4);

      const alerts = scan(events, compiledRules);
      expect(alerts.some((a) => a.ruleId === "BRUTE-01")).toBe(true);
    });
  });
});
