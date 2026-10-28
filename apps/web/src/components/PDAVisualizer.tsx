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
    <div className="h-full flex flex-col bg-board-raised p-4 font-sans text-xs select-none">
      <div className="flex items-center justify-between border-b border-track pb-3 mb-3">
        <div>
          <div className="font-semibold text-xs tracking-tight text-paper">Pushdown Automaton (PDA) Stack Analyzer</div>
          <div className="text-[11px] text-paper-dim">Non-Regular Balanced Delimiter Checker Γ = &#123; (, [, &#123;, ', ", $ &#125;</div>
        </div>
        <span
          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
            trace.accepted
              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {trace.accepted ? "✓ Stack Balanced (Valid Dyck Language)" : "✕ Delimiter Mismatch"}
        </span>
      </div>

      <div className="mb-3 space-y-1.5">
        <label className="text-[11px] font-medium text-paper-dim">Test Input String:</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => handleTest(e.target.value)}
            className="flex-1 bg-board border border-track rounded-md px-3 py-1.5 text-xs text-paper font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <button
            onClick={() => handleTest("SELECT * FROM (users WHERE a = [1, 2))")}
            className="px-3 py-1.5 bg-board border border-track rounded-md text-xs text-paper-dim hover:text-paper font-medium transition-colors"
            title="Load unbalanced example"
          >
            Load Bad Delimiter
          </button>
        </div>
        {trace.errorMessage && (
          <div className="text-[11px] font-mono text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 mt-1">
            ! {trace.errorMessage}
          </div>
        )}
      </div>

      {/* Stack & Operations */}
      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Physical Stack Column */}
        <div className="w-32 flex flex-col border border-track rounded-lg bg-board p-2.5 items-center">
          <span className="text-[11px] font-semibold text-paper-dim mb-2">Execution Stack</span>
          <div className="flex-1 w-full border border-track rounded bg-board-raised flex flex-col-reverse p-1.5 gap-1.5 overflow-y-auto">
            {trace.finalStack.map((item, idx) => (
              <div
                key={idx}
                className={`h-7 rounded border flex items-center justify-center font-bold font-mono text-xs transition-all ${
                  item === "$"
                    ? "bg-slate-100 border-slate-300 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                    : "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs"
                }`}
              >
                {item === "$" ? "Z0 ($)" : item}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-paper-dim mt-1.5 font-mono">Top (Depth: {trace.finalStack.length})</span>
        </div>

        {/* Trace step list */}
        <div className="flex-1 border border-track rounded-lg bg-board-raised flex flex-col overflow-hidden">
          <div className="h-8 px-3 border-b border-track flex items-center justify-between text-xs text-paper-dim bg-board font-medium">
            <span>Stack Operation Log</span>
            <span className="font-mono text-[11px]">{trace.steps.length} Steps</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-track text-xs font-mono">
            {trace.steps.map((st, idx) => (
              <div key={idx} className="p-2 px-3 flex items-center justify-between hover:bg-board/60">
                <span className="text-paper-dim text-[11px]">#{st.index + 1}</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                    st.action === "push"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      : st.action === "pop"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : st.action === "error"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      : "text-paper-dim/60"
                  }`}
                >
                  {st.action}
                </span>
                <span className="text-paper truncate ml-3 text-right">{st.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
