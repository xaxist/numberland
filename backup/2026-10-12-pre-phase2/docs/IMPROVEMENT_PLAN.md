# Numberland — improvement plan

Produced by two adversarial reviewers arguing across two rounds: a **kid-experience panel**
(plays the game as a 5/7/9-year-old and as a parent) and a **lead developer** (owns the codebase and
the "zero dependencies, no build step" constraint). Round 1 surfaced claims, round 2 re-checked every
one against source. This document is the adjudicated result. **No game code was changed to write it.**

Confidence legend for each finding:

| Tag | Meaning |
|-----|---------|
| CONFIRMED | Both reviewers agree, evidence verified |
| WORSE | Real, and the original report understated it |
| OVERSTATED | Real problem, wrong diagnosis or wrong severity |
| REFUTED | Investigated and dismissed — recorded so it is not re-litigated |

---

## 1. Findings, ranked

`js:` = `src/js/game.js`, `css:` = `src/css/style.css`, `html:` = `src/index.html`,
`md:` = `docs/LLM_CONTEXT.md`.

### Critical — the game teaches the wrong maths

| # | Finding | Evidence | Tag |
|---|---------|----------|-----|
| C1 | **Crossed-out objects delete themselves.** In subtraction the taken-away items fade to `opacity:.35`, then `flyAway` animates to `opacity: 0` with `forwards`, and animation fill overrides the declaration. The picture that proves the answer vanishes and the child is left with bare numerals. `md:101` promises "render faded", so the docs are wrong about the code. Also `visual-eq` is created and never given text, so there is no `=` either. | css:304, css:309; js:1127-1131; md:101 | WORSE |
| C2 | **Tap-to-count destroys the question.** `Speech.say` is `cancel()` then speak, and every apple tap speaks its index. A child using the counting aid mid-instruction loses the instruction — the aid punishes the behaviour it wants. | js:84-92, js:1116-1123 | CONFIRMED |
| C3 | **Fractions punish a child who is ahead.** `fracOptions` hard-codes `1/2, 2/3, 3/4, 1/6` as distractors while `answer` is the literal unreduced string, and the check is strict `===`. A `3/6` pie therefore offers `1/2` as a *wrong button*, and `6/8`, `8/12`, `9/12`, `4/12` all do the same. | js:257-268, js:698-699, js:1154 | CONFIRMED |
| C4 | **Place-value questions can be formally unanswerable.** `place` picks a position and the distractors are that digit's value in every column, but the visual is plain text with no digit marked. For `2123` ("What is the value of the 2?") there are two 2s — two options are defensible. | js:607, js:614-615, js:977 | WORSE |

### High — blocks progress or excludes players

| # | Finding | Evidence | Tag |
|---|---------|----------|-----|
| H1 | **Level is never persisted.** Every entry restarts at Level 1, so a child who has earned Level 4 in Multiply replays nine warm-up questions (`[2,5,10] × 1-5`) each time. `State` stores only stars and trophies. | js:1270, js:159-172, js:499-501 | CONFIRMED |
| H2 | **The top level is silent.** `leveledUp` requires `State.level < 4`, so at Level 4 there is never a medal, fanfare or confetti — mastery feels like a dead end. Panel's workaround (quit and re-enter to force a celebration) also throws away H1's progress: same root bug. | js:1216-1220, js:1225-1227 | CONFIRMED |
| H3 | **One stray tap erases a session.** `goBack` has no confirmation and `startMode` hard-resets the level. On a tablet a 5-year-old's elbow costs the last five minutes of work. | js:1276-1278, js:1270 | CONFIRMED |
| H4 | **Answer buttons fail contrast.** White text on the option fills gives 1.8:1 (teal) / 1.9:1 (orange) / 2.4:1 (pink) / 2.5:1 (blue) / 2.8:1 (red). Five of six colours fail even the 3:1 large-text bar. This is the single worst accessibility defect in the app. | js:34, js:1139, js:1151 | CONFIRMED |
| H5 | **Measure rewards the grid, not the object.** Candidates include `cells` (the row width) and `cells - lenA`, and every empty slot is drawn as a bordered box, only *lighter*. The child who miscounts gets exactly the box count as a tempting button. | js:748, js:1016-1019, css:196-207 | WORSE |
| H6 | **Compare Level 4 is unreadable.** 19 vs 20 in two `flex:1 1 0` panels ≈166px wide on a 375px phone, `.obj` min 2.4rem → ~3 per row, 7 rows, one extra cell invisible, no numerals, and it overflows the screen. "More" cannot be seen, which was the whole point. | js:396, js:405, js:952-971; css:317, css:129, css:281 | CONFIRMED |
| H7 | **Praise gets cut off.** The level-up line is ~2.5s but `nextQuestion` fires at 1600ms and `say` cancels. "Level up!" and "You worked that out" are both truncated mid-word. | js:1228-1230, js:1245, js:1265 | CONFIRMED |
| H8 | **One switch kills the voice.** `Sound.enabled` gates `tone()` *and* `say()`, so a child who mutes the ding-dong also silences every question — fatal for pre-readers. | js:85, js:47, js:1340-1343 | CONFIRMED |

