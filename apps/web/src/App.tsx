import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Rule,
  Event,
  Alert,
  compileRule,
  CompiledRule,
  parseAuthLog,
  parseAccessLog,
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
  // Theme & Modals
  const [isDaylight, setIsDaylight] = useState<boolean>(false);
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

    const isAuth =
      rawLogText.includes("sshd[") ||
      rawLogText.includes("Failed password") ||
      rawLogText.includes("Accepted password");

    return isAuth ? parseAuthLog(rawLogText) : parseAccessLog(rawLogText);
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

  // Stepping & Interlocking Engine State
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [activeStateId, setActiveStateId] = useState<number>(0);
  const [previousStateId, setPreviousStateId] = useState<number | null>(null);
  const [trippedLineNumbers, setTrippedLineNumbers] = useState<Set<number>>(new Set());
  const [incrementalAlerts, setIncrementalAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  // Sync daylight theme to document
  useEffect(() => {
    if (isDaylight) {
      document.documentElement.setAttribute("data-theme", "daylight");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDaylight]);

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

  // Reset when selected rule changes
  useEffect(() => {
    handleReset();
  }, [selectedRuleId, handleReset]);

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
          : currentEvent.fields[field] || "";
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
      handleReset();
    }
  };

  const handleLoadCustomLog = (content: string) => {
    setRawLogText(content);
    handleReset();
  };

  // Combine full scan alerts and incremental alerts
  const displayAlerts = fullScanAlerts.length > 0 ? fullScanAlerts : incrementalAlerts;

  return (
    <div className="h-screen w-screen flex flex-col bg-board text-paper font-mono overflow-hidden select-none">
      {/* 1. Signal Box Control Desk Header */}
      <header className="h-10 border-b border-track flex items-center px-4 bg-board justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="plaque-title text-lamp-amber font-bold text-base tracking-wider">TRIPWIRE</span>
            <span className="text-[10px] text-paper-dim border border-track px-1.5 py-0.2 bg-board-raised">
              INTERLOCKING BOX v{VERSION}
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] text-paper-dim/80">
            Automata-Driven Intrusion Detection System
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* PDA Toggle */}
          <button
            onClick={() => setShowPDA(!showPDA)}
            className={`px-2 py-0.5 border font-mono text-[11px] transition-colors ${
              showPDA ? "bg-lamp-amber text-board border-lamp-amber font-bold" : "border-track text-paper-dim hover:text-paper"
            }`}
            title="Toggle Pushdown Automaton (Dyck balanced delimiter checker)"
          >
            {showPDA ? "CLOSE PDA" : "PDA STACK"}
          </button>

          {/* Daylight High Contrast Toggle */}
          <button
            onClick={() => setIsDaylight(!isDaylight)}
            className="px-2 py-0.5 border border-track text-paper-dim hover:text-paper transition-colors text-[11px]"
            title="Toggle daylight / dark mode"
          >
            {isDaylight ? "NIGHT ◑" : "DAYLIGHT ◐"}
          </button>

          {/* Shortcut Help Button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-6 h-6 border border-track flex items-center justify-center text-paper-dim hover:text-paper font-bold"
            title="Keyboard shortcuts [?]"
          >
            ?
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar (visible below 768px) */}
      <div className="md:hidden h-8 border-b border-track bg-board-raised flex items-center justify-around text-xs shrink-0">
        {(["rules", "track", "tape", "alerts", "pda"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveMobileTab(t)}
            className={`capitalize px-2 py-1 text-[11px] font-mono ${
              activeMobileTab === t ? "text-lamp-amber font-bold border-b-2 border-lamp-amber" : "text-paper-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 2. Main Control Desk Panels */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2 relative">
        {/* Left Column: Rule Book (24% desktop, or mobile tab) */}
        <div
          className={`w-full md:w-[24%] h-full shrink-0 ${
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
          className={`flex-1 h-full flex flex-col min-w-0 ${
            activeMobileTab === "track" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex-1 min-h-0 relative">
            {showPDA ? (
              <PDAVisualizer />
            ) : (
              <TrackDiagram
                compiledRule={compiledRule}
                activeStateId={activeStateId}
                previousStateId={previousStateId}
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
          className={`w-full md:w-[30%] h-full shrink-0 ${
            activeMobileTab === "tape" ? "block" : "hidden md:block"
          }`}
        >
          <EventTape
            events={events}
            activeLineIndex={activeLineIndex}
            trippedLineNumbers={trippedLineNumbers}
            skippedCount={skippedCount}
            onSelectSample={handleSelectSample}
            onLoadCustomLog={handleLoadCustomLog}
          />
        </div>
      </main>

      {/* 3. Bottom Alert Register Drawer */}
      <div
        className={`shrink-0 ${
          activeMobileTab === "alerts" ? "block fixed inset-x-0 bottom-0 z-40" : "hidden md:block"
        }`}
      >
        <AlertRegister
          alerts={displayAlerts}
          onSelectAlert={handleSelectAlert}
          selectedAlert={selectedAlert}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      <ShortcutModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
