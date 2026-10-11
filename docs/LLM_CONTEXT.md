# Numberland — LLM Project Guide

Read this first if you are an LLM/agent picking up this repository. It explains what the
project is, how it is structured, and the conventions to follow when changing it.

## What this is

**Numberland** is a static web game that teaches maths to children aged **3–10** with
**20 games** on one screen. It is a single-page app with zero dependencies and no build
step: plain HTML, CSS, and JavaScript. It is deployed as-is to **GitHub Pages** from the
repository root.

- Live site: `https://xaxist.github.io/numberland/`
- Repo: `https://github.com/xaxist/numberland`
- Deploy model: **push to `main` = deploy**. GitHub Pages rebuilds in ~1 minute.

## Hard constraints (do not break these)

1. **No build tools, no frameworks, no npm.** Everything must run by opening `src/index.html`.
   The only external request is the Fredoka font from Google Fonts (graceful fallback offline).
2. **The root `index.html` must stay a redirect shim to `src/`** — GitHub Pages serves from
   the repo root; without the shim the live URL 404s.
3. **Audience is pre-readers and early readers.** Every question must be spoken aloud via the
   Web Speech API, all instructions must be tappable/visual (emoji, not text), and wrong
   answers must never punish (no score loss, gentle retry).
4. Kid-safe UX rules established so far:
   - Confetti showers only on **level completion** (3-correct streak) and **trophy milestones**
     (every 10 stars) — never on ordinary correct answers.
   - The home screen is a **single flat grid** of game cards (no age/section grouping),
     ordered as a difficulty ladder from easiest to hardest concept. Every game is always
     tappable: difficulty is remembered per game and resumed **silently** — no locks, no badges,
     no progress text on the cards, and the grid never re-sorts itself.
   - In-game navigation is a single **back button** (`#btn-back`, ⬅️) in the top-left of the
     top bar — no home button. It is hidden on the home screen and returns the child to the
     game grid from the game and reward screens.
   - The **`#logo` is hidden while playing** (`showScreen` swaps it with the back button in the
     same top-left slot) — on a phone the logo and the back button do not both fit.
   - Speech and pending question timers must be cancelled when leaving the game screen.
   - **Hold (long-press) a home card to hear its name** without starting the game — a pre-reader
     browses the grid by ear; a tap still starts it at once. Tapping the objects in a picture stops
     once the question has been answered, so the count-along cannot keep talking.
   - **A strategy is taught once, then it stops.** Put it in `q.coach`, never in the question
     wording — otherwise the game narrates itself at a child on every single question.
   - **Pictures are described, not dictated.** `#visual` carries `role="img"` plus an `aria-label`
     naming the *kind* of picture ("A group of apples to count") and never the count, because the
     count is the answer. Compare panels are "The left group"/"The right group". Tap targets stay at
     or above 48px and must not be squeezable (`.icon-btn { flex: 0 0 auto }`).
   - A wrong tap never punishes, but a child must never be stuck: on the **second** wrong tap
     of a question the correct option gets a green glow (`reveal`) and is described aloud.
   - Question wording must be grammatical with the content tables (use `OBJECTS[].s` for
     singular, `.w` for plural).
   - **The picture must prove the answer.** Crossed-out subtraction objects stay on screen
     (faded + red strike line) — never animate them to `opacity: 0`, and never let a `forwards`
     fill override the declared opacity.
   - **A distractor must never be an artefact of the picture.** Measuring cubes are drawn only
     where the object actually covers (a bordered empty slot becomes a wrong answer to count);
     a fraction distractor is never an equivalent form of the answer, and `sameAmount` accepts one
     if a child offers it. Comparison sides must differ by enough to be *seen* (≥2 at level 1,
     ≥3 at level 2, ≥5 above), and place-value digits must be unique and highlighted.
   - **Text colour on every coloured fill goes through `inkFor(hex)`**, which picks white or
     near-black by WCAG luminance. Hard-coded white on the option colours measured 1.8:1 on the
     teal and 1.9:1 on the orange. Keep the worst ratio above 3:1 (`src/tests.html` asserts it).
   - **`@media (prefers-reduced-motion: reduce)` must disable every looping animation** (sky
     drift, sun spin, answer glow). Add new infinite animations to that block.

## Repository layout

