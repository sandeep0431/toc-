# Tripwire Automata Theory Documentation

Tripwire is an automata-driven intrusion detection system (IDS) built from first principles in pure TypeScript. It implements the core constructions of formal language and automata theory without external regex or automata libraries:

1. **Disjoint Character Set Algebra** ($\Sigma$ partitioned into atomic interval minterms)
2. **Thompson's $\epsilon$-NFA Construction** (Regex AST $\to$ $\epsilon$-NFA)
3. **Rabin-Scott Subset Construction** ($\epsilon$-NFA $\to$ DFA with unanchored scanning)
4. **Hopcroft's Partition Refinement Algorithm** (DFA $\to$ Minimal DFA in $O(|S| \cdot |\Sigma| \log |S|)$)
5. **Deterministic Pushdown Automaton (PDA)** (Dyck language for balanced delimiter verification)

---

## 1. Alphabet & Character Set Algebra (`alphabet.ts`)

### Formal Definition
An alphabet $\Sigma$ is a non-empty finite set of symbols. In Tripwire:
$$\Sigma = \{ c \in \mathbb{N} \mid (32 \le c \le 126) \lor c = 9 \lor c = -1 \}$$
- Codes $32 \dots 126$: Printable ASCII (characters `' '` through `'~'`)
- Code $9$: Horizontal tab (`\t`)
- Code $-1$: `OTHER` sentinel representing any non-printable ASCII or multi-byte Unicode sequence.

### Disjoint Canonical Character Sets (`CharSet`)
Transitions in automata are stored on sorted, pairwise disjoint, non-adjacent inclusive ranges $[s_i, e_i]$:
$$C = \bigcup_{i=1}^k [s_i, e_i], \quad \text{where } e_i + 1 < s_{i+1}$$
This enables exact set operations:
- **Union:** $A \cup B$ via interval sweep line merging.
- **Intersection:** $A \cap B$ via two-pointer boundary clipping.
- **Complement:** $\Sigma \setminus A$ relative to the universal alphabet set $\Sigma$.
- **Labeling:** $A$ renders as readable edge plates: `[a-z]`, `\d`, `\w`, `\s`, `.`, `[^']`, or single literals.

---

## 2. Thompson's Construction (`parser.ts` & `nfa.ts`)

### Theorem (Thompson, 1968)
Every regular expression $R$ over alphabet $\Sigma$ can be compiled into an equivalent Non-deterministic Finite Automaton with $\epsilon$-transitions ($\epsilon$-NFA) $N$ such that $L(N) = L(R)$, with:
- Exactly **one start state** $q_0$ and **one accept state** $q_f$.
- No transitions entering $q_0$ from outside the fragment.
- No transitions exiting $q_f$ to outside the fragment.
- Number of states $|S| \le 2 \cdot |R|$, and transitions $|T| \le 4 \cdot |R|$.

### Inductive Base Cases and Inductive Steps
1. **Base Literal $a \in \Sigma$:**
   $$q_0 \xrightarrow{a} q_f$$
2. **Base Empty $\epsilon$:**
   $$q_0 \xrightarrow{\epsilon} q_f$$
3. **Concatenation $R_1 \cdot R_2$:**
   Connect accept of $N_1$ to start of $N_2$ via $\epsilon$:
   $$q_{f1} \xrightarrow{\epsilon} q_{02}$$
   Start is $q_{01}$, accept is $q_{f2}$.
4. **Alternation $R_1 \mid R_2$:**
   Create new start $q_0$ and accept $q_f$:
   $$q_0 \xrightarrow{\epsilon} q_{01}, \quad q_0 \xrightarrow{\epsilon} q_{02}, \quad q_{f1} \xrightarrow{\epsilon} q_f, \quad q_{f2} \xrightarrow{\epsilon} q_f$$
5. **Kleene Star $R_1^*$:**
   Create new start $q_0$ and accept $q_f$:
   $$q_0 \xrightarrow{\epsilon} q_f \text{ (zero occurrences)}, \quad q_0 \xrightarrow{\epsilon} q_{01}, \quad q_{f1} \xrightarrow{\epsilon} q_{01} \text{ (loopback)}, \quad q_{f1} \xrightarrow{\epsilon} q_f$$

### Worked Example: `F{3,}S` (SSH Brute Force Rule)
- Desugared into: $F \cdot F \cdot F \cdot F^* \cdot S$
- States: 12 NFA states.
- Traces 3 required failures, arbitrary additional failures, terminating in successful login symbol $S$.

---

## 3. Rabin-Scott Subset Construction (`dfa.ts`)

### Theorem (Rabin & Scott, 1959)
For every NFA $N = (Q_N, \Sigma, \delta_N, q_0, F_N)$, there exists an equivalent DFA $D = (Q_D, \Sigma, \delta_D, q_{0D}, F_D)$ recognizing the exact same language:
$$L(D) = L(N)$$
Each DFA state $S \in Q_D$ is a subset of NFA states ($S \subseteq Q_N$).

### Algorithm
1. $\epsilon\text{-closure}(T)$:
   $$\epsilon\text{-closure}(T) = T \cup \{ q \in Q_N \mid \exists p \in \epsilon\text{-closure}(T) \text{ with } q \in \delta_N(p, \epsilon) \}$$
2. Initial State:
   $$q_{0D} = \epsilon\text{-closure}(\{ q_{0N} \})$$
3. Transition Function:
   $$\delta_D(S, a) = \epsilon\text{-closure}\left( \bigcup_{p \in S} \delta_N(p, a) \right)$$
4. Accepting States:
   $$F_D = \{ S \in Q_D \mid S \cap F_N \neq \emptyset \}$$

