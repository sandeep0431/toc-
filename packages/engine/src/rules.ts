/**
 * rules.ts: Rule definitions, validation, and compilation to minimal DFAs.
 *
 * Formal Theory:
 * An intrusion detection rule is a formal regular language predicate:
 * - Payload rules: Regex L_p scanned over unanchored input strings w ∈ Σ*.
 * - Sequence rules: Regex L_s matched over temporal event symbol strings s ∈ {F, S, P, R, E, X}*
 *   partitioned by source identifier within a sliding time window Δt.
 */

import { ASTNode, parseRegex, RegexSyntaxError } from "./parser";
import { buildNFA, NFA } from "./nfa";
import { DFA, toDFA } from "./dfa";
import { minimizeDFA } from "./minimize";

export type RuleSeverity = "low" | "medium" | "high";
export type RuleKind = "payload" | "sequence";
export type RuleField = "path" | "query" | "userAgent" | "raw";

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly kind: RuleKind;
  readonly pattern: string;
  readonly field?: RuleField;
  readonly groupBy?: "source";
  readonly windowSeconds?: number;
  readonly severity: RuleSeverity;
  readonly explain: string;
  readonly caseInsensitive?: boolean;
}

export interface RuleValidationError {
  readonly ruleId: string;
  readonly index: number;
  readonly message: string;
}

export interface CompiledRule {
  readonly rule: Rule;
  readonly ast: ASTNode;
  readonly nfa: NFA;
  readonly dfa: DFA;
  readonly minDfa: DFA;
}

/**
 * Validates a rule's syntax and schema.
 * Throws RuleValidationError with rule id and character column index if invalid.
 */
export function validateRule(rule: Rule): void {
  if (!rule.id || rule.id.trim().length === 0) {
    throw { ruleId: rule.id || "UNKNOWN", index: 0, message: "Rule missing id" };
  }
  if (!rule.pattern || rule.pattern.length === 0) {
    throw { ruleId: rule.id, index: 0, message: "Rule missing pattern" };
  }
  if (rule.kind !== "payload" && rule.kind !== "sequence") {
    throw { ruleId: rule.id, index: 0, message: `Invalid rule kind: ${rule.kind}` };
  }

  if (rule.kind === "sequence") {
    if (rule.windowSeconds !== undefined && rule.windowSeconds <= 0) {
      throw { ruleId: rule.id, index: 0, message: "Sequence rule windowSeconds must be positive" };
    }
  }

  // Validate regex syntax via parser
  try {
    parseRegex(rule.pattern, { caseInsensitive: rule.caseInsensitive });
  } catch (err) {
    if (err instanceof RegexSyntaxError) {
      throw {
        ruleId: rule.id,
        index: err.index,
        message: err.message,
      };
    }
    throw {
      ruleId: rule.id,
      index: 0,
      message: (err as Error).message || "Regex parse error",
    };
  }
}

/**
 * Compiles a Rule into its minimal DFA via AST -> NFA -> DFA -> MinDFA.
 */
export function compileRule(rule: Rule): CompiledRule {
  validateRule(rule);

  const isUnanchored = rule.kind === "payload";
  const ast = parseRegex(rule.pattern, { caseInsensitive: rule.caseInsensitive });
  const nfa = buildNFA(ast);
  const dfa = toDFA(nfa, { unanchored: isUnanchored });
  const { dfa: minDfa } = minimizeDFA(dfa);

  return {
    rule,
    ast,
    nfa,
    dfa,
    minDfa,
  };
}

/**
 * Loads, validates, and compiles an array of rules.
 */
export function loadRules(rulesJson: readonly Rule[]): {
  compiledRules: CompiledRule[];
  errors: RuleValidationError[];
} {
  const compiledRules: CompiledRule[] = [];
  const errors: RuleValidationError[] = [];

  for (const r of rulesJson) {
    try {
      compiledRules.push(compileRule(r));
    } catch (err: any) {
      errors.push(err);
    }
  }

  return { compiledRules, errors };
}
