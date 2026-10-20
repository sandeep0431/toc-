/**
 * pda.ts: Pushdown Automaton (PDA) for balanced delimiter verification.
 *
 * Formal Theory:
 * A Pushdown Automaton is a 7-tuple M = (Q, Σ, Γ, δ, q0, Z0, F).
 * By the Pumping Lemma for Regular Languages, the language of balanced delimiters
 * (the Dyck language L = { w ∈ {(, ), [, ], {, }}* | w is properly nested }) is
 * strictly non-regular. No DFA or NFA can recognize it because finite automata
 * possess only O(1) state memory and cannot count arbitrarily deep nesting.
 *
 * This PDA proves the theoretical boundary between Chomsky Type 3 (Regular) and
 * Type 2 (Context-Free) languages by providing an explicit stack Γ* that grows and shrinks.
 */

export interface PDAStep {
  readonly index: number;
  readonly symbol: string;
  readonly stack: readonly string[];
  readonly action: "push" | "pop" | "noop" | "error";
  readonly description: string;
}

export interface PDATrace {
  readonly accepted: boolean;
  readonly errorIndex: number | null;
  readonly errorMessage?: string;
  readonly steps: readonly PDAStep[];
  readonly finalStack: readonly string[];
}

const OPEN_DELIMITERS = new Set(["(", "[", "{"]);
const MATCHING_CLOSE: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

/**
 * Executes a deterministic Pushdown Automaton to verify balanced delimiters in SQL/web queries.
 * Handles nested brackets (), [], {} and string quote delimiters ', ".
 */
export function simulatePDA(input: string): PDATrace {
  const stack: string[] = ["$"]; // $ is initial bottom-of-stack marker Z0
  const steps: PDAStep[] = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (OPEN_DELIMITERS.has(ch)) {
      stack.push(ch);
      steps.push({
        index: i,
        symbol: ch,
        stack: [...stack],
        action: "push",
        description: `Push '${ch}' onto stack (nesting depth: ${stack.length - 1})`,
      });
    } else if (ch in MATCHING_CLOSE) {
      const expectedOpen = MATCHING_CLOSE[ch];
      const top = stack[stack.length - 1];

      if (top === expectedOpen) {
        stack.pop();
        steps.push({
          index: i,
          symbol: ch,
          stack: [...stack],
          action: "pop",
          description: `Matched '${ch}' with '${top}' -> Popped from stack`,
        });
      } else {
        steps.push({
          index: i,
          symbol: ch,
          stack: [...stack],
          action: "error",
          description: `Mismatched delimiter: encountered '${ch}' but stack top was '${top}'`,
        });
        return {
          accepted: false,
          errorIndex: i,
          errorMessage: `Mismatched closing delimiter '${ch}' at column ${i}`,
          steps,
          finalStack: stack,
        };
      }
    } else if (ch === "'" || ch === '"') {
      const top = stack[stack.length - 1];
      if (top === ch) {
        stack.pop();
        steps.push({
          index: i,
          symbol: ch,
          stack: [...stack],
          action: "pop",
          description: `Closed quote ${ch} -> Popped from stack`,
        });
      } else {
        stack.push(ch);
        steps.push({
          index: i,
          symbol: ch,
          stack: [...stack],
          action: "push",
          description: `Opened quote ${ch} -> Pushed onto stack`,
        });
      }
    } else {
      // Non-delimiter symbol: noop
      steps.push({
        index: i,
        symbol: ch,
        stack: [...stack],
        action: "noop",
        description: `Read '${ch}' -> Stack unchanged`,
      });
    }
  }

  // Final acceptance check: stack must contain only bottom-of-stack marker '$'
  const isBalanced = stack.length === 1 && stack[0] === "$";

  if (!isBalanced) {
    const unclosed = stack[stack.length - 1];
    return {
      accepted: false,
      errorIndex: input.length,
      errorMessage: `Unclosed delimiter '${unclosed}' remaining on stack at end of input`,
      steps,
      finalStack: stack,
    };
  }

  return {
    accepted: true,
    errorIndex: null,
    steps,
    finalStack: stack,
  };
}