### Medium

| # | Finding | Evidence | Tag |
|---|---------|----------|-----|
| M1 | **A revealed answer still pays a star** (glow at 2 misses, then the tap runs the normal correct path). | js:1175-1176, js:1211 | CONFIRMED |
| M2 | **Cards cannot be heard before choosing.** `Speech.say(m.name)` is cancelled by the same click's `nextQuestion`; it is not dead code, it is a cancelled feature. No browse/read-aloud mode exists. | js:933-936, js:1265 | WORSE |
| M3 | **Wrong answers get a shrug.** Three generic lines, no "you counted the boxes, not the snake" — nothing to redirect the specific mistake. | js:1179, js:32, css:359 | CONFIRMED |
| M4 | **No per-game record.** Nothing tells a child which game they are best at, so the ladder has no feedback loop. | js:159-172 | CONFIRMED |
| M5 | **No `prefers-reduced-motion`.** Infinite cloud drift, spinning sun and a never-ending `glow` are a problem for vestibular-sensitive and ADHD players. | css:44, css:63, css:71 | CONFIRMED |
| M6 | **Tappable objects are unnamed** `<span>`s; compare panels have no role or label; `.icon-btn` is 46px under the 48px floor. | js:1068, js:1083, css | CONFIRMED |
| M7 | **The scroll position is not reset** when switching screens. A card near the bottom of the 20-game grid leaves the question bar off-screen for a small child. One line, high blast radius. | `showScreen` | CONFIRMED |
| M8 | **The measure ruler is 12.5px** and is never mentioned in the spoken question. | js:746, css:211 | CONFIRMED |

### Low — polish

L1 `❓` is both the Missing No. icon and the in-question gap glyph (js:889, 347, 375, 439, 507, 869) ·
L2 `patterns` always asks "What comes next?" (js:534) ·
L3 `data` prints the counts under the bars, so the graph does not have to be read (js:1052-1054) ·
L4 `placeLabel` pluralises on `v !== 1`, producing "0 hundreds", and zero terms are printed (js:233, js:600) ·
L5 `find` Level 4 distractors are only ±3 apart (js:180, js:332) ·
L6 coaching hints repeat on every question, e.g. "Do the multiplication first!" (js:345, 374, 834, 843, 858) ·
L7 the 1600ms pause cannot be skipped by tapping (js:1184, js:1245) ·
L9 `fraction` says "apple" while `pieSVG` draws an abstract red/grey disc, and the noun is re-picked per question (js:692, 695 vs js:270-282) ·
L10 `oddeven` loses its pairing picture above 16, so the concept is no longer visible (js:549-553).

---

## 2. Five root causes

Most of the list above is not twenty separate bugs.

1. **RC1 — Speech has no queue and no priority; `say()` always cancels.** Causes C2, H7, and makes
   M2 impossible to fix by tweaking wording. One small queue with `question > feedback > count-along`
   resolves three findings.
2. **RC2 — Visuals do not prove their own answer.** C1, H5, H6, C4 and L9 all violate one rule:
   *the picture must make the distinction perceptible without reading a numeral*. Fixing the rule
   fixes the family.
3. **RC3 — Distractors are generated from the picture's artefacts** (grid width, reduced forms)
   while matching is strict `===`. Source of C3 and H5. Cannot be fixed without touching
   `fracOptions` and `measure`'s candidate lists — the developer formally retired the round-1
   position "the generator core must not change" for exactly this reason.
4. **RC4 — Progression state is session-only and capped silently.** H1, H2, H3 and M4 are one bug:
   `level` lives in memory, and reaching the ceiling produces no event.
5. **RC5 — There is no accessibility floor.** H4, M5, M6, M7 share one cause: nothing in the repo
   states a contrast, target-size, motion or scroll minimum.

---

## 3. Roadmap

Order matters: Phase 0 makes the app safe and testable, Phase 1 fixes the voice, Phase 2 the
maths, Phase 3 the motivation loop. Effort is S/M/L against this codebase, and every item stays
vanilla — no dependencies, no build step, `src/index.html` still opens directly.

