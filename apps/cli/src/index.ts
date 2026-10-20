#!/usr/bin/env node
/**
 * Tripwire CLI: Automata-driven intrusion detection command line interface.
 *
 * Implements:
 * - tripwire scan <file> [--rules rules.json] [--format table|json] [--explain]
 * - tripwire compile "<regex>" [--dot out.dot] [--stats]
 * - tripwire rules lint rules.json
 *
 * Exit codes:
 * 0: Success / no alerts found
 * 1: Security alerts found
 * 2: Error
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  parseAuthLog,
  parseAccessLog,
  loadRules,
  validateRule,
  scan,
  parseRegex,
  buildNFA,
  toDFA,
  minimizeDFA,
  labelOf,
  Rule,
  DFA,
} from "@tripwire/engine";

function printUsage(): void {
  console.log(`Tripwire — Automata-Driven Intrusion Detection System

Usage:
  tripwire scan <file> [--rules <file>] [--format table|json] [--explain]
  tripwire compile "<regex>" [--dot <file>] [--stats]
  tripwire rules lint <rules.json>

Options:
  --rules <file>     Custom rules JSON path (default: data/rules.json)
  --format <fmt>     Output format: table (default) or json
  --explain          Print visited automaton state paths for alerts
  --dot <file>       Export compiled minimized DFA as Graphviz DOT graph
  --stats            Print NFA, DFA, and Minimized DFA state comparison
  -h, --help         Show this help message
`);
}

/**
 * Generate Graphviz DOT format string for a DFA.
 */
