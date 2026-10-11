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
  { e: '🍎', w: 'apples' }, { e: '🐥', w: 'chicks' }, { e: '🎈', w: 'balloons' },
  { e: '🐶', w: 'puppies' }, { e: '🍓', w: 'strawberries' }, { e: '🦋', w: 'butterflies' },
  { e: '⚽', w: 'balls' }, { e: '🐠', w: 'fish' }, { e: '🌸', w: 'flowers' },
  { e: '🚗', w: 'cars' }, { e: '🧸', w: 'teddy bears' }, { e: '🍪', w: 'cookies' },
  { e: '🐸', w: 'frogs' }, { e: '🍇', w: 'grapes' }, { e: '🐱', w: 'kittens' },
];

const SHAPES = [
  { e: '🔵', w: 'circle' }, { e: '🟥', w: 'square' }, { e: '🔺', w: 'triangle' },
  { e: '⭐', w: 'star' }, { e: '❤️', w: 'heart' }, { e: '🔶', w: 'diamond' },
];

const PRAISES = ['Great job!', 'Awesome!', 'You did it!', 'Super star!', 'Fantastic!', 'Yay! Well done!', 'Brilliant!'];
const PRAISE_EMOJI = ['🎉', '🌟', '🦄', '🥳', '👏', '🌈', '🚀', '💫'];
const ENCOURAGE = ['Try again!', 'Almost! Have another go!', 'You can do it!'];

const OPTION_COLORS = ['#ff6b6b', '#ffa94d', '#4dabf7', '#9775fa', '#f783ac', '#38d9a9'];

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
  voice: null,
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
  say(text) {
    if (!this.supported || !Sound.enabled) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1.15;
    speechSynthesis.speak(u);
  },
  stop() { if (this.supported) speechSynthesis.cancel(); },
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

