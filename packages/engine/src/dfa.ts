/**
 * dfa.ts: Deterministic Finite Automaton (DFA) conversion via subset construction.
 *
 * Formal Theory:
 * Subset Construction (Rabin & Scott, 1959):
 * Converts an ε-NFA into an equivalent DFA where each DFA state corresponds to a
 * subset of NFA states.
 * - Start state = ε-closure({ nfa.startState }).
 * - Transition δ_D(T, a) = ε-closure(move(T, a)).
 * - Accepting states = any subset containing the NFA accept state.
 *
 * For unanchored substring matching (e.g. payload inspection), a self-loop on Σ
 * is added to the NFA start state, equivalent to prefixing Σ*.
 */

import {
  CharRange,
  CharSet,
  charSetContains,
  charSetDifference,
  charSetNormalize,
  charSetUnion,
  charToSymbol,
  labelOf,
  OTHER_SYMBOL,
  PRINTABLE_ASCII_END,
  PRINTABLE_ASCII_START,
  TAB_CODE,
  UNIVERSAL_CHAR_SET,
} from "./alphabet";
import { epsilonClosure, NFA, NFATransition } from "./nfa";

export interface DFAState {
  readonly id: number;
  readonly nfaStates: readonly number[];
  readonly isAccept: boolean;
  readonly isDead?: boolean;
}

export interface DFATransition {
  readonly from: number;
  readonly to: number;
  readonly charSet: CharSet;
}

export interface SubsetStep {
  readonly stepIndex: number;
  readonly type: "init" | "closure" | "move" | "new_state";
  readonly dfaStateId: number;
  readonly nfaStates: readonly number[];
  readonly symbolLabel?: string;
  readonly targetDfaStateId?: number;
  readonly description: string;
}

export interface DFA {
  readonly states: readonly DFAState[];
  readonly startState: number;
  readonly transitions: readonly DFATransition[];
  readonly deadStateId?: number;
  readonly steps: readonly SubsetStep[];
  readonly unanchored?: boolean;
}

export interface ToDFAOptions {
  unanchored?: boolean;
  includeTrapState?: boolean;
}

/**
 * Derives atomic, non-overlapping character set partitions from a set of transitions.
 * This partitions the alphabet Σ into elementary disjoint intervals so that every
 * NFA transition either completely includes or completely excludes each atomic interval.
 */
export function computeAlphabetPartition(transitions: readonly NFATransition[]): CharSet[] {
  // Collect all cut-point boundaries
  const cutPoints = new Set<number>();
  cutPoints.add(OTHER_SYMBOL);
  cutPoints.add(OTHER_SYMBOL + 1);
  cutPoints.add(TAB_CODE);
  cutPoints.add(TAB_CODE + 1);
  cutPoints.add(PRINTABLE_ASCII_START);
  cutPoints.add(PRINTABLE_ASCII_END + 1);

  for (const t of transitions) {
    if (t.charSet !== null) {
      for (const [start, end] of t.charSet) {
        cutPoints.add(start);
        cutPoints.add(end + 1);
      }
    }
  }

  const sortedPoints = Array.from(cutPoints).sort((a, b) => a - b);
  const partition: CharSet[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const start = sortedPoints[i];
    const nextCut = sortedPoints[i + 1];
    const end = nextCut - 1;

    if (start <= end) {
      // Keep only ranges within the defined alphabet (OTHER, TAB, or 32..126)
      const range: CharRange = [start, end];
      const valid = charSetNormalize([range]);
      for (const r of valid) {
        if (
          (r[0] === OTHER_SYMBOL && r[1] === OTHER_SYMBOL) ||
          (r[0] === TAB_CODE && r[1] === TAB_CODE) ||
          (r[0] >= PRINTABLE_ASCII_START && r[1] <= PRINTABLE_ASCII_END)
        ) {
          partition.push([r]);
        }
      }
    }
  }

  return partition;
}

/**
 * Creates a canonical string key for a set of NFA state IDs.
 */
