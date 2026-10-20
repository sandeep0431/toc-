# Architecture & Engineering Decisions

This document records key design and theoretical decisions made during the construction of Tripwire.

## Decision Log

### 1. Monorepo Structure & TypeScript Setup
- **Decision:** Use native npm workspaces with strict TypeScript (`strict: true`, `noImplicitAny: true`, `isolatedModules: true`).
- **Rationale:** Keeps dependencies clean and avoids workspace hoisting friction while guaranteeing strict type safety across engine, CLI, and web.

### 2. Disjoint Character Set Representation in `alphabet.ts`
- **Decision:** Alphabet covers printable ASCII (codes 32–126), `\t` (code 9), and a designated `OTHER` symbol (-1). Transitions store sorted disjoint inclusive ranges `[start, end]`.
- **Rationale:** Preserves graph readability by merging adjacent characters into single edge labels (e.g. `[a-z]`, `\d`) and handles arbitrary binary/non-ASCII safely without combinatorial explosion.

### 3. Parser AST & Quantifier Desugaring
- **Decision:** Desugar bounded quantifiers `{m}`, `{m,}`, `{m,n}` at the AST stage into sequences of concatenation and `?` operators before feeding into Thompson's NFA construction.
- **Rationale:** Keeps Thompson's NFA construction primitive and theoretically pure (base fragments: literal, concat, union, star) while fully supporting practical regex features required by IDS rules.

### 4. Minimization Algorithm Selection
- **Decision:** Hopcroft's partition refinement algorithm $O(s \cdot |\Sigma| \log s)$ over table-filling (Myhill-Nerode Moore) algorithm $O(s^2 \cdot |\Sigma|)$.
- **Rationale:** Superior computational complexity on larger payload automata; provides a partition refinement history that maps directly to the web UI's "Show merges" visualizer.

### 5. Atomic Alphabet Partitioning for Subset Construction
- **Decision:** Partition $\Sigma$ using the boundary points of all transitions in the NFA into elementary disjoint intervals.
- **Rationale:** Guarantees that outgoing transitions from DFA states are strictly deterministic and pairwise disjoint, while allowing parallel edges to be merged cleanly via `charSetUnion` into legible edge plates (`[a-z]`, `\d`, etc.).

### 6. Unanchored Matching & Trace Semantics
- **Decision:** Implement unanchored search by attaching a universal self-loop to the start state, and declaring detection as `firstAcceptIndex !== null` (the automaton reached an accepting state at any point along the input string).
- **Rationale:** Conforms directly to Section 3.6 of `instruction.md` and standard Aho-Corasick / lexical scanner theory without needing ad-hoc string slicing.

### 7. Zero-RegExp Log Normalizers in `packages/engine`
- **Decision:** Parse OpenSSH `auth.log` and Apache/Nginx combined access log lines using pure string boundary scanning (`indexOf`, `substring`, custom whitespace splitting) rather than regular expressions.
- **Rationale:** Strictly enforces the project's hard constraint that `packages/engine` has zero dependency on regex engines, ensuring all pattern matching is performed exclusively by our custom finite automata.

### 8. Sliding-Window Temporal Sequence Evaluation
- **Decision:** Maintain a per-source event history queue bounded by `windowSeconds` ($t_{\text{current}} - t_{\text{event}} \le \Delta t$). Sequence DFAs evaluate the concatenated symbolic stream (e.g. `FFFS`). Upon firing an alert, the matching history is reset to prevent redundant duplicate alerts on future events.
- **Rationale:** Matches stateful IDS semantics (such as Snort/Suricata thresholding) while mapping directly to standard DFA word recognition.
