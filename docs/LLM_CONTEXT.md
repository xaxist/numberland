# Numberland — LLM Project Guide

Read this first if you are an LLM/agent picking up this repository. It explains what the
project is, how it is structured, and the conventions to follow when changing it.

## What this is

**Numberland** is a static web game that teaches maths to children aged **3–8**. It is a
single-page app with zero dependencies and no build step: plain HTML, CSS, and JavaScript.
It is deployed as-is to **GitHub Pages** from the repository root.

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
   - The home screen is a **single flat grid** of game cards (no age/section grouping).
   - Speech and pending question timers must be cancelled when leaving the game screen.

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

- **Helpers** — `rand`, `pick`, `shuffle`, `$`; content tables `OBJECTS` (emoji + plural word)
  and `SHAPES`; `PRAISES`/`ENCOURAGE` phrase lists.
- **`Sound`** — synthesized effects via Web Audio (`tone()` primitive + `pop`, `count`,
  `correct`, `wrong`, `fanfare`). No audio files. `Sound.enabled` persisted in
  `localStorage['nl_sound']`. AudioContext is created/resumed on first pointer interaction
  (browser autoplay policy).
- **`Speech`** — wraps `speechSynthesis`; `say(text)` cancels any current utterance first,
  picks an English voice, rate 0.95 / pitch 1.15. Gated by `Sound.enabled`.
- **`Confetti`** — full-screen canvas particle shower; `launch(n)`.
- **`State`** — `{ stars, trophies, mode, level, streak, answered, question, timer }`.
  Stars/trophies persist in `localStorage['nl_stars']` / `['nl_trophies']` via `State.save()`.
- **Option builders** — `numberOptions` (near-miss distractors), `multiplyOptions`
  (adjacent-multiple distractors), `pvOptions` (digit-swap distractors), `clockOptions`,
  plus `fmtTime` and `clockSVG(hour, minute)` which renders the analog clock as inline SVG.
- **`Generators`** — one function per game mode, keyed by mode id. Each returns a
  **question object** (contract below).
- **`MODES`** — registry array of `{ id, name, desc, icon, color }`; order = home grid order.
- **Render/flow** — `renderHome`, `renderQuestion`, `onAnswer`, `onCompare`,
  `handleCorrect`, `showReward`, `nextQuestion`, `startMode`, `goHome`, settings modal,
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
| `q.compare`   | `{ left, right, emoji }` — two panels, `q.answer` is `'left'`/`'right'` |
| `q.shapeOptions` | Array of `{ e, w }` shape objects |

### Progression

- Correct answer: +1 star (persisted), praise shown in the **feedback strip** (an in-flow row
  between the question bar and the visuals — never an overlay on top of the answer buttons),
  chime + spoken praise, streak +1.
- **3-streak → level up** (max level 4): confetti, fanfare, spoken "Level up!".
- **Every 10 stars → trophy screen**: big confetti, fanfare, trophy count bumps in the top bar.
- Wrong answer: option dims and disables, spoken encouragement, streak resets. No penalty.
- Generators receive `level` (1–4) and must scale difficulty (see existing modes for ranges).

### Settings modal

Gear button → modal with sound on/off (persisted) and Reset Progress (two-tap confirm;
zeroes stars/trophies). Reset confirm auto-disarms after 3s and on modal close.

## How to add a new game mode

1. Write `Generators.mymode(level)` returning a question object per the contract above.
2. Add `{ id: 'mymode', name, desc, icon, color }` to `MODES`.
3. If it needs a new visual kind, extend `renderQuestion` and `style.css`.
4. Test: serve locally, answer correctly/incorrectly, level up, go home mid-question
   (speech must stop), check the console.

## Local development & testing

```sh
python3 -m http.server 8765   # from repo root, then open http://localhost:8765/
```

(Opening the root shim redirects to `src/`. Serving directly from `src/` also works.)

There is no test suite; verify manually in a browser: each mode renders, correct answers
score stars, wrong answers are gentle, home button stops speech, console has no errors.

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
