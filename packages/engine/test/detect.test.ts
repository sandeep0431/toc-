import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parseAuthLog, parseAccessLog } from "../src/normalize";
import { loadRules, Rule } from "../src/rules";
import { scan } from "../src/detect";

describe("Detection Engine", () => {
  const rulesPath = resolve(__dirname, "../../../data/rules.json");
  const authLogPath = resolve(__dirname, "../../../data/auth.sample.log");
  const accessLogPath = resolve(__dirname, "../../../data/access.sample.log");
  const goldenAuthPath = resolve(__dirname, "../../../data/golden-auth-alerts.json");
  const goldenAccessPath = resolve(__dirname, "../../../data/golden-access-alerts.json");

  const rules: Rule[] = JSON.parse(readFileSync(rulesPath, "utf-8"));
  const { compiledRules } = loadRules(rules);

  it("detects all attacks in auth.sample.log and matches golden alerts", () => {
    const authContent = readFileSync(authLogPath, "utf-8");
    const { events } = parseAuthLog(authContent);
    const alerts = scan(events, compiledRules);

    // Verify attacks detected:
    // 1. Brute force (F{3,}S) from 10.0.0.99
    // 2. Port scan (P{5,}) from 10.0.0.88
    const bruteAlerts = alerts.filter((a) => a.ruleId === "BRUTE-01");
    const scanAlerts = alerts.filter((a) => a.ruleId === "SCAN-PORT-01");

    expect(bruteAlerts.length).toBe(1);
    expect(bruteAlerts[0].source).toBe("10.0.0.99");
    expect(bruteAlerts[0].lineNumbers).toEqual([3, 4, 5, 6]);

    expect(scanAlerts.length).toBe(1);
    expect(scanAlerts[0].source).toBe("10.0.0.88");
    expect(scanAlerts[0].lineNumbers).toEqual([9, 10, 11, 12, 13]);

    // Save golden file if not exists
    if (!existsSync(goldenAuthPath)) {
      writeFileSync(goldenAuthPath, JSON.stringify(alerts, null, 2), "utf-8");
    }

    const goldenAlerts = JSON.parse(readFileSync(goldenAuthPath, "utf-8"));
    expect(alerts).toEqual(goldenAlerts);
  });

  it("detects all attacks in access.sample.log and matches golden alerts", () => {
    const accessContent = readFileSync(accessLogPath, "utf-8");
    const { events } = parseAccessLog(accessContent);
    const alerts = scan(events, compiledRules);

    // Verified attack rules detected:
    // UNION SELECT, ' OR '1'='1, directory traversal, script tag, onerror handler, sqlmap scanner
    const ruleIds = alerts.map((a) => a.ruleId);
    expect(ruleIds).toContain("SQLI-UNION");
    expect(ruleIds).toContain("SQLI-TAUTOLOGY");
    expect(ruleIds).toContain("TRAV-01");
    expect(ruleIds).toContain("XSS-SCRIPT");
    expect(ruleIds).toContain("XSS-HANDLER");
    expect(ruleIds).toContain("AGENT-SCANNER");

    // No benign lines (lines 1, 2, 9) raise an alert
    const benignLines = [1, 2, 9];
    for (const alert of alerts) {
      for (const line of alert.lineNumbers) {
        expect(benignLines).not.toContain(line);
      }
    }

    // Save golden file if not exists
    if (!existsSync(goldenAccessPath)) {
      writeFileSync(goldenAccessPath, JSON.stringify(alerts, null, 2), "utf-8");
    }

    const goldenAlerts = JSON.parse(readFileSync(goldenAccessPath, "utf-8"));
    expect(alerts).toEqual(goldenAlerts);
  });

  it("theorem: detection is deterministic (running scan twice produces byte-identical JSON)", () => {
    const accessContent = readFileSync(accessLogPath, "utf-8");
    const { events } = parseAccessLog(accessContent);

    const run1 = scan(events, compiledRules);
    const run2 = scan(events, compiledRules);

    const json1 = JSON.stringify(run1);
    const json2 = JSON.stringify(run2);

    expect(json1).toBe(json2);
  });

  it("enforces sliding window limits: expired events outside windowSeconds do not trip sequence rules", () => {
    // 3 failed logins spread across 10 minutes (outside 120s window)
    const baseTs = new Date(Date.UTC(2026, 9, 20, 10, 0, 0)).getTime();
    const spreadEvents = [
      {
        lineNumber: 1,
        ts: baseTs,
        source: "1.2.3.4",
        kind: "auth" as const,
        symbol: "F" as const,
        raw: "fail 1",
        fields: {},
      },
      {
        lineNumber: 2,
        ts: baseTs + 300 * 1000, // +5 min
        source: "1.2.3.4",
        kind: "auth" as const,
        symbol: "F" as const,
        raw: "fail 2",
        fields: {},
      },
      {
        lineNumber: 3,
        ts: baseTs + 600 * 1000, // +10 min
        source: "1.2.3.4",
        kind: "auth" as const,
        symbol: "F" as const,
        raw: "fail 3",
        fields: {},
      },
      {
        lineNumber: 4,
        ts: baseTs + 610 * 1000,
        source: "1.2.3.4",
        kind: "auth" as const,
        symbol: "S" as const,
        raw: "success",
        fields: {},
      },
    ];

    const alerts = scan(spreadEvents, compiledRules);
    // Should NOT trigger BRUTE-01 because failures were expired outside 120s window
    const bruteAlerts = alerts.filter((a) => a.ruleId === "BRUTE-01");
    expect(bruteAlerts).toHaveLength(0);
  });
});
