/* ============ Numberland — game logic ============ */
'use strict';

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const OBJECTS = [
  { e: '🍎', w: 'apples', s: 'apple' }, { e: '🐥', w: 'chicks', s: 'chick' }, { e: '🎈', w: 'balloons', s: 'balloon' },
  { e: '🐶', w: 'puppies', s: 'puppy' }, { e: '🍓', w: 'strawberries', s: 'strawberry' }, { e: '🦋', w: 'butterflies', s: 'butterfly' },
  { e: '⚽', w: 'balls', s: 'ball' }, { e: '🐠', w: 'fish', s: 'fish' }, { e: '🌸', w: 'flowers', s: 'flower' },
  { e: '🚗', w: 'cars', s: 'car' }, { e: '🧸', w: 'teddy bears', s: 'teddy bear' }, { e: '🍪', w: 'cookies', s: 'cookie' },
  { e: '🐸', w: 'frogs', s: 'frog' }, { e: '🍇', w: 'grapes', s: 'grape' }, { e: '🐱', w: 'kittens', s: 'kitten' },
];

const SHAPES = [
  { e: '🔵', w: 'circle' }, { e: '🟥', w: 'square' }, { e: '🔺', w: 'triangle' },
  { e: '⭐', w: 'star' }, { e: '❤️', w: 'heart' }, { e: '🔶', w: 'diamond' },
];

const PRAISES = ['Great job!', 'Awesome!', 'You did it!', 'Super star!', 'Fantastic!', 'Yay! Well done!', 'Brilliant!'];
const PRAISE_EMOJI = ['🎉', '🌟', '🦄', '🥳', '👏', '🌈', '🚀', '💫'];
const ENCOURAGE = ['Try again!', 'Almost! Have another go!', 'You can do it!'];

/* First wrong tap gets a hint about how to look at the picture, not a shrug. Spoken,
   because the audience cannot read it — and never the answer itself. */
const REDIRECT = {
  count: 'Tap each one to count them, then tap the answer.',
  find: 'Listen again. Tap the speaker to hear the number.',
  compare: 'Look at both sides. Did we want more, or fewer?',
  shapes: 'Look at the shape we want, then tap the one that matches.',
  add: 'Tap the groups and count them all.',
  sub: 'Count the ones that are not crossed out.',
  measure: 'Tap the cubes to count them.',
  data: 'Compare the columns. Tallest is the most, shortest is the fewest.',
  money: 'Add the biggest coin first, then count on.',
  doublehalf: 'Double means two lots of the same number. Half means sharing between two.',
  missing: 'Which number fits in the gap? Count on from the numbers you can see.',
  oddeven: 'Pair them up. If one is left over, it is odd.',
  multiply: 'Count the boxes, then count how many are in each box.',
  patterns: 'What is the rule? Count on from the last number.',
  divide: 'Share them out one at a time to each friend.',
  clock: 'The short hand points at the hour, the long hand at the minutes.',
  placevalue: 'Ones, tens, hundreds — which column is that digit in?',
  fraction: 'Count all the parts, then count the shaded ones.',
  round: 'Find the two numbers it sits between, then pick the closer one.',
  mixed: 'Brackets first, then multiply or divide, then add or subtract.',
};

const OPTION_COLORS = ['#ff6b6b', '#ffa94d', '#4dabf7', '#9775fa', '#f783ac', '#38d9a9'];

/* White alone measured 1.8:1 on the teal and 1.9:1 on the orange answer buttons,
   so every coloured fill gets whichever ink reads better against it. */
function inkFor(hex) {
  const lum = h => {
    const n = parseInt(h.slice(1), 16);
    const chan = shift => {
      const c = ((n >> shift) & 255) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(16) + 0.7152 * chan(8) + 0.0722 * chan(0);
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const l = lum(hex);
  return ratio(l, 1) >= ratio(l, lum('#212529')) ? '#fff' : '#212529';
}

/* ---------- sound effects (Web Audio, no files needed) ---------- */
const Sound = {
  ctx: null,
  enabled: localStorage.getItem('nl_sound') !== 'off',
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur = 0.15, type = 'sine', delay = 0, vol = 0.2) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },
  pop()     { this.tone(700, 0.07, 'square', 0, 0.08); },
  count(n)  { this.tone(400 + n * 60, 0.12, 'triangle', 0, 0.15); },
  correct() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', i * 0.09, 0.22)); },
  wrong()   { this.tone(230, 0.2, 'sine', 0, 0.12); this.tone(180, 0.28, 'sine', 0.12, 0.1); },
  fanfare() {
    [523, 523, 523, 659, 784, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', i * 0.13, 0.22));
  },
};

/* ---------- speech (reads questions aloud for pre-readers) ---------- */
const Speech = {
  supported: 'speechSynthesis' in window,
  // Its own switch: a child who mutes the ding-dong must still hear the questions.
  enabled: localStorage.getItem('nl_voice') !== 'off',
  voice: null,
  // One line at a time, lowest priority first: counting along with the apples must never
  // chop the instruction short, and the instruction must never chop the praise short.
  // Once the child has answered the instruction is spent, so praise may cut in front of it.
  PRIO: { question: 3, answer: 3, praise: 2, count: 1 },
  current: null,
  pending: [],
  init() {
    if (!this.supported) return;
    const load = () => {
      const voices = speechSynthesis.getVoices();
      this.voice =
        voices.find(v => /^en/i.test(v.lang) && /samantha|zira|female|google us english|karen|serena/i.test(v.name)) ||
        voices.find(v => /^en[-_]US/i.test(v.lang)) ||
        voices.find(v => /^en/i.test(v.lang)) || null;
    };
    load();
    speechSynthesis.onvoiceschanged = load;
  },
  say(text, kind = 'praise') {
    if (!this.supported || !this.enabled) return;
    const p = this.PRIO[kind] || 2;
    if (this.current) {
      if (p < this.current.p) {
        if (p === 1) this.pending = this.pending.filter(x => x.p !== 1); // counts must not pile up
        this.pending.push({ text, p });
        return;
      }
      this.pending = [];
      speechSynthesis.cancel();
      this.current = null;
    }
    this.start(text, p);
  },
  start(text, p) {
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1.15;
    u.onend = u.onerror = () => {
      if (!this.current || this.current.u !== u) return;
      this.current = null;
      const next = this.pending.shift();
      if (next) this.start(next.text, next.p);
    };
    this.current = { text, p, u };
    speechSynthesis.speak(u);
  },
  busy() { return !!this.current || this.pending.length > 0; },
  stop() {
    if (!this.supported) return;
    this.pending = [];
    this.current = null;
    speechSynthesis.cancel();
  },
};

/* ---------- confetti ---------- */
const Confetti = {
  canvas: null, ctx: null, parts: [], raf: null,
  COLORS: ['#ff6b6b', '#ffa94d', '#ffd43b', '#51cf66', '#4dabf7', '#9775fa', '#f783ac'],
  init() {
    this.canvas = $('#confetti-canvas');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  launch(n = 100) {
    const w = this.canvas.width;
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: rand(0, w),
        y: rand(-60, -10),
        vx: (Math.random() - 0.5) * 2.2,
        vy: 2 + Math.random() * 3.2,
        size: 6 + Math.random() * 7,
        color: pick(this.COLORS),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        round: Math.random() < 0.35,
      });
    }
    if (!this.raf) this.loop();
  },
  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.parts = this.parts.filter(p => p.y < canvas.height + 30);
    if (this.parts.length === 0) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    for (const p of this.parts) {
      p.x += p.vx + Math.sin(p.y / 40);
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    }
  },
};

