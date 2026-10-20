# Tripwire Examiner Viva & Defense Preparation

This document contains 28 detailed examination questions and answers designed for academic viva voce and technical project defenses on Theory of Computation (TOC), formal automata, and compiler construction.

---

### Q1: What is Tripwire and what role does automata theory play in it?
**Answer:** Tripwire is an intrusion detection system (IDS) that models security monitoring as formal language recognition. Instead of relying on ad-hoc regex libraries or string searching, it compiles security signatures and temporal event sequences into finite automata (Thompson NFA $\to$ Subset Construction DFA $\to$ Hopcroft Minimized DFA). Every intrusion detection decision is a path traversal in a deterministic finite automaton.

---

### Q2: What is the formal difference between a DFA and an NFA?
**Answer:**
- A **Deterministic Finite Automaton (DFA)** has a transition function $\delta: Q \times \Sigma \to Q$. For every state $q$ and symbol $a$, there is exactly one next state. It has no $\epsilon$-transitions.
- A **Non-deterministic Finite Automaton (NFA)** has transition function $\delta: Q \times (\Sigma \cup \{\epsilon\}) \to \mathcal{P}(Q)$. For a state and symbol, there can be zero, one, or multiple transitions, as well as spontaneous $\epsilon$-transitions without consuming input. Both recognize the exact same class of languages (Regular Languages, Chomsky Type 3).

---

### Q3: Why not scan inputs directly with an NFA instead of converting to a DFA?
**Answer:** Time complexity. Simulating an NFA takes $O(|Q|^2)$ time per input character because the simulator must track a subset of active states and compute $\epsilon$-closures. A DFA takes strictly $O(1)$ time per character (a single array/table lookup). For real-time network or log inspection with gigabytes of throughput, $O(1)$ per character is essential to prevent CPU exhaustion.

---

### Q4: What is an $\epsilon$-closure, and how is it computed?
**Answer:** The $\epsilon$-closure of a state $q$ (or set of states $T$) is the set of all states reachable from $q$ along paths consisting solely of $\epsilon$-transitions. It is computed using depth-first search (DFS) or breadth-first search (BFS) over the directed graph formed by $\epsilon$-edges, with a visited set to handle cycles created by Kleene star loops ($A^*$).

---

### Q5: How does Thompson's construction ensure correctness?
**Answer:** Thompson's construction is an inductive proof:
1. Base cases for literal characters $a \in \Sigma$ and empty $\epsilon$ trivially accept their respective languages.
2. Inductive steps for concatenation, alternation, and Kleene star preserve fragment isolation: each fragment has exactly one start and one accept state, with no incoming edges to start and no outgoing edges from accept. Hence, composition preserves language semantics without transition interference.

---

### Q6: What is the worst-case state blowup in the subset construction?
**Answer:** For an NFA with $n$ states, the subset construction can theoretically produce up to $2^n$ DFA states. A classic example is the language $L_k = \{ w \in \{0, 1\}^* \mid \text{the } k\text{-th symbol from the end is } 1 \}$, which requires an $n = k + 1$ state NFA but requires at least $2^k$ DFA states because the DFA must remember the entire window of the last $k$ bits. In practice, security rules rarely exhibit exponential blowup.

---

### Q7: Why do we minimize DFAs?
**Answer:**
1. **Memory efficiency:** Reduces transition table memory footprint in cache.
2. **Canonical representation:** The minimal DFA is unique up to state isomorphism (Myhill-Nerode theorem), allowing equivalence checking between two rules by checking if their minimized DFAs are isomorphic.
3. **Hardware / Diagram readability:** Minimal state count makes the Track Diagram clear and interpretable.

---

### Q8: What algorithm did you choose for minimization, and why?
**Answer:** We implemented **Hopcroft's partition refinement algorithm** ($O(|S| \cdot |\Sigma| \log |S|)$) over Moore's table-filling algorithm ($O(|S|^2 \cdot |\Sigma|)$). Hopcroft's algorithm partitions states by refining blocks using inverse transitions and a worklist, scaling efficiently to large payload automata while recording partition refinement history for visual replay.

---

