(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scene: lockers, doors, floor lines ---------- */
  (function buildScene() {
    const g = $('#lockers'), fl = $('#floorlines');
    if (!g || !fl) return;
    const topL = (x) => 0.5 * x;
    const botL = (x) => 800 - 0.785714 * x;
    const H = (x) => botL(x) - topL(x);
    const flip = (p, side) => (side === 'R' ? [1200 - p[0], p[1]] : p);
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      (parent || g).appendChild(n);
      return n;
    };
    const pts = (a) => a.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    function panel(x1, x2, side, kind) {
      const ft = kind === 'door' ? 0.06 : 0.16;
      const fb = kind === 'door' ? 0.02 : 0.12;
      const quad = [
        [x1, topL(x1) + ft * H(x1)], [x2, topL(x2) + ft * H(x2)],
        [x2, botL(x2) - fb * H(x2)], [x1, botL(x1) - fb * H(x1)],
      ].map((p) => flip(p, side));
      el('polygon', { points: pts(quad), fill: kind === 'door' ? '#1d2724' : '#1b2522', stroke: '#070909', 'stroke-width': '1.5' });
      const xm = x1 + (x2 - x1) * 0.78;
      const ym = (topL(xm) + botL(xm)) / 2;
      if (kind === 'door') {
        const wx1 = x1 + (x2 - x1) * 0.2, wx2 = x1 + (x2 - x1) * 0.8;
        const wt = (x) => topL(x) + 0.14 * H(x), wb = (x) => topL(x) + 0.4 * H(x);
        const win = [[wx1, wt(wx1)], [wx2, wt(wx2)], [wx2, wb(wx2)], [wx1, wb(wx1)]].map((p) => flip(p, side));
        el('polygon', { points: pts(win), fill: '#3b1614', stroke: '#070909', 'stroke-width': '1' });
      } else {
        const hp = flip([xm, ym], side);
        el('circle', { cx: hp[0].toFixed(1), cy: hp[1].toFixed(1), r: '2.2', fill: '#56635d' });
        const vt = (x) => topL(x) + 0.2 * H(x);
        const vx1 = x1 + (x2 - x1) * 0.25, vx2 = x1 + (x2 - x1) * 0.75;
        for (let i = 0; i < 3; i++) {
          const o = i * 0.035;
          const a = flip([vx1, vt(vx1) + o * H(vx1)], side), b = flip([vx2, vt(vx2) + o * H(vx2)], side);
          el('line', { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), stroke: '#0a0e0d', 'stroke-width': '1.6' });
        }
      }
    }
    [[12, 56], [56, 98], [104, 146], [146, 186], [192, 230], [230, 268], [274, 308], [308, 340], [346, 376], [376, 402]]
      .forEach((s) => panel(s[0], s[1], 'L', 'locker'));
    [[12, 56], [56, 98], [104, 146], [146, 186], [274, 308], [308, 340], [346, 376], [376, 402]]
      .forEach((s) => panel(s[0], s[1], 'R', 'locker'));
    panel(192, 268, 'R', 'door');

    for (let i = -7; i <= 7; i++) {
      el('line', { x1: 600 + i * 28, y1: 470, x2: 600 + i * 190, y2: 800, stroke: 'rgba(255,255,255,0.05)', 'stroke-width': '1' }, fl);
    }
    [492, 520, 556, 604, 672, 770].forEach((y) => {
      el('line', { x1: 0, y1: y, x2: 1200, y2: y, stroke: 'rgba(255,255,255,0.05)', 'stroke-width': '1' }, fl);
    });
  })();

  /* ---------- sound (synth only, starts after a click) ---------- */
  let ac = null, soundOn = true;
  function ensureAudio() {
    if (!soundOn) return;
    try {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!ac || !soundOn) return;
    try {
      const t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest());
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  function staticBurst(dur, vol) {
    if (!ac || !soundOn) return;
    try {
      const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ac.createBufferSource(); s.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.8;
      const g = ac.createGain(); g.gain.value = vol;
      s.connect(f).connect(g).connect(dest()); s.start();
    } catch (e) { /* ignore */ }
  }
  const thud = () => { tone(78, 34, 0.3, 'sine', 0.9); rumble(260, 4); };
  const siren = () => bassHit(1);
  const beep = () => { staticBurst(0.12, 0.05); tone(1180, null, 0.07, 'square', 0.035, 0.1); };
  const sendBlip = () => { tone(880, null, 0.05, 'square', 0.03); };

  /* ---------- more sound and effects ---------- */
  let entered = false, locked = false, amb = null, evTimer = 0, heart = 0, lastTick = 0, lastKey = 0;
  const appEl = document.querySelector('.app');
  const sceneEl = document.querySelector('.scene-svg');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const MAXG = 4;
  let volume = 1, outNode = null;
  function dest() {
    if (!outNode) {
      const g = ac.createGain();
      g.gain.value = volume * MAXG;
      const c = ac.createDynamicsCompressor();
      c.threshold.value = -20; c.knee.value = 12; c.ratio.value = 8; c.attack.value = 0.003; c.release.value = 0.2;
      g.connect(c); c.connect(ac.destination);
      outNode = g;
    }
    return outNode;
  }
  const volEl = $('#vol');
  if (volEl) {
    volEl.addEventListener('input', () => {
      volume = Number(volEl.value) / 100;
      if (outNode && ac) outNode.gain.setTargetAtTime(volume * MAXG, ac.currentTime, 0.05);
    });
  }
  function noise(dur, vol, ftype, freq, delay) {
    if (!ac || !soundOn) return;
    try {
      const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
      const g = ac.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(dest());
      src.start(ac.currentTime + (delay || 0));
    } catch (e) { /* ignore */ }
  }

  function ambGain() {
    if (!amb || !ac) return;
    try { amb.master.gain.setTargetAtTime(soundOn ? 0.5 : 0.0001, ac.currentTime, 0.6); } catch (e) { /* ignore */ }
  }
  function startAmbience() { /* no continuous bed: only sparse events */ }

  function shake(px) {
    if (reduce || !appEl || !appEl.animate) return;
    const j = () => (Math.random() * 2 - 1) * px;
    appEl.animate([
      { transform: 'translate(0,0)' },
      { transform: 'translate(' + j() + 'px,' + j() + 'px)' },
      { transform: 'translate(' + j() + 'px,' + j() + 'px)' },
      { transform: 'translate(' + j() / 2 + 'px,' + j() / 2 + 'px)' },
      { transform: 'translate(0,0)' },
    ], { duration: 340, easing: 'ease-out' });
  }
  function alarmFlash() {
    const w = $('.alarm-wash');
    if (w && !reduce && w.animate) w.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 600 });
  }
  function rumble(ms, px) {
    if (reduce) return;
    const N = 26, frames = [];
    for (let i = 0; i <= N; i++) {
      const k = Math.pow(1 - i / N, 1.5) * px;
      frames.push({ transform: 'translate(' + ((Math.random() * 2 - 1) * k).toFixed(2) + 'px,' + ((Math.random() * 2 - 1) * k).toFixed(2) + 'px)' });
    }
    frames[N] = { transform: 'translate(0,0)' };
    [appEl, sceneEl].forEach((n) => { if (n && n.animate) n.animate(frames, { duration: ms, easing: 'linear' }); });
  }
  function bassHit(power) {
    const p = power || 1;
    tone(70, 30, 1.2, 'sine', 1.3 * p);
    tone(112, 52, 0.6, 'triangle', 0.8 * p);
    noise(0.3, 0.25 * p, 'lowpass', 320);
    rumble(900 * Math.min(p, 1.4), 10 * p);
  }
  function formantMoan(f0, f1, dur, vol) {
    if (!ac || !soundOn) return;
    try {
      const t = ac.currentTime;
      const src = ac.createOscillator(); src.type = 'sawtooth';
      src.frequency.setValueAtTime(f0, t);
      src.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const vib = ac.createOscillator(), vg = ac.createGain();
      vib.frequency.value = 5.5; vg.gain.value = 5; vib.connect(vg); vg.connect(src.frequency);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      env.connect(dest());
      [[620, 4], [1080, 2.6]].forEach((fm) => {
        const b = ac.createBiquadFilter(), gg = ac.createGain();
        b.type = 'bandpass'; b.frequency.value = fm[0]; b.Q.value = 5; gg.gain.value = fm[1];
        src.connect(b); b.connect(gg); gg.connect(env);
      });
      src.start(t); vib.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  const zMoan = () => { const f = rnd(92, 122); formantMoan(f, f * 0.55, rnd(1.5, 2.3), 0.5); noise(1.2, 0.02, 'bandpass', 900, 0.1); };
  const zGrowl = () => {
    if (!ac || !soundOn) return;
    try {
      const t = ac.currentTime, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.8);
      lp.type = 'lowpass'; lp.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      lfo.frequency.value = 26; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain);
      o.connect(lp); lp.connect(g); g.connect(dest());
      o.start(t); lfo.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9);
    } catch (e) { /* ignore */ }
  };
  const knock = () => { [0, 0.24, 0.5, 0.82].forEach((d) => { tone(190, 85, 0.12, 'triangle', 0.8, d); tone(62, 34, 0.22, 'sine', 0.8, d); }); };
  const scratch = () => { for (let i = 0; i < 6; i++) noise(0.16, 0.06, 'highpass', 1800, i * 0.17 + Math.random() * 0.05); };
  const shuffle = () => { for (let i = 0; i < 6; i++) { const d = i * 0.52; noise(0.2, 0.14, 'lowpass', 520, d); tone(92, 52, 0.12, 'sine', 0.35, d); } };
  const bang = () => { knock(); rumble(520, 8); alarmFlash(); };
  const scrape = () => { scratch(); };
  const groan = () => { zMoan(); };
  const bassDrop = () => { bassHit(1.25); alarmFlash(); setTimeout(zMoan, 900); };
  const walkers = () => { shuffle(); setTimeout(zMoan, 1200); };
  const farMoan = () => formantMoan(rnd(80, 100), rnd(48, 60), rnd(2, 3), 0.22);
  const farThud = () => { tone(60, 32, 0.4, 'sine', 0.5); };
  function scare() { mood('puzzled', 3400); whisper.textContent = 'Shh… something is at the door.'; }
  const peek = () => {
    const z = $('#zwin');
    if (z && !reduce) { z.classList.remove('on'); void z.getBoundingClientRect(); z.classList.add('on'); }
    knock(); bassHit(1.1); setTimeout(zMoan, 700); setTimeout(zGrowl, 1600); alarmFlash(); scare();
  };
  const lightsOut = () => {
    const b = $('#blackout');
    if (b && !reduce) { b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
    tone(100, 98, 0.5, 'square', 0.02); staticBurst(0.5, 0.03);
  };
  function scheduleEvent() {
    clearTimeout(evTimer);
    evTimer = setTimeout(() => {
      if (!document.hidden && entered) {
        const r = Math.random();
        const ev = [bang, groan, walkers, scrape, peek, bassDrop, lightsOut, farMoan, farThud, groan, bassDrop, farMoan];
        ev[Math.floor(r * ev.length)]();
      }
      scheduleEvent();
    }, rnd(4000, 9000));
  }

  function stopHeart() { clearInterval(heart); heart = 0; }
  function startHeart() {
    stopHeart();
    const beat = () => { tone(62, 38, 0.14, 'sine', 0.4); tone(55, 34, 0.12, 'sine', 0.3, 0.2); };
    beat(); heart = setInterval(beat, 850);
  }
  const streamTick = () => { const n = performance.now(); if (n - lastTick > 80) { lastTick = n; tone(rnd(1300, 1800), null, 0.025, 'square', 0.012); } };
  const keyTick = () => { const n = performance.now(); if (n - lastKey > 30) { lastKey = n; tone(rnd(2200, 2800), 1400, 0.025, 'square', 0.012); } };
  const rip = () => { staticBurst(0.22, 0.09); };
  const typeClack = () => { tone(rnd(1500, 2100), 700, 0.03, 'square', 0.09); noise(0.03, 0.12, 'bandpass', 3000); };
  const lineDing = () => { tone(2400, null, 0.5, 'sine', 0.12); tone(3600, null, 0.35, 'sine', 0.05, 0.02); noise(0.25, 0.1, 'highpass', 2500, 0.06); };
  const chime = () => { [660, 880, 1320].forEach((f, i) => tone(f, null, 0.4, 'sine', 0.06, i * 0.12)); };

  (function dust() {
    const c = $('#dust');
    if (!c || reduce) return;
    const x = c.getContext('2d');
    if (!x) return;
    let w = 0, h = 0;
    const P = [];
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);
    for (let i = 0; i < 70; i++) {
      P.push({ x: Math.random(), y: Math.random(), r: rnd(0.6, 2.2), vy: rnd(-0.012, 0.03), vx: rnd(-0.01, 0.01), a: rnd(0.15, 0.55), ember: Math.random() < 0.18, ph: Math.random() * 6.28 });
    }
    let last = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden) { last = t; return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      x.clearRect(0, 0, w, h);
      for (const p of P) {
        p.x += (p.vx + Math.sin(t / 1800 + p.ph) * 0.004) * dt;
        p.y += p.vy * dt;
        if (p.y > 1.02) p.y = -0.02;
        if (p.y < -0.03) p.y = 1.02;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        const fl = 0.6 + 0.4 * Math.sin(t / 400 + p.ph);
        x.beginPath(); x.arc(p.x * w, p.y * h, p.r, 0, 6.283);
        x.fillStyle = p.ember ? 'rgba(255,120,60,' + (p.a * fl).toFixed(3) + ')' : 'rgba(200,210,205,' + (p.a * 0.5).toFixed(3) + ')';
        x.fill();
      }
    }
    requestAnimationFrame(frame);
  })();
  document.addEventListener('pointerdown', ensureAudio, { passive: true });
  document.addEventListener('keydown', ensureAudio);
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) tone(700, 420, 0.05, 'square', 0.06); });

  const soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
    if (soundOn) { ensureAudio(); if (entered) startAmbience(); }
    ambGain();
  });

  /* ---------- intro ---------- */
  const intro = $('#intro'), stage = $('#introStage'), flash = $('#flash');
  let skipped = false, playId = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, skipped ? 0 : ms));

  function cue(name) {

    if (name === 'alarm') {
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    }
  }
  async function typeInto(node, text, speed, id) {
    for (let i = 1; i <= text.length; i++) {
      if (skipped || id !== playId) return;
      node.textContent = text.slice(0, i);
      if (text.charAt(i - 1) !== ' ') typeClack();
      await sleep(speed);
    }
  }
  function finishIntroPlay() {
    if (!intro.classList.contains('playing')) return;
    intro.classList.remove('playing');
    intro.classList.add('title-in');
    stopHeart(); bassHit(1.2); staticBurst(0.25, 0.06); setTimeout(zMoan, 900);
    if (!entered) { entered = true; scheduleEvent(); }
    stage.textContent = '';
  }
  async function playIntro() {
    const id = ++playId;
    skipped = false;
    intro.classList.remove('title-in');
    intro.classList.add('playing');
    stage.textContent = '';
    const script = [
      { t: '09:41 · THIRD FLOOR', cls: 'dim', after: 800 },
      { t: 'Period three. Maths. Unit test on Friday.', after: 1000 },
      { t: 'Then the screaming started.', cue: 'thud', after: 1000 },
      { t: 'Somebody locked the door.', cue: 'thud2', after: 900 },
      { t: 'Something is pounding on the other side.', cue: 'knock', after: 900 },
      { t: 'Nobody is going home today.', cue: 'alarm', after: 1300 },
    ];
    for (const s of script) {
      if (skipped || id !== playId) return;
      const p = document.createElement('p');
      p.className = 'iline' + (s.cls ? ' ' + s.cls : '');
      stage.appendChild(p);
      if (s.cue) cue(s.cue);
      await typeInto(p, s.t, 26, id);
      if (!skipped && id === playId) lineDing();
      await sleep(s.after);
    }
    if (id === playId) finishIntroPlay();
  }
  $('#skipBtn').addEventListener('click', () => { skipped = true; finishIntroPlay(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && intro.classList.contains('playing')) { skipped = true; finishIntroPlay(); }
  });
  $('#enterBtn').addEventListener('click', () => {
    ensureAudio(); siren(); staticBurst(0.4, 0.05);
    entered = true; startAmbience(); scheduleEvent(); setTimeout(walkers, 2500);
    intro.classList.add('gone');
    setTimeout(() => { intro.hidden = true; const m = $('#msg'); if (m) m.focus({ preventScroll: true }); }, 650);
  });
  $('#replayBtn').addEventListener('click', () => {
    intro.hidden = false;
    flash.classList.remove('on');
    requestAnimationFrame(() => { intro.classList.remove('gone'); playIntro(); });
  });
  $('#gateBtn').addEventListener('click', () => {
    ensureAudio();
    intro.classList.remove('gated');
    if (reduce) { intro.classList.add('title-in'); entered = true; scheduleEvent(); } else playIntro();
  });

  /* ---------- mascot ---------- */
  const kid = $('#kid'), whisper = $('#whisper');
  const WHISPERS = {
    idle: "Keep it quiet. I'm listening.",
    thinking: 'Hold on. Checking the corridor…',
    happy: 'Ha! Good to hear it.',
    puzzled: "Signal's gone. Try once more.",
  };
  let moodTimer = 0;
  function mood(name, hold) {
    clearTimeout(moodTimer);
    kid.classList.remove('thinking', 'happy', 'puzzled');
    if (name !== 'idle') kid.classList.add(name);
    whisper.textContent = WHISPERS[name] || WHISPERS.idle;
    if (hold) moodTimer = setTimeout(() => mood('idle'), hold);
  }

  /* ---------- chat ---------- */
  const log = $('#log'), form = $('#composer'), input = $('#msg'), sendBtn = $('#sendBtn');
  const chips = $('#chips');
  const turns = [];
  let busy = false, ctl = null, replies = 0, notedOffline = false;

  /* ---------- backend call: /api/chat holds the Groq key ---------- */
  const CHAT_URL = '/api/chat';

  // Sends the conversation to our own backend and streams the reply back through onText.
  async function chatApi(messages, opts) {
    let acc = '';
    let res;
    try {
      res = await fetch(CHAT_URL, {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', text: '' };
      throw { code: 'network' };
    }
    if (!res.ok) {
      if (res.status === 500) throw { code: 'server_config' };
      if (res.status === 429) throw { code: 'rate_limited' };
      if (res.status === 413) throw { code: 'prompt_too_large' };
      throw { code: 'api_error' };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', finish = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const ln of lines) {
          const s = ln.trim();
          if (!s.startsWith('data:')) continue;
          const data = s.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const ch = JSON.parse(data).choices[0];
            if (ch.delta && ch.delta.content) { acc += ch.delta.content; opts.onText(acc); }
            if (ch.finish_reason) finish = ch.finish_reason;
          } catch (e) { /* skip partial chunk */ }
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', text: acc };
      throw { code: 'network', text: acc };
    }
    if (!acc) throw { code: 'empty_completion' };
    return { text: acc, truncated: finish === 'length' };
  }

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function bars() {
    const b = document.createElement('span');
    b.className = 'bars'; b.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 4; i++) b.appendChild(document.createElement('i'));
    return b;
  }
  function addYou(text) {
    const d = document.createElement('div');
    d.className = 'msg you'; d.textContent = text;
    log.appendChild(d); scrollDown();
  }
  function addSys(text) {
    const d = document.createElement('div');
    d.className = 'sys'; d.textContent = text;
    log.appendChild(d); scrollDown();
  }
  function addAi(text, waiting) {
    const d = document.createElement('article');
    d.className = 'msg ai' + (waiting ? ' wait' : '');
    const head = document.createElement('div'); head.className = 'ai-head';
    const who = document.createElement('span'); who.textContent = 'Mira · CH 3';
    const rx = document.createElement('span'); rx.className = 'rx'; rx.textContent = waiting ? '…' : 'RX';
    head.append(bars(), who, rx);
    const p = document.createElement('p'); p.className = 'ai-text'; p.textContent = text;
    d.append(head, p);
    log.appendChild(d); scrollDown();
    return {
      node: d,
      set(t) { d.classList.remove('wait'); rx.textContent = '…'; p.textContent = t; scrollDown(); },
      done(t) { d.classList.remove('wait'); rx.textContent = 'RX'; if (t != null) p.textContent = t; scrollDown(); },
      remove() { d.remove(); },
    };
  }

  const SIG_LABELS = [[30, 'Faint'], [60, 'Weak'], [90, 'Clear'], [101, 'Safe zone locked']];
  function setSignal(pct) {
    pct = Math.max(0, Math.min(100, pct));
    $('#sigFill').style.width = pct + '%';
    $('#sigPct').textContent = Math.round(pct) + '%';
    $('#sigTrack').setAttribute('aria-valuenow', String(Math.round(pct)));
    if (pct >= 100 && !locked) { locked = true; chime(); shake(6); }
    if (pct < 100) locked = false;
    $('#sigLabel').textContent = (SIG_LABELS.find((r) => pct < r[0]) || SIG_LABELS[3])[1];
  }

  function setBusy(b) {
    busy = b;
    sendBtn.textContent = b ? 'Stop' : 'Send';
    sendBtn.classList.toggle('stop', b);
    chips.querySelectorAll('button').forEach((c) => { c.disabled = b; });
  }

  const COPY = {
    server_config: "The radio isn't set up yet. The site owner needs to add the GROQ_API_KEY setting.",
    network: "Can't reach the radio server. Check your internet connection and try again.",
    api_error: 'The radio server returned an error. Try again in a moment.',
    rate_limited: 'Too many transmissions too fast. Wait a moment, then try again.',
    refused: "Mira can't answer that one. Try asking it a different way.",
    empty_completion: 'Nothing came through. Try rephrasing.',
    prompt_too_large: 'That message is too long. Send a shorter one.',
  };
  const OFFLINE = [
    "Copy that. The line to the main server is down, so this is a test transmission only. Over.",
    "Still on test signal. Barricade is holding, tiffin is rationed. Real replies need the server back up. Over.",
    "Static on the line. Try again in a bit. Over.",
  ];

  async function send(raw) {
    const text = (raw || '').trim();
    if (!text || busy) return;
    sendBlip(); shake(3);
    addYou(text);
    turns.push({ role: 'user', content: text });
    input.value = ''; autosize();
    if (/\b(thanks?|thank you|shukriya|dhanyavaad|dhanyawad|great job|awesome)\b/i.test(text)) mood('happy', 3200);
    setBusy(true);
    if (!/\b(thanks?|thank you|shukriya|dhanyavaad|dhanyawad|great job|awesome)\b/i.test(text)) mood('thinking');
    const ai = addAi('Thinking…', true);
    ctl = new AbortController(); startHeart();
    try {
      let recent = turns.slice(-14);
      while (recent.length && recent[0].role !== 'user') recent.shift();
      const res = await chatApi(recent, {
        signal: ctl.signal,
        onText: (t) => { stopHeart(); streamTick(); ai.set(t); },
      });
      ai.done(res.text);
      turns.push({ role: 'assistant', content: res.text });
      if (res.truncated) addSys('Transmission cut short. Ask for less at a time.');
      beep(); replies++; setSignal(20 + replies * 12);
      if (Math.random() < 0.4) setTimeout(zMoan, 600);
      if (!kid.classList.contains('happy')) mood('idle');
    } catch (e) {
      const code = e && e.code;
      if (code === 'offline') {
        const canned = OFFLINE[Math.min(replies, OFFLINE.length - 1)];
        ai.done(canned); beep(); replies++; setSignal(20 + replies * 4);
        if (!notedOffline) { notedOffline = true; addSys('Demo mode: server not connected.'); }
        if (!kid.classList.contains('happy')) mood('idle');
      } else if (code === 'cancelled') {
        if (e.text) { ai.done(e.text); turns.push({ role: 'assistant', content: e.text }); addSys('— transmission cut —'); }
        else { ai.remove(); }
        mood('idle');
      } else {
        if (e && e.text) { ai.done(e.text); turns.push({ role: 'assistant', content: e.text }); addSys('Signal dropped mid-message.'); }
        else {
          const msg = COPY[code] || 'The signal dropped. Press send to try again.';
          ai.done(msg);
        }
        mood('puzzled', 3500);
      }
    } finally {
      ctl = null; stopHeart(); setBusy(false);
      if (!window.matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) { if (ctl) ctl.abort(); return; }
    send(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 112) + 'px'; }
  input.addEventListener('input', (e) => { autosize(); if (e.inputType && e.inputType.indexOf('insert') === 0) keyTick(); });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b && !busy) { rip(); send(b.dataset.msg); }
  });

  function resetChat() {
    if (ctl) ctl.abort();
    turns.length = 0; replies = 0; log.textContent = '';
    setSignal(20); mood('idle');
    const g = addAi("Radio check, radio check. This is Mira, third floor. Door's barricaded, tiffin's rationed, and I've got all night. Ask me anything: homework, plans, stories. Over.");
    g.done();
  }
  $('#resetBtn').addEventListener('click', resetChat);
  resetChat();
})();
