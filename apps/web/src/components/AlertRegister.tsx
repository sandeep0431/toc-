import React, { useState } from "react";
import { Alert, RuleSeverity } from "@tripwire/engine";

interface AlertRegisterProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  selectedAlert: Alert | null;
}

export const AlertRegister: React.FC<AlertRegisterProps> = ({
  alerts,
  onSelectAlert,
  selectedAlert,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === "ALL") return true;
    return a.severity.toUpperCase() === filterSeverity;
  });

  return (
    <div
      className={`border-t border-track bg-board-raised flex flex-col select-none transition-all duration-200 z-10 ${
        isExpanded ? "h-64" : "h-36"
      }`}
    >
      {/* Header bar */}
      <div className="h-8 px-3 border-b border-track flex items-center justify-between bg-board text-xs">
        <div className="flex items-center space-x-3">
          <span className="plaque-title text-paper font-semibold tracking-wider">ALERT REGISTER</span>
          <span className="font-mono text-[10px] text-paper-dim">[{alerts.length} TRIPPED]</span>

          {/* Severity filter toggle plates */}
          <div className="flex items-center space-x-1 ml-4">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                  filterSeverity === sev
                    ? "bg-track text-paper border-track-dim font-bold shadow-inner"
                    : "text-paper-dim border-transparent hover:text-paper hover:bg-board-raised"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] font-mono text-paper-dim hover:text-paper px-2 py-0.5 border border-track"
          title="Toggle drawer height"
        >
          {isExpanded ? "COLLAPSE ▼" : "EXPAND ▲"}
        </button>
      </div>

      {/* Ledger list */}
      <div className="flex-1 overflow-y-auto divide-y divide-track-dim/40 font-mono text-xs">
        {filteredAlerts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-paper-dim text-xs">
            Clear. No rule tripped across all evaluated lines.
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const isSelected = selectedAlert === alert;
            const sevBadge = alert.severity === "high" ? "H" : alert.severity === "medium" ? "M" : "L";
            const sevColor =
              alert.severity === "high"
                ? "border-lamp-red text-lamp-red"
                : alert.severity === "medium"
                ? "border-lamp-amber text-lamp-amber"
                : "border-lamp-green text-lamp-green";

            return (
              <div
                key={`alert-${idx}`}
                onClick={() => onSelectAlert(alert)}
                className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected ? "bg-board border-l-2 border-l-lamp-red" : "hover:bg-board/60"
                }`}
                title="Click to rewind tape and replay state path"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  {/* Square Stamp */}
                  <span
                    className={`w-4 h-4 border flex items-center justify-center text-[9px] font-bold shrink-0 ${sevColor}`}
                  >
                    {sevBadge}
                  </span>

                  <span className="font-bold text-paper text-xs shrink-0">{alert.ruleId}</span>
                  <span className="text-[11px] text-paper-dim font-serif truncate max-w-[200px]">
                    {alert.ruleName}
                  </span>
                  <span className="text-[10px] text-paper-dim shrink-0">
                    SRC: {alert.source} | LINE {alert.lineNumbers.join(",")}
                  </span>
                </div>

                {/* State Path Strip */}
                <div className="flex items-center space-x-3 shrink-0 ml-2">
                  <div className="bg-board px-2 py-0.5 border border-track text-[10px] text-lamp-amber">
                    {alert.statePath.map((s) => `q${s}`).join(" → ")}
                  </div>
                  <span className="text-[9px] text-paper-dim">
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
