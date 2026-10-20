/**
 * matcher.ts: Finite automata execution and tracing.
 *
 * Formal Theory:
 * An automaton accepts an input w = a_1 a_2 ... a_n iff there exists a sequence of
 * states r_0, r_1, ..., r_n such that:
 * 1. r_0 = q_0 (start state)
 * 2. r_{i+1} = δ(r_i, a_{i+1})
 * 3. r_n ∈ F (for anchored languages), OR ∃ k ≤ n with r_k ∈ F (for unanchored search).
 */

import { DFA, dfaTrace } from "./dfa";

export interface Trace {
  readonly states: readonly number[];
  readonly accepted: boolean;
  readonly firstAcceptIndex: number | null;
  readonly matchedSnippet?: string;
}

/**
 * Runs a DFA on an input string, recording the complete per-character state transition history.
 */
export function run(dfa: DFA, input: string): Trace {
  const result = dfaTrace(dfa, input);

  let matchedSnippet: string | undefined;
  if (result.firstAcceptIndex !== null) {
    // Extract snippet around acceptance point
    const end = Math.min(input.length, result.firstAcceptIndex);
    const start = Math.max(0, end - 30);
    matchedSnippet = input.substring(start, end);
  }

  return {
    states: result.statePath,
    accepted: result.accepted,
    firstAcceptIndex: result.firstAcceptIndex,
    matchedSnippet,
  };
}
