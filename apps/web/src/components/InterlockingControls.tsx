import React from "react";

interface InterlockingControlsProps {
  isRunning: boolean;
  speed: number;
  onStep: () => void;
  onToggleRun: () => void;
  onReset: () => void;
  onChangeSpeed: (newSpeed: number) => void;
}

export const InterlockingControls: React.FC<InterlockingControlsProps> = ({
  isRunning,
  speed,
  onStep,
  onToggleRun,
  onReset,
  onChangeSpeed,
}) => {
  return (
    <div className="h-11 px-3 border-t border-track bg-board flex items-center justify-between select-none">
      {/* Primary Action Levers */}
      <div className="flex items-center space-x-2">
        {/* STEP Lever */}
        <button
          onClick={onStep}
          disabled={isRunning}
          className={`px-3 py-1 font-mono text-xs font-bold border border-track text-paper transition-colors flex items-center space-x-1.5 ${
            isRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-track hover:text-white"
          }`}
          title="Consume one symbol [Space]"
        >
          <span>STEP</span>
          <span className="text-[10px] text-paper-dim">⇥</span>
        </button>

        {/* RUN / PAUSE Lever */}
        <button
          onClick={onToggleRun}
          className={`px-3 py-1 font-mono text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
            isRunning
              ? "bg-lamp-amber text-board border-lamp-amber"
              : "border-track text-paper hover:bg-track"
          }`}
          title="Run / pause automated scanner [R]"
        >
          <span>{isRunning ? "PAUSE" : "RUN"}</span>
          <span className="text-[10px]">{isRunning ? "⏸" : "▶"}</span>
        </button>

        {/* RESET Lever */}
        <button
          onClick={onReset}
          className="px-2.5 py-1 font-mono text-xs border border-track text-paper-dim hover:text-paper hover:bg-track transition-colors"
          title="Reset route to start state [Esc]"
        >
          RESET
        </button>
      </div>

      {/* Speed Dial Notches: 1x, 2x, 5x, 20x */}
      <div className="flex items-center space-x-2 font-mono text-xs">
        <span className="text-[10px] text-paper-dim plaque-title">SPEED DIAL:</span>
        <div className="flex items-center space-x-1 bg-board-raised border border-track p-0.5">
          {[1, 2, 5, 20].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-1.5 py-0.5 text-[10px] transition-colors ${
                speed === s
                  ? "bg-track text-paper font-bold shadow-inner"
                  : "text-paper-dim hover:text-paper"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
