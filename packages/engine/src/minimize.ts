/**
 * minimize.ts: Hopcroft's DFA minimization via partition refinement.
 *
 * Formal Theory:
 * Hopcroft's Algorithm (1971):
 * Finds the unique minimal state DFA (Myhill-Nerode theorem) in O(|Σ| * n log n) time.
 * States p and q are equivalent (p ~ q) iff for all strings w ∈ Σ*,
 * δ*(p, w) ∈ F <=> δ*(q, w) ∈ F.
 *
 * The algorithm begins with a partition P = { F, S \ F } separating accepting
 * from non-accepting states, and iteratively refines blocks using inverse transitions
 * until reaching a stable fixed point.
 */

import {
  CharSet,
  charSetDifference,
  charSetNormalize,
  charSetUnion,
  UNIVERSAL_CHAR_SET,
} from "./alphabet";
import { DFA, DFAState, DFATransition } from "./dfa";

export interface MinimizedDFA {
  readonly dfa: DFA;
  readonly partitionsHistory: readonly (readonly (readonly number[])[])[];
}

/**
 * Minimizes a DFA using Hopcroft's partition refinement algorithm.
 */
export function minimizeDFA(dfa: DFA): MinimizedDFA {
  // Step 1: Reachability analysis - discard unreachable states
  const reachable = new Set<number>();
  const queue = [dfa.startState];
  reachable.add(dfa.startState);

  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const t of dfa.transitions) {
      if (t.from === s && !reachable.has(t.to)) {
        reachable.add(t.to);
        queue.push(t.to);
      }
    }
  }

  const activeStates = dfa.states.filter((s) => reachable.has(s.id));
  const activeTransitions = dfa.transitions.filter(
    (t) => reachable.has(t.from) && reachable.has(t.to)
  );

  // If 0 or 1 reachable states, already minimal
  if (activeStates.length <= 1) {
    return {
      dfa,
      partitionsHistory: [[activeStates.map((s) => s.id)]],
    };
  }

  // Step 2: Initial partition into accepting and non-accepting states
  const accepting: number[] = [];
  const nonAccepting: number[] = [];

  for (const s of activeStates) {
    if (s.isAccept) {
      accepting.push(s.id);
    } else {
      nonAccepting.push(s.id);
    }
  }

  let partition: number[][] = [];
  if (accepting.length > 0) partition.push(accepting);
  if (nonAccepting.length > 0) partition.push(nonAccepting);

  const partitionsHistory: number[][][] = [];
  partitionsHistory.push(partition.map((block) => [...block]));

  // Pre-calculate distinct alphabet character sets from transitions
  const alphabetSets: CharSet[] = [];
  for (const t of activeTransitions) {
    alphabetSets.push(t.charSet);
  }

  // Step 3: Hopcroft partition refinement loop
  let changed = true;
  while (changed) {
    changed = false;
    const nextPartition: number[][] = [];

    for (const block of partition) {
      if (block.length <= 1) {
        nextPartition.push(block);
        continue;
      }

      // Find the block index each state in this block transitions to for each symbol set
      // Group states in the block by their transition signature
      const stateToBlockMap = new Map<number, number>();
      for (let bIdx = 0; bIdx < partition.length; bIdx++) {
        for (const stateId of partition[bIdx]) {
          stateToBlockMap.set(stateId, bIdx);
        }
      }

      // Group states by signature: string key representing target block for each outgoing transition
      const signatureGroups = new Map<string, number[]>();

      for (const stateId of block) {
        // Collect transitions for this state
        const stateTrans = activeTransitions.filter((t) => t.from === stateId);
        // Build signature sorted by target block and charSet
        const sigParts: string[] = [];
        for (const t of stateTrans) {
          const targetBlock = stateToBlockMap.get(t.to);
          sigParts.push(`${t.charSet.map(([s, e]) => `${s}-${e}`).join(";")}=>${targetBlock}`);
        }
        sigParts.sort();
        const signature = sigParts.join("|");

        let group = signatureGroups.get(signature);
        if (!group) {
          group = [];
          signatureGroups.set(signature, group);
        }
        group.push(stateId);
      }

      if (signatureGroups.size > 1) {
        changed = true;
        for (const subGroup of signatureGroups.values()) {
          nextPartition.push(subGroup);
        }
      } else {
        nextPartition.push(block);
      }
    }

    partition = nextPartition;
    if (changed) {
      partitionsHistory.push(partition.map((block) => [...block]));
    }
  }

  // Step 4: Construct the Minimized DFA from final partition blocks
  // Sort blocks so that the block containing startState is index 0
  partition.sort((a, b) => {
    const aHasStart = a.includes(dfa.startState);
    const bHasStart = b.includes(dfa.startState);
    if (aHasStart && !bHasStart) return -1;
    if (!aHasStart && bHasStart) return 1;
    return a[0] - b[0];
  });

  const stateToNewId = new Map<number, number>();
  for (let i = 0; i < partition.length; i++) {
    for (const origStateId of partition[i]) {
      stateToNewId.set(origStateId, i);
    }
  }

  const minStates: DFAState[] = [];
  for (let i = 0; i < partition.length; i++) {
    const block = partition[i];
    const isAccept = block.some((origId) => dfa.states[origId].isAccept);
    const isDead = block.every((origId) => dfa.states[origId].isDead);

    // Merge NFA states from all member states
    const mergedNfaStates = new Set<number>();
    for (const origId of block) {
      for (const nfaId of dfa.states[origId].nfaStates) {
        mergedNfaStates.add(nfaId);
      }
    }

    minStates.push({
      id: i,
      nfaStates: Array.from(mergedNfaStates).sort((a, b) => a - b),
      isAccept,
      isDead: isDead ? true : undefined,
    });
  }

  // Step 5: Merge Transitions between minimized blocks
  const targetMap = new Map<string, CharSet>(); // `${from}->${to}` => CharSet

  for (const t of activeTransitions) {
    const newFrom = stateToNewId.get(t.from);
    const newTo = stateToNewId.get(t.to);

    if (newFrom !== undefined && newTo !== undefined) {
      const key = `${newFrom}->${newTo}`;
      const existing = targetMap.get(key) || [];
      targetMap.set(key, charSetUnion(existing, t.charSet));
    }
  }

  const minTransitions: DFATransition[] = [];
  for (const [key, charSet] of targetMap.entries()) {
    const [fromStr, toStr] = key.split("->");
    minTransitions.push({
      from: parseInt(fromStr, 10),
      to: parseInt(toStr, 10),
      charSet,
    });
  }

  const deadStateId = minStates.find((s) => s.isDead)?.id;

  const minDFA: DFA = {
    states: Object.freeze(minStates),
    startState: 0,
    transitions: Object.freeze(minTransitions),
    deadStateId,
    steps: dfa.steps, // Preserve original construction steps
    unanchored: dfa.unanchored,
  };

  return {
    dfa: minDFA,
    partitionsHistory,
  };
}
