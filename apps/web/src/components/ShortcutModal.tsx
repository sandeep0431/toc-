import React from "react";

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", action: "STEP: Advance tape and token by one character/event" },
    { key: "R", action: "RUN / PAUSE: Start or pause automated scanning" },
    { key: "Esc", action: "RESET: Return automaton to initial state" },
    { key: "↑ / ↓", action: "RULE SELECT: Navigate between ledger rules" },
    { key: "1 / 2 / 5", action: "SPEED: Set stepping speed multiplier" },
    { key: "?", action: "HELP: Open this keyboard shortcuts plaque" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-board-raised border border-track p-4 panel-interlocking shadow-2xl">
        <div className="flex items-center justify-between border-b border-track pb-2 mb-3">
          <span className="plaque-title text-lamp-amber text-sm font-bold">SIGNAL BOX OPERATOR CONTROLS</span>
          <button
            onClick={onClose}
            className="text-paper-dim hover:text-paper text-xs px-2 py-0.5 border border-track"
          >
            CLOSE [Esc]
          </button>
        </div>

        <div className="divide-y divide-track-dim/50 font-mono text-xs">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2 flex items-center justify-between">
              <span className="bg-board px-2 py-1 border border-track font-bold text-paper text-[11px]">
                {s.key}
              </span>
              <span className="text-paper-dim text-[11px] text-right ml-4">{s.action}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-2 border-t border-track text-[10px] text-paper-dim text-center">
          Tripwire Interlocking Signal Box • Antigravity Course Project
        </div>
      </div>
    </div>
  );
};
