import React, { useState } from "react";
import { Event } from "@tripwire/engine";
import { SAMPLE_LOGS } from "../data/samples";

interface EventTapeProps {
  events: Event[];
  activeLineIndex: number;
  trippedLineNumbers: Set<number>;
  skippedCount: number;
  activeSampleKey: string;
  onSelectSample: (sampleKey: string) => void;
  onLoadCustomLog: (content: string) => void;
}

export const EventTape: React.FC<EventTapeProps> = ({
  events,
  activeLineIndex,
  trippedLineNumbers,
  skippedCount,
  activeSampleKey,
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
    <div className="h-full flex flex-col bg-board-raised text-paper select-none relative overflow-hidden">
      {/* Tape Header */}
      <div className="h-11 px-3 border-b border-track flex items-center justify-between bg-board-raised shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xs tracking-tight text-paper">Event Stream</span>
          <span className="text-[10px] font-mono text-paper-dim bg-board px-1.5 py-0.2 rounded border border-track">
            {events.length} lines
          </span>
        </div>
        <button
          onClick={() => setIsFeedingTape(!isFeedingTape)}
          className="text-xs px-2.5 py-1 rounded-md border border-track text-paper hover:bg-board font-medium transition-colors"
          title="Paste or drop log files"
        >
          {isFeedingTape ? "Close" : "+ Feed Log"}
        </button>
      </div>

      {/* Sample Selector Bar */}
      <div className="px-3 py-2 border-b border-track bg-board/60 flex items-center justify-between text-xs shrink-0">
        <span className="text-paper-dim text-[11px] font-medium">Dataset:</span>
        <select
          value={activeSampleKey}
          onChange={(e) => onSelectSample(e.target.value)}
          className="bg-board-raised border border-track rounded px-2 py-1 text-paper text-xs max-w-[200px] truncate focus:outline-none focus:border-amber-500 font-medium"
        >
          <option value="auth">SSH Auth Log (Brute Force)</option>
          <option value="access">Nginx Access Log (Web Attacks)</option>
          <option value="benign">Benign Traffic (Clean)</option>
          {activeSampleKey === "custom" && <option value="custom">Custom Tape Feed</option>}
        </select>
        {skippedCount > 0 && (
          <span className="text-[10px] text-paper-dim" title={`${skippedCount} unrecognized lines skipped`}>
            ({skippedCount} skipped)
          </span>
        )}
      </div>

      {/* Feed Tape Drawer (Paste / Drop Box) */}
      {isFeedingTape && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="p-3 border-b border-dashed border-track bg-board text-xs space-y-2 shrink-0"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-paper">Feed Custom Log Data</span>
            <div className="flex space-x-1.5">
              <button
                type="button"
                onClick={() =>
                  setPastedLog(
                    "GET /search?id=1 UNION SELECT password FROM users HTTP/1.1\nGET /login?user=admin' OR '1'='1 HTTP/1.1\nGET /index.php?q=<script>alert(1)</script> HTTP/1.1\nGET /static/../../etc/passwd HTTP/1.1"
                  )
                }
                className="text-[10px] px-2 py-0.5 rounded border border-track bg-board-raised text-paper-dim hover:text-paper font-mono transition-colors"
                title="Fill with SQLi/XSS/Traversal test payload lines"
              >
                + Web Attack
              </button>
              <button
                type="button"
                onClick={() =>
                  setPastedLog(
                    "Oct 20 10:14:20 server sshd[100]: Failed password for root from 192.168.1.99 port 22\nOct 20 10:14:21 server sshd[100]: Failed password for root from 192.168.1.99 port 22\nOct 20 10:14:22 server sshd[100]: Failed password for root from 192.168.1.99 port 22\nOct 20 10:14:23 server sshd[100]: Accepted password for root from 192.168.1.99 port 22"
                  )
                }
                className="text-[10px] px-2 py-0.5 rounded border border-track bg-board-raised text-paper-dim hover:text-paper font-mono transition-colors"
                title="Fill with SSH Brute Force test lines"
              >
                + SSH Brute
              </button>
            </div>
          </div>
          <textarea
            placeholder="Paste raw log lines, SQLi/XSS queries, or symbol sequences (e.g. FFFS), or drag & drop a file..."
            value={pastedLog}
            onChange={(e) => setPastedLog(e.target.value)}
            className="w-full h-24 p-2 font-mono text-[11px] bg-board-raised border border-track rounded resize-none text-paper focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handlePasteSubmit}
            className="w-full py-1.5 bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded shadow-xs transition-colors"
          >
            Load into Stream
          </button>
        </div>
      )}

      {/* Stream Lines */}
      <div className="flex-1 overflow-y-auto divide-y divide-track font-mono text-xs">
        {events.length === 0 ? (
          <div className="p-6 text-center text-paper-dim leading-relaxed">
            The event stream is empty. Select a sample or paste custom logs.
          </div>
        ) : (
          events.map((ev, idx) => {
            const isReadingHead = idx === activeLineIndex;
            const isTripped = trippedLineNumbers.has(ev.lineNumber);

            return (
              <div
                key={`line-${ev.lineNumber}`}
                className={`flex items-center px-3 py-1.5 relative transition-colors ${
                  isReadingHead
                    ? "bg-amber-100/70 dark:bg-amber-950/40 border-l-[3px] border-l-amber-600 font-semibold"
                    : "hover:bg-board/60"
                }`}
              >
                {/* Margin: Line number */}
                <div className="w-8 text-[11px] text-paper-dim font-mono font-bold shrink-0 text-right pr-2 select-none">
                  {ev.lineNumber}
                </div>

                {/* Symbol Gutter Badge */}
                <div
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded border font-mono shrink-0 mr-2.5 ${
                    ev.symbol === "F"
                      ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      : ev.symbol === "S"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : ev.symbol === "P"
                      ? "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                      : "bg-board border-track text-paper"
                  }`}
                  title={`Derived symbol: ${ev.symbol}`}
                >
                  {ev.symbol}
                </div>

                {/* Raw Event Text - HIGH CONTRAST */}
                <div className="flex-1 min-w-0 font-mono text-[11px] font-semibold text-paper truncate">
                  {ev.raw}
                </div>

                {/* Clean TRIPPED Pill */}
                {isTripped && (
                  <div
                    className="ml-2 shrink-0 px-2 py-0.5 rounded-full border border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 text-[10px] font-bold tracking-wider shadow-2xs"
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
      <div className="h-7 px-3 border-t border-track bg-board flex items-center justify-between text-[11px] text-paper-dim font-mono shrink-0">
        <span className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active Stream</span>
        </span>
        <span>Line {Math.min(activeLineIndex + 1, events.length)} of {events.length}</span>
      </div>
    </div>
  );
};