/* ---------- persistent state ---------- */
const State = {
  stars: parseInt(localStorage.getItem('nl_stars') || '0', 10),
  trophies: parseInt(localStorage.getItem('nl_trophies') || '0', 10),
  mode: null,
  level: 1,
  streak: 0,
  misses: 0,
  answered: false,
  question: null,
  timer: null,
  save() {
    localStorage.setItem('nl_stars', String(this.stars));
    localStorage.setItem('nl_trophies', String(this.trophies));
  },
};

/* ---------- question generators ---------- */
function numberOptions(correct, count, min, max) {
  const set = new Set([correct]);
  let guard = 0;
  while (set.size < count && guard++ < 60) {
    const d = correct + pick([-3, -2, -1, 1, 2, 3]);
    if (d >= min && d <= max) set.add(d);
  }
  while (set.size < count) set.add(rand(min, max));
  return shuffle([...set]);
}

/* Build an option list from candidate values, keeping the answer and dropping
   out-of-range or duplicate candidates. */
function optionSet(correct, cands, count, min = 1) {
  const set = new Set([correct]);
  for (const c of shuffle(cands)) {
    if (set.size >= count) break;
    if (c !== correct && (typeof c === 'string' || (Number.isInteger(c) && c >= min))) set.add(c);
  }
  let e = 1;
  while (set.size < count && typeof correct === 'number') {
    if (correct + e >= min) set.add(correct + e);
    e++;
  }
  return shuffle([...set].slice(0, Math.max(count, set.size)));
}

/* Distractors close to the answer, useful once numbers get big. */
function nearOptions(correct, count, deltas, min = 1) {
  return optionSet(correct, deltas.map(d => correct + d), count, min);
}

function multiplyOptions(product, table) {
  const set = new Set([product]);
  const cands = shuffle([product - table, product + table, product + 2 * table, product - 2 * table, product + 1, product - 1, product + 10, product - 10]);
  for (const c of cands) {
    if (set.size >= 4) break;
    if (c >= 0) set.add(c);
  }
  return shuffle([...set]);
}

function pvOptions(n) {
  const set = new Set([n]);
  const hundreds = Math.floor(n / 100), tens = Math.floor(n / 10) % 10, ones = n % 10;
  const swapped = hundreds * 100 + ones * 10 + tens;
  if (swapped !== n && swapped >= 0) set.add(swapped);
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    const d = n + pick([-100, 100, -10, 10, -2, 2, -1, 1]);
    if (d >= 0) set.add(d);
  }
  return shuffle([...set]);
}

/* "1 ten" / "3 tens" — place value wording */
function placeLabel(v, unit) {
  return `${v} ${v === 1 ? unit : unit + 's'}`;
}

