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

const Generators = {
  count(level) {
    const max = level === 1 ? 5 : 10;
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
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
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
    const maxSum = level === 1 ? 5 : 10;
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
    const max = level === 1 ? 5 : 10;
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
    const max = level === 1 ? 5 : 10;
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
};

const MODES = [
  { id: 'count',   name: 'Counting',    desc: 'Count the objects',  icon: '🍎', color: '#ff6b6b' },
  { id: 'find',    name: 'Find Number', desc: 'Spot the number',    icon: '🔢', color: '#4dabf7' },
  { id: 'add',     name: 'Adding',      desc: 'Put groups together',icon: '➕', color: '#51cf66' },
  { id: 'sub',     name: 'Take Away',   desc: 'How many are left?', icon: '➖', color: '#ffa94d' },
  { id: 'compare', name: 'More or Less',desc: 'Which side wins?',   icon: '⚖️', color: '#9775fa' },
  { id: 'shapes',  name: 'Shapes',      desc: 'Name that shape',    icon: '🔷', color: '#f783ac' },
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
  Confetti.launch(60);

  State.stars++;
  State.streak++;
  State.save();
  updateStarUI(true);

  const praise = pick(PRAISES);
  const fb = $('#feedback');
  fb.innerHTML = `<div class="fb-emoji">${pick(PRAISE_EMOJI)}</div><div class="fb-word">${praise}</div>`;
  fb.classList.remove('hidden');
  Speech.say(praise);

  if (State.streak >= 3 && State.level < 4) {
    State.level++;
    State.streak = 0;
  }

  const milestone = State.stars % 10 === 0;
  setTimeout(() => {
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
  Speech.stop();
  renderHome();
  showScreen('screen-home');
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
  $('#btn-sound').addEventListener('click', () => {
    Sound.enabled = !Sound.enabled;
    localStorage.setItem('nl_sound', Sound.enabled ? 'on' : 'off');
    $('#btn-sound').textContent = Sound.enabled ? '🔊' : '🔇';
    if (!Sound.enabled) Speech.stop();
    else { Sound.init(); Sound.pop(); }
  });
  $('#btn-sound').textContent = Sound.enabled ? '🔊' : '🔇';
}

document.addEventListener('DOMContentLoaded', init);