```
/
├── index.html          # Redirect shim to src/ (required for GitHub Pages)
├── docs/
│   ├── LLM_CONTEXT.md  # This file
│   └── IMPROVEMENT_PLAN.md  # Phased improvement roadmap from the player/dev-review debate
├── backup/
│   └── <date>-pre-<phase>/  # Snapshots taken before each roadmap phase
└── src/
    ├── index.html      # The app shell: topbar, screens, settings modal
    ├── tests.html      # Self-test harness — audits every generator + the DOM it renders
    ├── css/
    │   └── style.css   # All styles; animated sky background, chunky kid-friendly buttons
    ├── js/
    │   └── game.js     # Entire game engine (see architecture below)
    └── img/
        ├── favicon-32x32.png
        ├── icon-192x192.png
        └── apple-touch-icon.png
```

## Architecture (src/js/game.js)

Everything is plain script (no modules) with these subsystems, top to bottom:

- **Helpers** — `rand`, `pick`, `shuffle`, `$`, `inkFor(hex)` (WCAG-luminance ink picker),
  `placeParts(places)` (place-value sum wording, zero places dropped), `visualAria(q)` (the spoken
  description of a picture); content tables `OBJECTS` (`{ e: emoji, w: plural word, s: singular
  word }`) and `SHAPES`; `PRAISES`/`PRAISE_EMOJI`/`ENCOURAGE` phrase lists.
- **`Sound`** — synthesized effects via Web Audio (`tone()` primitive + `pop`, `count`,
  `correct`, `wrong`, `fanfare`). No audio files. `Sound.enabled` persisted in
  `localStorage['nl_sound']`. AudioContext is created/resumed on first pointer interaction
  (browser autoplay policy).
- **`Speech`** — wraps `speechSynthesis`, with its **own** `Speech.enabled` switch
  (`localStorage['nl_voice']`), independent of `Sound`, so muting the effects never silences the
  questions. `say(text, kind)` is a **one-at-a-time priority queue**, not a bare cancel:
  `question`/`answer` (3) > `praise` (2) > `count` (1). Lower-priority lines wait their turn
  (count-along lines collapse to the newest so they cannot pile up), so tapping an apple can no
  longer truncate the instruction — while a question the child has already answered counts as spent
  and its praise cuts in front of the remaining wording. `busy()` drives `afterFeedback`, which
  holds the 1600 ms hand-off until the voice finishes (capped at 4.5 s) so "Level up!" is never cut
  off. `stop()` clears the queue and the utterance; every exit from the game screen calls it.
  English voice, rate 0.95 / pitch 1.15.
- **`Confetti`** — full-screen canvas particle shower; `launch(n)`.
- **`State`** — `{ stars, trophies, mode, level, streak, misses, answered, question, timer, pending }`.
  Stars/trophies persist in `localStorage['nl_stars']` / `['nl_trophies']` via `State.save()`.
  `misses` counts wrong taps on the current question and drives the reveal hint. `pending` holds the
  not-yet-run continuation of the feedback pause so a tap on the picture can run it early.
- **`Progress`** — per-game record in one key, `localStorage['nl_progress']`
  (`{ v: 1, games: { [id]: { level, mastered } } }`). Additive: no migration, and unreadable or
  out-of-range values fall back to level 1 rather than throwing. `startMode` resumes the stored
  level silently, `handleCorrect` and `goBack` save it, and Reset Progress clears it. Nothing about
  it is displayed on the home grid — no locks, no badges, no re-sorting.
- **Option builders** — `numberOptions` (near-miss distractors), `optionSet` (deduped candidate
  list, works for numbers and strings), `nearOptions`, `multiplyOptions` (adjacent-multiple
  distractors), `pvOptions` (digit-swap distractors), `fracOptions` (fraction distractors — it
  rejects any candidate equal to the answer, so `1/2` is never offered as wrong under `3/6`),
  `sameAmount(value, answer)` + `fractionParts` (the equivalence rule, also used when grading a
  tap), `clockOptions` (`jitter` widens minute distractors at level 4), plus `fmtTime`,
  `clockSVG(hour, minute)` and `pieSVG(parts, shaded)` which render inline SVG.
- **`REDIRECT`** — map of mode id → one spoken hint for a first wrong tap. Keep it about *how to
  look at the picture*, never the answer, and only reference visuals that exist at every level.