function fmtTime(hour, minute) {  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function clockOptions(hour, minute, count, jitter = false) {
  const set = new Set([fmtTime(hour, minute)]);
  let guard = 0;
  while (set.size < count && guard++ < 60) {
    let h = hour + pick([-2, -1, 1, 2]);
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    let m = minute;
    if (jitter) {
      m = minute + pick([-20, -15, -10, -5, 5, 10, 15, 20]);
      if (m < 0) m += 60;
      if (m > 59) m -= 60;
    }
    set.add(fmtTime(h, m));
  }
  return shuffle([...set]);
}

/* 1/2 and 3/6 name the same amount. That is true both for an answer a child may give
   (which must be accepted) and for a distractor we must never offer as wrong. */
function fractionParts(v) {
  return /^\d+\/\d+$/.test(String(v)) ? String(v).split('/').map(Number) : null;
}

function sameAmount(value, answer) {
  if (value === answer) return true;
  const a = fractionParts(value), b = fractionParts(answer);
  return !!a && !!b && a[0] * b[1] === a[1] * b[0];
}

function fracOptions(den, num, count) {
  const correct = `${num}/${den}`;
  const cands = [];
  const push = f => { if (!sameAmount(f, correct) && !cands.includes(f)) cands.push(f); };
  if (num + 1 <= den) push(`${num + 1}/${den}`);
  if (num - 1 >= 1) push(`${num - 1}/${den}`);
  if (den - num >= 1) push(`${den - num}/${den}`);
  push(`${num}/${den + 2}`);
  push(`${num}/${den * 2}`);
  for (const f of ['1/2', '1/3', '1/4', '2/3', '3/4', '1/6', '5/6', '3/8']) push(f);
  return optionSet(correct, cands, count, 0);
}

function pieSVG(parts, shaded) {
  const c = 84, r = 72;
  let svg = `<svg viewBox="0 0 168 168" width="168" height="168" role="img" aria-label="Fraction picture">`;
  svg += `<circle cx="${c}" cy="${c}" r="${r + 5}" fill="#ffffff"/>`;
  for (let i = 0; i < parts; i++) {
    const a0 = (i * 360 / parts - 90) * Math.PI / 180;
    const a1 = ((i + 1) * 360 / parts - 90) * Math.PI / 180;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    svg += `<path d="M ${c} ${c} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${i < shaded ? '#ff6b6b' : '#e9ecef'}" stroke="#343a40" stroke-width="3"/>`;
  }
  return `${svg}</svg>`;
}

function clockSVG(hour, minute) {
  const hand = (angleDeg, len, width, color) => {
    const rad = (angleDeg - 90) * Math.PI / 180;
    const x = 90 + len * Math.cos(rad);
    const y = 90 + len * Math.sin(rad);
    return `<line x1="90" y1="90" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * Math.PI / 180;
    const x = 90 + 62 * Math.sin(a);
    const y = 90 - 62 * Math.cos(a);
    ticks += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="16" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#343a40">${i === 0 ? 12 : i}</text>`;
  }
  const minAngle = minute * 6;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  return `<svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="clock">
    <circle cx="90" cy="90" r="84" fill="#ffffff" stroke="#4dabf7" stroke-width="8"/>
    ${ticks}
    ${hand(hourAngle, 42, 8, '#343a40')}
    ${hand(minAngle, 62, 5, '#ff6b6b')}
    <circle cx="90" cy="90" r="7" fill="#ffd43b"/>
  </svg>`;
}

const Generators = {
  count(level) {
    const max = level === 1 ? 5 : level === 2 ? 10 : level === 3 ? 15 : 20;
    const n = rand(1, max);
    const obj = pick(OBJECTS);
    return {
      type: 'count',
      text: `How many ${obj.w} do you see? Tap them to count!`,
      speak: `How many ${obj.w} do you see? Tap them to count, then tap the answer!`,
      objects: { emoji: obj.e, total: n, crossed: 0 },
      options: numberOptions(n, 3, 1, Math.max(7, max)),
      answer: n,
    };
  },

  find(level) {
    const max = level === 1 ? 5 : level === 2 ? 10 : level === 3 ? 100 : 999;
    const target = rand(1, max);
    return {
      type: 'options',
      text: `Tap the number ${target}!`,
      speak: `Tap the number ${target}!`,
      objects: null,
      options: numberOptions(target, 4, 1, Math.max(9, max)),
      answer: target,
    };
  },

  add(level) {
    if (level >= 4) {
      const a = rand(120, 699);
      const b = rand(110, 999 - a);
      const sum = a + b;
      return {
        type: 'options',
        text: `${a} + ${b} = ?`,
        speak: `What is ${a} plus ${b}? Line up the tens and ones!`,
        visualText: `${a} + ${b} = ❓`,
        options: nearOptions(sum, 4, [-100, -10, -1, 1, 10, 100], 1),
        answer: sum,
      };
    }
    const maxSum = level === 1 ? 5 : level === 2 ? 10 : 20;
    const a = rand(1, maxSum - 1);
    const b = rand(1, maxSum - a);
    const obj = pick(OBJECTS);
    const sum = a + b;
    return {
      type: 'add',
      text: `${a} + ${b} = ?`,
      speak: `What is ${a} plus ${b}? Count all the ${obj.w}!`,
      objects: { emoji: obj.e, total: sum, crossed: 0, split: a },
      options: numberOptions(sum, 3, 1, maxSum + 3),
      answer: sum,
    };
  },

  sub(level) {
    if (level >= 4) {
      const a = rand(300, 999);
      const b = rand(110, a - 100);
      const result = a - b;
      return {
        type: 'options',
        text: `${a} − ${b} = ?`,
        speak: `What is ${a} minus ${b}? Watch out for exchanging!`,
        visualText: `${a} − ${b} = ❓`,
        options: nearOptions(result, 4, [-100, -10, -1, 1, 10, 100], 1),
        answer: result,
      };
    }
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
    const a = rand(2, max);
    const b = rand(1, level === 1 ? a - 1 : a);
    const obj = pick(OBJECTS);
    const result = a - b;
    return {
      type: 'sub',
      text: `${a} − ${b} = ?`,
      speak: `What is ${a} take away ${b}? Count the ${obj.w} that are left!`,
      objects: { emoji: obj.e, total: a, crossed: b },
      options: numberOptions(result, 3, 0, max),
      answer: result,
    };
  },

  compare(level) {
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
    const minGap = level === 1 ? 2 : level === 2 ? 3 : 5;
    const left = rand(1, max);
    let right = rand(1, max);
    // "Which has more" must be answerable by looking: 20 next to 19 is a counting exercise,
    // not a comparison, and it cannot be seen in a phone-sized panel at all.
    let guard = 0;
    while (Math.abs(right - left) < minGap && guard++ < 80) right = rand(1, max);
    const askMore = Math.random() < 0.5;
    const obj = pick(OBJECTS);
    const winner = askMore ? (left > right ? 'left' : 'right') : (left < right ? 'left' : 'right');
    return {
      type: 'compare',
      text: askMore ? 'Which side has MORE?' : 'Which side has FEWER?',
      speak: askMore
        ? `Which side has more ${obj.w}? Tap the side!`
        : `Which side has fewer ${obj.w}? Tap the side!`,
      compare: { left, right, emoji: obj.e, askMore },
      answer: winner,
    };
  },

  shapes(level) {
    const count = level === 1 ? 3 : Math.min(6, 3 + level);
    const options = shuffle(SHAPES).slice(0, count);
    const target = pick(options);
    return {
      type: 'shapes',
      text: `Find the ${target.w}!`,
      speak: `Can you find the ${target.w}? Tap it!`,
      objects: null,
      shapeOptions: options,
      answer: target.w,
    };
  },

  missing(level) {
    if (level >= 4) {
      const useSub = Math.random() < 0.5;
      if (useSub) {
        const a = rand(400, 999);
        const r = rand(110, a - 100);
        const b = a - r;
        return {
          type: 'options',
          text: `${a} − ? = ${r}`,
          speak: `What is the missing number? ${a} minus what equals ${r}?`,
          visualText: `${a} − ❓ = ${r}`,
          options: nearOptions(b, 4, [-100, -10, -1, 1, 10, 100], 1),
          answer: b,
        };
      }
      const sum = rand(500, 999);
      const a = rand(110, sum - 110);
      const b = sum - a;
      return {
        type: 'options',
        text: `${a} + ? = ${sum}`,
        speak: `What is the missing number? ${a} plus what equals ${sum}?`,
        visualText: `${a} + ❓ = ${sum}`,
        options: nearOptions(b, 4, [-100, -10, -1, 1, 10, 100], 1),
        answer: b,
      };
    }
    const max = level === 1 ? 10 : level === 2 ? 15 : 20;
    const useSub = level >= 2 && Math.random() < 0.5;
    if (useSub) {
      const a = rand(3, max);
      const r = rand(1, a - 1);
      const b = a - r;
      return {
        type: 'options',
        text: `${a} − ? = ${r}`,
        speak: `What is the missing number? ${a} minus what equals ${r}?`,
        visualText: `${a} − ❓ = ${r}`,
        options: numberOptions(b, 4, 0, max),
        answer: b,
      };
    }
    const sum = rand(4, max);
    const a = rand(1, sum - 1);
    const b = sum - a;
    return {
      type: 'options',
      text: `${a} + ? = ${sum}`,
      speak: `What is the missing number? ${a} plus what equals ${sum}?`,
      visualText: `${a} + ❓ = ${sum}`,
      options: numberOptions(b, 4, 0, max),
      answer: b,
    };
  },

  multiply(level) {
    if (level >= 4) {
      const big = Math.random() < 0.4;
      const a = big ? rand(11, 19) : pick([6, 7, 8, 9, 12]);
      const b = big ? rand(3, 9) : rand(2, 12);
      const product = a * b;
      return {
        type: 'options',
        text: `${a} × ${b} = ?`,
        speak: `What is ${a} times ${b}?`,
        visualText: `${a} × ${b} = ❓`,
        options: multiplyOptions(product, a),
        answer: product,
      };
    }
    const tables = level === 1 ? [2, 5, 10] : level === 2 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 9];
    const a = pick(tables);
    const b = rand(1, level === 1 ? 5 : level === 2 ? 6 : 9);
    const product = a * b;
    const q = {
      type: 'options',
      text: `${a} × ${b} = ?`,
      speak: `What is ${a} times ${b}? ${a} groups of ${b}.`,
      visualText: `${a} × ${b} = ❓`,
      options: multiplyOptions(product, a),
      answer: product,
    };
    if (product <= 24) q.groups = { count: a, size: b, emoji: pick(OBJECTS).e };
    return q;
  },

  patterns(level) {
    const steps = level === 1 ? [1, 2] : level === 2 ? [2, 5, 10] : [2, 3, 4, 5, 10];
    const shown = level === 1 ? 3 : 4;
    const doubling = level >= 3 && Math.random() < 0.3;
    let seq, answer;
    if (doubling) {
      const s0 = pick([2, 3, 5]);
      seq = [s0, s0 * 2, s0 * 4, s0 * 8];
      answer = s0 * 16;
    } else {
      const step = pick(steps);
      const down = level >= 3 && Math.random() < 0.4;
      const start = down ? rand(step * shown + 1, step * shown + 10) : rand(1, 10);
      seq = [];
      for (let i = 0; i < shown; i++) seq.push(start + (down ? -step : step) * i);
      answer = start + (down ? -step : step) * shown;
    }
    return {
      type: 'options',
      text: 'What comes next?',
      speak: `What comes next? ${seq.join(', ')}, what?`,
      visualText: seq.join(' → ') + ' → ❓',
      options: optionSet(answer, [answer - 1, answer + 1, answer - 10, answer + 10, seq[seq.length - 1] * 2, answer * 2], level === 1 ? 3 : 4, 0),
      answer,
    };
  },

  oddeven(level) {
    const max = level === 1 ? 10 : level === 2 ? 30 : level === 3 ? 99 : 999;
    const n = rand(1, max);
    const q = {
      type: 'options',
      text: `Is ${n} odd or even?`,
      speak: `Is ${n} odd or even?`,
      options: shuffle(['ODD', 'EVEN']),
      answer: n % 2 === 1 ? 'ODD' : 'EVEN',
    };
    if (n <= 16) q.pairs = { n, emoji: pick(OBJECTS).e };
    else q.visualText = String(n);
    return q;
  },

  doublehalf(level) {
    const obj = pick(OBJECTS);
    if (Math.random() < 0.5) {
      const n = level === 1 ? rand(1, 5) : level === 2 ? rand(2, 8) : level === 3 ? rand(5, 12) : rand(13, 49);
      const answer = n * 2;
      const q = {
        type: 'options',
        text: `What is double ${n}?`,
        speak: `What is double ${n}? Two lots of ${n}.`,
        options: nearOptions(answer, level === 1 ? 3 : 4, [-n, -2, -1, 1, 2, 3], 1),
        answer,
      };
      if (answer <= 20) q.objects = { emoji: obj.e, total: answer, crossed: 0, split: n };
      else q.visualText = `${n} + ${n} = ❓`;
      return q;
    }
    const whole = level === 1 ? pick([2, 4, 6, 8, 10])
      : level === 2 ? pick([4, 6, 8, 10, 12, 16, 18, 20])
      : level === 3 ? pick([12, 14, 16, 18, 20, 24, 30, 40])
      : pick([22, 24, 26, 28, 32, 34, 46, 48, 56, 68, 74, 86, 98]);
    const answer = whole / 2;
    const q = {
      type: 'options',
      text: `What is half of ${whole}?`,
      speak: `What is half of ${whole}? Share ${whole} between two.`,
      options: nearOptions(answer, level === 1 ? 3 : 4, [answer, -2, -1, 1, 2, 4], 1),
      answer,
    };
    if (answer <= 10) q.groups = { count: 2, size: answer, emoji: obj.e };
    else q.visualText = `${whole} ÷ 2 = ❓`;
    return q;
  },

  placevalue(level) {
    if (level >= 4) {
      if (Math.random() < 0.5) {
        const th = rand(1, 6), h = rand(0, 9), t = rand(0, 9), o = rand(1, 9);
        const made = th * 1000 + h * 100 + t * 10 + o;
        return {
          type: 'options',
          text: `${placeLabel(th, 'thousand')} + ${placeLabel(h, 'hundred')} + ${placeLabel(t, 'ten')} + ${placeLabel(o, 'one')} = ?`,
          speak: `What is ${placeLabel(th, 'thousand')}, ${placeLabel(h, 'hundred')}, ${placeLabel(t, 'ten')} and ${placeLabel(o, 'one')}?`,
          visualText: `${th * 1000} + ${h * 100} + ${t * 10} + ${o} = ❓`,
          options: nearOptions(made, 4, [-1000, -100, -10, 10, 100, 1000, -1, 1], 1),
          answer: made,
        };
      }
      // Four different digits: "the value of the 2 in 2123" has two right answers, which is
      // not a question. A repeated digit made the question formally unanswerable.
      const ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
      if (ds[0] === 0) { const j = rand(1, 9); ds[0] = ds[j]; ds[j] = 0; }
      const digits = { th: ds[0], h: ds[1], t: ds[2], o: ds[3] };
      const values = { th: digits.th * 1000, h: digits.h * 100, t: digits.t * 10, o: digits.o };
      const n = values.th + values.h + values.t + values.o;
      const spot = { th: 0, h: 1, t: 2, o: 3 };
      const place = pick(['th', 'h', 't', 'o'].filter(p => digits[p] > 0));
      const answer = values[place];
      const d = digits[place];
      return {
        type: 'options',
        text: `What is the value of the ${d} in ${n}?`,
        speak: `What is the value of the highlighted digit ${d} in the number ${n}?`,
        visualText: String(n),
        mark: spot[place],
        options: optionSet(answer, [d, d * 10, d * 100, d * 1000, answer * 10, answer / 10], 4, 1),
        answer,
      };
    }
    const type = level >= 3 ? pick(['make3', 'tens']) : pick(['make2', 'make2', 'tens']);
    if (type === 'make3') {
      const h = rand(1, 5), t = rand(0, 9), o = rand(0, 9);
      const n = h * 100 + t * 10 + o;
      return {
        type: 'options',
        text: `${placeLabel(h, 'hundred')} + ${placeLabel(t, 'ten')} + ${placeLabel(o, 'one')} = ?`,
        speak: `What is ${placeLabel(h, 'hundred')}, ${placeLabel(t, 'ten')} and ${placeLabel(o, 'one')}?`,
        visualText: `${h * 100} + ${t * 10} + ${o} = ❓`,
        options: pvOptions(n),
        answer: n,
      };
    }
    if (type === 'tens') {
      const n = rand(2, 9) * 10 + rand(1, 9);
      const tens = Math.floor(n / 10);
      return {
        type: 'options',
        text: `How many tens in ${n}?`,
        speak: `How many tens are in ${n}?`,
        visualText: String(n),
        options: numberOptions(tens, 3, 0, 9),
        answer: tens,
      };
    }
    const t = rand(1, level === 1 ? 5 : 9);
    const o = rand(1, 9);
    const n = t * 10 + o;
    return {
      type: 'options',
      text: `${placeLabel(t, 'ten')} + ${placeLabel(o, 'one')} = ?`,
      speak: `What is ${placeLabel(t, 'ten')} and ${placeLabel(o, 'one')}?`,
      visualText: `${t * 10} + ${o} = ❓`,
      options: pvOptions(n),
      answer: n,
    };
  },

  clock(level) {
    const minute = level === 1 ? 0 : level === 2 ? pick([0, 30]) : level === 3 ? pick([0, 15, 30, 45]) : pick([0, 5, 10, 20, 25, 35, 40, 50, 55]);
    const hour = rand(1, 12);
    return {
      type: 'options',
      text: 'What time is it? 🕐',
      speak: 'What time is it? Look at the clock!',
      clock: { hour, minute },
      options: clockOptions(hour, minute, level === 1 ? 3 : 4, level >= 4),
      answer: fmtTime(hour, minute),
    };
  },

  /* ---- new concepts for older kids ---- */

  divide(level) {
    const groups = level === 1 ? rand(2, 3) : level === 2 ? rand(2, 5) : rand(3, 9);
    const size = level === 1 ? rand(1, 4) : level === 2 ? rand(2, 5) : rand(2, 9);
    const total = groups * size;
    const obj = pick(OBJECTS);
    const q = {
      type: 'options',
      text: `Share ${total} ${obj.w} between ${groups} friends. How many each?`,
      speak: `Share ${total} ${obj.w} equally between ${groups} friends. How many does each friend get?`,
      visualText: `${total} ÷ ${groups} = ❓`,
      options: optionSet(size, [size - 1, size + 1, size - 2, size + 2, groups, total - size], level === 1 ? 3 : 4, 1),
      answer: size,
    };
    if (total <= 24) q.groups = { count: groups, size, emoji: obj.e };
    return q;
  },

  fraction(level) {
    const den = level === 1 ? 2 : level === 2 ? pick([2, 4]) : level === 3 ? pick([3, 4, 6]) : pick([5, 6, 8, 10, 12]);
    const num = rand(1, den - 1);
    return {
      type: 'options',
      text: 'What fraction of the pizza is shaded?',
      speak: 'What fraction of this pizza is shaded? Count all the parts, then count the shaded ones!',
      pie: { parts: den, shaded: num },
      options: fracOptions(den, num, level === 1 ? 3 : 4),
      answer: `${num}/${den}`,
    };
  },

  money(level) {
    const coins = level === 1 ? [1, 2] : level === 2 ? [1, 2, 5, 10] : level === 3 ? [1, 5, 10, 20] : [1, 2, 5, 10, 20, 50];
    const count = level === 1 ? rand(2, 4) : level === 2 ? rand(3, 5) : rand(3, 6);
    const held = [];
    for (let i = 0; i < count; i++) held.push(pick(coins));
    const total = held.reduce((s, c) => s + c, 0);
    const deltas = [];
    for (const c of held) { deltas.push(-c, c); }
    return {
      type: 'options',
      text: 'How much treasure is in the pot?',
      speak: 'Count the gold coins! Add up the biggest ones first. How much treasure altogether?',
      coins: held,
      options: optionSet(total, deltas.concat([-2, -1, 1, 2, 5, 10]).map(d => total + d), 4, 1),
      answer: total,
    };
  },

  measure(level) {
    const cells = level === 1 ? 6 : level === 2 ? 10 : level === 3 ? 15 : 20;
    const asking = level >= 3 ? pick(['len', 'diff']) : 'len';
    const objA = pick(OBJECTS);
    let objB = pick(OBJECTS);
    while (objB.e === objA.e) objB = pick(OBJECTS);
    const lenA = rand(2, cells);
    if (asking === 'diff') {
      let lenB = rand(1, cells);
      while (lenB === lenA) lenB = rand(1, cells);
      const long = Math.max(lenA, lenB);
      const short = Math.min(lenA, lenB);
      const diff = long - short;
      return {
        type: 'options',
        text: `How much longer is the ${objA.s} than the ${objB.s}?`,
        speak: `Measure both! Tap the cubes on each row. How much longer is the ${objA.s} than the ${objB.s}?`,
        measure: { cells, items: [{ emoji: objA.e, len: long }, { emoji: objB.e, len: short }] },
        options: optionSet(diff, [diff - 1, diff + 1, diff - 2, diff + 2, long, short].filter(v => v > 0), 4, 1),
        answer: diff,
      };
    }
    return {
      type: 'options',
      text: `How many cubes long is the ${objA.s}?`,
      speak: `How many cubes long is the ${objA.s}? Tap the cubes to count them!`,
      measure: { cells, items: [{ emoji: objA.e, len: lenA }] },
      // The grid width is never a plausible answer once the row only shows the cubes that
      // cover the object — offering it taught children to count the boxes instead.
      options: optionSet(lenA, [lenA - 1, lenA + 1, lenA - 2, lenA + 2].filter(v => v > 0), level === 1 ? 3 : 4, 1),
      answer: lenA,
    };
  },

  round(level) {
    const nearest = level <= 2 ? 10 : level === 3 ? pick([10, 100]) : pick([100, 1000]);
    let n;
    if (nearest === 10) n = rand(11, 99);
    else if (nearest === 100) n = rand(110, 989);
    else n = rand(1100, 9890);
    if (n % nearest === 0) n += rand(1, nearest - 1);
    const lower = Math.floor(n / nearest) * nearest;
    const upper = lower + nearest;
    const answer = n - lower >= nearest - (n - lower) ? upper : lower;
    return {
      type: 'options',
      text: `Round ${n} to the nearest ${nearest}.`,
      speak: `Round ${n} to the nearest ${nearest}! Which is it closer to?`,
      visualText: `${n} → ❓`,
      options: optionSet(answer, [lower, upper, answer + nearest, answer - nearest, n].filter(v => v > 0), 4, 1),
      answer,
    };
  },

  data(level) {
    const kinds = shuffle(OBJECTS).slice(0, level === 1 ? 3 : 4);
    const max = level === 1 ? 5 : level === 2 ? 8 : 10;
    const used = [];
    for (const k of kinds) {
      let n = rand(1, max);
      while (used.includes(n)) n = rand(1, max);
      used.push(n);
      k.n = n;
    }
    const asked = shuffle(kinds);
    const question = level === 1 ? pick(['most', 'fewest']) : pick(['most', 'fewest', 'count', 'diff']);
    if (question === 'count') {
      const target = asked[0];
      return {
        type: 'options',
        text: `How many ${target.w} were counted?`,
        speak: `Look at the graph. How many ${target.w} were counted?`,
        chart: asked,
        options: optionSet(target.n, [target.n - 1, target.n + 1, target.n - 2, target.n + 2].filter(v => v > 0), 4, 1),
        answer: target.n,
      };
    }
    if (question === 'diff') {
      const [a, b] = asked[0].n > asked[1].n ? [asked[0], asked[1]] : [asked[1], asked[0]];
      const diff = a.n - b.n;
      return {
        type: 'options',
        text: `How many more ${a.w} than ${b.w}?`,
        speak: `How many more ${a.w} are there than ${b.w}?`,
        chart: asked,
        options: optionSet(diff, [diff - 1, diff + 1, diff - 2, diff + 2, a.n].filter(v => v > 0), 4, 1),
        answer: diff,
      };
    }
    const sorted = asked.slice().sort((x, y) => (question === 'most' ? y.n - x.n : x.n - y.n));
    const winner = sorted[0];
    return {
      type: 'options',
      text: question === 'most' ? 'Which group has the MOST?' : 'Which group has the FEWEST?',
      speak: question === 'most'
        ? 'Look at the graph! Which group has the most?'
        : 'Look at the graph! Which group has the fewest?',
      chart: asked,
      options: shuffle(asked.map(k => k.e)),
      answer: winner.e,
    };
  },

  mixed(level) {
    const kinds = level === 1 ? ['addMul', 'mulAdd']
      : level === 2 ? ['addMul', 'mulAdd', 'subDiv', 'bracket']
      : level === 3 ? ['subDiv', 'bracket', 'twoMul', 'minus']
      : ['twoMul', 'minus', 'bracket', 'subDiv'];
    const big = level >= 4;
    const kind = pick(kinds);
    let a, b, c, d, text, speak, visualText, answer, trap;
    if (kind === 'addMul') {
      b = rand(2, big ? 9 : 5); c = rand(2, big ? 9 : 6); a = rand(1, 9);
      answer = a + b * c; trap = (a + b) * c;
      text = `${a} + ${b} × ${c} = ?`;
      speak = `What is ${a} plus ${b} times ${c}? Do the multiplication first!`;
    } else if (kind === 'subDiv') {
      c = rand(2, 6);
      const q = rand(2, big ? 9 : 6);
      const k = rand(1, 4);
      b = c * q;
      a = c * (q + k);
      answer = a - q; trap = k;
      text = `${a} − ${b} ÷ ${c} = ?`;
      speak = `What is ${a} minus ${b} divided by ${c}? Do the division first!`;
    } else if (kind === 'mulAdd') {
      a = rand(2, big ? 9 : 6); b = rand(2, big ? 9 : 6); c = rand(1, 9);
      answer = a * b + c; trap = a * (b + c);
      text = `${a} × ${b} + ${c} = ?`;
      speak = `What is ${a} times ${b}, plus ${c}?`;
    } else if (kind === 'bracket') {
      a = rand(2, 9); b = rand(2, 9); c = rand(2, big ? 9 : 5);
      answer = (a + b) * c; trap = a + b * c;
      text = `(${a} + ${b}) × ${c} = ?`;
      speak = `What is the sum of ${a} and ${b}, all multiplied by ${c}?`;
    } else if (kind === 'twoMul') {
      a = rand(2, 6); b = rand(2, 6); c = rand(2, 5); d = rand(2, 5);
      answer = a * b + c * d; trap = (a + c) * (b + d);
      text = `${a} × ${b} + ${c} × ${d} = ?`;
      speak = `What is ${a} times ${b}, plus ${c} times ${d}? Do both multiplications first!`;
    } else {
      a = rand(6, big ? 20 : 12); b = rand(2, a - 2); c = rand(2, big ? 9 : 5);
      answer = (a - b) * c; trap = a - b * c;
      text = `(${a} − ${b}) × ${c} = ?`;
      speak = `What is ${a} minus ${b}, all multiplied by ${c}?`;
    }
    return {
      type: 'options',
      text,
      speak,
      visualText: text.replace('= ?', '= ❓'),
      options: optionSet(answer, [trap, answer - 1, answer + 1, answer - 2, answer + 2, answer + 10].filter(v => v > 0), 4, 1),
      answer,
      trap,
    };
  },
};

