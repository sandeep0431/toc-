# MASTER PROMPT: Tripwire (paste this into Antigravity)

You are a senior engineer building **Tripwire**, an automata-driven intrusion detection system, as a Theory of Computation (TOC) course project. The project is graded on how clearly it demonstrates automata theory, so the theory must be visible in the code, the UI and the docs.

## What Tripwire is
Tripwire reads security logs (SSH auth logs, web server access logs), turns them into symbols, and uses **finite automata built from scratch** to detect attacks:
- Payload rules: a regex is compiled **regex → NFA (Thompson) → DFA (subset construction) → minimized DFA**, then scanned over raw request strings (SQL injection, path traversal, XSS).
- Sequence rules: per-source-IP event streams (e.g. `F F F S` = three failed logins then a success) are matched by a DFA to catch brute force and port scans.
- Optional: a small pushdown automaton (PDA) for balanced-delimiter checks, to show where a DFA is not enough.

It ships as **one TypeScript engine used by two front-ends**: a Node CLI and a React website that visualizes every automaton and lets you step through detection.

## Files you must read before writing any code
1. `instruction.md`: the technical spec, constraints, module layout, testing rules, definition of done.
2. `workflow.md`: the phase-by-phase plan. Follow it in order and stop at each checkpoint.
3. `ui.md`: the visual and interaction design for the website. It is deliberately specific; do not fall back on generic dashboard styling.

If any two files conflict, `instruction.md` wins on engine behavior and `ui.md` wins on anything visual.

## How to work
- Start in **Planning mode**. Produce an implementation plan artifact for Phase 0 and Phase 1 only, then wait for my approval before coding.
- Work **one phase at a time**. At the end of each phase: run the tests, show me the results, commit, update `PROGRESS.md`, and stop.
- Never use an automata or regex library inside `packages/engine`. Native `RegExp` is allowed **only in tests** as a correctness oracle.
- Every theory-heavy function gets a short comment naming the construction it implements (e.g. "Thompson's construction", "subset construction", "Hopcroft partition refinement").
- When something is ambiguous, pick the simplest option that satisfies `instruction.md`, note it in `DECISIONS.md`, and keep going. Ask me only if the choice would be expensive to undo.
- Use the browser agent to open the website after each UI phase and verify against `ui.md`; attach screenshots to your report.

## Definition of done
All phases in `workflow.md` complete, tests green, CLI and website both detect all sample attacks with identical results, `docs/THEORY.md` written, and the website deployed to Vercel with a shareable link.

Begin now with Phase 0.
