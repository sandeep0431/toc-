import React, { useState } from "react";
import { Rule, parseRegex, RegexSyntaxError } from "@tripwire/engine";

interface RuleBookProps {
  rules: Rule[];
  selectedRuleId: string;
  onSelectRule: (rule: Rule) => void;
  onUpdateRule: (updatedRule: Rule) => void;
  onAddRule: (newRule: Rule) => void;
}

export const RuleBook: React.FC<RuleBookProps> = ({
  rules,
  selectedRuleId,
  onSelectRule,
  onUpdateRule,
  onAddRule,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [patternError, setPatternError] = useState<{ message: string; index: number } | null>(null);
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);

  // New rule draft state
  const [newRuleId, setNewRuleId] = useState<string>("CUSTOM-01");
  const [newRuleName, setNewRuleName] = useState<string>("Custom rule");
  const [newRulePattern, setNewRulePattern] = useState<string>("admin");
  const [newRuleKind, setNewRuleKind] = useState<"payload" | "sequence">("payload");
  const [newRuleSev, setNewRuleSev] = useState<"low" | "medium" | "high">("high");

  const selectedRule = rules.find((r) => r.id === selectedRuleId) || rules[0];

  React.useEffect(() => {
    setEditingPattern(null);
    setPatternError(null);
  }, [selectedRuleId]);

  const handlePatternChange = (newVal: string) => {
    setEditingPattern(newVal);

    if (newVal.trim().length === 0) {
      setPatternError({ message: "Pattern cannot be empty", index: 0 });
      return;
    }

    try {
      parseRegex(newVal, { caseInsensitive: selectedRule?.caseInsensitive });
      setPatternError(null);
      if (selectedRule) {
        onUpdateRule({
          ...selectedRule,
          pattern: newVal,
        });
      }
    } catch (err: any) {
      if (err instanceof RegexSyntaxError) {
        setPatternError({ message: err.message, index: err.index });
      } else {
        setPatternError({ message: err.message || "Parse error", index: 0 });
      }
    }
  };

  const handleAddNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      parseRegex(newRulePattern);
    } catch (err: any) {
      alert(`Invalid pattern: ${err.message}`);
      return;
    }
    const created: Rule = {
      id: newRuleId.trim().toUpperCase(),
      name: newRuleName.trim(),
      kind: newRuleKind,
      pattern: newRulePattern,
      field: newRuleKind === "payload" ? "query" : undefined,
      groupBy: newRuleKind === "sequence" ? "source" : undefined,
      windowSeconds: newRuleKind === "sequence" ? 120 : undefined,
      severity: newRuleSev,
      explain: "User defined security predicate",
    };
    onAddRule(created);
    setIsAddingRule(false);
  };

  const filteredRules = rules.filter((r) => {
    if (filterSeverity === "ALL") return true;
    return r.severity.toUpperCase() === filterSeverity;
  });

  return (
    <div className="h-full flex flex-col bg-board-raised border border-track select-none panel-interlocking">
      {/* Panel Header */}
      <div className="h-9 px-3 border-b border-track flex items-center justify-between bg-board">
        <div className="flex items-center space-x-2">
          <span className="plaque-title text-paper text-xs font-semibold tracking-wider">RULE BOOK</span>
          <span className="text-[10px] text-paper-dim font-mono">[{rules.length}]</span>
        </div>
        <button
          onClick={() => setIsAddingRule(!isAddingRule)}
          className="text-[11px] px-2 py-0.5 border border-track text-paper hover:bg-track hover:text-white transition-colors"
          title="Add custom rule"
        >
          {isAddingRule ? "CANCEL" : "+ NEW"}
        </button>
      </div>

      {/* New Rule Drawer */}
      {isAddingRule && (
        <form onSubmit={handleAddNewRule} className="p-2 border-b border-track bg-board text-xs space-y-2">
          <div className="text-[10px] plaque-title text-lamp-amber font-bold">STAMP NEW RULE</div>
          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              placeholder="RULE-ID"
              value={newRuleId}
              onChange={(e) => setNewRuleId(e.target.value)}
              className="bg-board-raised border border-track px-1.5 py-0.5 text-paper font-mono"
              required
            />
            <select
              value={newRuleSev}
              onChange={(e) => setNewRuleSev(e.target.value as any)}
              className="bg-board-raised border border-track px-1 py-0.5 text-paper"
            >
              <option value="high">HIGH [H]</option>
              <option value="medium">MED [M]</option>
              <option value="low">LOW [L]</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Rule name"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            className="w-full bg-board-raised border border-track px-1.5 py-0.5 text-paper"
            required
          />
          <div className="flex items-center space-x-2">
            <label className="text-[10px] text-paper-dim">Type:</label>
            <label className="flex items-center space-x-1">
              <input
                type="radio"
                name="kind"
                checked={newRuleKind === "payload"}
                onChange={() => setNewRuleKind("payload")}
              />
              <span className="text-[10px]">Payload</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="radio"
                name="kind"
                checked={newRuleKind === "sequence"}
                onChange={() => setNewRuleKind("sequence")}
              />
              <span className="text-[10px]">Sequence</span>
            </label>
          </div>
          <input
            type="text"
            placeholder="Regex pattern"
            value={newRulePattern}
            onChange={(e) => setNewRulePattern(e.target.value)}
            className="w-full bg-board-raised border border-track px-1.5 py-0.5 text-paper font-mono"
            required
          />
          <button
            type="submit"
            className="w-full py-1 bg-track text-paper hover:bg-track-dim transition-colors text-xs font-mono font-bold"
          >
            INSERT INTO LEDGER
          </button>
        </form>
      )}

      {/* Rules Ledger List */}
      <div className="flex-1 overflow-y-auto divide-y divide-track-dim/50">
        {filteredRules.length === 0 ? (
          <div className="p-4 text-xs text-paper-dim text-center">
            No rules on the board. Add one to see its machine.
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isSelected = rule.id === selectedRuleId;
            const sevBadge = rule.severity === "high" ? "H" : rule.severity === "medium" ? "M" : "L";
            const sevColor =
              rule.severity === "high"
                ? "border-lamp-red text-lamp-red"
                : rule.severity === "medium"
                ? "border-lamp-amber text-lamp-amber"
                : "border-lamp-green text-lamp-green";

            return (
              <div
                key={rule.id}
                onClick={() => {
                  onSelectRule(rule);
                  setEditingPattern(null);
                  setPatternError(null);
                }}
                className={`p-2.5 cursor-pointer transition-colors flex items-start space-x-2.5 ${
                  isSelected ? "bg-board border-l-2 border-l-lamp-amber" : "hover:bg-board/60"
                }`}
              >
                {/* Severity square stamp */}
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 border font-mono text-[10px] font-bold shrink-0 ${sevColor}`}
                  title={`Severity: ${rule.severity}`}
                >
                  {sevBadge}
                </span>

                {/* Rule Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-paper truncate">{rule.id}</span>
                    <span className="text-[10px] text-paper-dim font-mono tracking-tight">
                      {rule.kind === "payload" ? "PAYLOAD" : `SEQ (${rule.windowSeconds}s)`}
                    </span>
                  </div>
                  <div className="font-serif text-[13px] text-paper-dim leading-snug truncate mt-0.5">
                    {rule.name}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Rule Pattern Editor (Punched Label Style) */}
      {selectedRule && (
        <div className="border-t border-track p-2.5 bg-board">
          <div className="text-[10px] plaque-title text-paper-dim flex justify-between items-center mb-1">
            <span>PUNCHED PATTERN LABEL</span>
            <span className="font-mono text-[9px] text-paper-dim/80">{selectedRule.id}</span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={editingPattern !== null ? editingPattern : selectedRule.pattern}
              onChange={(e) => handlePatternChange(e.target.value)}
              className="w-full bg-board-raised border border-track px-2 py-1.5 font-mono text-xs text-lamp-amber focus:outline-none focus:border-lamp-amber"
              title="Edit regex pattern"
              spellCheck={false}
            />

            {/* Error underline highlighting */}
            {patternError && (
              <div className="mt-1 text-[11px] font-mono text-lamp-red flex items-start space-x-1 bg-lamp-red/10 p-1 border border-lamp-red/30">
                <span className="font-bold">!</span>
                <span>
                  {patternError.message} (col {patternError.index})
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 text-[11px] text-paper-dim/90 leading-tight">
            {selectedRule.explain}
          </div>
        </div>
      )}
    </div>
  );
};
