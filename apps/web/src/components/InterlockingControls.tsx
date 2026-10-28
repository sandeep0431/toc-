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
    <div className="h-12 px-3 border-t border-track bg-board-raised flex items-center justify-between select-none">
      {/* Primary Action Controls */}
      <div className="flex items-center space-x-2">
        {/* STEP Button */}
        <button
          onClick={onStep}
          disabled={isRunning}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border border-track text-paper transition-all flex items-center space-x-2 shadow-2xs ${
            isRunning
              ? "opacity-40 cursor-not-allowed bg-board"
              : "hover:bg-board active:scale-95"
          }`}
          title="Consume one symbol [Space]"
        >
          <span>Step</span>
          <kbd className="text-[10px] text-paper-dim font-mono bg-board px-1 py-0.2 rounded border border-track">Space</kbd>
        </button>

        {/* RUN / PAUSE Button */}
        <button
          onClick={onToggleRun}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-xs active:scale-95 ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
          }`}
          title="Run / pause automated scanner [R]"
        >
          <span>{isRunning ? "Pause" : "Run Live"}</span>
          <span className="text-[11px]">{isRunning ? "⏸" : "▶"}</span>
        </button>

        {/* RESET Button */}
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-track text-paper-dim hover:text-paper hover:bg-board transition-all active:scale-95"
          title="Reset route to start state [Esc]"
        >
          Reset
        </button>
      </div>

      {/* Speed Dial Segmented Control */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-[11px] text-paper-dim font-medium">Speed:</span>
        <div className="flex items-center space-x-1 bg-board border border-track p-1 rounded-md">
          {[1, 2, 5, 20].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-0.5 text-xs font-mono font-medium rounded transition-all ${
                speed === s
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs"
                  : "text-paper-dim hover:text-paper hover:bg-slate-200/50 dark:hover:bg-zinc-800"
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
