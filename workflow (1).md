# workflow.md: Tripwire build workflow

Work in phases. Finish one phase completely, run its checks, commit, update `PROGRESS.md`, then **stop and report** before starting the next. Use Planning mode at the start of each phase and keep the implementation plan short.

## Antigravity working rules
- Open the repo as the workspace. Keep the three spec files at the repo root, and re-read them at the start of every phase.
- Plan first, then code. For each phase, post a plan artifact (files to create, tests to write) and wait for approval.
- Run tests in the terminal yourself and paste the summary line into your report.
- For UI phases, use the browser agent to load `localhost`, take screenshots at 1440px and 390px widths, and compare them against `ui.md`.
- One commit per phase, message format: `phase N: <what works now>`.
- If a decision isn't covered, choose the simplest option, log it in `DECISIONS.md`, and continue.

## Phase 0: Scaffold (30 min)
- Create the monorepo from `instruction.md` section 2: workspaces, tsconfig base, vitest, eslint, prettier.
- Create empty `PROGRESS.md`, `DECISIONS.md`, `docs/THEORY.md`, `docs/VIVA.md`.
- **Done when:** `npm test` runs (even with one placeholder test) and `npm run build` succeeds in all three workspaces.

## Phase 1: Regex parser and NFA
- `alphabet.ts`, `parser.ts`, `nfa.ts` with an NFA simulator (for testing only).
- **Tests:** parser accepts and rejects the right syntax and reports error indexes; NFA simulation matches `RegExp` on the fuzz corpus.
- **Done when:** differential fuzz passes for NFA on at least 50 patterns.

## Phase 2: Subset construction and minimization
- `dfa.ts` with recorded construction steps and `nfaStates` per DFA state, then `minimize.ts` with partition history.
- **Tests:** `(a|b)*abb` gives 4 minimal states, subset-construction golden test, minimization idempotence, fuzz equivalence for DFA and min-DFA.
- **Done when:** all engine tests green and `compile --stats` style numbers are printable from a script.

## Phase 3: Events, rules, detection
- `normalize.ts` for auth.log and access log, `rules.ts` with validation, `matcher.ts`, `detect.ts`.
- Write `data/*.sample.log`, `data/rules.json`, and golden alert files.
- **Tests:** golden-file detection tests, windowing tests for sequence rules, determinism test (run twice, compare JSON).
- **Done when:** every attack in the sample logs is detected and no benign line raises an alert.

## Phase 4: CLI
- Implement `scan`, `compile`, `rules lint` per `instruction.md` section 5.
- **Done when:** `tripwire scan data/auth.sample.log --explain` prints alerts with state paths and the exit codes behave.

## Phase 5: Website (read `ui.md` first)
Build in this order, checking in with screenshots after 5c and 5f:
- 5a. Design tokens, fonts, layout shell (the control desk), empty states.
- 5b. Rule Book panel with live regex validation and error underlining.
- 5c. Track Diagram renderer (SVG) for NFA, DFA, minimized DFA, with the stage switcher and state-count counters.
- 5d. Event Tape with log loading, sample selector, and highlighting.
- 5e. Step-through engine: STEP, RUN, RESET, speed dial, the moving token, lamp changes.
- 5f. Alert Register, with click-to-jump to the tape line and the state path replay.
- 5g. Subset-construction replay and minimization-merge animation.
- **Done when:** a first-time visitor can load a sample, press RUN, and see an alert trip without reading instructions, and the web alerts equal the golden files.

## Phase 6: Optional PDA
- `pda.ts`, the stack visualizer in the UI, and one rule that uses it. Skip if time is short.

## Phase 7: Docs, polish, deploy
- `docs/THEORY.md`: for each construction, a plain-language explanation, a worked example using one of our real rules, and the complexity (e.g. subset construction can blow up to 2^n states).
- `docs/VIVA.md`: at least 25 likely examiner questions with short answers (NFA vs DFA, why minimize, what ε-closure is, why regex ≠ all languages, where a PDA is needed, limits of this IDS).
- Accessibility and reduced-motion pass, mobile pass at 390px, empty and error states.
- Deploy `apps/web` to Vercel and add the link to `README.md`.
- **Done when:** the `instruction.md` definition of done is satisfied.

## Report format after every phase
1. What now works (2-3 lines).
2. Test summary line.
3. Screenshots (UI phases).
4. Decisions made.
5. What the next phase will do.
