import React, { useState } from "react";
import { simulatePDA, PDATrace } from "@tripwire/engine";

export const PDAVisualizer: React.FC = () => {
  const [queryInput, setQueryInput] = useState<string>("SELECT * FROM (users WHERE id = [1, 2])");
  const [trace, setTrace] = useState<PDATrace>(() => simulatePDA("SELECT * FROM (users WHERE id = [1, 2])"));

  const handleTest = (val: string) => {
    setQueryInput(val);
    setTrace(simulatePDA(val));
  };

  return (
    <div className="h-full flex flex-col bg-board border border-track p-3 font-mono text-xs select-none panel-interlocking">
      <div className="flex items-center justify-between border-b border-track pb-2 mb-2">
        <div>
          <span className="plaque-title text-lamp-amber text-xs font-bold">PUSHDOWN AUTOMATON (PDA)</span>
          <div className="text-[10px] text-paper-dim">Balanced Delimiter Stack Checker Γ = &#123; (, [, &#123;, ', ", $ &#125;</div>
        </div>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold border ${
            trace.accepted
              ? "bg-lamp-green/20 text-lamp-green border-lamp-green"
              : "bg-lamp-red/20 text-lamp-red border-lamp-red"
          }`}
        >
          {trace.accepted ? "STACK BALANCED" : "DELIMITER MISMATCH"}
        </span>
      </div>

      <div className="mb-2 space-y-1">
        <label className="text-[10px] text-paper-dim">INPUT TEST STRING:</label>
        <div className="flex space-x-1">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => handleTest(e.target.value)}
            className="flex-1 bg-board-raised border border-track px-2 py-1 text-xs text-paper font-mono focus:outline-none focus:border-lamp-amber"
          />
          <button
            onClick={() => handleTest("SELECT * FROM (users WHERE a = [1, 2))")}
            className="px-2 py-1 bg-board-raised border border-track text-[10px] text-paper-dim hover:text-paper"
            title="Load unbalanced example"
          >
            Load Bad
          </button>
        </div>
        {trace.errorMessage && (
          <div className="text-[10px] text-lamp-red font-mono mt-1">
            ! {trace.errorMessage}
          </div>
        )}
      </div>

      {/* Vertical Rail of Stack Slots */}
      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Physical Stack Column */}
        <div className="w-28 flex flex-col border border-track bg-board-raised p-2 items-center">
          <span className="text-[10px] plaque-title text-paper-dim mb-1">PDA STACK</span>
          <div className="flex-1 w-full border border-track-dim bg-board flex flex-col-reverse p-1 gap-1 overflow-y-auto">
            {trace.finalStack.map((item, idx) => (
              <div
                key={idx}
                className={`h-6 border flex items-center justify-center font-bold text-xs transition-all ${
                  item === "$"
                    ? "bg-track-dim/50 border-track text-paper-dim"
                    : "bg-lamp-amber/20 border-lamp-amber text-lamp-amber shadow-sm"
                }`}
              >
                {item === "$" ? "Z0 ($)" : item}
              </div>
            ))}
          </div>
          <span className="text-[9px] text-paper-dim mt-1 font-mono">TOP (DEPTH: {trace.finalStack.length})</span>
        </div>

        {/* Trace step list */}
        <div className="flex-1 border border-track bg-board-raised flex flex-col overflow-hidden">
          <div className="h-6 px-2 border-b border-track flex items-center justify-between text-[10px] text-paper-dim bg-board">
            <span>STACK OPERATION LOG</span>
            <span>{trace.steps.length} SYMBOLS</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-track-dim/40 text-[10px]">
            {trace.steps.map((st, idx) => (
              <div key={idx} className="p-1 px-2 flex items-center justify-between">
                <span className="font-mono text-paper-dim">#{st.index + 1}</span>
                <span
                  className={`px-1 py-0.2 font-bold uppercase ${
                    st.action === "push"
                      ? "text-lamp-amber"
                      : st.action === "pop"
                      ? "text-lamp-green"
                      : st.action === "error"
                      ? "text-lamp-red"
                      : "text-paper-dim/60"
                  }`}
                >
                  {st.action}
                </span>
                <span className="text-paper truncate ml-2 text-right">{st.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