### Q9: What is the Myhill-Nerode Theorem?
**Answer:** The Myhill-Nerode Theorem states that a language $L$ is regular if and only if the number of equivalence classes of the right-invariant equivalence relation $\sim_L$ is finite:
$$x \sim_L y \iff \forall z \in \Sigma^*, (xz \in L \iff yz \in L)$$
The number of states in the minimal DFA for $L$ is exactly equal to the index (number of equivalence classes) of $\sim_L$.

---

### Q10: How does Tripwire perform unanchored substring search using a DFA?
**Answer:** Standard DFA recognition tests whether the entire input string belongs to $L$ (anchored match). For payload rules (e.g. finding `UNION SELECT` in a URI), Tripwire attaches a self-loop on the universal alphabet $\Sigma$ to the NFA start state: $q_0 \xrightarrow{\Sigma} q_0$. In the resulting DFA, the start state is retained in state subsets until the pattern matches, achieving Aho-Corasick / KMP style substring matching in $O(n)$ time without string slicing.

---

### Q11: How do you handle characters outside printable ASCII?
**Answer:** In `alphabet.ts`, any non-printable ASCII or multi-byte character code maps to a sentinel `OTHER_SYMBOL` (-1). Transitions operate over canonical disjoint ranges (`CharSet`), so out-of-alphabet characters are classified into a single equivalence class without combinatorial explosion.

---

### Q12: Why are transitions stored as character sets rather than individual characters?
**Answer:** Printable ASCII has 95 characters. Storing individual transitions would create 95 separate edges between states for a wildcard `.`. Grouping into canonical intervals (e.g. `[a-z]`, `\d`, `\w`) keeps the transition table compact and produces clean, readable edge plates in the SVG diagram.

---

### Q13: How are bounded quantifiers like `F{3,}` or `F{3,5}` handled?
**Answer:** They are desugared at the AST parser stage before NFA construction:
- `{m}` becomes $m$ concatenations of the atom.
- `{m,}` becomes $m$ concatenations followed by Kleene star $A^*$.
- `{m,n}` becomes $m$ concatenations followed by $(n - m)$ optional $A^?$ copies.
This preserves the theoretical simplicity and purity of Thompson's primitive fragments.

---

### Q14: What is the difference between payload rules and sequence rules?
**Answer:**
- **Payload rules** inspect raw string content (HTTP URI, query string, User-Agent) for signature patterns (SQLi, XSS, Path Traversal).
- **Sequence rules** inspect temporal sequences of discrete events per source IP (e.g. `F F F S` = 3 failed logins followed by a success within 120 seconds) to detect behavioral attacks like brute-force or port scans.

---

### Q15: Why can't regular expressions check for balanced parentheses?
**Answer:** By the **Pumping Lemma for Regular Languages**, any regular language must have a pumping length $p$. For a string $s = (^p )^p \in L$, any division $s = xyz$ with $|xy| \le p$ and $|y| > 0$ means $y$ consists only of `(`. Pumping $y$ to $xy^2z$ produces $(^{p+|y|} )^p$, which has more `(` than `)` and is not balanced. Thus, balanced delimiters require unbounded memory to count nesting depth, which a finite state machine cannot provide.

---

### Q16: How does the Pushdown Automaton (PDA) overcome this limitation?
**Answer:** A PDA augments a finite control with an unbounded Last-In-First-Out (LIFO) stack $\Gamma^*$. When encountering an opening delimiter (`(`, `[`, `{`), it pushes the symbol onto the stack. When encountering a closing delimiter (`)`, `]`, `}`), it pops the stack and verifies that the top matches. The input is accepted iff the stack contains only the bottom marker $\$$ at end-of-string.

---

### Q17: What Chomsky hierarchy level does the PDA belong to?
**Answer:** The PDA recognizes **Context-Free Languages (Type 2)** in the Chomsky hierarchy. The hierarchy is:
- Type 3: Regular Languages (DFA / NFA)
- Type 2: Context-Free Languages (PDA)
- Type 1: Context-Sensitive Languages (Linear Bounded Automaton)
- Type 0: Recursively Enumerable Languages (Turing Machine)

