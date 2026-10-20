import React, { useState } from "react";
import { Event } from "@tripwire/engine";
import { SAMPLE_LOGS } from "../data/samples";

interface EventTapeProps {
  events: Event[];
  activeLineIndex: number;
  trippedLineNumbers: Set<number>;
  skippedCount: number;
  onSelectSample: (sampleKey: string) => void;
  onLoadCustomLog: (content: string) => void;
}

export const EventTape: React.FC<EventTapeProps> = ({
  events,
  activeLineIndex,
  trippedLineNumbers,
  skippedCount,
  onSelectSample,
  onLoadCustomLog,
}) => {
  const [isFeedingTape, setIsFeedingTape] = useState<boolean>(false);
  const [pastedLog, setPastedLog] = useState<string>("");

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          onLoadCustomLog(text);
          setIsFeedingTape(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePasteSubmit = () => {
    if (pastedLog.trim().length > 0) {
      onLoadCustomLog(pastedLog);
      setPastedLog("");
      setIsFeedingTape(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-tape text-ink-on-paper border border-stone-400 select-none relative overflow-hidden shadow-sm">
      {/* Tape Perforated Border Styling */}
      <div className="h-9 px-3 border-b border-stone-300 flex items-center justify-between bg-tape">
        <div className="flex items-center space-x-2">
          <span className="plaque-title text-ink-on-paper text-xs font-bold tracking-wider">EVENT TAPE</span>
          <span className="text-[10px] font-mono text-stone-600">[{events.length} lines]</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsFeedingTape(!isFeedingTape)}
            className="text-[10px] px-2 py-0.5 border border-stone-400 hover:bg-stone-200 transition-colors font-mono font-semibold"
            title="Paste or drop log files"
          >
            {isFeedingTape ? "CLOSE" : "FEED TAPE"}
          </button>
        </div>
      </div>

      {/* Sample Selector Bar */}
      <div className="px-2 py-1.5 border-b border-stone-300 bg-stone-100 flex items-center justify-between text-[11px] font-mono">
        <span className="text-stone-500 text-[10px]">SAMPLE:</span>
        <select
          onChange={(e) => onSelectSample(e.target.value)}
          className="bg-white border border-stone-300 px-1 py-0.5 text-ink-on-paper text-xs max-w-[180px] truncate"
        >
          <option value="auth">SSH Auth Log (Brute Force)</option>
          <option value="access">Nginx Access Log (Web Attacks)</option>
          <option value="benign">Benign Traffic (Clean)</option>
        </select>
        {skippedCount > 0 && (
          <span className="text-[9px] text-stone-500" title={`${skippedCount} unrecognized lines skipped`}>
            ({skippedCount} skipped)
          </span>
        )}
      </div>

      {/* Feed Tape Drawer (Paste / Drop Box) */}
      {isFeedingTape && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="p-3 border-b-2 border-dashed border-stone-400 bg-stone-50 text-xs space-y-2"
        >
          <div className="text-[10px] font-mono font-bold text-stone-700">FEED THE TAPE</div>
          <textarea
            placeholder="Paste raw auth.log or access.log content here, or drag & drop a file..."
            value={pastedLog}
            onChange={(e) => setPastedLog(e.target.value)}
            className="w-full h-24 p-1.5 font-mono text-[11px] bg-white border border-stone-300 resize-none text-ink-on-paper focus:outline-none"
          />
          <button
            onClick={handlePasteSubmit}
            className="w-full py-1 bg-stone-800 text-stone-100 hover:bg-stone-900 font-mono text-xs font-bold"
          >
            PUNCH ONTO TAPE
          </button>
        </div>
      )}

      {/* Paper Strip Lines */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-300/60 font-mono text-xs">
        {events.length === 0 ? (
          <div className="p-6 text-center text-stone-500 leading-relaxed">
            The tape is empty. Feed it a log or pick a sample.
          </div>
        ) : (
          events.map((ev, idx) => {
            const isReadingHead = idx === activeLineIndex;
            const isTripped = trippedLineNumbers.has(ev.lineNumber);

            return (
              <div
                key={`line-${ev.lineNumber}`}
                className={`flex items-center px-2 py-1.5 relative transition-colors ${
                  isReadingHead
                    ? "bg-amber-100/80 border-l-4 border-l-lamp-red shadow-sm"
                    : "hover:bg-stone-100/60"
                }`}
              >
                {/* Optical reading head cursor marker */}
                {isReadingHead && (
                  <div
                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-lamp-red rotate-45 pointer-events-none"
                    title="Optical printing head marker"
                  />
                )}

                {/* Margin: Line number */}
                <div className="w-8 text-[10px] text-stone-400 font-mono shrink-0 text-right pr-2 select-none">
                  {ev.lineNumber}
                </div>

                {/* Symbol Gutter Badge */}
                <div
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold border font-mono shrink-0 mr-2 ${
                    ev.symbol === "F"
                      ? "bg-amber-200/50 border-amber-500 text-amber-900"
                      : ev.symbol === "S"
                      ? "bg-emerald-200/50 border-emerald-500 text-emerald-900"
                      : ev.symbol === "P"
                      ? "bg-rose-200/50 border-rose-500 text-rose-900"
                      : "bg-stone-200/50 border-stone-400 text-stone-700"
                  }`}
                  title={`Derived symbol: ${ev.symbol}`}
                >
                  {ev.symbol}
                </div>

                {/* Raw Event Text */}
                <div className="flex-1 min-w-0 font-mono text-[11px] text-ink-on-paper truncate">
                  {ev.raw}
                </div>

                {/* Vermilion TRIPPED Slam Stamp */}
                {isTripped && (
                  <div
                    className="ml-2 shrink-0 px-1.5 py-0.5 border-2 border-lamp-red text-lamp-red text-[9px] font-extrabold tracking-wider rotate-[-3deg] shadow-sm animate-pulse"
                    title="Intrusion alert tripped on this event"
                  >
                    TRIPPED
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="h-6 px-3 border-t border-stone-300 bg-stone-100 flex items-center justify-between text-[10px] text-stone-500 font-mono">
        <span>INTERLOCKING FEED ACTIVE</span>
        <span>LINE {activeLineIndex + 1} OF {events.length}</span>
      </div>
    </div>
  );
};
