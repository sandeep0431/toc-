import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Rule,
  Event,
  Alert,
  compileRule,
  CompiledRule,
  parseAuthLog,
  parseAccessLog,
  parseAnyLog,
  scan,
  run,
  VERSION,
} from "@tripwire/engine";
import { DEFAULT_RULES, SAMPLE_LOGS } from "./data/samples";
import { RuleBook } from "./components/RuleBook";
import { TrackDiagram } from "./components/TrackDiagram";
import { EventTape } from "./components/EventTape";
import { InterlockingControls } from "./components/InterlockingControls";
import { AlertRegister } from "./components/AlertRegister";
import { ConstructionDrawer } from "./components/ConstructionDrawer";
import { MergesDrawer } from "./components/MergesDrawer";
import { ShortcutModal } from "./components/ShortcutModal";
import { PDAVisualizer } from "./components/PDAVisualizer";

export default function App() {
  // Theme & Modals (Default is clean Studio light mode)
  const [isDark, setIsDark] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showConstruction, setShowConstruction] = useState<boolean>(false);
  const [showMerges, setShowMerges] = useState<boolean>(false);
  const [showPDA, setShowPDA] = useState<boolean>(false);
  const [activeMobileTab, setActiveMobileTab] = useState<"rules" | "track" | "tape" | "alerts" | "pda">("track");

  // Rules & Compilation
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("BRUTE-01");

  const selectedRule = useMemo(() => {
    return rules.find((r) => r.id === selectedRuleId) || rules[0];
  }, [rules, selectedRuleId]);

  const fallbackRule: Rule = {
    id: "IDLE",
    name: "Standby route",
    kind: "payload",
    pattern: ".*",
    severity: "low",
    explain: "Awaiting pattern definition",
  };

  const compiledRule: CompiledRule = useMemo(() => {
    const target = selectedRule || fallbackRule;
    if (!target.pattern || target.pattern.trim().length === 0) {
      try {
        return compileRule({ ...target, pattern: ".*" });
      } catch {
        return compileRule(fallbackRule);
      }
    }

    try {
      return compileRule(target);
    } catch {
      try {
        return compileRule({ ...target, pattern: ".*" });
      } catch {
        return compileRule(fallbackRule);
      }
    }
  }, [selectedRule]);

  // Log Events State
  const [activeSampleKey, setActiveSampleKey] = useState<string>("auth");
  const [rawLogText, setRawLogText] = useState<string>(SAMPLE_LOGS.auth.content);

  const { events, skippedCount } = useMemo(() => {
    if (!rawLogText || rawLogText.trim().length === 0) {
      return { events: [], skippedCount: 0 };
    }

    return parseAnyLog(rawLogText);
  }, [rawLogText]);

  // Precomputed full-scan alerts for the entire log
  const fullScanAlerts = useMemo(() => {
    if (events.length === 0) return [];

    const allCompiled = rules
      .map((r) => {
        try {
          return compileRule(r);
        } catch {
          return null;
        }
      })
      .filter((r): r is CompiledRule => r !== null);

    return scan(events, allCompiled);
  }, [events, rules]);

  // Direct Interactive Automaton String Probe State
  const [probeString, setProbeString] = useState<string>("");
  const probeTrace = useMemo(() => {
    if (!probeString || probeString.length === 0) return null;
    try {
      return run(compiledRule.minDfa, probeString);
    } catch {
      return null;
    }
  }, [probeString, compiledRule]);

  // Stepping & Interlocking Engine State
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [activeStateId, setActiveStateId] = useState<number>(0);
  const [previousStateId, setPreviousStateId] = useState<number | null>(null);
  const [trippedLineNumbers, setTrippedLineNumbers] = useState<Set<number>>(new Set());
  const [incrementalAlerts, setIncrementalAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  // Sync dark theme to document (default is clean light studio)
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Reset execution route
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setActiveLineIndex(0);
    setActiveStateId(compiledRule.minDfa.startState);
    setPreviousStateId(null);
    setTrippedLineNumbers(new Set());
    setIncrementalAlerts([]);
    setSelectedAlert(null);
  }, [compiledRule]);

  // Reset when selected rule or compiled automaton changes
  useEffect(() => {
    handleReset();
  }, [selectedRuleId, compiledRule, handleReset]);

  // Single Step Function
  const handleStep = useCallback(() => {
    if (events.length === 0) return;
    if (activeLineIndex >= events.length) {
      setIsRunning(false);
      return;
    }

    const currentEvent = events[activeLineIndex];
    if (!currentEvent) {
      setIsRunning(false);
      return;
    }

    setPreviousStateId(activeStateId);

    // Determine string or symbol to evaluate on current rule
    let textToEvaluate = "";
    if (compiledRule.rule.kind === "payload") {
      const field = compiledRule.rule.field || "raw";
      textToEvaluate =
        field === "raw"
          ? currentEvent.raw
          : currentEvent.fields[field] || currentEvent.raw;
    } else {
      // Sequence rule: evaluate cumulative symbol sequence up to current line
      const relevantEvents = events.slice(0, activeLineIndex + 1).filter((e) => e.source === currentEvent.source);
      textToEvaluate = relevantEvents.map((e) => e.symbol).join("");
    }

    if (textToEvaluate.length > 0) {
      const trace = run(compiledRule.minDfa, textToEvaluate);
      const nextState = trace.states[trace.states.length - 1] ?? compiledRule.minDfa.startState;
      setActiveStateId(nextState);

      if (trace.accepted) {
        // Slam TRIPPED stamp
        setTrippedLineNumbers((prev) => new Set([...prev, currentEvent.lineNumber]));

        const newAlert: Alert = {
          ruleId: compiledRule.rule.id,
          ruleName: compiledRule.rule.name,
          severity: compiledRule.rule.severity,
          source: currentEvent.source,
          lineNumbers: [currentEvent.lineNumber],
          matchedSnippet: trace.matchedSnippet || textToEvaluate,
          statePath: trace.states,
          timestamp: new Date(currentEvent.ts).toISOString(),
        };

        setIncrementalAlerts((prev) => {
          if (prev.some((a) => a.ruleId === newAlert.ruleId && a.lineNumbers[0] === newAlert.lineNumbers[0])) {
            return prev;
          }
          return [newAlert, ...prev];
        });
      }
    }

    setActiveLineIndex((idx) => idx + 1);
  }, [events, activeLineIndex, activeStateId, compiledRule]);

  // Automated Running Loop
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = Math.max(50, Math.floor(500 / speed));
    const timer = setInterval(() => {
      if (activeLineIndex >= events.length) {
        setIsRunning(false);
      } else {
        handleStep();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, speed, activeLineIndex, events.length, handleStep]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs or textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleStep();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setIsRunning((r) => !r);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleReset();
        setShowShortcuts(false);
        setShowConstruction(false);
        setShowMerges(false);
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      } else if (e.key === "1") {
        setSpeed(1);
      } else if (e.key === "2") {
        setSpeed(2);
      } else if (e.key === "5") {
        setSpeed(5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleStep, handleReset]);

  // Click on Alert to Replay State Path & Rewind Tape
  const handleSelectAlert = (alert: Alert) => {
    setSelectedAlert(alert);

    // Switch to that rule if different
    if (alert.ruleId !== selectedRuleId) {
      setSelectedRuleId(alert.ruleId);
    }

    // Rewind active line to first line of alert
    if (alert.lineNumbers.length > 0) {
      const targetLine = alert.lineNumbers[0];
      const foundIdx = events.findIndex((e) => e.lineNumber === targetLine);
      if (foundIdx !== -1) {
        setActiveLineIndex(foundIdx);
      }
    }

    // Highlight final state in path
    if (alert.statePath.length > 0) {
      setActiveStateId(alert.statePath[alert.statePath.length - 1]);
    }
  };

  const handleSelectSample = (sampleKey: string) => {
    setActiveSampleKey(sampleKey);
    const sample = SAMPLE_LOGS[sampleKey];
    if (sample) {
      setRawLogText(sample.content);
      if (sample.type === "web") {
        setSelectedRuleId("SQLI-UNION");
      } else if (sample.type === "auth") {
        setSelectedRuleId("BRUTE-01");
      }
      handleReset();
    }
  };

  const handleLoadCustomLog = (content: string) => {
    setActiveSampleKey("custom");
    setRawLogText(content);
    handleReset();
  };

  // Combine full scan alerts and incremental alerts
  const displayAlerts = fullScanAlerts.length > 0 ? fullScanAlerts : incrementalAlerts;

  return (
    <div className="h-screen w-screen flex flex-col bg-board text-paper font-sans overflow-hidden select-none">
      {/* 1. Precision Studio Navigation Header */}
      <header className="h-12 border-b border-track flex items-center px-4 bg-board-raised justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {/* Minimal Automata Node Icon */}
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <line x1="8.7" y1="10.7" x2="15.3" y2="7.3" />
                <line x1="8.7" y1="13.3" x2="15.3" y2="16.7" />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-tight text-paper">TRIPWIRE</span>
            <span className="text-[10px] text-paper-dim border border-track px-2 py-0.5 rounded-full bg-board font-mono font-medium">
              TOC Engine v{VERSION}
            </span>
          </div>
          <span className="hidden lg:inline-block text-[12px] text-paper-dim pl-2 border-l border-track">
            Automata-Driven Intrusion Detection System
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* PDA Toggle */}
          <button
            onClick={() => setShowPDA(!showPDA)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              showPDA
                ? "bg-amber-600 text-white shadow-xs font-semibold"
                : "border border-track text-paper-dim hover:text-paper hover:bg-board"
            }`}
            title="Toggle Pushdown Automaton (Dyck balanced delimiter checker)"
          >
            {showPDA ? "Close PDA Stack" : "PDA Stack Analyzer"}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="px-2.5 py-1 rounded-md border border-track text-paper-dim hover:text-paper hover:bg-board transition-all text-[11px] font-medium"
            title="Toggle Studio Light / Minimal Dark mode"
          >
            {isDark ? "Light Studio ☼" : "Dark Mode ☾"}
          </button>

          {/* Shortcut Help Button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-7 h-7 rounded-md border border-track flex items-center justify-center text-paper-dim hover:text-paper hover:bg-board font-semibold text-xs transition-colors"
            title="Keyboard shortcuts [?]"
          >
            ?
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar (visible below 768px) */}
      <div className="md:hidden h-9 border-b border-track bg-board-raised flex items-center justify-around text-xs shrink-0 px-2">
        {(["rules", "track", "tape", "alerts", "pda"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveMobileTab(t)}
            className={`capitalize px-3 py-1 text-xs rounded-md transition-colors ${
              activeMobileTab === t
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                : "text-paper-dim hover:text-paper"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 2. Main Precision Panels */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 relative bg-board">
        {/* Left Column: Rule Book (24% desktop, or mobile tab) */}
        <div
          className={`w-full md:w-[24%] h-full shrink-0 rounded-lg overflow-hidden border border-track bg-board-raised shadow-xs ${
            activeMobileTab === "rules" ? "block" : "hidden md:block"
          }`}
        >
          <RuleBook
            rules={rules}
            selectedRuleId={selectedRuleId}
            onSelectRule={(r) => setSelectedRuleId(r.id)}
            onUpdateRule={(updated) => {
              setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            }}
            onAddRule={(newR) => {
              setRules((prev) => [newR, ...prev]);
              setSelectedRuleId(newR.id);
            }}
          />
        </div>

        {/* Center Column: Track Diagram + Interlocking Stepper (46% desktop, or mobile tab) */}
        <div
          className={`flex-1 h-full flex flex-col min-w-0 rounded-lg overflow-hidden border border-track bg-board-raised shadow-xs ${
            activeMobileTab === "track" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex-1 min-h-0 relative">
            {showPDA ? (
              <PDAVisualizer />
            ) : (
              <TrackDiagram
                compiledRule={compiledRule}
                activeStateId={
                  probeTrace && probeTrace.states.length > 0
                    ? probeTrace.states[probeTrace.states.length - 1]
                    : activeStateId
                }
                previousStateId={previousStateId}
                isDark={isDark}
                onOpenConstruction={() => setShowConstruction(true)}
                onOpenMerges={() => setShowMerges(true)}
              />
            )}

            {/* Replay Drawers */}
            {showConstruction && (
              <ConstructionDrawer
                steps={compiledRule.dfa.steps}
                onClose={() => setShowConstruction(false)}
                onSelectStep={(step) => {
                  if (step.targetDfaStateId !== undefined) {
                    setActiveStateId(step.targetDfaStateId);
                  }
                }}
                selectedStep={null}
              />
            )}

            {showMerges && (
              <MergesDrawer
                partitionsHistory={compiledRule.minDfa.steps ? [compiledRule.minDfa.states.map((s) => s.nfaStates)] : []}
                onClose={() => setShowMerges(false)}
              />
            )}
          </div>

          {/* Direct Interactive Automaton String Probe Input */}
          <div className="border-t border-track bg-board-raised p-3 flex flex-col space-y-2 shrink-0 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs tracking-tight text-paper">Automaton String Probe</span>
                <span className="text-[11px] text-paper-dim font-medium">Test arbitrary string on {selectedRule.id} DFA:</span>
              </div>
              {probeTrace && (
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                      probeTrace.accepted
                        ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    {probeTrace.accepted ? "🚨 ATTACK DETECTED" : "✓ SAFE / BENIGN (No Attack)"}
                  </span>
                  <span className="text-[11px] text-paper font-mono bg-board px-2 py-0.5 rounded font-semibold border border-track">
                    Path: {probeTrace.states.map((s) => `q${s}`).join(" → ")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={
                  selectedRule.kind === "sequence"
                    ? 'Type sequence string (e.g. "FFFS", "PPPPP")...'
                    : 'Type test payload (e.g. "UNION SELECT", "\' OR \'1\'=\'1", "<script>")...'
                }
                value={probeString}
                onChange={(e) => setProbeString(e.target.value)}
                className="flex-1 bg-board border border-track rounded-md px-3 py-1.5 text-xs font-semibold text-paper font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-paper-dim/60"
              />
              {probeString.length > 0 && (
                <button
                  type="button"
                  onClick={() => setProbeString("")}
                  className="px-2.5 py-1.5 rounded-md border border-track text-paper hover:bg-board text-xs font-semibold transition-colors"
                  title="Clear probe string"
                >
                  Clear
                </button>
              )}
              {/* Presets */}
              <div className="flex items-center space-x-1 shrink-0">
                {(selectedRule.kind === "sequence"
                  ? ["FFFS", "PPPP", "SS"]
                  : ["UNION SELECT", "' OR '1'='1", "<script", "safe query"]
                ).map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setProbeString(example)}
                    className="px-2 py-1 rounded-md border border-track bg-board text-paper hover:bg-board-raised text-[11px] font-mono font-semibold transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pinned Stepping Controls */}
          <InterlockingControls
            isRunning={isRunning}
            speed={speed}
            onStep={handleStep}
            onToggleRun={() => setIsRunning(!isRunning)}
            onReset={handleReset}
            onChangeSpeed={(s) => setSpeed(s)}
          />
        </div>

        {/* Right Column: Event Tape (30% desktop, or mobile tab) */}
        <div
          className={`w-full md:w-[30%] h-full shrink-0 rounded-lg overflow-hidden border border-track bg-board-raised shadow-xs ${
            activeMobileTab === "tape" ? "block" : "hidden md:block"
          }`}
        >
          <EventTape
            events={events}
            activeLineIndex={activeLineIndex}
            trippedLineNumbers={trippedLineNumbers}
            skippedCount={skippedCount}
            activeSampleKey={activeSampleKey}
            onSelectSample={handleSelectSample}
            onLoadCustomLog={handleLoadCustomLog}
          />
        </div>
      </main>

      {/* 3. Bottom Alert Register Drawer */}
      <div
        className={`shrink-0 z-30 ${
          activeMobileTab === "alerts" ? "block fixed inset-x-0 bottom-0" : "hidden md:block"
        }`}
      >
        <AlertRegister
          alerts={displayAlerts}
          onSelectAlert={handleSelectAlert}
          selectedAlert={selectedAlert}
          trippedLineNumbers={trippedLineNumbers}
          activeLineIndex={activeLineIndex}
          totalEventsCount={events.length}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      <ShortcutModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
