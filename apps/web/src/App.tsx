import React from "react";
import { VERSION } from "@tripwire/engine";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-board text-paper font-mono select-none">
      <header className="h-10 border-b border-track flex items-center px-4 bg-board-raised justify-between">
        <div className="flex items-center space-x-4">
          <span className="plaque-title text-lamp-amber font-bold text-lg tracking-wider">TRIPWIRE</span>
          <span className="text-xs text-paper-dim">SIGNAL BOX v{VERSION}</span>
        </div>
        <div className="text-xs text-paper-dim flex items-center space-x-3">
          <span>INTERLOCKING ACTIVE</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        <div className="w-1/4 panel-interlocking p-3 flex flex-col">
          <div className="plaque-title text-sm border-b border-track pb-1 mb-2 text-paper">RULE BOOK</div>
          <p className="text-xs text-paper-dim">No rules on the board. Add one to see its machine.</p>
        </div>
        <div className="flex-1 panel-interlocking p-3 flex flex-col">
          <div className="plaque-title text-sm border-b border-track pb-1 mb-2 text-paper">TRACK DIAGRAM</div>
          <div className="flex-1 flex items-center justify-center text-xs text-paper-dim">
            Signal lamps awaiting route setup.
          </div>
        </div>
        <div className="w-1/3 panel-interlocking p-3 flex flex-col bg-tape text-ink-on-paper">
          <div className="plaque-title text-sm border-b border-stone-400 pb-1 mb-2 font-bold">EVENT TAPE</div>
          <p className="text-xs text-stone-600">The tape is empty. Feed it a log or pick a sample.</p>
        </div>
      </main>

      <footer className="h-20 border-t border-track bg-board-raised px-4 py-2 flex flex-col justify-center">
        <div className="plaque-title text-xs text-paper-dim">ALERT REGISTER</div>
        <div className="text-xs text-paper-dim">Clear. No rule tripped.</div>
      </footer>
    </div>
  );
}
