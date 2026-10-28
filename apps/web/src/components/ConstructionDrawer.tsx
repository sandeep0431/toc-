import React from "react";
import { SubsetStep } from "@tripwire/engine";

interface ConstructionDrawerProps {
  steps: readonly SubsetStep[];
  onClose: () => void;
  onSelectStep: (step: SubsetStep) => void;
  selectedStep: SubsetStep | null;
}

export const ConstructionDrawer: React.FC<ConstructionDrawerProps> = ({
  steps,
  onClose,
  onSelectStep,
  selectedStep,
}) => {
  return (
    <div className="absolute top-11 left-0 bottom-0 w-88 bg-board-raised border-r border-track shadow-2xl z-30 flex flex-col font-sans text-xs select-none">
      <div className="h-11 px-4 border-b border-track flex items-center justify-between bg-board-raised shrink-0">
        <div>
          <span className="font-semibold text-xs tracking-tight text-paper">Subset Construction</span>
          <span className="text-[10px] text-paper-dim font-mono ml-2">({steps.length} steps)</span>
        </div>
        <button
          onClick={onClose}
          className="text-paper-dim hover:text-paper font-semibold px-2 py-0.5 rounded border border-track text-xs"
        >
          ✕
        </button>
      </div>

      <div className="p-3 border-b border-track bg-board text-xs text-paper-dim">
        Replay powerset expansion from ε-closure(q0) through new DFA state discovery.
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-track">
        {steps.map((step) => {
          const isSelected = selectedStep?.stepIndex === step.stepIndex;

          return (
            <div
              key={`step-${step.stepIndex}`}
              onClick={() => onSelectStep(step)}
              className={`p-3 cursor-pointer transition-colors ${
                isSelected ? "bg-slate-100/90 dark:bg-zinc-800/90 border-l-[3px] border-l-amber-600" : "hover:bg-board/60"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-paper-dim mb-1">
                <span className="uppercase font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                  {step.type.replace("_", " ")}
                </span>
                <span className="font-mono text-paper-dim">Step #{step.stepIndex + 1}</span>
              </div>
              <div className="text-xs text-paper font-mono leading-tight mt-1">
                {step.description}
              </div>
              {step.nfaStates && step.nfaStates.length > 0 && (
                <div className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  NFA States: &#123; {step.nfaStates.map((s) => `q${s}`).join(", ")} &#125;
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