// Ordered by difficulty: youngest starting level first, then by how high the ceiling goes.
// The home grid renders in this exact order, so keep new modes inserted, not appended.
const MODES = [
  { id: 'count',      name: 'Counting',     desc: 'Count the objects',       icon: '🍎', color: '#ff6b6b' },
  { id: 'find',       name: 'Find Number',  desc: 'Spot the number',         icon: '🔢', color: '#4dabf7' },
  { id: 'compare',    name: 'More or Less', desc: 'Which side wins?',        icon: '⚖️', color: '#9775fa' },
  { id: 'shapes',     name: 'Shapes',       desc: 'Name that shape',         icon: '🔷', color: '#f783ac' },
  { id: 'add',        name: 'Adding',       desc: 'Put groups together',     icon: '➕', color: '#51cf66' },
  { id: 'sub',        name: 'Take Away',    desc: 'How many are left?',      icon: '➖', color: '#ffa94d' },
  { id: 'measure',    name: 'Measure',      desc: 'How many cubes long?',    icon: '📏', color: '#7048e8' },
  { id: 'data',       name: 'My Graph',     desc: 'Read the picture graph',  icon: '📊', color: '#12b886' },
  { id: 'money',      name: 'Treasure',     desc: 'Count the coins',         icon: '🪙', color: '#fab005' },
  { id: 'doublehalf', name: 'Double or Half', desc: 'Twice as many',           icon: '🌗', color: '#0c8599' },
  { id: 'missing',    name: 'Missing No.',  desc: 'Solve the gap',           icon: '❓', color: '#20c997' },
  { id: 'oddeven',    name: 'Odd or Even',  desc: 'Pair them up',            icon: '👯', color: '#d6336c' },
  { id: 'multiply',   name: 'Multiply',     desc: 'Times tables fun',        icon: '✖️', color: '#f03e3e' },
  { id: 'patterns',   name: 'Patterns',     desc: 'What comes next?',        icon: '🧩', color: '#4263eb' },
  { id: 'divide',     name: 'Share Fairly', desc: 'Divide into groups',      icon: '🍰', color: '#e64980' },
  { id: 'clock',      name: 'Clock Time',   desc: 'Read the clock',          icon: '🕐', color: '#f76707' },
  { id: 'placevalue', name: 'Place Value',  desc: 'Tens, hundreds, more',    icon: '🧮', color: '#0ca678' },
  { id: 'fraction',   name: 'Fractions',    desc: 'Parts of a whole',        icon: '🍕', color: '#ae3ec9' },
  { id: 'round',      name: 'Rounding',     desc: 'Round it to the nearest', icon: '🎯', color: '#5c7cfa' },
  { id: 'mixed',      name: 'Brain Order',  desc: 'Brackets come first',     icon: '🧠', color: '#82c91e' },
];

