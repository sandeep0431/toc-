/**
 * nfa.ts: Thompson's construction and NFA simulation.
 *
 * Formal Theory:
 * Thompson's construction (1968) compiles any regular expression / AST into an
 * equivalent Non-deterministic Finite Automaton with ε-transitions (ε-NFA).
 * Properties guaranteed by this construction:
 * 1. Exactly one start state and one accept state per fragment and for the final NFA.
 * 2. The number of states is at most 2 * |AST|, and transitions at most 4 * |AST|.
 * 3. State IDs are allocated monotonically in construction order (0, 1, 2, ...).
 * 4. Provenance tracking per state records the AST node role for interactive UI inspection.
 */

import { CharSet, charSetContains, charToSymbol } from "./alphabet";
import { ASTNode } from "./parser";

export interface NFAState {
  readonly id: number;
  readonly provenance: string;
}

export interface NFATransition {
  readonly from: number;
  readonly to: number;
  /** null represents an ε-transition */
  readonly charSet: CharSet | null;
}

export interface NFA {
  readonly states: readonly NFAState[];
  readonly startState: number;
  readonly acceptState: number;
  readonly transitions: readonly NFATransition[];
}

interface NFAFragment {
  readonly startState: number;
  readonly acceptState: number;
}

/**
 * Compiles a parsed regex AST into an ε-NFA using Thompson's construction.
 */
export function buildNFA(ast: ASTNode): NFA {
  const states: NFAState[] = [];
  const transitions: NFATransition[] = [];
  let nextStateId = 0;

  function createState(provenance: string): number {
    const id = nextStateId++;
    states.push({ id, provenance });
    return id;
  }

  function addTransition(from: number, to: number, charSet: CharSet | null): void {
    transitions.push({ from, to, charSet });
  }

  /**
   * Recursive Thompson's construction implementation.
   */
  function buildFragment(node: ASTNode): NFAFragment {
    switch (node.type) {
      case "empty": {
        const start = createState("empty:start");
        const accept = createState("empty:accept");
        addTransition(start, accept, null); // ε-transition
        return { startState: start, acceptState: accept };
      }

      case "charSet": {
        const label = node.rawLabel ? `'${node.rawLabel}'` : "class";
        const start = createState(`symbol:${label}:start`);
        const accept = createState(`symbol:${label}:accept`);
        addTransition(start, accept, node.charSet);
        return { startState: start, acceptState: accept };
      }

      case "concat": {
        if (node.children.length === 0) {
          return buildFragment({ type: "empty", id: node.id });
        }

        const firstFrag = buildFragment(node.children[0]);
        let currentAccept = firstFrag.acceptState;

        for (let i = 1; i < node.children.length; i++) {
          const nextFrag = buildFragment(node.children[i]);
          // Connect previous accept to next start via ε-transition
          addTransition(currentAccept, nextFrag.startState, null);
          currentAccept = nextFrag.acceptState;
        }

        return {
          startState: firstFrag.startState,
          acceptState: currentAccept,
        };
      }

      case "union": {
        const start = createState("union:fork");
        const accept = createState("union:join");

        const leftFrag = buildFragment(node.left);
        const rightFrag = buildFragment(node.right);

        // Fork ε-transitions
        addTransition(start, leftFrag.startState, null);
        addTransition(start, rightFrag.startState, null);

        // Join ε-transitions
        addTransition(leftFrag.acceptState, accept, null);
        addTransition(rightFrag.acceptState, accept, null);

        return { startState: start, acceptState: accept };
      }

      case "star": {
        const start = createState("star:start");
        const accept = createState("star:accept");

        const innerFrag = buildFragment(node.child);

        // Zero occurrences skip: start -> accept
        addTransition(start, accept, null);
        // Enter fragment: start -> inner
        addTransition(start, innerFrag.startState, null);
        // Loop back: inner -> inner
        addTransition(innerFrag.acceptState, innerFrag.startState, null);
        // Exit fragment: inner -> accept
        addTransition(innerFrag.acceptState, accept, null);

        return { startState: start, acceptState: accept };
      }

      case "plus": {
        const start = createState("plus:start");
        const accept = createState("plus:accept");

        const innerFrag = buildFragment(node.child);

        // Must match at least once: start -> inner
        addTransition(start, innerFrag.startState, null);
        // Loop back for repetition
        addTransition(innerFrag.acceptState, innerFrag.startState, null);
        // Exit fragment
        addTransition(innerFrag.acceptState, accept, null);

        return { startState: start, acceptState: accept };
      }

      case "question": {
        const start = createState("optional:start");
        const accept = createState("optional:accept");

        const innerFrag = buildFragment(node.child);

        // Match option: start -> inner
        addTransition(start, innerFrag.startState, null);
        // Skip option: start -> accept
        addTransition(start, accept, null);
        // Exit option
        addTransition(innerFrag.acceptState, accept, null);

        return { startState: start, acceptState: accept };
      }
    }
  }

  const finalFragment = buildFragment(ast);

  return {
    states: Object.freeze(states),
    startState: finalFragment.startState,
    acceptState: finalFragment.acceptState,
    transitions: Object.freeze(transitions),
  };
}

/**
 * Computes the ε-closure of a set of NFA states.
 * Formally: ε-closure(T) = { s | s is reachable from some state in T along zero or more ε-transitions }.
 */
export function epsilonClosure(nfa: NFA, initialStates: Iterable<number>): Set<number> {
  const closure = new Set<number>(initialStates);
  const stack = Array.from(initialStates);

  // Pre-index ε-transitions for efficiency
  const epsilonAdjacency = new Map<number, number[]>();
  for (const trans of nfa.transitions) {
    if (trans.charSet === null) {
      let targets = epsilonAdjacency.get(trans.from);
      if (!targets) {
        targets = [];
        epsilonAdjacency.set(trans.from, targets);
      }
      targets.push(trans.to);
    }
  }

  while (stack.length > 0) {
    const state = stack.pop()!;
    const targets = epsilonAdjacency.get(state);
    if (targets) {
      for (const next of targets) {
        if (!closure.has(next)) {
          closure.add(next);
          stack.push(next);
        }
      }
    }
  }

  return closure;
}

/**
 * Computes move(T, a): the set of states reachable on symbol code `a` from states in T.
 */
export function nfaMove(nfa: NFA, states: Iterable<number>, symbolCode: number): Set<number> {
  const result = new Set<number>();
  const stateSet = states instanceof Set ? states : new Set(states);

  for (const trans of nfa.transitions) {
    if (trans.charSet !== null && stateSet.has(trans.from)) {
      if (charSetContains(trans.charSet, symbolCode)) {
        result.add(trans.to);
      }
    }
  }

  return result;
}

/**
 * NFA Simulator: Tests whether a string is accepted by the NFA.
 * Used for differential testing against JavaScript's RegExp.
 */
export function nfaSimulate(nfa: NFA, input: string): boolean {
  let currentStates = epsilonClosure(nfa, [nfa.startState]);

  for (let i = 0; i < input.length; i++) {
    const symbol = charToSymbol(input[i]);
    const moved = nfaMove(nfa, currentStates, symbol);
    currentStates = epsilonClosure(nfa, moved);
    if (currentStates.size === 0) {
      return false;
    }
  }

  return currentStates.has(nfa.acceptState);
}
