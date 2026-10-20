# ui.md: Tripwire website design

## Concept: the signal box
Tripwire's interface is a **railway signal-box interlocking board**. Automaton states are signal lamps on a track diagram, input characters are trains running along the rails, and an alert is a lamp tripping from amber to red with a stamped register entry. This is the one idea the whole UI is built on. It suits the topic (finite states, transitions, a token moving through a machine) and keeps the site from looking like a generic security dashboard.

## Anti-generic rules (hard)
Never use: purple/blue gradients, glassmorphism, neon-cyan "hacker" green-on-black, matrix rain, shield or padlock icons, Inter/Roboto/system-ui as the main face, rounded-everything cards with drop shadows, emoji, or a hero banner with a stock illustration. No generic KPI tiles ("1,204 threats blocked"). Do not invent fake statistics; every number on screen comes from real engine output.

## Design tokens
```css
:root {
  --board:        #0E1916;  /* signal-box panel, deep green-black */
  --board-raised: #14231F;
  --track:        #2F4A41;  /* rails, borders */
  --track-dim:    #223630;
  --paper:        #E9E4D2;  /* text, tape paper tint */
  --paper-dim:    #A8A592;
  --lamp-amber:   #FFB000;  /* active / in progress */
  --lamp-green:   #7DF0B0;  /* accepting state, safe */
  --lamp-red:     #FF4D2E;  /* alert tripped */
  --ink-on-paper: #1B1A14;  /* text on the paper tape */
  --tape:         #EFE9D6;  /* event tape background */
  --radius: 2px;            /* square, industrial */
}
```
Light theme: not required. Offer a single high-contrast "daylight" toggle that swaps `--board` to `#EFEAD8` and `--paper` to `#1B1A14`, keeping the lamp colors.

**Type**
- Headings and plaque labels: **Fraunces** (variable, weight 600, slightly soft) in small caps for panel titles.
- All data, code, regex, log lines: **IBM Plex Mono**.
- Never mix in a third face. Body copy is rare; keep it to 14-15px Plex Mono or Fraunces 15px.

**Texture:** panel edges use a 1px `--track` border with a small inner bevel, rivet dots in panel corners (CSS radial-gradient, 3px), and a very faint 2% noise on `--board`. Nothing glossy.

## Layout: the control desk (desktop 1280px and up)
```
+--------------------------------------------------------------------------+
| TRIPWIRE   ▸ Rule Book   Track Diagram   Event Tape        [daylight] [?]|
+------------------+-----------------------------------+-------------------+
| RULE BOOK        |  TRACK DIAGRAM                    | EVENT TAPE        |
| ledger of rules  |  stage: REGEX | NFA | DFA | MIN   | paper tape, lines |
| id, name, sev    |                                   | scrolling, current|
| pattern editor   |        ( )--a-->( )--b-->(( ))    | line has a        |
| live validation  |          \_______c______/         | printing head     |
|                  |                                   |                   |
|                  |  NFA 14 → DFA 9 → MIN 6  states   |                   |
|                  |  [STEP] [RUN] [RESET]  speed ◐    |                   |
+------------------+-----------------------------------+-------------------+
| ALERT REGISTER: stamped entries, newest on top, click to replay           |
+--------------------------------------------------------------------------+
```
- Three fixed columns (24% / 46% / 30%) with a resizable divider that clicks into notches.
- Alert Register is a bottom drawer 180px high, expandable.
- **Tablet (768-1279):** Rule Book becomes a left slide-over; Tape and Diagram stack.
- **Mobile (below 768, test at 390px):** bottom tab bar with the four panels (Rules, Track, Tape, Alerts). The Track Diagram scrolls horizontally inside a pannable frame with pinch zoom; STEP/RUN controls are pinned above the tab bar.

## Components

**Rule Book (left):** looks like a ledger page. Each rule is a ruled row: severity as a stamped letter in a square (H/M/L, shape plus text, not color alone), id in mono, name in Fraunces. Selecting a row loads its automaton into the Track Diagram. The pattern editor is a mono field styled like a punched label; invalid regex underlines the exact character from `RegexSyntaxError.index` with a dashed red line and the message printed below as a plaque ("Unclosed group at column 7"). "New rule" opens a blank ledger line.

**Stage switcher + counters (center top):** four tabs named **REGEX · NFA · DFA · MIN-DFA**. Under the diagram, a counter strip with odometer-style digits: `NFA 14 → DFA 9 → MIN 6`. When minimization merges states, the final number ticks down and the merged states glow briefly. This strip is the proof that minimization worked, so keep it visible.