/* ---------- UI rendering ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`#${id}`).classList.remove('hidden');
  $('#btn-back').classList.toggle('hidden', id === 'screen-home');
  // The logo and the back button share the top-left slot; on a phone they do not both fit.
  $('#logo').classList.toggle('hidden', id !== 'screen-home');
  // A card near the bottom of the grid would otherwise leave the question bar off-screen.
  window.scrollTo(0, 0);
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateCounters(bumpStars = false, bumpTrophies = false) {
  $('#star-count').textContent = State.stars;
  $('#trophy-count').textContent = State.trophies;
  if (bumpStars) bump($('#star-counter'));
  if (bumpTrophies) bump($('#trophy-counter'));
}

function renderHome() {
  const grid = $('#mode-grid');
  grid.innerHTML = '';
  for (const m of MODES) {
    const btn = document.createElement('button');
    btn.className = 'mode-card';
    btn.style.background = `linear-gradient(160deg, ${m.color}, ${m.color}cc)`;
    btn.style.color = inkFor(m.color);
    btn.innerHTML = `<span class="mode-icon">${m.icon}</span>
                     <span class="mode-name">${m.name}</span>
                     <span class="mode-desc">${m.desc}</span>`;
    // Holding a card reads its name out loud and does not start the game, so a pre-reader
    // can browse the grid by ear. A tap still starts it immediately.
    let pressTimer = null;
    let held = false;
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('pointerdown', () => {
      held = false;
      pressTimer = setTimeout(() => { held = true; Speech.stop(); Speech.say(m.name, 'question'); }, 450);
    });
    const releasePress = () => clearTimeout(pressTimer);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, releasePress));
    btn.addEventListener('click', () => {
      Sound.init();
      if (held) return;
      Sound.pop();
      startMode(m.id);
    });
    grid.appendChild(btn);
  }
}

function renderQuestion(q) {
  $('#question-text').textContent = q.text;
  $('#level-badge').textContent = `Level ${State.level}`;
  $('#streak-dots').textContent = '🔥'.repeat(Math.min(State.streak, 3));

  const visual = $('#visual');
  const options = $('#options');
  visual.innerHTML = '';
  options.innerHTML = '';

  if (q.type === 'compare') {
    const wrap = document.createElement('div');
    wrap.className = 'compare-wrap';
    for (const side of ['left', 'right']) {
      const panel = document.createElement('button');
      panel.className = 'compare-panel';
      panel.dataset.side = side;
      const n = q.compare[side];
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'obj';
        s.style.animationDelay = `${i * 0.05}s`;
        s.textContent = q.compare.emoji;
        panel.appendChild(s);
      }
      panel.addEventListener('click', () => onCompare(panel, side, q));
      wrap.appendChild(panel);
    }
    visual.appendChild(wrap);
    return;
  }

  if (q.visualText) {
    const d = document.createElement('div');
    d.className = 'visual-text';
    if (q.mark !== undefined) {
      // Built from text nodes, not markup, so nothing about the question can inject HTML.
      String(q.visualText).split('').forEach((ch, i) => {
        if (i !== q.mark) { d.appendChild(document.createTextNode(ch)); return; }
        const m = document.createElement('span');
        m.className = 'digit-mark';
        m.textContent = ch;
        d.appendChild(m);
      });
    } else {
      d.textContent = q.visualText;
    }
    visual.appendChild(d);
  }

  if (q.clock) {
    const d = document.createElement('div');
    d.className = 'clock-wrap';
    d.innerHTML = clockSVG(q.clock.hour, q.clock.minute);
    visual.appendChild(d);
  }

  if (q.pie) {
    const d = document.createElement('div');
    d.className = 'pie-wrap';
    d.innerHTML = pieSVG(q.pie.parts, q.pie.shaded);
    visual.appendChild(d);
  }

  if (q.coins) {
    const d = document.createElement('div');
    d.className = 'coins-wrap';
    q.coins.slice().sort((a, b) => b - a).forEach((v, i) => {
      const c = document.createElement('span');
      c.className = 'coin' + (v >= 20 ? ' big' : '');
      c.style.animationDelay = `${i * 0.06}s`;
      c.textContent = v;
      d.appendChild(c);
    });
    visual.appendChild(d);
  }

  if (q.measure) {
    const wrap = document.createElement('div');
    wrap.className = 'measure';
    // Size the cubes by what is drawn, but never below a comfortable tap: a 20-cube row
    // wraps into two tidy lines instead of shrinking to 13px boxes.
    wrap.style.setProperty('--cells', Math.min(Math.max(...q.measure.items.map(it => it.len)), 12));
    for (let r = 0; r < q.measure.items.length; r++) {
      const it = q.measure.items[r];
      const row = document.createElement('div');
      row.className = `measure-row ${r === 0 ? 'first' : 'second'}`;
      let counted = 0;
      // Only the cubes that cover the object are drawn. Bordered empty slots used to turn
      // the grid width into an answer, and children counted boxes instead of the snake.
      for (let i = 0; i < it.len; i++) {
        const cell = document.createElement('span');
        cell.className = 'measure-unit';
        cell.textContent = it.emoji;
        cell.style.animationDelay = `${i * 0.04}s`;
        cell.addEventListener('click', () => {
          if (State.answered || cell.classList.contains('counted')) return;
          counted++;
          cell.classList.add('counted');
          cell.dataset.count = counted;
          Sound.init(); Sound.count(counted);
          Speech.say(String(counted), 'count');
        });
        row.appendChild(cell);
      }
      wrap.appendChild(row);
    }
    visual.appendChild(wrap);
  }

  if (q.chart) {
    const wrap = document.createElement('div');
    wrap.className = 'chart';
    for (const k of q.chart) {
      const col = document.createElement('div');
      col.className = 'chart-col';
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      for (let i = 0; i < k.n; i++) {
        const cell = document.createElement('span');
        cell.className = 'chart-cell';
        cell.style.animationDelay = `${i * 0.05}s`;
        cell.textContent = k.e;
        bar.appendChild(cell);
      }
      const label = document.createElement('span');
      label.className = 'chart-label';
      label.textContent = k.n;
      col.appendChild(bar);
      col.appendChild(label);
      wrap.appendChild(col);
    }
    visual.appendChild(wrap);
  }

  if (q.groups) {
    for (let g = 0; g < q.groups.count; g++) {
      const box = document.createElement('div');
      box.className = 'group-box';
      for (let i = 0; i < q.groups.size; i++) {
        const s = document.createElement('span');
        s.className = 'obj static';
        s.textContent = q.groups.emoji;
        box.appendChild(s);
      }
      visual.appendChild(box);
    }
  }

  if (q.pairs) {
    const fullPairs = Math.floor(q.pairs.n / 2);
    for (let i = 0; i < fullPairs; i++) {
      const box = document.createElement('div');
      box.className = 'group-box';
      for (let j = 0; j < 2; j++) {
        const s = document.createElement('span');
        s.className = 'obj static';
        s.textContent = q.pairs.emoji;
        box.appendChild(s);
      }
      visual.appendChild(box);
    }
    if (q.pairs.n % 2 === 1) {
      const box = document.createElement('div');
      box.className = 'group-box single';
      const s = document.createElement('span');
      s.className = 'obj static';
      s.textContent = q.pairs.emoji;
      box.appendChild(s);
      visual.appendChild(box);
    }
  }

  if (q.objects) {
    const { emoji, total, crossed, split } = q.objects;
    let idx = 0;
    for (let i = 0; i < total; i++) {
      if (split !== undefined && i === split) {
        const plus = document.createElement('span');
        plus.className = 'visual-op';
        plus.textContent = '➕';
        visual.appendChild(plus);
      }
      const s = document.createElement('span');
      const isCrossed = i >= total - crossed;
      s.className = 'obj' + (isCrossed ? ' crossed' : '');
      s.style.animationDelay = `${i * 0.06}s`;
      s.textContent = emoji;
      if (!isCrossed) {
        s.addEventListener('click', () => {
          if (State.answered || s.classList.contains('counted')) return;
          idx++;
          s.classList.add('counted');
          s.dataset.count = idx;
          Sound.init(); Sound.count(idx);
          Speech.say(String(idx), 'count');
        });
      }
      visual.appendChild(s);
    }
    if (q.type === 'sub') {
      const eq = document.createElement('span');
      eq.className = 'visual-eq';
      eq.textContent = '= ❓';
      visual.appendChild(eq);
    }
  }

  if (q.type === 'shapes') {
    q.shapeOptions.forEach((sh, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.dataset.val = sh.w;
      btn.style.background = OPTION_COLORS[i % OPTION_COLORS.length];
      btn.style.color = inkFor(OPTION_COLORS[i % OPTION_COLORS.length]);
      btn.style.animationDelay = `${i * 0.07}s`;
      btn.innerHTML = `<span class="shape-emoji">${sh.e}</span>`;
      btn.addEventListener('click', () => onAnswer(btn, sh.w === q.answer, q));
      options.appendChild(btn);
    });
  } else if (q.options) {
    q.options.forEach((num, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      if (typeof num === 'string') btn.classList.add('text');
      btn.dataset.val = String(num);
      btn.style.background = OPTION_COLORS[i % OPTION_COLORS.length];
      btn.style.color = inkFor(OPTION_COLORS[i % OPTION_COLORS.length]);
      btn.style.animationDelay = `${i * 0.07}s`;
      btn.textContent = num;
      btn.addEventListener('click', () => onAnswer(btn, sameAmount(num, q.answer), q));
      options.appendChild(btn);
    });
  }
}

/* ---------- answering ---------- */
function revealAnswer(q) {
  $('#options').querySelectorAll('.opt-btn').forEach(b => {
    if (b.dataset.val === String(q.answer)) b.classList.add('reveal');
  });
  document.querySelectorAll('.compare-panel').forEach(p => {
    if (p.dataset.side === q.answer) p.classList.add('reveal-panel');
  });
}

