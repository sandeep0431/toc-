# instruction.md: Tripwire technical spec

## 1. Goal
Build an automata-driven intrusion detection system. Every detection decision must come from an automaton the project built itself. The theory (NFA, DFA, minimization, optional PDA) must be visible and explainable.

## 2. Hard constraints
- **Language:** TypeScript, `strict: true`, no `any` without a comment justifying it.
- **Monorepo (npm workspaces):**
  ```
  tripwire/
    packages/engine/      pure TS, zero runtime dependencies
    apps/cli/             Node CLI (uses tsx or tsup)
    apps/web/             Vite + React + TypeScript + Tailwind
    data/                 sample logs + rules.json
    docs/                 THEORY.md, VIVA.md
    PROGRESS.md  DECISIONS.md
  ```
- **No automata or regex libraries in `packages/engine`.** The engine may not call `RegExp` or import `automata-lib` or similar. Native `RegExp` is allowed **only inside test files** as a correctness oracle, and a property-testing library such as `fast-check` is fine in tests only.
- A graph-layout library (`dagre` or `elkjs`) is allowed in `apps/web` **only to compute node positions**. All automata logic and all SVG drawing is our own code.
- Testing: `vitest`. Web: React 18+, Tailwind, no component library (no shadcn/MUI/Chakra; see `ui.md`).

## 3. Engine modules (`packages/engine/src`)

### 3.1 `alphabet.ts`
- Alphabet = printable ASCII (codes 32-126) plus `\t`. Characters outside it map to a single `OTHER` symbol.
- Transitions are stored on **character sets** (sorted ranges), not single chars, so diagrams stay readable. Provide `labelOf(set): string` that renders sets like `[a-z]`, `[^']`, `.`, `\d`.

### 3.2 `parser.ts`: regex to AST
Supported syntax (document it in `docs/THEORY.md`):
- literals, escapes (`\.` `\\` `\'` `\n` `\t`), classes `\d \w \s`, wildcard `.`
- bracket classes `[abc]`, `[a-z]`, `[^...]`
- grouping `( )`, alternation `|`
- `*`, `+`, `?`, and bounded `{m}`, `{m,}`, `{m,n}` (desugared into concatenation and `?` before NFA construction)
- Case-insensitive flag as a rule option (expands literals to `[aA]`), not as regex syntax.
- Return a typed AST and throw `RegexSyntaxError` with the character index. The web UI uses this index to underline the bad character.

### 3.3 `nfa.ts`: Thompson's construction
- `buildNFA(ast): NFA` with ε-transitions, one start state, one accept state per fragment, final NFA has a single accept state.
- State ids are integers allocated in construction order. Keep a `provenance` note per state (which AST node created it) so the UI can explain it.

### 3.4 `dfa.ts`: subset construction
- `toDFA(nfa, { unanchored }): DFA`. ε-closure and `move` implemented by hand.
- Each DFA state records its `nfaStates: number[]` so the UI can show "this DFA state = {q2, q5, q7}".
- `unanchored: true` models substring search by treating the start as having a self-loop on every symbol (equivalent to prefixing `Σ*`). Payload rules use this mode.
- Record **construction steps** (`steps: SubsetStep[]`) so the UI can replay "closure, move, new state discovered".
- Add a dead state only when needed; hide it from diagrams by default with a toggle.

### 3.5 `minimize.ts`
- Hopcroft partition refinement or table-filling (pick one, say why in `DECISIONS.md`).
- Return the minimized DFA plus `partitions: number[][]` history so the UI can animate merges.
- Property to hold: for every rule, `accepts(minDFA, s) === accepts(dfa, s)` for all `s`.

### 3.6 `matcher.ts`
- `run(dfa, input): Trace` returns `{ states: number[], accepted: boolean, firstAcceptIndex: number | null }`. Keep per-character state history; the UI step-through reads it.
- Detection means "reaches an accepting state at any position" for unanchored DFAs. Report the index where it first accepted.

### 3.7 Event layer (`events.ts`, `normalize.ts`)
Raw log line becomes `Event { ts, source, kind, symbol, raw, fields }`.