- **`Generators`** — one function per game mode, keyed by mode id. Each returns a
  **question object** (contract below).
- **`MODES`** — registry array of `{ id, name, desc, icon, color }`; array order is the
  difficulty ladder and drives the home grid (see the game table below).
- **Render/flow** — `renderHome`, `renderQuestion`, `onAnswer`, `onCompare`,
  `handleCorrect`, `showReward`, `nextQuestion`, `startMode`, `goBack`, settings modal,
  `init` on `DOMContentLoaded`.

### Question object contract

`Generators[modeId](level) -> q`. Fields by type:

| Field         | Meaning |
|---------------|---------|
| `q.type`      | `'options'` (default button grid), `'compare'` (two side panels), `'shapes'` (shape buttons), `'count'`/`'add'`/`'sub'` (tappable objects + options) |
| `q.text`      | On-screen question text (big heading) |
| `q.speak`     | Text spoken aloud — write it for a child, not a reader |
| `q.coach`     | Optional strategy line. Spoken **once per game per session**, fused onto the first question so it cannot be dropped by the queue; put it here rather than in `q.speak`, or the game narrates every single question |
| `q.answer`    | Correct answer; for `options` compared with `===` to the option value (numbers or strings like `'ODD'`, `'7:30'`) |
| `q.options`   | Array of option values → rendered as big buttons |
| `q.objects`   | `{ emoji, total, crossed, split? }` — tappable count-along objects; `crossed` rightmost items stay visible, faded with a red strike line, and a `= ❓` cue follows a `type: 'sub'` row; `split` inserts a ➕ after N items (addition) |
| `q.visualText`| Big centered text (equations, sequences). With `q.mark: <index>` the character at that index is highlighted (`.digit-mark`) — place value uses it so "the value of the 7" points at one visible digit, odd/even uses it to point at the units digit that decides parity |
| `q.groups`    | `{ count, size, emoji }` — count boxes of size emoji (multiplication groups) |
| `q.pairs`     | `{ n, emoji }` — n emoji in boxes of 2, odd leftover highlighted (odd/even) |
| `q.clock`     | `{ hour, minute }` — renders analog SVG clock |
| `q.pie`       | `{ parts, shaded }` — SVG pie for fractions; `q.answer` is the string `'shaded/parts'` |
| `q.coins`     | Array of coin values — rendered as gold coins, biggest first (treasure/money) |
| `q.measure`   | `{ cells, items: [{ emoji, len }] }` — only the cubes that cover each object are drawn (never empty grid slots), one row per item, left-aligned so two lengths compare, each cube tappable to count along. `cells` is the level's length budget, not a drawn grid |
| `q.chart`     | Array of `{ e, w, n }` — picture graph columns, height `n`, count label under each |
| `q.compare`   | `{ left, right, emoji, askMore }` — two equal panels laid out in rows of four; `q.answer` is `'left'`/`'right'` and `askMore` records which was asked, so the tests can re-derive the answer independently |
| `q.shapeOptions` | Array of `{ e, w }` shape objects |

### The 20 games (home grid order = difficulty ladder, easiest → hardest)

The grid order **is** the curriculum: index 0 is the easiest concept for a 3-year-old and the
last is the hardest for a 10-year-old. When adding a mode, insert it where its concept sits on
this ladder rather than appending it.