function stateSetKey(states: Iterable<number>): string {
  const sorted = Array.from(states).sort((a, b) => a - b);
  return sorted.join(",");
}

/**
 * Converts an NFA into a deterministic finite automaton using the subset construction.
 */
export function toDFA(nfa: NFA, options: ToDFAOptions = {}): DFA {
  const steps: SubsetStep[] = [];
  let stepCounter = 0;

  // If unanchored, augment NFA with a start state self-loop on UNIVERSAL_CHAR_SET
  let effectiveTransitions = [...nfa.transitions];
  if (options.unanchored) {
    effectiveTransitions.push({
      from: nfa.startState,
      to: nfa.startState,
      charSet: UNIVERSAL_CHAR_SET,
    });
  }

  const effectiveNFA: NFA = {
    states: nfa.states,
    startState: nfa.startState,
    acceptState: nfa.acceptState,
    transitions: effectiveTransitions,
  };

  // Pre-calculate alphabet partition
  const alphabetPartition = computeAlphabetPartition(effectiveTransitions);

  // Initial state = ε-closure({ startState })
  const initialClosureSet = epsilonClosure(effectiveNFA, [effectiveNFA.startState]);
  const initialClosure = Array.from(initialClosureSet).sort((a, b) => a - b);

  const stateMap = new Map<string, number>(); // stateSetKey -> DFA state id
  const dfaStates: DFAState[] = [];
  const dfaTransitions: DFATransition[] = [];

  const startId = 0;
  stateMap.set(stateSetKey(initialClosure), startId);

  const isStartAccept = initialClosure.includes(effectiveNFA.acceptState);
  dfaStates.push({
    id: startId,
    nfaStates: initialClosure,
    isAccept: isStartAccept,
  });

  steps.push({
    stepIndex: stepCounter++,
    type: "init",
    dfaStateId: startId,
    nfaStates: initialClosure,
    description: `q${startId} initialized with ε-closure({q${effectiveNFA.startState}}) = {${initialClosure.map((s) => `q${s}`).join(", ")}}`,
  });

  const workQueue: number[] = [startId];

  while (workQueue.length > 0) {
    const currentDfaId = workQueue.shift()!;
    const currentNfaStates = dfaStates[currentDfaId].nfaStates;

    // Map each target state key to the accumulated CharSet leading to it
    const targetToCharSet = new Map<number, CharSet>();

    for (const part of alphabetPartition) {
      const sampleSymbol = part[0][0];

      // move(currentNfaStates, sampleSymbol)
      const moveSet = new Set<number>();
      for (const nfaState of currentNfaStates) {
        for (const trans of effectiveNFA.transitions) {
          if (trans.from === nfaState && trans.charSet !== null) {
            if (charSetContains(trans.charSet, sampleSymbol)) {
              moveSet.add(trans.to);
            }
          }
        }
      }

      if (moveSet.size === 0) {
        continue;
      }

      // ε-closure(moveSet)
      const nextClosureSet = epsilonClosure(effectiveNFA, moveSet);
      const nextClosure = Array.from(nextClosureSet).sort((a, b) => a - b);
      const key = stateSetKey(nextClosure);

      let targetDfaId: number;
      if (!stateMap.has(key)) {
        targetDfaId = dfaStates.length;
        stateMap.set(key, targetDfaId);

        const isAccept = nextClosure.includes(effectiveNFA.acceptState);
        dfaStates.push({
          id: targetDfaId,
          nfaStates: nextClosure,
          isAccept,
        });

        workQueue.push(targetDfaId);

        steps.push({
          stepIndex: stepCounter++,
          type: "new_state",
          dfaStateId: currentDfaId,
          targetDfaStateId: targetDfaId,
          symbolLabel: labelOf(part),
          nfaStates: nextClosure,
          description: `Discovered new DFA state q${targetDfaId} = {${nextClosure.map((s) => `q${s}`).join(", ")}} on ${labelOf(part)}`,
        });
      } else {
        targetDfaId = stateMap.get(key)!;
      }

      // Accumulate transition character sets for identical targets
      const existingSet = targetToCharSet.get(targetDfaId) || [];
      targetToCharSet.set(targetDfaId, charSetUnion(existingSet, part));
    }

    // Record merged transitions
    for (const [targetDfaId, set] of targetToCharSet.entries()) {
      dfaTransitions.push({
        from: currentDfaId,
        to: targetDfaId,
        charSet: set,
      });

      steps.push({
        stepIndex: stepCounter++,
        type: "move",
        dfaStateId: currentDfaId,
        targetDfaStateId: targetDfaId,
        symbolLabel: labelOf(set),
        nfaStates: dfaStates[targetDfaId].nfaStates,
        description: `Transition q${currentDfaId} --[${labelOf(set)}]--> q${targetDfaId}`,
      });
    }
  }

  // Handle dead / trap state if requested or needed
  let deadStateId: number | undefined;
  if (options.includeTrapState) {
    let hasMissingTransitions = false;

    // Check if any state lacks transitions on parts of the alphabet
    for (const state of dfaStates) {
      let covered = charSetNormalize([]);
      for (const t of dfaTransitions) {
        if (t.from === state.id) {
          covered = charSetUnion(covered, t.charSet);
        }
      }
      const uncovered = charSetDifference(UNIVERSAL_CHAR_SET, covered);
      if (uncovered.length > 0) {
        hasMissingTransitions = true;
        break;
      }
    }

    if (hasMissingTransitions) {
      deadStateId = dfaStates.length;
      dfaStates.push({
        id: deadStateId,
        nfaStates: [],
        isAccept: false,
        isDead: true,
      });

      // Self-loop on dead state
      dfaTransitions.push({
        from: deadStateId,
        to: deadStateId,
        charSet: UNIVERSAL_CHAR_SET,
      });

      // Connect uncovered characters to dead state
      for (const state of dfaStates) {
        if (state.id === deadStateId) continue;
        let covered = charSetNormalize([]);
        for (const t of dfaTransitions) {
          if (t.from === state.id) {
            covered = charSetUnion(covered, t.charSet);
          }
        }
        const uncovered = charSetDifference(UNIVERSAL_CHAR_SET, covered);
        if (uncovered.length > 0) {
          dfaTransitions.push({
            from: state.id,
            to: deadStateId,
            charSet: uncovered,
          });
        }
      }
    }
  }

  return {
    states: Object.freeze(dfaStates),
    startState: startId,
    transitions: Object.freeze(dfaTransitions),
    deadStateId,
    steps: Object.freeze(steps),
    unanchored: options.unanchored,
  };
}