function dfaToDot(dfa: DFA, title = "Tripwire Automaton"): string {
  const lines: string[] = [];
  lines.push(`digraph "${title}" {`);
  lines.push(`  rankdir=LR;`);
  lines.push(`  node [fontname="IBM Plex Mono", fontsize=10];`);
  lines.push(`  edge [fontname="IBM Plex Mono", fontsize=9];`);
  lines.push("");

  // Start state pointer
  lines.push(`  __start [shape=none, label="", width=0, height=0];`);
  lines.push(`  __start -> ${dfa.startState};`);

  // State nodes
  for (const s of dfa.states) {
    const shape = s.isAccept ? "doublecircle" : "circle";
    const label = `q${s.id}${s.nfaStates && s.nfaStates.length > 0 ? `\\n{${s.nfaStates.join(",")}}` : ""}`;
    const color = s.isAccept ? "darkgreen" : s.isDead ? "red" : "black";
    lines.push(`  ${s.id} [shape=${shape}, label="${label}", color="${color}"];`);
  }
  lines.push("");

  // Transitions
  for (const t of dfa.transitions) {
    const lbl = labelOf(t.charSet).replace(/"/g, '\\"');
    lines.push(`  ${t.from} -> ${t.to} [label="${lbl}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

export async function runCli(args: string[]): Promise<number> {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    return 0;
  }

  const command = args[0];

  // 1. SCAN COMMAND
  if (command === "scan") {
    const targetFile = args[1];
    if (!targetFile || targetFile.startsWith("--")) {
      console.error("Error: scan command requires a target log file path.");
      printUsage();
      return 2;
    }

    const absPath = resolve(process.cwd(), targetFile);
    if (!existsSync(absPath)) {
      console.error(`Error: target log file not found at ${absPath}`);
      return 2;
    }

    // Parse options
    let rulesPath = resolve(process.cwd(), "data/rules.json");
    let format = "table";
    let explain = false;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--rules" && i + 1 < args.length) {
        rulesPath = resolve(process.cwd(), args[++i]);
      } else if (args[i] === "--format" && i + 1 < args.length) {
        format = args[++i];
      } else if (args[i] === "--explain") {
        explain = true;
      }
    }

    if (!existsSync(rulesPath)) {
      console.error(`Error: rules file not found at ${rulesPath}`);
      return 2;
    }

    let rules: Rule[];
    try {
      rules = JSON.parse(readFileSync(rulesPath, "utf-8"));
    } catch (err: any) {
      console.error(`Error: failed to read rules JSON: ${err.message}`);
      return 2;
    }

    const { compiledRules, errors } = loadRules(rules);
    if (errors.length > 0) {
      console.error(`Error: rule validation failed with ${errors.length} error(s):`);
      for (const e of errors) {
        console.error(`  - Rule [${e.ruleId}]: ${e.message} at column ${e.index}`);
      }
      return 2;
    }

    const logContent = readFileSync(absPath, "utf-8");

    // Autodetect log type: SSH auth log vs web access log
    const isAuthLog =
      logContent.includes("sshd[") ||
      logContent.includes("Failed password") ||
      logContent.includes("Accepted password");

    const { events, skippedCount } = isAuthLog
      ? parseAuthLog(logContent)
      : parseAccessLog(logContent);

    const alerts = scan(events, compiledRules);

    if (format === "json") {
      console.log(JSON.stringify(alerts, null, 2));
    } else {
      console.log("================================================================================");
      console.log(` TRIPWIRE SECURITY SCANNER — Log: ${targetFile}`);
      console.log(` Parsed: ${events.length} events | Skipped: ${skippedCount} lines | Rules: ${compiledRules.length}`);
      console.log("================================================================================");

      if (alerts.length === 0) {
        console.log("Clear. No rule tripped across all evaluated lines.");
      } else {
        console.log(`[!] ${alerts.length} ALERTS TRIPPED:\n`);
        for (const a of alerts) {
          const sevTag = a.severity === "high" ? "[HIGH]" : a.severity === "medium" ? "[MED ]" : "[LOW ]";
          console.log(`${sevTag} ${a.ruleId.padEnd(16)} | Line(s): ${a.lineNumbers.join(", ").padEnd(12)} | Source: ${a.source}`);
          console.log(`      Name:    ${a.ruleName}`);
          console.log(`      Snippet: ${a.matchedSnippet.length > 60 ? a.matchedSnippet.substring(0, 60) + "..." : a.matchedSnippet}`);
          if (explain) {
            console.log(`      Path:    ${a.statePath.map((s) => `q${s}`).join(" -> ")}`);
          }
          console.log("");
        }
      }
      console.log("================================================================================");
    }

    return alerts.length > 0 ? 1 : 0;
  }

  // 2. COMPILE COMMAND
  if (command === "compile") {
    const pattern = args[1];
    if (!pattern || pattern.startsWith("--")) {
      console.error("Error: compile command requires a regular expression pattern string.");
      printUsage();
      return 2;
    }

    let stats = false;
    let dotFile: string | null = null;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--stats") {
        stats = true;
      } else if (args[i] === "--dot" && i + 1 < args.length) {
        dotFile = args[++i];
      }
    }

    try {
      const ast = parseRegex(pattern);
      const nfa = buildNFA(ast);
      const dfa = toDFA(nfa);
      const { dfa: minDfa } = minimizeDFA(dfa);

      if (dotFile) {
        const dotContent = dfaToDot(minDfa, `Minimized DFA for /${pattern}/`);
        writeFileSync(resolve(process.cwd(), dotFile), dotContent, "utf-8");
        console.log(`Exported Graphviz DOT to ${dotFile}`);
      }

      if (stats || !dotFile) {
        console.log(`Automata Compilation Summary for /${pattern}/`);
        console.log("------------------------------------------------------------------");
        console.log(`  Thompson NFA:   ${nfa.states.length.toString().padStart(4)} states | ${nfa.transitions.length.toString().padStart(4)} transitions`);
        console.log(`  Subset DFA:     ${dfa.states.length.toString().padStart(4)} states | ${dfa.transitions.length.toString().padStart(4)} transitions`);
        console.log(`  Hopcroft Min:   ${minDfa.states.length.toString().padStart(4)} states | ${minDfa.transitions.length.toString().padStart(4)} transitions`);
        const reduction = Math.round((1 - minDfa.states.length / dfa.states.length) * 100);
        console.log(`  State Reduction: ${reduction}%`);
        console.log("------------------------------------------------------------------");
      }

      return 0;
    } catch (err: any) {
      console.error(`Error during compilation: ${err.message}`);
      return 2;
    }
  }

  // 3. RULES LINT COMMAND
  if (command === "rules") {
    const sub = args[1];
    if (sub !== "lint") {
      console.error(`Unknown subcommand: rules ${sub}`);
      printUsage();
      return 2;
    }

    const rulesFile = args[2] || "data/rules.json";
    const absPath = resolve(process.cwd(), rulesFile);

    if (!existsSync(absPath)) {
      console.error(`Error: rules file not found at ${absPath}`);
      return 2;
    }

    try {
      const content = readFileSync(absPath, "utf-8");
      const rules: Rule[] = JSON.parse(content);

      let hasErrors = false;
      for (const r of rules) {
        try {
          validateRule(r);
        } catch (err: any) {
          hasErrors = true;
          console.error(`[FAIL] Rule '${err.ruleId}': ${err.message} at index ${err.index}`);
          if (r.pattern && err.index !== undefined) {
            console.error(`       ${r.pattern}`);
            console.error(`       ${" ".repeat(err.index)}^`);
          }
        }
      }

      if (hasErrors) {
        return 2;
      }

      console.log(`OK: All ${rules.length} rules in ${rulesFile} are structurally valid.`);
      return 0;
    } catch (err: any) {
      console.error(`Error: failed to lint rules: ${err.message}`);
      return 2;
    }
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  return 2;
}

import { fileURLToPath } from "node:url";

const isDirectEntry =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isDirectEntry) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