**Track Diagram (center):** custom SVG, laid out with dagre for positions only.
- States are **signal lamps**: ring + inner lamp. Start state has an inbound arrow stub; accepting states have a double ring and a green lamp when reached.
- Transitions are **rails** (1.5px `--track`) with a small rectangular **plate** at the midpoint holding the symbol or class label (`[a-z]`, `'`, `F`). Self-loops arc above the lamp. Parallel edges merge into one plate with a comma list.
- ε-transitions in the NFA are drawn **dashed** with an ε plate.
- Selecting a DFA state shows a floating tag: "= { q2, q5, q7 }" (its NFA states) and the NFA diagram highlights those states.
- Pan and zoom with mouse wheel, drag, and +/- buttons; "fit" button resets.
- Dead state hidden by default; a small toggle "show trap state".

**Stepping (the signature interaction):** pressing STEP consumes one input character. A small amber **train head** runs along the matching rail in 280ms, the previous lamp dims, the new lamp lights amber. Landing on an accepting state flips the lamp green, then the whole row on the tape gets a vermilion **TRIPPED** stamp that slams in (scale 1.15 → 1, 140ms). RUN steps automatically; the speed dial has notches 1x, 2x, 5x, 20x. The current character sits under a fixed **printing head** marker on the tape and the tape scrolls under it.

**Event Tape (right):** a paper strip (`--tape` background, `--ink-on-paper` text) with perforated edges, line numbers in a margin column, and the line being processed under a red-edged reading window. Loaded lines show their derived symbol in a small gutter (`F`, `S`, `P`...). Controls: sample selector ("SSH brute force", "SQL injection", "Mixed day"), paste box, file drop zone labelled "Feed the tape". Skipped/unparseable lines appear greyed with a "skipped" mark and a running count.

**Alert Register (bottom):** a ledger of stamped entries: timestamp, rule id, severity, source, matched text, and a mini state-path strip (`q0→q1→q3→q5`). Clicking an entry rewinds the tape to that line and replays the path on the diagram. Filter by severity with three toggle plates.

**Subset-construction replay:** a "Show construction" button on the DFA tab opens a step list on the left side of the stage ("closure of {q0} = {q0,q1,q4}", "move on a → {q2}"), with each step highlighting the relevant NFA states. "Show merges" does the same for minimization using the partition history.

**PDA stack (if built):** a vertical rail of slots beside the diagram; pushes drop a plate in, pops lift it out. Same lamp language.

## Motion
- Durations: 140ms for stamps, 280ms for train moves, 200ms for panel transitions, easing `cubic-bezier(.2,.8,.2,1)`.
- No decorative looping animation. Motion only communicates a state change.
- `prefers-reduced-motion`: no train movement or slam; lamps change color instantly and the active edge is outlined in amber for 600ms instead.

## Microcopy
Voice is a calm signaller, short and literal. Examples:
- Empty tape: "The tape is empty. Feed it a log or pick a sample."
- Empty rule book: "No rules on the board. Add one to see its machine."
- Regex error: "Unclosed group at column 7."
- Alert: "Rule BRUTE-01 tripped at line 42."
- No alerts: "Clear. No rule tripped across 1,208 lines."
- Skipped lines: "14 lines skipped (unrecognized format)."

## Accessibility
- Every alert and lamp state has a non-color cue: shape, text, or pattern (tripped lamp has an "!" plate; accepting state has a double ring).
- Contrast: body text at least 7:1 on `--board`; verify `--paper-dim` at 4.5:1 minimum.
- Full keyboard control: Space = STEP, R = RUN/PAUSE, Esc = RESET, arrow keys move between rules, Tab order follows the panels. Show a shortcut cheat sheet on `?`.
- Diagram has an accessible text alternative: a visually hidden table of states and transitions.
- Live region announces alerts ("Rule BRUTE-01 tripped at line 42").
- Minimum touch target 44px on mobile.

## Performance
- Handle a 10,000-line log without blocking: run scanning in a Web Worker and virtualize the tape.
- Diagram stays smooth up to about 60 states; above that, cluster and show a "large automaton" notice with a zoom hint.

## Acceptance checklist (verify with screenshots at 1440px and 390px)
- [ ] The board, tape and lamp language are visible at first glance; it does not look like a standard dashboard.
- [ ] Fraunces and IBM Plex Mono load; no fallback faces visible.
- [ ] STEP animates train and lamp; an accepting state turns green and a TRIPPED stamp appears on the tape row.
- [ ] Counter strip shows real NFA → DFA → MIN counts for the selected rule.
- [ ] Invalid regex underlines the exact character.
- [ ] Clicking an alert replays its state path.
- [ ] Everything works by keyboard and under reduced motion.
- [ ] No fake numbers anywhere.
