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
    <div className="absolute top-10 left-0 bottom-0 w-80 bg-board border-r border-track shadow-2xl z-30 flex flex-col font-mono text-xs select-none">
      <div className="h-9 px-3 border-b border-track flex items-center justify-between bg-board-raised">
        <span className="plaque-title text-lamp-green text-xs font-bold">HOPCROFT MERGES</span>
        <button
          onClick={onClose}
          className="text-paper-dim hover:text-paper font-bold px-1.5 py-0.5 border border-track text-[10px]"
        >
          ✕
        </button>
      </div>

      <div className="p-2 border-b border-track bg-board text-[11px] text-paper-dim">
        Iterative equivalence partition refinement from P0 = &#123; F, S \ F &#125; until convergence.
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-track-dim/50 p-2 space-y-3">
        {partitionsHistory.map((partition, iter) => (
          <div key={`iter-${iter}`} className="p-2 border border-track bg-board-raised">
            <div className="flex items-center justify-between text-[10px] text-paper-dim mb-1 font-bold">
              <span>{iter === 0 ? "INITIAL PARTITION (P0)" : `REFINEMENT ROUND #${iter}`}</span>
              <span className="text-lamp-green">{partition.length} BLOCKS</span>
            </div>
            <div className="space-y-1 mt-1">
              {partition.map((block, bIdx) => (
                <div
                  key={`block-${bIdx}`}
                  className="bg-board px-2 py-1 border border-track-dim text-[11px] text-paper font-mono"
                >
                  <span className="text-paper-dim text-[10px] mr-2">B{bIdx}:</span>
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
