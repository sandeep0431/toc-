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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-board-raised border border-track rounded-xl p-5 shadow-2xl font-sans">
        <div className="flex items-center justify-between border-b border-track pb-3 mb-3">
          <span className="font-semibold text-sm tracking-tight text-paper">Keyboard Shortcuts</span>
          <button
            onClick={onClose}
            className="text-paper-dim hover:text-paper text-xs px-2 py-1 rounded-md border border-track hover:bg-board font-medium transition-colors"
          >
            Esc
          </button>
        </div>

        <div className="divide-y divide-track text-xs">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between">
              <kbd className="bg-board px-2 py-1 rounded border border-track font-mono font-semibold text-paper text-[11px] shadow-2xs">
                {s.key}
              </kbd>
              <span className="text-paper-dim text-xs text-right ml-4">{s.action}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-track text-[11px] text-paper-dim text-center">
          Tripwire IDS • Formal Theory of Computation Project
        </div>
      </div>
    </div>
  );
};
