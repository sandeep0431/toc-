import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Tripwire UI ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-board text-paper font-sans p-6 select-none">
          <div className="max-w-lg w-full bg-board-raised border border-rose-300 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5 border-b border-track pb-3">
              <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                !
              </span>
              <span className="font-semibold text-rose-700 text-sm tracking-tight">
                Automata Rendering Exception
              </span>
            </div>

            <p className="text-xs text-paper-dim leading-relaxed">
              An input or transition fault occurred while rendering the automaton state. The system safely caught the exception.
            </p>

            <div className="bg-board p-3 rounded-md border border-track text-xs font-mono text-rose-700 overflow-x-auto">
              {this.state.error?.message || "Unknown rendering fault"}
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-3 py-1.5 rounded-md border border-track text-paper hover:bg-board text-xs font-medium transition-colors"
              >
                Dismiss & Retry
              </button>
              <button
                onClick={this.handleReset}
                className="px-3.5 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