| Symbol | Meaning | Example source line |
|---|---|---|
| `F` | failed login | `Failed password for root from 10.0.0.5` |
| `S` | successful login | `Accepted password for admin from 10.0.0.5` |
| `P` | port probe / connection refused or SYN-only | firewall log line |
| `R` | web request, 2xx/3xx | access log |
| `E` | web request, 4xx/5xx | access log |
| `X` | web request whose path/query matched a payload rule | derived |

Provide parsers for **OpenSSH auth.log** and **Apache/Nginx combined access log**. Unknown lines are skipped and counted, never crash.

### 3.8 Rules (`rules.ts`, JSON in `data/rules.json`)
```json
{
  "id": "BRUTE-01",
  "name": "SSH brute force then success",
  "kind": "sequence",
  "pattern": "F{3,}S",
  "groupBy": "source",
  "windowSeconds": 120,
  "severity": "high",
  "explain": "Three or more failures from one source followed by a success."
}
```
- `kind: "payload"`: regex run over a raw field (`path`, `query`, `userAgent`).
- `kind: "sequence"`: regex run over the per-source symbol string, `windowSeconds` limits how far back events count.
- Ship at least these rules: brute force, password spray (`F{10,}`), port scan (`P{5,}`), SQL injection (tautology, `UNION SELECT`, comment terminator), path traversal (`(\.\./){2,}` and URL-encoded forms), XSS (`<script`, `onerror=`), scanner user agents.
- Validate rules on load; report errors with rule id and character index.

### 3.9 Optional PDA (`pda.ts`), only after Phase 5 is green
- Balanced delimiter checker for `( ) [ ] { } ' "` with an explicit stack trace.
- Used by one rule: "unbalanced quote or bracket in a query value" to show a language a DFA cannot recognize.
- UI shows the stack growing and shrinking.

### 3.10 `detect.ts`
`scan(events, rules): Alert[]`. An `Alert` contains rule id, severity, source, line number(s), the matched substring or symbol window, and the **state path** (DFA state ids visited). Must be deterministic: same input gives byte-identical JSON output.

## 4. Data
- `data/auth.sample.log`, `data/access.sample.log`: small, hand-checkable, include benign noise and every attack type.
- `scripts/gen-logs.ts`: seeded generator (fixed seed) for larger demo files. Never random without a seed.

## 5. CLI behavior
```
tripwire scan <file> [--rules rules.json] [--format table|json] [--explain]
tripwire compile "<regex>" [--dot out.dot] [--stats]
tripwire rules lint rules.json
```
- `compile --stats` prints state counts for NFA, DFA and minimized DFA.
- `--explain` prints the state path for each alert.
- Exit code 0 means no alerts, 1 means alerts found, 2 means error.

## 6. Testing (non-negotiable)
- **Differential fuzz:** for every regex in a corpus of at least 50 patterns, generate 10,000 seeded random strings and assert `engine.accepts === new RegExp(...).test(...)` for NFA simulation, DFA, and minimized DFA.
- **Known results:** `(a|b)*abb` minimizes to exactly 4 states. `a(b|c)*d` and `(0|1)*1(0|1)` have documented state counts; assert them.
- Subset-construction test on the textbook NFA for `(a|b)*abb` checks the exact set of NFA-state-sets.
- Minimization is idempotent: minimizing twice changes nothing.
- Each sample log has a golden file of expected alerts; CLI and web must both match it.
- Test names read like theorems, e.g. `"minimized DFA accepts the same language as the DFA"`.

## 7. Code style
- Small pure functions, no classes unless a data structure needs one. No global mutable state.
- Every public function has a one-line doc comment naming the theory concept.
- No dead code, no commented-out blocks, no TODOs left at the end of a phase.

## 8. Do not
- Do not use any automata/regex library in the engine.
- Do not hard-code attack strings into detection logic; everything comes from rules.
- Do not fake results in the UI. Every diagram and every trace comes from real engine output.
- Do not add a backend. The website runs the engine in the browser.
- Do not move to the next phase with failing tests.

## 9. Definition of done
Engine tests green, CLI and web produce identical alerts for both sample logs, minimization demonstrably reduces state counts on at least 3 rules, `docs/THEORY.md` and `docs/VIVA.md` written, website deployed to Vercel.