/**
 * Traces input execution through a DFA.
 * Records state visit history for UI replay and step-through animation.
 */
export function dfaTrace(
  dfa: DFA,
  input: string
): {
  statePath: number[];
  accepted: boolean;
  firstAcceptIndex: number | null;
} {
  let currentState = dfa.startState;
  const statePath = [currentState];
  let firstAcceptIndex: number | null = dfa.states[currentState].isAccept ? 0 : null;

  for (let i = 0; i < input.length; i++) {
    const symbol = charToSymbol(input[i]);
    let nextState: number | null = null;

    for (const t of dfa.transitions) {
      if (t.from === currentState && charSetContains(t.charSet, symbol)) {
        nextState = t.to;
        break;
      }
    }

    if (nextState === null) {
      // Transition undefined -> enter trap / reject
      return {
        statePath,
        accepted: dfa.unanchored ? firstAcceptIndex !== null : false,
        firstAcceptIndex,
      };
    }

    currentState = nextState;
    statePath.push(currentState);

    if (firstAcceptIndex === null && dfa.states[currentState].isAccept) {
      firstAcceptIndex = i + 1;
    }
  }

  const accepted = dfa.unanchored
    ? firstAcceptIndex !== null
    : dfa.states[currentState].isAccept;

  return {
    statePath,
    accepted,
    firstAcceptIndex,
  };
}

/**
 * Simulates DFA acceptance on a string.
 */
export function dfaSimulate(dfa: DFA, input: string): boolean {
  return dfaTrace(dfa, input).accepted;
}
