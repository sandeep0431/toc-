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
    <div className="absolute top-10 left-0 bottom-0 w-80 bg-board border-r border-track shadow-2xl z-30 flex flex-col font-mono text-xs select-none">
      <div className="h-9 px-3 border-b border-track flex items-center justify-between bg-board-raised">
        <span className="plaque-title text-lamp-amber text-xs font-bold">SUBSET CONSTRUCTION</span>
        <button
          onClick={onClose}
          className="text-paper-dim hover:text-paper font-bold px-1.5 py-0.5 border border-track text-[10px]"
        >
          ✕
        </button>
      </div>

      <div className="p-2 border-b border-track bg-board text-[11px] text-paper-dim">
        Replay powerset expansion from ε-closure(q0) through new DFA state discovery.
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-track-dim/50">
        {steps.map((step) => {
          const isSelected = selectedStep?.stepIndex === step.stepIndex;

          return (
            <div
              key={`step-${step.stepIndex}`}
              onClick={() => onSelectStep(step)}
              className={`p-2.5 cursor-pointer transition-colors ${
                isSelected ? "bg-board-raised border-l-2 border-l-lamp-amber" : "hover:bg-board-raised/50"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-paper-dim mb-1">
                <span className="uppercase font-bold text-lamp-amber">
                  [{step.type.replace("_", " ")}]
                </span>
                <span>STEP #{step.stepIndex + 1}</span>
              </div>
              <div className="text-[11px] text-paper font-mono leading-tight">
                {step.description}
              </div>
              {step.nfaStates && step.nfaStates.length > 0 && (
                <div className="mt-1 text-[10px] text-lamp-green font-mono">
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
