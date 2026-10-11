# Numberland — LLM Project Guide

Read this first if you are an LLM/agent picking up this repository. It explains what the
project is, how it is structured, and the conventions to follow when changing it.

## What this is

**Numberland** is a static web game that teaches maths to children aged **3–10** with
**19 games** on one screen. It is a single-page app with zero dependencies and no build
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
     ordered as a difficulty ladder from easiest to hardest concept.
   - In-game navigation is a single **back button** (`#btn-back`, ⬅️) in the top-left of the
     top bar — no home button. It is hidden on the home screen and returns the child to the
     game grid from the game and reward screens.
   - Speech and pending question timers must be cancelled when leaving the game screen.
   - A wrong tap never punishes, but a child must never be stuck: on the **second** wrong tap
     of a question the correct option gets a green glow (`reveal`) and is described aloud.
   - Question wording must be grammatical with the content tables (use `OBJECTS[].s` for
     singular, `.w` for plural).

## Repository layout

```
/
├── index.html          # Redirect shim to src/ (required for GitHub Pages)
├── docs/
│   └── LLM_CONTEXT.md  # This file
└── src/
    ├── index.html      # The app shell: topbar, screens, settings modal
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

- **Helpers** — `rand`, `pick`, `shuffle`, `$`; content tables `OBJECTS` (`{ e: emoji,
  w: plural word, s: singular word }`) and `SHAPES`; `PRAISES`/`ENCOURAGE` phrase lists.
- **`Sound`** — synthesized effects via Web Audio (`tone()` primitive + `pop`, `count`,
  `correct`, `wrong`, `fanfare`). No audio files. `Sound.enabled` persisted in
  `localStorage['nl_sound']`. AudioContext is created/resumed on first pointer interaction
  (browser autoplay policy).
- **`Speech`** — wraps `speechSynthesis`; `say(text)` cancels any current utterance first,
  picks an English voice, rate 0.95 / pitch 1.15. Gated by `Sound.enabled`.
- **`Confetti`** — full-screen canvas particle shower; `launch(n)`.
- **`State`** — `{ stars, trophies, mode, level, streak, misses, answered, question, timer }`.
  Stars/trophies persist in `localStorage['nl_stars']` / `['nl_trophies']` via `State.save()`.
  `misses` counts wrong taps on the current question and drives the reveal hint.
- **Option builders** — `numberOptions` (near-miss distractors), `optionSet` (deduped candidate
  list, works for numbers and strings), `nearOptions`, `multiplyOptions` (adjacent-multiple
  distractors), `pvOptions` (digit-swap distractors), `fracOptions` (fraction distractors),
  `clockOptions` (`jitter` widens minute distractors at level 4), plus `fmtTime`,
  `clockSVG(hour, minute)` and `pieSVG(parts, shaded)` which render inline SVG.
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
| `q.answer`    | Correct answer; for `options` compared with `===` to the option value (numbers or strings like `'ODD'`, `'7:30'`) |
| `q.options`   | Array of option values → rendered as big buttons |
| `q.objects`   | `{ emoji, total, crossed, split? }` — tappable count-along objects; `crossed` rightmost items render faded (subtraction); `split` inserts a ➕ after N items (addition) |
| `q.visualText`| Big centered text (equations, sequences) |
| `q.groups`    | `{ count, size, emoji }` — count boxes of size emoji (multiplication groups) |
| `q.pairs`     | `{ n, emoji }` — n emoji in boxes of 2, odd leftover highlighted (odd/even) |
| `q.clock`     | `{ hour, minute }` — renders analog SVG clock |
| `q.pie`       | `{ parts, shaded }` — SVG pie for fractions; `q.answer` is the string `'shaded/parts'` |
| `q.coins`     | Array of coin values — rendered as gold coins, biggest first (treasure/money) |
| `q.measure`   | `{ cells, items: [{ emoji, len }] }` — cube ruler grid; a numbered cube row is drawn under each item |
| `q.chart`     | Array of `{ e, w, n }` — picture graph columns, height `n`, count label under each |
| `q.compare`   | `{ left, right, emoji }` — two panels, `q.answer` is `'left'`/`'right'` |
| `q.shapeOptions` | Array of `{ e, w }` shape objects |

### The 19 games (home grid order = difficulty ladder, easiest → hardest)

The grid order **is** the curriculum: index 0 is the easiest concept for a 3-year-old and the
last is the hardest for a 10-year-old. When adding a mode, insert it where its concept sits on
this ladder rather than appending it.

| # | id | Concept | Ages | Level 4 ceiling |
|---|----|---------|------|-----------------|
| 1 | `count` | Counting objects | 3–5 | up to 20 objects |
| 2 | `find` | Recognise a spoken number | 3–6 | numbers to 999 |
| 3 | `compare` | More / fewer | 3–6 | up to 20 per side |
| 4 | `shapes` | Shape names | 4–6 | 6 shapes on screen |
| 5 | `add` | Addition with tappable groups | 4–9 | 3-digit + 3-digit |
| 6 | `sub` | Subtraction with crossing-out | 4–9 | 3-digit − 3-digit |
| 7 | `measure` | Non-standard measurement | 5–8 | compare two lengths, to 20 cubes |
| 8 | `data` | Picture graphs: most/fewest/how many/how many more | 5–9 | 4 categories, up to 10 |
| 9 | `money` | Adding coin values | 5–9 | values to 50, 6 coins |
| 10 | `missing` | Missing number / fact families | 6–9 | 3-digit equations |
| 11 | `oddeven` | Odd/even by pairing | 6–9 | numbers to 999 |
| 12 | `multiply` | Times tables, grouped objects | 6–10 | 11–19 × 3–9, tables to 12 |
| 13 | `patterns` | Number sequences (+ rules, doubling) | 6–10 | step up to 10 and doubling from 5 |
| 14 | `divide` | Sharing into equal groups | 7–9 | tables to 9, grouping shown |
| 15 | `clock` | Reading an analog clock | 7–10 | minutes in 5s |
| 16 | `placevalue` | Tens, hundreds, digit values | 7–10 | thousands + "value of the digit" |
| 17 | `fraction` | Unit fractions from a shaded pie | 7–10 | twelfths |
| 18 | `round` | Rounding | 8–10 | nearest 1000 |
| 19 | `mixed` | Order of operations (brackets first) | 8–10 | `a × b + c × d`, `(a − b) × c`, `a − b ÷ c` |

### Progression

- Correct answer: +1 star (persisted), praise shown in the **feedback strip** (an in-flow row
  between the question bar and the visuals — never an overlay on top of the answer buttons),
  chime + spoken praise, streak +1.
- **3-streak → level up** (max level 4): confetti, fanfare, spoken "Level up!".
- **Every 10 stars → trophy screen**: big confetti, fanfare, trophy count bumps in the top bar.
- Wrong answer: option dims and disables, spoken encouragement, streak resets. No penalty.
- Second wrong tap on the same question: `revealAnswer(q)` glows the correct option (or panel)
  and speech says "Look for the green glow, then tap it!". `State.misses` resets each question.
- Answering correctly after having missed: spoken "Yes! You worked that out, well done!"
  instead of a generic praise, and no star is deducted.
- Generators receive `level` (1–4) and must scale difficulty (see the game table above).

### Settings modal

Gear button → modal with sound on/off (persisted) and Reset Progress (two-tap confirm;
zeroes stars/trophies). Reset confirm auto-disarms after 3s and on modal close.

## How to add a new game mode

1. Write `Generators.mymode(level)` returning a question object per the contract above.
2. Insert `{ id: 'mymode', name, desc, icon, color }` into `MODES` **at its place on the
   difficulty ladder** (not appended), so the grid stays easiest → hardest.
3. If it needs a new visual kind, extend `renderQuestion` and `style.css`.
4. Test: serve locally, answer correctly/incorrectly, level up, press back mid-question
   (speech must stop), check the console.

## Local development & testing

```sh
python3 -m http.server 8765   # from repo root, then open http://localhost:8765/
```

(Opening the root shim redirects to `src/`. Serving directly from `src/` also works.)

There is no test suite; verify manually in a browser: each mode renders, correct answers
score stars, wrong answers are gentle, back button stops speech, console has no errors.

## Deployment

Push to `main`. GitHub Pages (repo Settings → Pages → deploy from branch `main`, `/root`)
rebuilds in ~1 minute. Commit + push is the expected end of every change.

## Git history highlights

- `521a17e` initial game (6 modes for ages 3–6)
- `014861a` favicon/touch icons
- `669b2e7` fix: speech/timer leak when leaving game screen
- `ba9ee7e` settings modal (sound toggle, reset progress)
- `7f15bd6` confetti only on level-up/milestones
- `08464a9` six modes for ages 6–8 (missing number, multiply, patterns, odd/even,
  place value, clock) + higher difficulty ceilings