| # | id | Concept | Ages | Level 4 ceiling |
|---|----|---------|------|-----------------|
| 1 | `count` | Counting objects | 3–5 | up to 20 objects |
| 2 | `find` | Recognise a spoken number (at level 4 the neighbours differ by tens and hundreds, so a digit column has to be read) | 3–6 | numbers to 999 |
| 3 | `compare` | More / fewer | 3–6 | up to 20 per side |
| 4 | `shapes` | Shape names | 4–6 | 6 shapes on screen |
| 5 | `add` | Addition with tappable groups | 4–9 | 3-digit + 3-digit |
| 6 | `sub` | Subtraction with crossing-out | 4–9 | 3-digit − 3-digit |
| 7 | `measure` | Non-standard measurement | 5–8 | compare two lengths, to 20 cubes |
| 8 | `data` | Picture graphs: most/fewest/how many/how many more — no counts printed, the bars must be read | 5–9 | 4 categories, up to 10 |
| 9 | `money` | Adding coin values | 5–9 | values to 50, 6 coins |
| 10 | `doublehalf` | Doubling and halving | 5–8 | double 2-digit to 49, half of 2-digit to 98 |
| 11 | `missing` | Missing number / fact families | 6–9 | 3-digit equations |
| 12 | `oddeven` | Odd/even — pairing picture to 16, then the units-digit rule (that digit is highlighted) | 6–9 | numbers to 999 |
| 13 | `multiply` | Times tables, grouped objects | 6–10 | 11–19 × 3–9, tables to 12 |
| 14 | `patterns` | Number sequences (+ rules, doubling) — asks what comes next **or** what comes first | 6–10 | step up to 10 and doubling from 5 |
| 15 | `divide` | Sharing into equal groups | 7–9 | tables to 9, grouping shown |
| 16 | `clock` | Reading an analog clock | 7–10 | minutes in 5s |
| 17 | `placevalue` | Tens, hundreds, digit values | 7–10 | thousands + "value of the digit" |
| 18 | `fraction` | Unit fractions from a shaded pie | 7–10 | twelfths |
| 19 | `round` | Rounding | 8–10 | nearest 1000 |
| 20 | `mixed` | Order of operations (brackets first) | 8–10 | `a × b + c × d`, `(a − b) × c`, `a − b ÷ c` |

### Progression

- Correct answer: +1 star (persisted), praise shown in the **feedback strip** (an in-flow row
  between the question bar and the visuals — never an overlay on top of the answer buttons),
  chime + spoken praise, streak +1.
- **3-streak → level up** (max level 4): confetti, fanfare, spoken "Level up!".
- **3-streak at level 4 → champion**: the first time only, per game (`Progress…mastered`) — 👑,
  bigger confetti, fanfare, spoken "You are the champion of <game>!". After that the top level gives
  ordinary praise, so the crown cannot be farmed and reaching the ceiling is never silent.
- The hand-off after an answer waits for the voice to finish (never under 1600 ms, capped at 4.5 s).
  **Tapping the picture skips it** — but not within the first 600 ms, so a fast second tap on the
  answer can never steal the celebration.
- **Every 10 stars → trophy screen**: big confetti, fanfare, trophy count bumps in the top bar.
- Wrong answer: option dims and disables, streak resets, no penalty. The **first** wrong tap speaks a
  hint from `REDIRECT[mode]` about how to look at the picture (never the answer); the second reveals.
- Second wrong tap on the same question: `revealAnswer(q)` glows the correct option (or panel)
  and speech says "Look for the green glow, then tap it!". `State.misses` resets each question.
- Answering correctly after having missed: spoken "Yes! You worked that out, well done!"
  instead of a generic praise, and no star is deducted.
- Generators receive `level` (1–4) and must scale difficulty (see the game table above).

### Settings modal

Gear button → modal with **two independent switches** — `🔔 Sound effects` (`nl_sound`) and
`🗣️ Voice` (`nl_voice`) — and Reset Progress (two-tap confirm), which zeroes stars and trophies and
clears `nl_progress` with them. The two sound preferences survive a reset. Reset confirm auto-disarms
after 3s and on modal close.

## How to add a new game mode

1. Write `Generators.mymode(level)` returning a question object per the contract above.
2. Insert `{ id: 'mymode', name, desc, icon, color }` into `MODES` **at its place on the
   difficulty ladder** (not appended), so the grid stays easiest → hardest.
3. If it needs a new visual kind, extend `renderQuestion` and `style.css`.
4. Test: serve locally, answer correctly/incorrectly, level up, press back mid-question
   (speech must stop), check the console.

## Local development & testing

```sh
cd src && python3 -m http.server 8765   # http://localhost:8765/  (the game)
                                         # http://localhost:8765/tests.html  (the audits)
```

(Opening the root shim redirects to `src/`.)

### src/tests.html

The whole test suite, in the browser, with no dependencies. It sets `window.NL_TEST = true`
before loading `game.js` — which is why the auto-init at the bottom of that file is guarded by
`if (!window.NL_TEST)` — then disables `Sound`/`Speech`, reseeds `Math.random` (mulberry32, so a
failure is reproducible from the seed in the URL bar), and runs every generator × level × N
questions through a **contract** and a **DOM** audit, plus **speech**, **logic** and **progress**
audits at the end:

- **contract** — text and `speak` non-empty, no `NaN`/`undefined` leaking into wording, answer
  present and unique among the options (duplicate labels mean `revealAnswer` glows two buttons),
  options integral and in range, pictures consistent with the answer (`count`, `add`, `pie`,
  `compare`, `clock`, `measure`), wording never says "0 hundreds" or prints a `+ 0` term, a picture
  graph prints no digits in its question, odd/even above the pairing picture marks the units digit,
  `find` at level 4 keeps its neighbours a readable distance apart, sequences ask in both directions
  and the answer obeys the rule; no strategy clause is baked into `q.speak` (it must arrive as
  `q.coach`) — and for every arithmetic question the **shown equation is
  re-evaluated by a small recursive-descent parser and compared to `q.answer`**;
- **DOM** — `renderQuestion` must not throw, exactly one button may match the answer, option text
  must clear 3:1 against its fill, crossed objects must still be visible after all CSS animations
  finish, measure rows must draw exactly `len` cubes and never an empty slot, place value must
  highlight one and only one digit — the one it asks about — and compare panels must be equal width
  and show the counts they claim (`document.getAnimations().forEach(a => a.finish())` before
  measuring, or `popIn`'s `scale(0)` start frame collapses every rect). Each picture must carry
  `role="img"` and an `aria-label` that says what kind of picture it is without stating a count, and
  compare panels must each have an accessible name;
- **speech** — swaps in a fake `speechSynthesis` (no audio) and asserts the queue: a count-along tap
  never interrupts the instruction, queued counts collapse to the newest and play after it, praise
  waits behind an unfinished question but cuts in once it is answered, `stop()` empties everything,
  and tapping objects after answering does nothing at all. It also plays six questions of one game
  and asserts the `q.coach` strategy line is heard exactly once;
- **logic** — exercises the pure helpers (`sameAmount`, `inkFor` really picks the readable ink of
  the two, `fracOptions` never offers an equivalent form for every denominator in use), checks each
  mode has a `REDIRECT` hint, and clicks `1/2` under a `6/12` pizza expecting to be told well;
- **progress** — runs the real flow against a DOM replica of the game screen (the harness markup
  carries the same ids as `index.html`, so `startMode`/`goBack`/`showScreen` work here): corrupt and
  out-of-range `nl_progress` values fall back safely, a remembered level resumes on the badge, the
  crown fires once per game and never twice, a tap inside the dwell window cannot skip the
  celebration, and Reset clears the record;
- **assets** — fetches `index.html` and this page and checks both pin `js/game.js` and
  `css/style.css` with a `?v=` version, and that the two files name the *same* build, so a release
  cannot leave one page on the old engine.

Some assertions are geometric, and a browser surface that reports `innerWidth === 0` (the embedded
in-app browser does) cannot answer them — those count themselves as **skipped** and the summary says
how many, so a green page never claims to have tested fit. Run the page in a normal window for the
layout checks. Run the page in a normal window for the
layout checks. Default is 60 questions per mode per level ≈ 101,800 checks in ~7s; raise `runs` to
widen the sweep. **Run this page after any generator change** — there is no other test harness.

Manual checks still needed: correct/incorrect answers score gently, back button stops speech,
console has no errors.

## Deployment

Push to `main`. GitHub Pages (repo Settings → Pages → deploy from branch `main`, `/root`)
rebuilds in ~1 minute. Commit + push is the expected end of every change.

**Cached assets are versioned by hand:** `index.html` and `tests.html` load
`js/game.js?v=<date>` and `css/style.css?v=<date>`. **Bump both values in both files with every
release that changes them** — without it a phone can keep running the previous engine after a push,
which has already made a correct deploy look broken (and the tests page asserts the two files are
pinned to the same build, so a half-bump is caught).

## Git history highlights

- `521a17e` initial game (6 modes for ages 3–6)
- `014861a` favicon/touch icons
- `669b2e7` fix: speech/timer leak when leaving game screen
- `ba9ee7e` settings modal (sound toggle, reset progress)
- `7f15bd6` confetti only on level-up/milestones
- `08464a9` six modes for ages 6–8 (missing number, multiply, patterns, odd/even,
  place value, clock) + higher difficulty ceilings