### Phase 0 — correctness patches and the a11y floor *(do first, ships alone)*

> **Status: done 2026-10-11.** Pre-change snapshot in `backup/2026-10-11-pre-phase0/`.
> `src/tests.html` now reports 75,225 checks over 4,800 questions with **0 failures**; worst option
> contrast went from **1.80:1 to 4.58:1**; crossed objects measure `opacity: 0.45` with a strike line
> after all animations finish. The 3 known defect families (measure grid-width options, fraction
> equivalent forms, ambiguous place-value digits) are counted in the harness and fixed in Phase 2.

| Item | Change | Closes |
|------|--------|--------|
| Crossed objects stay visible | Delete the `flyAway … forwards` from `.obj.crossed`; keep fade + strikethrough | C1 |
| Contrast floor | Darken text onto the five failing `OPTION_COLORS` fills (or give each fill a paired ink) | H4 |
| Motion floor | Add a `prefers-reduced-motion` block disabling the sky drift, sun spin and infinite glow | M5 |
| Scroll reset | `window.scrollTo(0, 0)` in `showScreen` | M7 |
| Split the mute switch | New `nl_voice` key, independent toggle; keep `nl_sound` for SFX | H8 |
| Give the equation its `=` | Populate the empty `visual-eq` | C1 |
| Self-test page | `src/tests.html` (see §5) with `if (!window.NL_TEST) init()` | all later phases |

**Accept:** pinch-zoom behaviour unchanged; on `sub` Level 1 the crossed apples are still on screen
after the animation; every option button passes 3:1; tests page all green.

### Phase 1 — the speech queue *(RC1)*

> **Status: done 2026-10-11.** `Speech.say(text, kind)` now queues by priority
> (`question`/`answer` > `praise` > `count`) instead of cancelling; `afterFeedback` holds the
> hand-off until the voice has finished (capped at 4.5 s); object taps are inert once answered;
> holding a home card reads its name without starting the game. Asserted permanently by the
> **speech** audit in `src/tests.html`.
> Note: the plan said "🔊 on a home card" — there is no speaker button on the cards; a long-press
> was used instead, which needs no new controls in a grid of 20.

Priority queue so a count-along tap never interrupts the instruction; object handlers respect
`State.answered`; long-press (or the 🔊 on a card) speaks the mode name and starts the game only on
release, so names become browsable.

**Accept:** start Counting, immediately tap an apple — "…then tap the answer!" is still heard in
full. Reach Level 2 and hear "Level up!" complete. Back button stops speech.

### Phase 2 — picture honesty *(RC2, RC3)*

| Item | Change | Closes |
|------|--------|--------|
| Measure | Bordered cells stop at `len` (no empty boxes); drop `cells` and `cells - len` from the candidates; ruler digits to 1rem and mentioned in the speech | H5, M8 |
| Compare | Aligned rows (cap ~12 per side so MORE/FEWER is perceptual at a glance); keep numerals out below L4 | H6 |
| Place value | Add a marked-digit channel to `visualText` (needs a real change — it is set via `textContent`); never ask about a digit that repeats | C4, L4 |
| Fractions | `fracOptions` stops offering equivalent forms and the check *accepts* them; noun matches the picture or the picture becomes the noun | C3, L9 |
| Wrong feedback | One redirecting line per mode instead of three generic ones | M3 |

**Accept:** in Measure L3 no option equals the box count; in Fractions L3 tapping `1/2` under a `3/6`
pie celebrates; in Place value a `2123` question marks exactly one digit.

### Phase 3 — the motivation loop *(RC4)*

One additive key, `nl_progress = { v:1, games:{ [id]: { level, best, tried, firstTry, at } }, last:{…} }`,
no migration, and Reset must `removeItem('nl_progress')` too. Resume the stored level silently on tap —
**no new UI, no re-sorting `MODES`, no lock** (the grid order *is* the curriculum). Add a Level 4
+ 3-streak "You are the champion of Doubling" event so the top is not silent, a per-mode best line on
the card (`Lv 3 · 🔥4` — content, not structure), and tap-anywhere to skip the 1600ms wait.

**Accept:** reach Multiply L4, press ⬅️, re-enter → it starts at L4; the L4 celebration fires without
quitting; Reset Progress clears both keys.

---

## 4. Where the reviewers disagreed, and how it resolved

Worth keeping, because each of these will be re-raised otherwise.

