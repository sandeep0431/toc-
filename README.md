# Tripwire — Automata-Driven Intrusion Detection System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-56%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Zero-Dependency](https://img.shields.io/badge/Engine-Zero%20Runtime%20Dependencies-success.svg)]()
[![Theory](https://img.shields.io/badge/Theory-TOC%20Course%20Project-orange.svg)]()

> **Tripwire** is an automata-driven intrusion detection system (IDS) built from first principles for a Theory of Computation (TOC) course project. All detection decisions originate from finite automata built from scratch in pure TypeScript without external regex or automata libraries.

---

## 🚉 The Signal Box Metaphor

Tripwire's user interface is styled as a **railway signal-box interlocking board**:
- **Automaton States** are signal lamps with brass bezels.
- **Input Characters / Events** are trains travelling along transition rails.
- **Intrusions** trip the signal lamp from amber to vermilion red with a stamped **TRIPPED** register entry.

---

## 📐 Formal Theory Architecture

```
Regular Expression R
        │ (parser.ts - LL(1) recursive descent)
        ▼
    Typed AST (with column-indexed syntax errors)
        │ (nfa.ts - Thompson's construction)
        ▼
   ε-NFA Fragment (one start state, one accept state)
        │ (dfa.ts - Rabin-Scott subset construction)
        ▼
      DFA (deterministic subsets, unanchored Σ* self-loops)
        │ (minimize.ts - Hopcroft partition refinement)
        ▼
   Minimal DFA (canonical minimal state count)
        │ (detect.ts / matcher.ts)
        ▼
 Deterministic Alert Stream (with exact state paths q0 → q1 → ...)
```

- **Alphabet Algebra (`alphabet.ts`):** Canonical disjoint inclusive ranges (`CharSet`) partitioning $\Sigma$ into atomic intervals.
- **Thompson's Construction (`nfa.ts`):** Compiles AST into $\epsilon$-NFA with guaranteed fragment isolation.
- **Subset Construction (`dfa.ts`):** Powerset expansion with $\epsilon$-closure and unanchored payload scanning.
- **Hopcroft Minimization (`minimize.ts`):** $O(|S| \cdot |\Sigma| \log |S|)$ partition refinement producing canonical minimal DFAs.
- **Pushdown Automaton (`pda.ts`):** Deterministic PDA with explicit stack $\Gamma^*$ demonstrating non-regular balanced Dyck delimiter checking.

---

## 📂 Monorepo Structure

```text
tripwire/
├── packages/
│   └── engine/             # Pure TypeScript engine, ZERO external runtime dependencies
│       ├── src/
│       │   ├── alphabet.ts # Disjoint character set algebra & alphabet definitions
│       │   ├── parser.ts   # Regex to AST with character error indices
│       │   ├── nfa.ts      # Thompson's construction and NFA simulator
│       │   ├── dfa.ts      # Subset construction & unanchored payload scanner
│       │   ├── minimize.ts # Hopcroft's partition refinement algorithm
│       │   ├── events.ts   # Event definitions & classification symbols
│       │   ├── normalize.ts# Zero-RegExp log normalizers (auth.log, access.log)
│       │   ├── rules.ts    # Rule schema validation & DFA compiler
│       │   ├── matcher.ts  # Automaton trace execution
│       │   ├── detect.ts   # Multi-rule sliding-window detection engine
│       │   └── pda.ts      # Pushdown Automaton for balanced delimiters
│       └── test/           # Differential fuzzing (55 patterns) & golden tests
├── apps/
│   ├── cli/                # Node.js command-line interface (scan, compile, rules lint)
│   └── web/                # Vite + React 18 + Tailwind Signal Box Web UI
├── data/                   # Sample logs, ruleset, and golden alert fixtures
├── docs/
│   ├── THEORY.md           # Formal mathematical explanations & complexity analysis
│   └── VIVA.md             # 28 examiner defense questions and answers
├── scripts/                # Seeded synthetic log generator & compile stats
├── PROGRESS.md             # Phase-by-phase implementation log
└── DECISIONS.md            # Architecture decision records
```

---

## 🚀 Running Commands

### 1. Installation & Build

```bash
# Install dependencies across all workspaces
npm install

# Run complete test suite (56 tests across 13 test files)
npm test

# Build all packages (engine, CLI, web)
npm run build
```

---

### 2. Node CLI Tool (`@tripwire/cli`)

Run the CLI using `npx tsx` or via npm script:

#### A. Scan a Log File with State Path Explanations
```bash
# Scan OpenSSH auth log and print visited state paths
npx tsx apps/cli/src/index.ts scan data/auth.sample.log --explain

# Scan web access log and output formatted JSON alerts
npx tsx apps/cli/src/index.ts scan data/access.sample.log --format json
```

#### B. Compile Regular Expressions & Inspect Automata Statistics
```bash
# Print state counts for Thompson NFA -> Subset DFA -> Hopcroft Minimized DFA
npx tsx apps/cli/src/index.ts compile "(a|b)*abb" --stats

# Export compiled minimal DFA to Graphviz DOT format
npx tsx apps/cli/src/index.ts compile "(a|b)*abb" --dot automata.dot
```

#### C. Lint Rule Definitions
```bash
# Validate ruleset syntax and schema
npx tsx apps/cli/src/index.ts rules lint data/rules.json
```

---

### 3. Web Application (`@tripwire/web`)

Start the interactive Signal Box control desk:

```bash
npm run dev
# Open http://localhost:5173/ in your browser
```

#### Key Interface Features:
- **Rule Book (Left):** Stamped ledger rows (`[H]`, `[M]`, `[L]`), punched label regex editor with live error index underlining, and `+ NEW` custom rule modal.
- **Track Diagram (Center):** Custom SVG railway diagram positioned with Dagre. Features brass signal lamps, transition rails with midpoint plates, pan/zoom controls, and `TRAP` state toggle.
- **Stage Switcher & Odometer Strip:** Switch between **REGEX · NFA · DFA · MIN-DFA** with real-time state count progression (`NFA 14 → DFA 9 → MIN 6`).
- **Event Tape (Right):** Perforated paper tape with optical reading head, symbol gutters (`F`, `S`, `P`, `R`, `E`), sample selector, and paste/drop zone.
- **Interlocking Controls:** **[STEP]**, **[RUN / PAUSE]**, **[RESET]**, and speed dial (1x, 2x, 5x, 20x).
- **Alert Register (Bottom):** Expandable stamped ledger of alerts. Click any alert to rewind the tape and replay the exact state path through the automaton!
- **PDA Stack Visualizer:** Click **PDA STACK** in the top header to inspect the Pushdown Automaton evaluating balanced Dyck language delimiters.
- **Daylight Toggle:** Click `◐ DAYLIGHT` for high-contrast presentation mode.

---

### 4. Deploying to GitHub Pages 🌐

The project is fully pre-configured for GitHub Pages:

#### Method A: Automated Deployment via GitHub Actions (Recommended)
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. On GitHub, go to your repository **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your site!

#### Method B: Manual Deploy using `gh-pages`
```bash
# Builds the web application and pushes apps/web/dist to the gh-pages branch
npm run deploy
```

---

### 5. Helper Scripts

```bash
# Display automata compilation statistics across classical and security patterns
npx tsx scripts/compile-stats.ts

# Generate deterministic seeded synthetic log files
npx tsx scripts/gen-logs.ts
```

---

## 📊 State Minimization Proofs

Hopcroft's minimization demonstrably reduces state counts on both formal textbook benchmarks and production IDS signatures:

| Pattern | Theory / Purpose | NFA States | DFA States | Min-DFA States | State Reduction |
|---|---|---|---|---|---|
| `(a\|b)*abb` | Textbook golden benchmark | 14 | 5 | **4** | **20%** |
| `a(b\|c)*d` | Multi-branch alternation | 12 | 5 | **3** | **40%** |
| `(0\|1)*1(0\|1)` | Suffix bit-window | 16 | 5 | **4** | **20%** |
| `F{3,}S` | SSH brute-force threshold | 12 | 6 | **5** | **17%** |
| `GET /.* HTTP` | Web request scanner | 24 | 12 | **11** | **8%** |

---

## 📖 Theoretical Documentation & Viva Defense

- **[`docs/THEORY.md`](file:///c:/Users/kumar/OneDrive/Desktop/toc%20project%202/docs/THEORY.md):** Complete mathematical proofs, inductive base/step definitions, complexity analyses, and worked examples.
- **[`docs/VIVA.md`](file:///c:/Users/kumar/OneDrive/Desktop/toc%20project%202/docs/VIVA.md):** 28 comprehensive examination questions and model answers covering Pumping Lemma, DFA vs NFA, Myhill-Nerode, and Chomsky Hierarchy limits.
- **[`PROGRESS.md`](file:///c:/Users/kumar/OneDrive/Desktop/toc%20project%202/PROGRESS.md):** Phase-by-phase implementation log.
- **[`DECISIONS.md`](file:///c:/Users/kumar/OneDrive/Desktop/toc%20project%202/DECISIONS.md):** Architectural decision records.
