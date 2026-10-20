import { parseRegex } from "../packages/engine/src/parser";
import { buildNFA } from "../packages/engine/src/nfa";
import { toDFA } from "../packages/engine/src/dfa";
import { minimizeDFA } from "../packages/engine/src/minimize";

export function compileStats(pattern: string, options?: { unanchored?: boolean; caseInsensitive?: boolean }) {
  const ast = parseRegex(pattern, { caseInsensitive: options?.caseInsensitive });
  const nfa = buildNFA(ast);
  const dfa = toDFA(nfa, { unanchored: options?.unanchored });
  const { dfa: minDfa } = minimizeDFA(dfa);

  return {
    pattern,
    nfaStates: nfa.states.length,
    nfaTransitions: nfa.transitions.length,
    dfaStates: dfa.states.length,
    dfaTransitions: dfa.transitions.length,
    minDfaStates: minDfa.states.length,
    minDfaTransitions: minDfa.transitions.length,
    reductionPercent: Math.round((1 - minDfa.states.length / dfa.states.length) * 100),
  };
}

function main() {
  const patterns = [
    "(a|b)*abb",
    "a(b|c)*d",
    "(0|1)*1(0|1)",
    "F{3,}S",
    "UNION SELECT",
    "GET /.* HTTP",
  ];

  console.log("Tripwire Automata Compilation Statistics:");
  console.log("--------------------------------------------------------------------------------");
  console.log(
    "Pattern".padEnd(20) +
    "NFA States".padEnd(14) +
    "DFA States".padEnd(14) +
    "Min DFA States".padEnd(16) +
    "State Reduction"
  );
  console.log("--------------------------------------------------------------------------------");

  for (const p of patterns) {
    const s = compileStats(p);
    console.log(
      p.padEnd(20) +
      s.nfaStates.toString().padEnd(14) +
      s.dfaStates.toString().padEnd(14) +
      s.minDfaStates.toString().padEnd(16) +
      `${s.reductionPercent}%`
    );
  }
}

main();