---

### Q18: What is differential testing, and why did you use it?
**Answer:** Differential testing executes two independent implementations of the same specification on identical inputs and asserts that their outputs match. We tested our custom Thompson NFA simulator, subset DFA, and minimized DFA against JavaScript's native V8 `RegExp` engine on a corpus of 55 regex patterns and thousands of random and boundary strings to verify 100% equivalence.

---

### Q19: Why does `packages/engine` contain zero calls to `RegExp`?
**Answer:** Project hard constraint. The engine must demonstrate that the automata and parsing logic were constructed from scratch from first principles. Allowing native `RegExp` in the engine would allow shortcuts. Native `RegExp` is isolated strictly inside test files as a correctness oracle.

---

### Q20: What is a trap / dead state in a DFA?
**Answer:** A trap (or dead) state is a non-accepting state $q_{\text{dead}}$ where every symbol transitions back to itself:
$$\forall a \in \Sigma, \quad \delta(q_{\text{dead}}, a) = q_{\text{dead}}$$
Any transition that is undefined in a partial DFA transitions to the trap state to make the transition function total. In Tripwire, trap states are hidden by default to keep diagrams readable, with a "TRAP" toggle to inspect them.

---

### Q21: What is idempotence in minimization?
**Answer:** A function $f$ is idempotent if $f(f(x)) = f(x)$. For minimization, $\text{minimize}(\text{minimize}(D)) \equiv \text{minimize}(D)$. Minimizing an already minimal DFA performs zero partition splits and outputs an identical state and transition count.

---

### Q22: How does the sliding time window work for sequence rules?
**Answer:** Events are buffered in a per-source queue. When a new event arrives at time $t$, all events with $t_{\text{event}} < t - \Delta t$ (where $\Delta t = \text{windowSeconds}$) are evicted from the queue. The remaining events are mapped to their symbol string (e.g. `FFFS`) and evaluated by the sequence DFA.

---

### Q23: How does Tripwire report syntax errors in regular expressions?
**Answer:** The handwritten recursive descent parser tracks a 0-based character column index during lexical scanning. If an unexpected token, dangling quantifier (`*`), unclosed parenthesis (`(`), or out-of-order range (`[z-a]`) is detected, it throws `RegexSyntaxError(message, index)`. The web UI uses this index to render a red dashed underline under the exact invalid character.

---

### Q24: What is the time complexity of scanning an event stream?
**Answer:** For a log of $N$ characters and $K$ active compiled payload DFAs, the scanning time is strictly $O(N \cdot K)$. Because DFA transitions are $O(1)$ table lookups, throughput is linear with respect to log size and independent of pattern complexity.

---

### Q25: What are the primary limitations of finite automata in intrusion detection?
**Answer:**
1. **Lack of counting:** Cannot count arbitrary thresholds without adding $N$ distinct states (e.g. $F^{1000}$ requires 1000 states).
2. **Cannot verify balanced structures:** Cannot verify balanced SQL queries or XML/JSON tags without a stack (PDA).
3. **No semantic awareness:** Automata recognize syntactic patterns but cannot evaluate arithmetic conditions (e.g. `packet.length > 1500`) or database semantics.

---

### Q26: Can a DFA perform backtracking?
**Answer:** No. A DFA has no backtracking. It consumes one character per step and moves to exactly one deterministic next state. This prevents Regular Expression Denial of Service (ReDoS) attacks that plague backtracking NFA engines (such as standard PCRE).

---

### Q27: How does Dagre integrate with your Track Diagram?
**Answer:** Per project requirements, Dagre is used **exclusively to calculate $(x, y)$ coordinate positions** of states. All SVG rendering, rail paths, signal lamps, double accept rings, plates, moving token animations, and event handling are written in custom React SVG code.

---

### Q28: How does Tripwire ensure determinism in alert generation?
**Answer:**
1. Events are processed in strictly ascending line order.
2. Temporal queues use monotonically non-decreasing log timestamps.
3. Output alerts are sorted by primary key (first event line number), secondary key (rule ID), and tertiary key (source IP).
Running scan twice on identical inputs produces byte-identical JSON.
