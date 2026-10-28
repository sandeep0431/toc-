import React, { useState } from "react";
import { Alert, RuleSeverity } from "@tripwire/engine";

interface AlertRegisterProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  selectedAlert: Alert | null;
  trippedLineNumbers?: Set<number>;
  activeLineIndex?: number;
  totalEventsCount?: number;
}

export const AlertRegister: React.FC<AlertRegisterProps> = ({
  alerts,
  onSelectAlert,
  selectedAlert,
  trippedLineNumbers,
  activeLineIndex = 0,
  totalEventsCount = 0,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"ALL" | "STEPPED">("ALL");

  const liveTrippedCount = alerts.filter((a) =>
    a.lineNumbers.some((ln) => trippedLineNumbers?.has(ln))
  ).length;

  const baseList =
    viewMode === "STEPPED"
      ? alerts.filter((a) =>
          a.lineNumbers.some((ln) => trippedLineNumbers?.has(ln))
        )
      : alerts;

  const filteredAlerts = baseList.filter((a) => {
    if (filterSeverity === "ALL") return true;
    return a.severity.toUpperCase() === filterSeverity;
  });

  return (
    <div
      className={`border-t border-track bg-board-raised flex flex-col select-none transition-all duration-200 z-30 shadow-lg ${
        isExpanded ? "h-72" : "h-36"
      }`}
    >
      {/* Header bar */}
      <div className="h-10 px-4 border-b border-track flex items-center justify-between bg-board-raised text-xs shrink-0">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-xs tracking-tight text-paper">Alert Register</span>
          <span className="font-mono text-[10px] text-paper-dim bg-board px-2 py-0.5 rounded border border-track">
            {alerts.length} Detected {totalEventsCount > 0 ? `• ${liveTrippedCount} Tripped` : ""}
          </span>

          {/* View mode toggle: ALL vs STEPPED ONLY */}
          <div className="flex items-center space-x-1 border border-track p-0.5 rounded-md bg-board">
            <button
              onClick={() => setViewMode("ALL")}
              className={`text-[10px] font-medium px-2 py-0.5 rounded transition-all ${
                viewMode === "ALL"
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                  : "text-paper-dim hover:text-paper"
              }`}
              title="Show all detected alerts for current tape"
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setViewMode("STEPPED")}
              className={`text-[10px] font-medium px-2 py-0.5 rounded transition-all ${
                viewMode === "STEPPED"
                  ? "bg-rose-600 text-white font-semibold shadow-xs"
                  : "text-paper-dim hover:text-paper"
              }`}
              title="Show only alerts tripped up to current reading line"
            >
              Live Tripped ({liveTrippedCount})
            </button>
          </div>

          {/* Severity filter toggle plates */}
          <div className="hidden sm:flex items-center space-x-1 ml-2">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  filterSeverity === sev
                    ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                    : "text-paper-dim hover:text-paper hover:bg-board"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-medium text-paper-dim hover:text-paper px-2.5 py-1 rounded-md border border-track hover:bg-board transition-colors flex items-center space-x-1"
          title="Toggle drawer height"
        >
          <span>{isExpanded ? "Collapse" : "Expand"}</span>
          <span>{isExpanded ? "▼" : "▲"}</span>
        </button>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto divide-y divide-track font-mono text-xs">
        {filteredAlerts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-paper-dim text-xs font-sans">
            No active alerts matching current filter.
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const isSelected = selectedAlert === alert;
            const sevBadge = alert.severity === "high" ? "High" : alert.severity === "medium" ? "Med" : "Low";
            const sevStyle =
              alert.severity === "high"
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
                : alert.severity === "medium"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900";

            return (
              <div
                key={`alert-${idx}`}
                onClick={() => onSelectAlert(alert)}
                className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-board border-l-[3px] border-l-rose-600"
                    : "hover:bg-board/60"
                }`}
                title="Click to replay state path on track diagram"
              >
                <div className="flex items-center space-x-3 min-w-0 font-sans">
                  {/* Severity Badge */}
                  <span
                    className={`px-1.5 py-0.5 border text-[10px] font-semibold rounded shrink-0 ${sevStyle}`}
                  >
                    {sevBadge}
                  </span>

                  <span className="font-mono font-bold text-paper text-xs shrink-0">{alert.ruleId}</span>
                  <span className="text-xs text-paper font-medium truncate max-w-[220px]">
                    {alert.ruleName}
                  </span>
                  <span className="text-[11px] text-paper-dim font-mono shrink-0">
                    SRC: {alert.source} • Line {alert.lineNumbers.join(",")}
                  </span>
                  {alert.lineNumbers.some((ln) => trippedLineNumbers?.has(ln)) && (
                    <span className="px-2 py-0.5 rounded-full border border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[9px] font-bold tracking-wider">
                      TRIPPED
                    </span>
                  )}
                </div>

                {/* State Path Strip */}
                <div className="flex items-center space-x-3 shrink-0 ml-2 font-mono">
                  <div className="bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                    {alert.statePath.map((s) => `q${s}`).join(" → ")}
                  </div>
                  <span className="text-[11px] text-paper-dim font-medium">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