function fmtTime(hour, minute) {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function clockOptions(hour, minute, count) {
  const set = new Set([fmtTime(hour, minute)]);
  let guard = 0;
  while (set.size < count && guard++ < 60) {
    let h = hour + pick([-2, -1, 1, 2]);
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    set.add(fmtTime(h, minute));
  }
  return shuffle([...set]);
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
    const max = level === 1 ? 5 : level === 2 ? 10 : level === 3 ? 20 : 99;
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
    let left = rand(1, max);
    let right = rand(1, max);
    while (right === left) right = rand(1, max);
    const askMore = Math.random() < 0.5;
    const obj = pick(OBJECTS);
    const winner = askMore ? (left > right ? 'left' : 'right') : (left < right ? 'left' : 'right');
    return {
      type: 'compare',
      text: askMore ? 'Which side has MORE?' : 'Which side has FEWER?',
      speak: askMore
        ? `Which side has more ${obj.w}? Tap the side!`
        : `Which side has fewer ${obj.w}? Tap the side!`,
      compare: { left, right, emoji: obj.e },
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
    const tables = level === 1 ? [2, 5, 10] : level === 2 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6];
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
    const step = pick(steps);
    const down = level >= 3 && Math.random() < 0.4;
    const shown = level === 1 ? 3 : 4;
    const start = down ? rand(step * shown + 1, step * shown + 10) : rand(1, 10);
    const seq = [];
    for (let i = 0; i < shown; i++) seq.push(start + (down ? -step : step) * i);
    const answer = start + (down ? -step : step) * shown;
    return {
      type: 'options',
      text: 'What comes next?',
      speak: `What comes next? ${seq.join(', ')}, what?`,
      visualText: seq.join(' → ') + ' → ❓',
      options: numberOptions(answer, 3, 0, answer + step * 2 + 2),
      answer,
    };
  },

  oddeven(level) {
    const max = level === 1 ? 10 : level === 2 ? 30 : 99;
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

  placevalue(level) {
    const type = level >= 3 ? pick(['make3', 'tens']) : pick(['make2', 'make2', 'tens']);
    if (type === 'make3') {
      const h = rand(1, 5), t = rand(0, 9), o = rand(0, 9);
      const n = h * 100 + t * 10 + o;
      return {
        type: 'options',
        text: `${h} hundreds + ${t} tens + ${o} ones = ?`,
        speak: `What is ${h} hundreds, ${t} tens, and ${o} ones?`,
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
      text: `${t} tens + ${o} ones = ?`,
      speak: `What is ${t} tens and ${o} ones?`,
      visualText: `${t * 10} + ${o} = ❓`,
      options: pvOptions(n),
      answer: n,
    };
  },

  clock(level) {
    const minute = level === 1 ? 0 : level === 2 ? pick([0, 30]) : pick([0, 15, 30, 45]);
    const hour = rand(1, 12);
    return {
      type: 'options',
      text: 'What time is it? 🕐',
      speak: 'What time is it? Look at the clock!',
      clock: { hour, minute },
      options: clockOptions(hour, minute, level === 1 ? 3 : 4),
      answer: fmtTime(hour, minute),
    };
  },
};

const MODES = [
  { id: 'count',      name: 'Counting',     desc: 'Count the objects',    icon: '🍎', color: '#ff6b6b' },
  { id: 'find',       name: 'Find Number',  desc: 'Spot the number',      icon: '🔢', color: '#4dabf7' },
  { id: 'add',        name: 'Adding',       desc: 'Put groups together',  icon: '➕', color: '#51cf66' },
  { id: 'sub',        name: 'Take Away',    desc: 'How many are left?',   icon: '➖', color: '#ffa94d' },
  { id: 'compare',    name: 'More or Less', desc: 'Which side wins?',     icon: '⚖️', color: '#9775fa' },
  { id: 'shapes',     name: 'Shapes',       desc: 'Name that shape',      icon: '🔷', color: '#f783ac' },
  { id: 'missing',    name: 'Missing No.',  desc: 'Solve the gap',        icon: '❓', color: '#20c997' },
  { id: 'multiply',   name: 'Multiply',     desc: 'Times tables fun',     icon: '✖️', color: '#f03e3e' },
  { id: 'patterns',   name: 'Patterns',     desc: 'What comes next?',     icon: '🧩', color: '#4263eb' },
  { id: 'oddeven',    name: 'Odd or Even',  desc: 'Pair them up',         icon: '👯', color: '#d6336c' },
  { id: 'placevalue', name: 'Place Value',  desc: 'Tens and ones',        icon: '🧮', color: '#0ca678' },
  { id: 'clock',      name: 'Clock Time',   desc: 'Read the clock',       icon: '🕐', color: '#f76707' },
];

/* ---------- UI rendering ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`#${id}`).classList.remove('hidden');
  $('#btn-home').classList.toggle('hidden', id === 'screen-home');
}

function updateStarUI(bump = false) {
  $('#star-count').textContent = State.stars;
  if (bump) {
    const el = $('#star-counter');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

function renderHome() {
  const grid = $('#mode-grid');
  grid.innerHTML = '';
  for (const m of MODES) {
    const btn = document.createElement('button');
    btn.className = 'mode-card';
    btn.style.background = `linear-gradient(160deg, ${m.color}, ${m.color}cc)`;
    btn.innerHTML = `<span class="mode-icon">${m.icon}</span>
                     <span class="mode-name">${m.name}</span>
                     <span class="mode-desc">${m.desc}</span>`;
    btn.addEventListener('click', () => {
      Sound.init(); Sound.pop();
      Speech.say(m.name);
      startMode(m.id);
    });
    grid.appendChild(btn);
  }
  const shelf = $('#trophy-shelf');
  if (State.trophies > 0) {
    shelf.classList.remove('hidden');
    $('#trophy-list').textContent = '🏆'.repeat(Math.min(State.trophies, 20));
  } else {
    shelf.classList.add('hidden');
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
    d.textContent = q.visualText;
    visual.appendChild(d);
  }

  if (q.clock) {
    const d = document.createElement('div');
    d.className = 'clock-wrap';
    d.innerHTML = clockSVG(q.clock.hour, q.clock.minute);
    visual.appendChild(d);
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
          if (s.classList.contains('counted')) return;
          idx++;
          s.classList.add('counted');
          s.dataset.count = idx;
          Sound.init(); Sound.count(idx);
          Speech.say(String(idx));
        });
      }
      visual.appendChild(s);
    }
    if (q.type === 'sub') {
      const eq = document.createElement('span');
      eq.className = 'visual-eq';
      visual.appendChild(eq);
    }
  }

  if (q.type === 'shapes') {
    q.shapeOptions.forEach((sh, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.style.background = OPTION_COLORS[i % OPTION_COLORS.length];
      btn.style.animationDelay = `${i * 0.07}s`;
      btn.innerHTML = `<span class="shape-emoji">${sh.e}</span>`;
      btn.addEventListener('click', () => onAnswer(btn, sh.w === q.answer, q));
      options.appendChild(btn);
    });
  } else if (q.options) {
    q.options.forEach((num, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.style.background = OPTION_COLORS[i % OPTION_COLORS.length];
      btn.style.animationDelay = `${i * 0.07}s`;
      btn.textContent = num;
      btn.addEventListener('click', () => onAnswer(btn, num === q.answer, q));
      options.appendChild(btn);
    });
  }
}

/* ---------- answering ---------- */
function onAnswer(btn, correct, q) {
  if (State.answered) return;
  if (correct) {
    State.answered = true;
    btn.classList.add('right');
    handleCorrect();
  } else {
    btn.classList.add('wrong');
    State.streak = 0;
    $('#streak-dots').textContent = '';
    Sound.wrong();
    Speech.say(pick(ENCOURAGE));
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
    State.streak = 0;
    $('#streak-dots').textContent = '';
    Sound.wrong();
    Speech.say(pick(ENCOURAGE));
  }
}

function handleCorrect() {
  Sound.correct();

  State.stars++;
  State.streak++;
  State.save();
  updateStarUI(true);

  const leveledUp = State.streak >= 3 && State.level < 4;
  if (leveledUp) {
    State.level++;
    State.streak = 0;
  }

  const fb = $('#feedback');
  fb.innerHTML = `<div class="fb-emoji">${leveledUp ? '🏅' : pick(PRAISE_EMOJI)}</div><div class="fb-word">${leveledUp ? 'Level up!' : pick(PRAISES)}</div>`;
  fb.classList.remove('hidden');

  if (leveledUp) {
    Confetti.launch(150);
    Sound.fanfare();
    Speech.say(`Level up! Welcome to level ${State.level}!`);
  } else {
    Speech.say(pick(PRAISES));
  }

  const milestone = State.stars % 10 === 0;
  clearTimeout(State.timer);
  State.timer = setTimeout(() => {
    State.timer = null;
    fb.classList.add('hidden');
    if (milestone) {
      showReward();
    } else {
      nextQuestion();
    }
  }, 1600);
}

function showReward() {
  State.trophies++;
  State.save();
  $('#reward-count').textContent = `You have ${State.trophies} ${State.trophies === 1 ? 'trophy' : 'trophies'}! 🏆`;
  showScreen('screen-reward');
  Sound.fanfare();
  Confetti.launch(250);
  Speech.say('Amazing! You earned a trophy!');
}

/* ---------- flow ---------- */
function nextQuestion() {
  State.answered = false;
  State.question = Generators[State.mode](State.level);
  renderQuestion(State.question);
  Speech.say(State.question.speak);
}

function startMode(modeId) {
  State.mode = modeId;
  State.level = 1;
  State.streak = 0;
  showScreen('screen-game');
  nextQuestion();
}

function goHome() {
  clearTimeout(State.timer);
  State.timer = null;
  $('#feedback').classList.add('hidden');
  Speech.stop();
  renderHome();
  showScreen('screen-home');
}

/* ---------- settings ---------- */
let resetArmed = false;
let resetTimer = null;

function updateSoundBtn() {
  $('#btn-sound-toggle').textContent = Sound.enabled ? '🔊 Sound: On' : '🔇 Sound: Off';
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
  updateStarUI();
  showScreen('screen-home');

  // Unlock audio on first touch/click (required by browsers)
  const unlock = () => {
    Sound.init();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);

  $('#btn-home').addEventListener('click', () => { Sound.pop(); goHome(); });
  $('#btn-repeat').addEventListener('click', () => {
    Sound.pop();
    if (State.question) Speech.say(State.question.speak);
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
    if (!Sound.enabled) Speech.stop();
    else { Sound.init(); Sound.pop(); }
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
    updateStarUI();
    renderHome();
    b.textContent = '✅ Progress reset!';
    Sound.correct();
    setTimeout(() => { b.textContent = '🗑️ Reset Progress'; }, 1500);
  });
  updateSoundBtn();
}

document.addEventListener('DOMContentLoaded', init);