function missQuestion(q) {
  State.streak = 0;
  $('#streak-dots').textContent = '';
  Sound.wrong();
  State.misses++;
  if (State.misses >= 2) {
    revealAnswer(q);
    Speech.say('Look for the green glow, then tap it!');
  } else {
    Speech.say(REDIRECT[State.mode] || pick(ENCOURAGE));
  }
}

function onAnswer(btn, correct, q) {
  if (State.answered) return;
  if (correct) {
    State.answered = true;
    btn.classList.add('right');
    handleCorrect();
  } else {
    btn.classList.add('wrong');
    missQuestion(q);
  }
}

function onCompare(panel, side, q) {
  if (State.answered) return;
  if (side === q.answer) {
    State.answered = true;
    panel.classList.add('correct-panel');
    handleCorrect();
  } else {
    panel.style.opacity = '0.4';
    panel.style.pointerEvents = 'none';
    missQuestion(q);
  }
}

function handleCorrect() {
  Sound.correct();

  State.stars++;
  State.streak++;
  State.save();
  updateCounters(true);

  const leveledUp = State.streak >= 3 && State.level < 4;
  if (leveledUp) {
    State.level++;
    State.streak = 0;
  }

  const fb = $('#feedback');
  fb.innerHTML = `<div class="fb-emoji">${leveledUp ? '🏅' : pick(PRAISE_EMOJI)}</div><div class="fb-word">${leveledUp ? 'Level up!' : pick(PRAISES)}</div>`;

  if (leveledUp) {
    Confetti.launch(150);
    Sound.fanfare();
    Speech.say(`Level up! Welcome to level ${State.level}!`, 'answer');
  } else if (State.misses > 0) {
    Speech.say('Yes! You worked that out, well done!', 'answer');
  } else {
    Speech.say(pick(PRAISES), 'answer');
  }

  const milestone = State.stars % 10 === 0;
  afterFeedback(() => {
    fb.innerHTML = '';
    if (milestone) showReward();
    else nextQuestion();
  });
}