| Dispute | Outcome |
|---------|---------|
| *"`numberOptions` can hang"* — developer's round-1 landmine | **REFUTED, by the developer.** js:183's second loop is unguarded but unreachable: every call site has a range of ≥6 values for ≤4 options. The panel was right that it cannot hang, though it had checked the bounded loop at 179. Keep as a one-line guard, not a defect. |
| *"Star exploit guarantees a level-up"* | **Split.** The level-up half is refuted — `missQuestion` zeroes the streak (js:1171), so a revealed tap cannot feed a promotion. Star farming (M1) is real. Resolution: keep the reveal (it is the never-stuck guarantee, `md:37-38`) and flag the question internally as "hinted" instead of removing the star. |
| *"Remove `user-scalable=no`"* | **Open.** Developer filed it as an a11y defect; the panel argued that children pinch-zoom and lose the layout, which is a real child reason. Decision deferred to §6. |
| *"`divide` offering the number of friends is a bug"* | **REFUTED.** A textbook partitive distractor; keep it. |
| *"`money` sorting coins descending is a bug"* | **REFUTED.** It matches the strategy the voice teaches (js:714, `md:107`). |
| *"`oddeven` at L4 is half luck"* | **OVERSTATED.** Parity is decidable from the units digit, so the question is fair. The genuine issue is L10 — the pairing picture stops at 16. |
| *"The pie's shaded/unshaded wedges differ by colour only"* | **OVERSTATED.** Wedges carry 3px strokes and are countable; the real defect is the mismatched noun (L9). |
| *"Scroll-to-top is cosmetic"* vs *"it is a disaster preventer"* | **Panel won.** It is one line with a large blast radius, promoted into Phase 0. |
| *"Add a Resume card to the home grid"* | **Dropped by the panel itself** and reframed: remember the level silently, change no UI. Preserves the flat-grid rule. |
| New wish neither side had | **Kept as a proposal:** tapping 🔊 should re-count *the child's own* taps on *their* objects — a "my work" playback. Today js:1121 speaks the index and cancels the previous count, so the record of what they did is lost. Phase 1 candidate. |

---

## 5. Verification (there is no test suite)

The app has no build and no test runner, so verification is a browser page plus scripted audits.

**`src/tests.html`** — a self-test page that loads `game.js` with `window.NL_TEST = true`, guards the
auto-init (`if (!window.NL_TEST) init()`), seeds `Math.random` for reproducibility, sets
`Sound.enabled = false`, and generates thousands of questions per mode × level asserting:

- option-set integrity — no duplicate labels (two identical strings produce two green glows in `revealAnswer`), answer present, all in range;
- shown text and spoken text agree, and grammar is right (no "0 hundreds");
- per-level ceilings hold, and `mixed` never sets `trap === answer`;
- for independent recomputation, generators return an optional `q.givens`. Today `compare.askMore`
  (js:400) and `data.question` (js:784) are not returned, so those modes cannot be checked at all.

**Manual browser audit** — `evaluate_script` loops over generators, and geometry checks via
`getBoundingClientRect`. Critical method note learned the hard way this session: CSS `popIn` and
`fbBounce` start at `scale(0)`, which collapses rects and produces confident nonsense. Always run
`document.getAnimations().forEach(a => a.finish())` before measuring.

**Contrast** — compute the ratio of the text ink against each of the six `OPTION_COLORS` fills and
fail below 3:1.

Baseline to beat: 12,000 generated questions across 20 modes × 4 levels currently pass with 0 failures.
Any phase that changes a generator must keep that number at zero.

---

## 6. Deliberate non-goals

Agreed by both reviewers. Each is a decision, not an omission.

No bundler, framework, npm dependency or build step — the single-file, open-`index.html` model is the
product. No age bands, sections, locks or a promoted Resume card; the grid order *is* the ladder
(`md:114-117`). No timer or speed mode — time pressure is punishment in disguise. No speech
recognition, handwriting input or mandatory typed digits (the audience cannot write). No service
worker or PWA caching. No server or leaderboard — stars are local. No confetti on ordinary answers
(it would devalue the trophy, `md:27`). No removal of the reveal, of `groups` from divide's options,
or of star payment after a hinted answer. No pairing pictures up to 999 — the Level 4 goal is the
units-digit rule, not dots.

## 7. Open questions for the owner

1. **Zoom on phones** — keep `user-scalable=no` (layout safety for a child who pinches) or drop it
   (accessibility floor)? If dropped, the layout must survive 200% zoom first.
2. **Silent level resume** — is starting a game at the child's remembered level acceptable, given
   nothing is displayed about it? Phase 3 assumes yes, with no new UI.
3. **Hinted answers and stars** — pay, don't pay, or pay but mark the record? The plan recommends
   the third.
4. **Sequencing** — ship Phase 0 alone as a quick release (it is independently valuable and touches
   no generator), or batch Phase 0+1?
