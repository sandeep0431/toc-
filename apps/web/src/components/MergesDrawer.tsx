import React from "react";

interface MergesDrawerProps {
  partitionsHistory: readonly (readonly (readonly number[])[])[];
  onClose: () => void;
}

export const MergesDrawer: React.FC<MergesDrawerProps> = ({
  partitionsHistory,
  onClose,
}) => {
  return (
    <div className="absolute top-11 left-0 bottom-0 w-88 bg-board-raised border-r border-track shadow-2xl z-30 flex flex-col font-sans text-xs select-none">
      <div className="h-11 px-4 border-b border-track flex items-center justify-between bg-board-raised shrink-0">
        <div>
          <span className="font-semibold text-xs tracking-tight text-paper">Hopcroft Merges</span>
          <span className="text-[10px] text-paper-dim font-mono ml-2">({partitionsHistory.length} rounds)</span>
        </div>
        <button
          onClick={onClose}
          className="text-paper-dim hover:text-paper font-semibold px-2 py-0.5 rounded border border-track text-xs"
        >
          ✕
        </button>
      </div>

      <div className="p-3 border-b border-track bg-board text-xs text-paper-dim">
        Iterative equivalence partition refinement from P0 = &#123; F, S \ F &#125; until convergence.
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {partitionsHistory.map((partition, iter) => (
          <div key={`iter-${iter}`} className="p-3 border border-track rounded-lg bg-board">
            <div className="flex items-center justify-between text-xs text-paper mb-2 font-semibold">
              <span>{iter === 0 ? "Initial Partition (P0)" : `Refinement Round #${iter}`}</span>
              <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono">
                {partition.length} Blocks
              </span>
            </div>
            <div className="space-y-1.5 mt-1">
              {partition.map((block, bIdx) => (
                <div
                  key={`block-${bIdx}`}
                  className="bg-board-raised px-2.5 py-1.5 rounded border border-track text-xs text-paper font-mono"
                >
                  <span className="text-paper-dim text-[11px] font-semibold mr-2">B{bIdx}:</span>
                  &#123; {block.map((s) => `q${s}`).join(", ")} &#125;
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
