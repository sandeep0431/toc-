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
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-board text-paper font-mono p-6 select-none">
          <div className="max-w-lg w-full bg-board-raised border border-lamp-red p-6 panel-interlocking shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 border-b border-track pb-3">
              <span className="w-5 h-5 border border-lamp-red flex items-center justify-center text-lamp-red font-bold text-xs">
                !
              </span>
              <span className="plaque-title text-lamp-red text-sm font-bold tracking-wider">
                INTERLOCKING BOARD FAULT DETECTED
              </span>
            </div>

            <p className="text-xs text-paper-dim leading-relaxed">
              An input or transition error occurred while rendering the automata state. The board has safely caught the exception to prevent system failure.
            </p>

            <div className="bg-board p-3 border border-track text-[11px] font-mono text-lamp-amber overflow-x-auto">
              {this.state.error?.message || "Unknown rendering fault"}
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-3 py-1.5 border border-track text-paper hover:bg-track text-xs font-mono font-semibold"
              >
                DISMISS & RETRY
              </button>
              <button
                onClick={this.handleReset}
                className="px-3 py-1.5 bg-lamp-red text-white text-xs font-mono font-bold hover:bg-rose-700 transition-colors"
              >
                RESET BOARD TO DEFAULTS
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
