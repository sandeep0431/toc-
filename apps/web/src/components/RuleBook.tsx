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
    <div className="h-full flex flex-col bg-board-raised select-none">
      {/* Panel Header */}
      <div className="h-11 px-3 border-b border-track flex items-center justify-between bg-board-raised shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xs tracking-tight text-paper">Security Rules</span>
          <span className="text-[10px] text-paper-dim font-mono bg-board px-1.5 py-0.2 rounded border border-track">
            {rules.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddingRule(!isAddingRule)}
          className="text-xs px-2.5 py-1 rounded-md border border-track text-paper hover:bg-board font-medium transition-colors"
          title="Add custom rule"
        >
          {isAddingRule ? "Cancel" : "+ New Rule"}
        </button>
      </div>

      {/* Severity Filter Pills */}
      <div className="px-3 py-1.5 border-b border-track bg-board/50 flex items-center space-x-1 shrink-0">
        {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              filterSeverity === sev
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                : "text-paper-dim hover:text-paper hover:bg-slate-200/50 dark:hover:bg-zinc-800"
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* New Rule Drawer */}
      {isAddingRule && (
        <form onSubmit={handleAddNewRule} className="p-3 border-b border-track bg-board text-xs space-y-2.5 shrink-0">
          <div className="text-xs font-semibold text-paper">Define Custom Rule</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="RULE-ID"
              value={newRuleId}
              onChange={(e) => setNewRuleId(e.target.value)}
              className="bg-board-raised border border-track rounded px-2 py-1 text-paper font-mono text-xs focus:outline-none focus:border-amber-500"
              required
            />
            <select
              value={newRuleSev}
              onChange={(e) => setNewRuleSev(e.target.value as any)}
              className="bg-board-raised border border-track rounded px-2 py-1 text-paper text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="high">High [H]</option>
              <option value="medium">Medium [M]</option>
              <option value="low">Low [L]</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Rule description name"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            className="w-full bg-board-raised border border-track rounded px-2 py-1 text-paper text-xs focus:outline-none focus:border-amber-500"
            required
          />
          <div className="flex items-center space-x-3 text-xs text-paper-dim">
            <span>Type:</span>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="radio"
                name="kind"
                checked={newRuleKind === "payload"}
                onChange={() => setNewRuleKind("payload")}
              />
              <span>Payload</span>
            </label>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="radio"
                name="kind"
                checked={newRuleKind === "sequence"}
                onChange={() => setNewRuleKind("sequence")}
              />
              <span>Sequence</span>
            </label>
          </div>
          <input
            type="text"
            placeholder="Regex pattern (e.g. admin.*login)"
            value={newRulePattern}
            onChange={(e) => setNewRulePattern(e.target.value)}
            className="w-full bg-board-raised border border-track rounded px-2 py-1 text-paper font-mono text-xs focus:outline-none focus:border-amber-500"
            required
          />
          <button
            type="submit"
            className="w-full py-1.5 bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors text-xs font-semibold rounded shadow-xs"
          >
            Add Rule to Engine
          </button>
        </form>
      )}

      {/* Rules Ledger List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
        {filteredRules.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 dark:text-zinc-400 text-center">
            No rules matching filter.
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isSelected = rule.id === selectedRuleId;
            const sevBadge = rule.severity === "high" ? "High" : rule.severity === "medium" ? "Med" : "Low";
            const sevStyle =
              rule.severity === "high"
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
                : rule.severity === "medium"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900";

            return (
              <div
                key={rule.id}
                onClick={() => {
                  onSelectRule(rule);
                  setEditingPattern(null);
                  setPatternError(null);
                }}
                className={`p-3 cursor-pointer transition-colors flex items-start space-x-2.5 ${
                  isSelected
                    ? "bg-board border-l-[3px] border-l-amber-600"
                    : "hover:bg-board/60"
                }`}
              >
                {/* Severity pill badge */}
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.5 border text-[10px] font-semibold rounded shrink-0 ${sevStyle}`}
                  title={`Severity: ${rule.severity}`}
                >
                  {sevBadge}
                </span>

                {/* Rule Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-paper truncate">{rule.id}</span>
                    <span className="text-[10px] text-paper-dim font-mono font-medium">
                      {rule.kind === "payload" ? "PAYLOAD" : `SEQ (${rule.windowSeconds}s)`}
                    </span>
                  </div>
                  <div className="text-xs text-paper-dim font-medium leading-snug truncate mt-0.5">
                    {rule.name}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Rule Pattern Editor */}
      {selectedRule && (
        <div className="border-t border-track p-3 bg-board shrink-0">
          <div className="text-[11px] font-semibold text-paper-dim flex justify-between items-center mb-1.5">
            <span>Pattern Definition</span>
            <span className="font-mono text-[10px] text-paper font-bold">{selectedRule.id}</span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={editingPattern !== null ? editingPattern : selectedRule.pattern}
              onChange={(e) => handlePatternChange(e.target.value)}
              className="w-full bg-board-raised border border-track rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold text-paper focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-2xs"
              title="Edit regex pattern"
              spellCheck={false}
            />

            {/* Error underline highlighting */}
            {patternError && (
              <div className="mt-1.5 text-[11px] font-mono text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 p-1.5 rounded border border-rose-200 flex items-start space-x-1.5">
                <span className="font-bold">!</span>
                <span>
                  {patternError.message} (col {patternError.index})
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 text-[11px] text-paper-dim leading-relaxed font-medium">
            {selectedRule.explain}
          </div>
        </div>
      )}
    </div>
  );
};