### Substring / Unanchored Payload Scanning
To detect intrusion payloads embedded anywhere within raw HTTP requests (e.g. `UNION SELECT` inside `/products?id=1 UNION SELECT ...`), the start state is augmented with a universal self-loop:
$$\forall a \in \Sigma, \quad q_{0N} \xrightarrow{a} q_{0N}$$
This simulates prefixing $\Sigma^*$ to the language, enabling the DFA to scan streams in a single linear pass ($O(n)$ time) without backtracking.

---

## 4. Hopcroft's DFA Minimization (`minimize.ts`)

### Theorem (Myhill-Nerode & Hopcroft, 1971)
Every regular language $L$ has a unique (up to state isomorphism) minimal DFA with the smallest possible number of states. Hopcroft's partition refinement algorithm computes this minimal DFA in $O(|S| \cdot |\Sigma| \log |S|)$ time.

### Algorithm
1. **Initial Partition:**
   $$P = \{ F, Q \setminus F \}$$
   Separate accepting states $F$ from non-accepting states $Q \setminus F$.
2. **Worklist Refinement:**
   Maintain worklist $W \subseteq P$.
   While $W \neq \emptyset$:
   - Choose and remove $A \in W$.
   - For each input character class $c \in \Sigma$:
     - Let $X = \{ q \in Q \mid \delta(q, c) \in A \}$.
     - For each block $B \in P$ such that $B \cap X \neq \emptyset$ and $B \setminus X \neq \emptyset$:
       - Replace $B$ in $P$ with $B_1 = B \cap X$ and $B_2 = B \setminus X$.
       - If $B \in W$, replace $B$ with $B_1$ and $B_2$.
       - Otherwise, add the smaller of $B_1, B_2$ to $W$.
3. **Partition Convergence:**
   When no further blocks can be split, each equivalence class $[q] \in P$ becomes a single state in the minimal DFA.

### Proof of Idempotence
For any DFA $D$:
$$\text{minimize}(\text{minimize}(D)) \cong \text{minimize}(D)$$
Because the state equivalence relation $p \sim q \iff \forall w \in \Sigma^* (\delta^*(p, w) \in F \iff \delta^*(q, w) \in F)$ is an equivalence relation, applying the refinement to an already coarsest partition performs zero splits.

### Benchmark State Reductions in Tripwire
| Pattern | NFA States | DFA States | Min-DFA States | State Reduction |
|---|---|---|---|---|
| `(a\|b)*abb` | 14 | 5 | 4 | **20%** |
| `a(b\|c)*d` | 12 | 5 | 3 | **40%** |
| `(0\|1)*1(0\|1)` | 16 | 5 | 4 | **20%** |
| `F{3,}S` | 12 | 6 | 5 | **17%** |
| `GET /.* HTTP` | 24 | 12 | 11 | **8%** |

---

## 5. Pushdown Automaton (PDA) & Context-Free Languages (`pda.ts`)

### Why Finite Automata Are Insufficient
By the Pumping Lemma for Regular Languages, the language of balanced nested parentheses:
$$L_{\text{Dyck}} = \{ w \in \{(, )\}* \mid w \text{ is balanced} \}$$
is **not regular**. A finite automaton has only a finite number of states $k$. If input $(^m$ has $m > k$, the Pigeonhole Principle forces a loop on `(`, making the machine unable to count the exact number of matching `)`.

### Pushdown Automaton Formal Specification
A PDA is defined as:
$$M = (Q, \Sigma, \Gamma, \delta, q_0, Z_0, F)$$
- States $Q = \{ q_{\text{scan}}, q_{\text{accept}}, q_{\text{error}} \}$
- Input alphabet $\Sigma$: Printable ASCII
- Stack alphabet $\Gamma = \{ (, [, \{, ', ", \$ \}$
- Initial stack bottom marker $Z_0 = \$$
- Stack Transition Function $\delta$:
  - Opening delimiters: $\delta(q_{\text{scan}}, \text{'(', } \gamma) = (q_{\text{scan}}, \text{'(} \gamma)$ (PUSH)
  - Matching closing delimiter: $\delta(q_{\text{scan}}, \text{')', '('}) = (q_{\text{scan}}, \epsilon)$ (POP)
  - Mismatched delimiter: $\delta(q_{\text{scan}}, \text{']', '('}) = (q_{\text{error}}, \dots)$ (REJECT)
  - End of input: Accept iff stack contains only $\$$ (ACCEPT BY EMPTY/BOTTOM STACK).

---

## 6. Time and Space Complexity Summary

| Phase / Construction | Algorithm | Time Complexity | Space Complexity |
|---|---|---|---|
| **Lexing & Parsing** | LL(1) Recursive Descent | $O(|R|)$ | $O(|R|)$ AST nodes |
| **NFA Construction** | Thompson's Construction | $O(|R|)$ | $\le 2|R|$ states, $\le 4|R|$ transitions |
| **DFA Conversion** | Subset Construction | $O(2^{|S_{\text{NFA}}|} \cdot |\Sigma|)$ worst case; $O(|S_{\text{NFA}}|)$ typical | $\le 2^{|S_{\text{NFA}}|}$ states |
| **DFA Minimization** | Hopcroft's Partition Refinement | $O(|S_{\text{DFA}}| \cdot |\Sigma| \log |S_{\text{DFA}}|)$ | $O(|S_{\text{DFA}}| \cdot |\Sigma|)$ |
| **Stream Scanning** | DFA Table Lookup | $O(1)$ per char; $O(N)$ for string length $N$ | $O(1)$ dynamic memory |
| **PDA Verification** | Pushdown Stack | $O(N)$ for string length $N$ | $O(D)$ where $D$ is max nesting depth |
