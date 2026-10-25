/**
 * detect.ts: Deterministic multi-rule intrusion detection engine.
 *
 * Formal Theory:
 * The detection engine executes a composition of regular language recognizers:
 * 1. Payload detection: L_p(R) ⊆ Σ* executed over raw string fields.
 * 2. Temporal sequence detection: L_s(R) ⊆ Σ_events* executed over a per-source
 *    sliding window queue W(t, Δt) = { e ∈ Events | e.source == s ∧ t - Δt ≤ e.ts ≤ t }.
 *
 * Determinism Guarantee:
 * Identical log inputs and rules produce byte-identical JSON alert structures.
 */

import { Event } from "./events";
import { CompiledRule, RuleSeverity } from "./rules";
import { run } from "./matcher";

export interface Alert {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: RuleSeverity;
  readonly source: string;
  readonly lineNumbers: readonly number[];
  readonly matchedSnippet: string;
  readonly statePath: readonly number[];
  readonly timestamp: string;
}

/**
 * Scans an array of normalized events against compiled rules and returns
 * a deterministically ordered list of security alerts.
 */
export function scan(events: readonly Event[], rules: readonly CompiledRule[]): Alert[] {
  const alerts: Alert[] = [];

  // Separate payload and sequence rules
  const payloadRules = rules.filter((r) => r.rule.kind === "payload");
  const sequenceRules = rules.filter((r) => r.rule.kind === "sequence");

  // Track per-source event history for sliding window sequence rules
  // source -> ruleId -> Event[]
  const sourceHistories = new Map<string, Map<string, Event[]>>();

  // Process events in chronological line order
  for (const event of events) {
    // 1. Evaluate Payload Rules
    for (const cr of payloadRules) {
      const fieldName = cr.rule.field || "raw";
      let textToScan = "";

      if (fieldName === "raw") {
        textToScan = event.raw;
      } else if (event.fields && fieldName in event.fields) {
        textToScan = event.fields[fieldName];
      }

      // Fallback to raw text if field is empty/unextracted
      if (!textToScan && event.raw) {
        textToScan = event.raw;
      }

      if (textToScan.length > 0) {
        const trace = run(cr.minDfa, textToScan);
        if (trace.accepted) {
          const matchedSnippet = trace.matchedSnippet || textToScan;
          alerts.push({
            ruleId: cr.rule.id,
            ruleName: cr.rule.name,
            severity: cr.rule.severity,
            source: event.source,
            lineNumbers: [event.lineNumber],
            matchedSnippet,
            statePath: trace.states,
            timestamp: new Date(event.ts).toISOString(),
          });
        }
      }
    }

    // 2. Evaluate Temporal Sequence Rules
    if (sequenceRules.length > 0) {
      let ruleMap = sourceHistories.get(event.source);
      if (!ruleMap) {
        ruleMap = new Map();
        sourceHistories.set(event.source, ruleMap);
      }

      for (const cr of sequenceRules) {
        const windowSec = cr.rule.windowSeconds ?? 120;
        const windowMs = windowSec * 1000;

        let history = ruleMap.get(cr.rule.id);
        if (!history) {
          history = [];
          ruleMap.set(cr.rule.id, history);
        }

        // Add current event to window
        history.push(event);

        // Evict expired events outside the sliding window
        const cutoff = event.ts - windowMs;
        while (history.length > 0 && history[0].ts < cutoff) {
          history.shift();
        }

        // Build symbol sequence string for this window (e.g. "FFFS")
        const symbolSeq = history.map((e) => e.symbol).join("");

        const trace = run(cr.minDfa, symbolSeq);
        if (trace.accepted) {
          // Identify matching line numbers
          const matchedLines = history.map((e) => e.lineNumber);
          alerts.push({
            ruleId: cr.rule.id,
            ruleName: cr.rule.name,
            severity: cr.rule.severity,
            source: event.source,
            lineNumbers: matchedLines,
            matchedSnippet: symbolSeq,
            statePath: trace.states,
            timestamp: new Date(event.ts).toISOString(),
          });

          // Clear history after trip to prevent re-tripping on same prefix
          ruleMap.set(cr.rule.id, []);
        }
      }
    }
  }

  // Deterministic canonical sorting:
  // Primary: line number of first participating event
  // Secondary: ruleId
  // Tertiary: source IP
  alerts.sort((a, b) => {
    const aLine = a.lineNumbers[0] ?? 0;
    const bLine = b.lineNumbers[0] ?? 0;
    if (aLine !== bLine) return aLine - bLine;
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    return a.source.localeCompare(b.source);
  });

  return alerts;
}