function showReward() {
  State.trophies++;
  State.save();
  updateCounters(false, true);
  $('#reward-count').textContent = `You have ${State.trophies} ${State.trophies === 1 ? 'trophy' : 'trophies'}! 🏆`;
  showScreen('screen-reward');
  Sound.fanfare();
  Confetti.launch(250);
  Speech.say('Amazing! You earned a trophy!');
}

/* ---------- flow ---------- */
/* The hand-off used to be a flat 1600ms, which cut "Level up! Welcome to level 3!" off
   mid-sentence. Hold the next question until the voice has finished, but never for long. */
function afterFeedback(done) {
  const start = Date.now();
  const tick = () => {
    if (!Speech.busy() || Date.now() - start > 4500) { State.timer = null; done(); }
    else State.timer = setTimeout(tick, 150);
  };
  clearTimeout(State.timer);
  State.timer = setTimeout(tick, 1600);
}

function nextQuestion() {
  State.answered = false;
  State.misses = 0;
  State.question = Generators[State.mode](State.level);
  renderQuestion(State.question);
  Speech.say(State.question.speak, 'question');
}

function startMode(modeId) {
  State.mode = modeId;
  State.level = 1;
  State.streak = 0;
  showScreen('screen-game');
  nextQuestion();
}

function goBack() {
  clearTimeout(State.timer);
  State.timer = null;
  $('#feedback').innerHTML = '';
  Speech.stop();
  renderHome();
  showScreen('screen-home');
}

/* ---------- settings ---------- */
let resetArmed = false;
let resetTimer = null;

function updateSoundBtn() {
  $('#btn-sound-toggle').textContent = Sound.enabled ? '🔔 Sound effects: On' : '🔕 Sound effects: Off';
  $('#btn-voice-toggle').textContent = Speech.enabled ? '🗣️ Voice: On' : '🤐 Voice: Off';
}

function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  const b = $('#btn-reset');
  b.classList.remove('confirm');
  b.textContent = '🗑️ Reset Progress';
}

function closeSettings() {
  disarmReset();
  $('#settings-modal').classList.add('hidden');
}

/* ---------- init ---------- */
function init() {
  Confetti.init();
  Speech.init();
  renderHome();
  updateCounters();
  showScreen('screen-home');

  // Unlock audio on first touch/click (required by browsers)
  const unlock = () => {
    Sound.init();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);

  $('#btn-back').addEventListener('click', () => { Sound.pop(); goBack(); });
  $('#btn-repeat').addEventListener('click', () => {
    Sound.pop();
    if (State.question) Speech.say(State.question.speak, 'question');
  });
  $('#btn-keep-playing').addEventListener('click', () => {
    Sound.pop();
    nextQuestion();
    showScreen('screen-game');
  });
  $('#btn-settings').addEventListener('click', () => {
    Sound.init(); Sound.pop();
    updateSoundBtn();
    $('#settings-modal').classList.remove('hidden');
  });
  $('#btn-settings-close').addEventListener('click', () => { Sound.pop(); closeSettings(); });
  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') closeSettings();
  });
  $('#btn-sound-toggle').addEventListener('click', () => {
    Sound.enabled = !Sound.enabled;
    localStorage.setItem('nl_sound', Sound.enabled ? 'on' : 'off');
    if (Sound.enabled) { Sound.init(); Sound.pop(); }
    updateSoundBtn();
  });
  $('#btn-voice-toggle').addEventListener('click', () => {
    Speech.enabled = !Speech.enabled;
    localStorage.setItem('nl_voice', Speech.enabled ? 'on' : 'off');
    if (!Speech.enabled) Speech.stop();
    else { Sound.init(); Speech.say('Now I can read the questions to you!'); }
    updateSoundBtn();
  });
  $('#btn-reset').addEventListener('click', () => {
    const b = $('#btn-reset');
    if (!resetArmed) {
      resetArmed = true;
      b.classList.add('confirm');
      b.textContent = '⚠️ Are you sure? Tap again!';
      Sound.pop();
      resetTimer = setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    State.stars = 0;
    State.trophies = 0;
    State.save();
    updateCounters();
    renderHome();
    b.textContent = '✅ Progress reset!';
    Sound.correct();
    setTimeout(() => { b.textContent = '🗑️ Reset Progress'; }, 1500);
  });
  updateSoundBtn();
}

/* tests.html loads this file with NL_TEST set and drives the generators directly. */
if (!window.NL_TEST) document.addEventListener('DOMContentLoaded', init);
