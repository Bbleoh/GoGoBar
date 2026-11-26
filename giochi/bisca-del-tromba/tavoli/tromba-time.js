/* ════════════════════════════════════════════════════════════════
   TROMBA TIME — la ruota dei bonus (dal file mandato da Leo il 16/11/2026).
   Ruota da 54 spicchi: 1, 2, 5, 10 pagano N:1 (più la puntata), i
   quattro bonus (Coin Flip, Pachinko, Cash Hunt, Tromba Time) aprono il
   loro gioco a tutto schermo. Prima di ogni giro il Top Slot sceglie
   una casella e un moltiplicatore (2×–20×): se esce proprio quella,
   la vincita si moltiplica.
   Il motore (CTEngine) è quello di Leo, identico: è calibrato per
   rendere il 94–96% su ogni casella (simulato con 3 milioni di giri:
   1 96,1% · 2 96,1% · 5 96,3% · 10 95,9% · Coin Flip 96,0% ·
   Pachinko 94,7% · Cash Hunt 95,0% · Tromba Time 94,3%).
   Nella Bisca: niente timer (si gira quando premi GIRA), le fiche sono
   quelle fisse dei giochi del Tromba (10/20/50/100 al tavolo da 100,
   cioè 10%-20%-50%-100% del buy-in), massimo 30 volte il buy-in per
   casella, e le puntate restano sul tavolo dopo il giro. L'esito si
   salva nello stack prima dell'animazione (anche se ricarichi a metà
   bonus i soldi sono già tuoi). Auto: rigioca le stesse puntate; i
   bonus su cui non hai puntato non si guardano, le scelte (bersaglio,
   flapper) le fa il Tromba.
════════════════════════════════════════════════════════════════ */
(function () {

/* ===== MOTORE RUOTA DEI BONUS (di Leo, invariato) ===== */
const CTEngine = (function () {
  'use strict';
  const cryptoObj = globalThis.crypto;
  function randInt(max) {                               // intero uniforme in [0,max)
    const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
    do { cryptoObj.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
  }
  function rand() {                                      // float uniforme in [0,1)
    const a = new Uint32Array(2); cryptoObj.getRandomValues(a);
    return (a[0] * 2097152 + (a[1] >>> 11)) / 9007199254740992;
  }
  function makeSampler(values, weights) {
    const tot = weights.reduce((s, w) => s + w, 0); let acc = 0;
    const cum = weights.map(w => (acc += w / tot));
    return () => { const r = rand(); for (let i = 0; i < cum.length; i++) if (r < cum[i]) return values[i]; return values[values.length - 1]; };
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* RUOTA PRINCIPALE: 54 spicchi, ordine orario */
  const WHEEL = '1,2,5,1,2,PA,1,5,1,2,1,CF,1,2,1,10,2,CH,1,2,1,5,1,CF,1,5,2,10,1,PA,1,2,5,1,2,CF,1,10,1,5,1,CH,1,2,5,1,2,CF,2,1,10,2,1,CT'.split(',');
  const SPOTS = ['1', '2', '5', '10', 'CF', 'PA', 'CH', 'CT'];
  const NUM = { '1': 1, '2': 2, '5': 5, '10': 10 };

  const P = {
    topMults: [2, 3, 4, 5, 7, 10, 15, 20],
    topMW: [30, 22, 16, 12, 8, 6, 3.5, 2.5],
    topSpotP: { '1': 0.1277, '2': 0.1337, '5': 0.0766, '10': 0.0536, CF: 0.05, PA: 0.05, CH: 0.05, CT: 0.05 },
    cf: { v: [2, 3, 4, 5, 7, 10, 15, 20, 25, 50, 100], alpha: 0.9403, rescueChance: 0.5 },
    ch: { v: [5, 7, 10, 15, 20, 25, 50, 100, 200, 500], alpha: 0.7846 },
    pa: { v: [2, 3, 4, 5, 7, 10, 15, 20, 25, 50, 100, 200], alpha: 0.4394, dWeight: 0.12, rows: 12, zoneMin: 4, zoneMax: 13, rescueChance: 0.5, cap: 8000 },
    ct: { variants: [
      { '15': 18, '20': 15, '25': 12, '50': 8, '100': 5, '200': 4, D: 2 },
      { '15': 22, '20': 13, '25': 10, '50': 7, '100': 5, '200': 4, D: 3 },
      { '15': 17, '20': 16, '25': 13, '50': 7, '100': 6, '200': 4, D: 1 },
      { '15': 8, '20': 15, '25': 18, '50': 12, '100': 7, '200': 2, D: 2 }
    ] },
  };

  function topSlot() {
    const r = rand(); let acc = 0;
    for (const s of SPOTS) { acc += P.topSpotP[s]; if (r < acc) return { match: true, spot: s, mult: samplers.top() }; }
    return { match: false, spot: null, mult: 1 };
  }
  function coinFlip(T) {
    const red = samplers.cf(); let blue = samplers.cf();
    while (Math.abs(red - blue) < 3) blue = samplers.cf();
    let side = rand() < 0.5 ? 'red' : 'blue';
    const small = Math.min(red, blue), big = Math.max(red, blue);
    const smallSide = red <= blue ? 'red' : 'blue';
    let rescue = null;
    if ((small === 2 || small === 3) && big > 15 && side === smallSide && rand() < P.cf.rescueChance) {
      rescue = { first: side, second: rand() < 0.5 ? 'red' : 'blue' };
      side = rescue.second;
    }
    const base = side === 'red' ? red : blue;
    return { type: 'CF', red, blue, T, side, rescue, mult: base * T };
  }
  function cashHunt(T) {
    const board = []; for (let i = 0; i < 108; i++) board.push(samplers.ch() * T);
    const pick = randInt(108);
    return { type: 'CH', T, board, pick, mult: board[pick] };
  }
  function dropPuck(zone) {
    let x = zone; const path = [x];
    for (let r = 0; r < P.pa.rows; r++) {
      let step = rand() < 0.5 ? -0.5 : 0.5;
      if (x + step < 0.5 || x + step > 16.5) step = -step;
      x += step; path.push(x);
    }
    return { zone, path, slot: Math.round(x) };
  }
  function pachinko(T) {
    let board = []; for (let i = 0; i < 16; i++) board.push(samplers.pa());
    board = board.map(v => v === 'D' ? 'D' : v * T);
    const initial = board.slice();
    const events = []; let rescued = false, mult = 0, guard = 0;
    for (;;) {
      const zone = P.pa.zoneMin + randInt(P.pa.zoneMax - P.pa.zoneMin + 1);
      const d = dropPuck(zone); const val = board[d.slot - 1];
      events.push({ type: 'drop', zone, path: d.path, slot: d.slot, value: val });
      if (val === 'D') {
        board = board.map(v => v === 'D' ? 50 : v * 2);
        events.push({ type: 'double', board: board.slice() });
        if (++guard > 6) { mult = 50; break; }
        continue;
      }
      if (!rescued && (val === 2 || val === 3 || val === 4) && rand() < P.pa.rescueChance) {
        rescued = true;
        board = board.map(v => (v !== 'D' && v < val) ? val : v);
        events.push({ type: 'rescue', level: val, board: board.slice() });
        continue;
      }
      mult = val; break;
    }
    mult = Math.min(mult, P.pa.cap);
    return { type: 'PA', T, initial, events, mult };
  }
  function ctLayout(counts, seed) {
    const arr = []; Object.keys(counts).forEach(k => { for (let i = 0; i < counts[k]; i++) arr.push(k === 'D' ? 'D' : +k); });
    const rnd = mulberry32(seed);
    for (let attempt = 0; attempt < 400; attempt++) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      let ok = true;
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i], b = arr[(i + 1) % arr.length];
        if ((a === 'D' && b === 'D') || (a >= 100 && b >= 100) || (a === 200 && b >= 50)) { ok = false; break; }
      }
      if (ok) break;
    }
    return arr;
  }
  function crazyBonus(T) {
    const variant = randInt(P.ct.variants.length), lay = P.ct.layouts[variant];
    let doubles = 0, final = null; const spins = [];
    for (let step = 0; step < 3; step++) {
      const i = randInt(64); spins.push(i); const seg = lay[i];
      if (seg === 'D') {
        if (step === 2) { final = 50; break; }
        doubles++; continue;
      }
      final = seg * T * (doubles ? 2 : 1); break;
    }
    if (final === null) final = 50;
    return { type: 'CT', variant, T, spins, doubles, mult: final };
  }
  const samplers = {};
  function buildSamplers() {
    samplers.top = makeSampler(P.topMults, P.topMW);
    const tail = (vals, a) => vals.map(v => Math.pow(v, -a));
    samplers.cf = makeSampler(P.cf.v, tail(P.cf.v, P.cf.alpha));
    samplers.ch = makeSampler(P.ch.v, tail(P.ch.v, P.ch.alpha));
    const pv = P.pa.v.slice(), pw = tail(P.pa.v, P.pa.alpha); const tot = pw.reduce((s, w) => s + w, 0);
    pv.push('D'); pw.push(tot * P.pa.dWeight / (1 - P.pa.dWeight));
    samplers.pa = makeSampler(pv, pw);
    P.ct.layouts = P.ct.variants.map((c, i) => ctLayout(c, 1000 + i * 7919));
  }
  function playRound(f) {                              // f: SOLO per le prove ({ seg, top: { spot, mult } })
    f = f || {};
    const idx = f.seg ? WHEEL.map((s, i) => s === f.seg ? i : -1).filter(i => i >= 0) : null;
    const index = idx && idx.length ? idx[randInt(idx.length)] : randInt(54), seg = WHEEL[index];
    const top = f.top ? { match: true, spot: f.top.spot, mult: f.top.mult } : topSlot();
    const T = (top.spot === seg) ? top.mult : 1;
    let bonus = null;
    if (seg === 'CF') bonus = coinFlip(T);
    else if (seg === 'CH') bonus = cashHunt(T);
    else if (seg === 'PA') bonus = pachinko(T);
    else if (seg === 'CT') bonus = crazyBonus(T);
    return { v: 1, index, seg, top, bonus };
  }
  function settle(bets, o) {
    const per = {}; let payout = 0, total = 0;
    SPOTS.forEach(s => {
      const b = bets[s] || 0; if (!b) return;
      let p = 0;
      if (NUM[s]) { if (o.seg === s) { const T = o.top.spot === s ? o.top.mult : 1; p = b * (1 + NUM[s] * T); } }
      else if (o.seg === s && o.bonus) p = b * (1 + o.bonus.mult);
      p = Math.floor(p); per[s] = { bet: b, payout: p }; payout += p; total += b;
    });
    return { payout, total, per };
  }
  buildSamplers();
  return { WHEEL, SPOTS, NUM, P, playRound, settle, randInt, rand };
})();
const Engine = CTEngine;

/* ===== utilità ===== */
const NOMI = { CF: 'COIN FLIP', PA: 'PACHINKO', CH: 'CASH HUNT', CT: 'TROMBA TIME' };
const NOMI_BREVI = { CF: 'Coin Flip', PA: 'Pachinko', CH: 'Cash Hunt', CT: 'Tromba Time' };
const MAX_CASELLA = 30;                 // per casella, in buy-in
const DECIDI_MS = 8000;                 // tempo per scegliere bersaglio / flapper
const fmt = n => ogNum(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const somma = b => Object.keys(b).reduce((s, k) => s + (b[k] || 0), 0);
const ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = { out4: t => 1 - Math.pow(1 - t, 4), out3: t => 1 - Math.pow(1 - t, 3), inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };
function anim(ms, fn) {
  if (ridotto) ms = Math.min(ms, 250);
  return new Promise(res => { const t0 = performance.now(); (function f(now) { const t = Math.min(1, Math.max(0, (now - t0) / ms)); fn(t); t < 1 ? requestAnimationFrame(f) : res(); })(t0); });
}
function tierColor(v) {
  return v === 'D' ? '#e0453a' : v >= 200 ? '#c2185b' : v >= 100 ? '#8e24aa' : v >= 50 ? '#e68a00' : v >= 25 ? '#1e9e5a' : v >= 10 ? '#1976d2' : '#546e7a';
}

/* ===== suoni (stesso audio della Bisca, si spengono col 🔊) ===== */
function tone(f, d = .12, type = 'sine', vol = .06, when = 0, slide = 0) {
  if (typeof sfxOff !== 'undefined' && sfxOff) return;
  try {
    const AC = getAC(), t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
const sfx = {
  tick() { tone(1500, .025, 'square', .02); },
  whoosh() { tone(200, .6, 'sawtooth', .03, 0, 500); },
  win() { [523, 659, 784].forEach((f, i) => tone(f, .2, 'triangle', .07, i * .08)); },
  big() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .28, 'triangle', .08, i * .09)); },
  coin() { tone(1200, .12, 'triangle', .06); tone(1800, .18, 'triangle', .05, .07); },
  drop() { tone(700, .05, 'sine', .04); },
  boom() { tone(140, .5, 'sawtooth', .1, 0, -100); tone(90, .6, 'square', .06, .03, -60); },
  dbl() { [392, 523, 659, 784].forEach((f, i) => tone(f, .16, 'square', .05, i * .07)); },
  chip() { if (typeof sfxChip === 'function') sfxChip(); },
};

/* ===== aspetto dei segmenti ===== */
const SEG = {
  '1': { bg: '#e8c766', fg: '#2a1a02', label: '1' }, '2': { bg: '#2f86c9', fg: '#fff', label: '2' },
  '5': { bg: '#cf3a55', fg: '#fff', label: '5' }, '10': { bg: '#7c46c4', fg: '#fff', label: '10' },
  CF: { bg: '#14234d', fg: '#fff', icon: 'coin', label: 'CF' }, PA: { bg: '#b0197c', fg: '#fff', icon: 'pachinko', label: 'PA' },
  CH: { bg: '#0f7a5a', fg: '#fff', icon: 'target', label: 'CH' }, CT: { bg: '#f08a1c', fg: '#fff', icon: 'star', label: 'TT' },
};
function drawIcon(c, kind, r) {
  c.save();
  const rg = (x, y, r0, r1, a, b) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  if (kind === 'coin') {
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = rg(-r * .3, -r * .3, r * .1, r * 1.1, '#fff2b0', '#c98f14'); c.fill(); c.lineWidth = Math.max(1, r * .14); c.strokeStyle = '#6b4604'; c.stroke();
    c.beginPath(); c.arc(0, 0, r * .66, 0, 7); c.lineWidth = Math.max(.8, r * .09); c.strokeStyle = 'rgba(107,70,4,.7)'; c.stroke();
    c.fillStyle = '#6b4604'; c.font = `900 ${r * 1.05}px Cinzel,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, r * .05);
  } else if (kind === 'target') {
    [1, .72, .46, .22].forEach((k, i) => { c.beginPath(); c.arc(0, 0, r * k, 0, 7); c.fillStyle = i % 2 ? '#fff' : '#e8403a'; c.fill(); });
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.lineWidth = Math.max(1, r * .1); c.strokeStyle = '#5a0f0b'; c.stroke();
  } else if (kind === 'pachinko') {
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = rg(0, -r * .3, r * .1, r * 1.1, '#5a1a55', '#1a0a1f'); c.fill(); c.lineWidth = Math.max(1, r * .12); c.strokeStyle = '#ffd1f0'; c.stroke();
    c.fillStyle = '#ffd1f0'; [[0, -.5], [-.45, .15], [.45, .15], [0, .6]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, r * .17, 0, 7); c.fill(); });
  } else if (kind === 'star') {
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .5 : r * 1.05; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fillStyle = rg(0, -r * .2, r * .1, r * 1.1, '#fffbe0', '#ffc928'); c.fill(); c.lineWidth = Math.max(1, r * .12); c.strokeStyle = '#7a3a05'; c.lineJoin = 'round'; c.stroke();
  }
  c.restore();
}
/** Disegna una ruota: items[i] = {bg, draw(c, R)}; il segmento i è centrato a i*step in senso orario dall'alto. */
function drawWheelCanvas(cv, items, o) {
  o = o || {};
  const size = cv.clientWidth || o.size || 360, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size, size);
  const n = items.length, step = Math.PI * 2 / n, R = size / 2 - 3, rim = R * (o.rim || .085), Ro = R - rim;
  c.save(); c.translate(size / 2, size / 2);
  c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 10; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fillStyle = '#2b1606'; c.fill(); c.shadowBlur = 0;
  const g = c.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, '#fff3c0'); g.addColorStop(.25, '#c99a35'); g.addColorStop(.5, '#6e4a10'); g.addColorStop(.75, '#d8aa42'); g.addColorStop(1, '#fff3c0');
  c.beginPath(); c.arc(0, 0, R, 0, 7); c.arc(0, 0, R - rim, 0, 7, true); c.fillStyle = g; c.fill('evenodd');
  c.beginPath(); c.arc(0, 0, R - rim * .5, 0, 7); c.lineWidth = rim * .62; c.strokeStyle = '#1b0d04'; c.stroke();
  const vg = c.createRadialGradient(0, 0, Ro * .3, 0, 0, Ro);
  vg.addColorStop(0, 'rgba(0,0,0,.5)'); vg.addColorStop(.55, 'rgba(0,0,0,.08)'); vg.addColorStop(.9, 'rgba(255,255,255,.1)'); vg.addColorStop(1, 'rgba(255,255,255,.22)');
  for (let i = 0; i < n; i++) {
    const a0 = i * step - step / 2 - Math.PI / 2;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, Ro, a0, a0 + step); c.closePath();
    c.fillStyle = items[i].bg; c.fill(); c.fillStyle = vg; c.fill();
    c.lineWidth = 1.1; c.strokeStyle = 'rgba(255,225,150,.55)'; c.stroke();
  }
  for (let i = 0; i < n; i++) { c.save(); c.rotate(i * step); items[i].draw(c, Ro); c.restore(); }
  c.beginPath(); c.arc(0, 0, Ro * .36, 0, 7); c.fillStyle = '#0a2416'; c.fill();
  c.beginPath(); c.arc(0, 0, Ro * .36, 0, 7); c.lineWidth = 3; c.strokeStyle = g; c.stroke();
  c.beginPath(); c.arc(0, 0, Ro * .335, 0, 7); c.lineWidth = 1; c.strokeStyle = 'rgba(255,225,150,.5)'; c.stroke();
  c.beginPath(); c.arc(0, 0, Ro, 0, 7); c.lineWidth = 2; c.strokeStyle = 'rgba(20,8,0,.8)'; c.stroke();
  for (let i = 0; i < n; i++) {
    const a = i * step + step / 2 - Math.PI / 2, x = Math.cos(a) * (R - rim / 2), y = Math.sin(a) * (R - rim / 2), br = Math.max(1.6, rim * .24), warm = i % 2;
    c.save(); c.shadowColor = warm ? '#fff2b0' : '#ff5a3c'; c.shadowBlur = 6; c.beginPath(); c.arc(x, y, br, 0, 7);
    const bg = c.createRadialGradient(x - br * .3, y - br * .3, 0, x, y, br); bg.addColorStop(0, '#fff'); bg.addColorStop(1, warm ? '#f5d56a' : '#e0302a'); c.fillStyle = bg; c.fill(); c.restore();
  }
  c.restore();
}
function radialText(c, txt, r, size, fill, stroke, upright) {
  c.save(); c.translate(0, -r); if (!upright) c.rotate(-Math.PI / 2); c.font = `900 ${size}px Cinzel,'Arial Black',Arial,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, size * .12); c.strokeStyle = stroke || 'rgba(0,0,0,.65)'; c.strokeText(txt, 0, size * .04); c.fillStyle = fill; c.fillText(txt, 0, size * .04); c.restore();
}
function mainWheelItems() {
  return Engine.WHEEL.map(k => ({
    bg: SEG[k].bg,
    draw(c, Ro) {
      const s = SEG[k];
      if (s.icon) {
        c.save(); c.translate(0, -Ro * .905); drawIcon(c, s.icon, Ro * .042); c.restore();
        radialText(c, NOMI[k], Ro * (k === 'CT' ? .6 : .625), Ro * (k === 'CT' ? .052 : .058), '#fff');
      } else {
        radialText(c, s.label, Ro * .86, Ro * (k === '10' ? .082 : .12), s.fg, k === '1' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.55)', true);
      }
    },
  }));
}

/* ===== Top Slot (due rulli) ===== */
const REEL_SPOTS = ['1', '2', '5', '10', 'CF', 'PA', 'CH', 'CT'];
const REEL_SPOT_TXT = { '1': '1', '2': '2', '5': '5', '10': '10', CF: 'COIN FLIP', PA: 'PACHINKO', CH: 'CASH HUNT', CT: 'TROMBA TIME' };
const REEL_MULTS = [2, 3, 4, 5, 7, 10, 15, 20, 0];            // 0 = nessun moltiplicatore
function makeReel(el, labels) {
  const H = 26, n = labels.length, cycles = 7;
  el.innerHTML = '<div class="strip"></div><div class="mid"></div>';
  const strip = el.firstChild; let h = '';
  for (let c = 0; c < cycles; c++) labels.forEach((t, i) => { h += `<div class="it" data-k="${i}">${t}</div>`; });
  strip.innerHTML = h;
  const y = idx => -(idx - 1) * H; let cur = n;
  strip.style.transform = `translateY(${y(cur)}px)`;
  return {
    async spinTo(k, ms) {
      el.classList.remove('lit'); [...strip.children].forEach(x => x.classList.remove('sel'));
      const from = y(cur), to = y(n * 4 + k);
      await anim(ms, t => { strip.style.transform = `translateY(${from + (to - from) * ease.out3(t)}px)`; });
      cur = n + k; strip.style.transform = `translateY(${y(cur)}px)`;
    },
    light(k) { el.classList.add('lit'); strip.children[n + k].classList.add('sel'); },
  };
}

/* ===== icone delle caselle ===== */
const SPOT_ICON = {
  CF: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f1cf6b" stroke="#7a5408" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#7a5408" stroke-width="1"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="900" fill="#7a5408" font-family="Cinzel,serif">$</text></svg>',
  PA: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1a0a1f" stroke="#ffd1f0" stroke-width="1.6"/><g fill="#ffd1f0"><circle cx="12" cy="6.5" r="1.9"/><circle cx="7" cy="13" r="1.9"/><circle cx="17" cy="13" r="1.9"/><circle cx="12" cy="18" r="1.9"/></g></svg>',
  CH: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e8403a" stroke="#5a0f0b" stroke-width="1.4"/><circle cx="12" cy="12" r="7.2" fill="#fff"/><circle cx="12" cy="12" r="4.6" fill="#e8403a"/><circle cx="12" cy="12" r="2.2" fill="#fff"/></svg>',
  CT: '<svg viewBox="0 0 24 24"><path d="M12 1.5l3 6.9 7.4.7-5.6 4.9 1.7 7.3L12 17.5l-6.5 3.8 1.7-7.3L1.6 9.1l7.4-.7z" fill="#fff6c9" stroke="#7a3a05" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};
const TASTO_CASELLA = { '1': '1', '2': '2', '5': '5', '0': '10', c: 'CF', p: 'PA', h: 'CH', t: 'CT' };

/* ===== il gioco ===== */
const TT = Object.assign(ogBase('ttime', { titolo: 'Tromba Time', icona: '🎡', pref: 'tt', auto: true,
  tasti: 'Tasti: 1 2 5 0 numeri · C P H T bonus · U annulla · X raddoppia · Canc pulisci · Spazio gira · ↑↓ fiche · A auto' }), {
  bets: {}, undo: [], storia: [], forza: null, angolo: 0, girando: false, esito: null, totale: 0, pausaAuto: 900,

  benvenuto() { return 'Metti le fiche sulle caselle e premi GIRA. Più bonus puntate, più il Tromba ride.'; },
  infoModoAuto() { return 'Tengo le tue puntate sul tavolo: scegli 5, 10 o 20 giri.'; },
  infoAuto() { const t = somma(this.bets); return t ? 'Sul tavolo ' + ggb(t) + ' a giro' : 'Metti le fiche sulle caselle'; },
  autoPronto() { return somma(this.bets) > 0; },
  suggAuto() { return 'Metti le fiche'; },
  azzera() { this.esito = null; this.segnaCaselle(); },

  dopo() {
    this.$('.s-puntata small').textContent = 'Fiche';
    this.$$('.tt-spot').forEach(b => b.addEventListener('click', () => this.punta(b.dataset.spot)));
    this.reelSpot = makeReel(this.$('.tt-reel-spot'), REEL_SPOTS.map(s => REEL_SPOT_TXT[s]));
    this.reelMult = makeReel(this.$('.tt-reel-mult'), REEL_MULTS.map(m => m ? m + '×' : '—'));
    window.addEventListener('resize', () => { if (gioco === 'ttime' && !this.girando) this.disegnaRuota(); });
  },
  entra() {
    this.costruisci();
    this.aggiorna();
    if (!this.$('.og-msg').textContent) this.msg(this.benvenuto());
    requestAnimationFrame(() => this.disegnaRuota());
  },
  salto() { this.puntI = 0; this.bets = {}; this.undo = []; if (this.autoOn) { this.autoOn = false; this.autoStop = false; } },
  disegnaRuota() {
    const cv = this.$('.tt-ruota'); if (!cv || !cv.clientWidth) return;
    drawWheelCanvas(cv, mainWheelItems()); cv.style.transform = `rotate(${this.angolo}deg)`;
  },

  htmlSx() {
    return `<div class="tt-topslot"><span class="tt-ts-lbl">TOP<br>SLOT</span><div class="tt-reel tt-reel-spot"></div><span class="tt-ts-x">×</span><div class="tt-reel tt-reel-m tt-reel-mult"></div></div>
      <div class="tt-ruota-box"><canvas class="tt-ruota"></canvas><div class="tt-lancetta"></div>
        <div class="tt-mozzo"><b class="tt-mozzo-big">🎡</b><small class="tt-mozzo-small">FATE IL VOSTRO GIOCO</small></div></div>
      <div class="tt-storia" aria-label="Ultimi giri"></div>`;
  },
  htmlDx() {
    const casella = k => {
      const num = /\d/.test(k);
      return `<button type="button" class="tt-spot${num ? '' : ' bonus'}" data-spot="${k}" style="--c:${SEG[k].bg}" aria-label="Punta su ${num ? k : NOMI_BREVI[k]}">` +
        (num ? `<span class="sp-name">${k}</span><span class="sp-pay">${Engine.NUM[k]}:1</span>`
             : `<span class="sp-ico">${SPOT_ICON[k]}</span><span class="sp-name">${NOMI[k]}</span>`) +
        `<span class="sp-bet"></span><span class="sp-top"></span></button>`;
    };
    return `<div class="tt-spots">${['1', '2', '5', '10', 'CF', 'PA', 'CH', 'CT'].map(casella).join('')}</div>
      <div class="mn-riga"><span class="og-info tt-info"></span><div class="mn-seg" style="flex:none">` +
      `<button type="button" class="bet-tool tt-x2" onclick="ORIGINALI.ttime.raddoppia()" title="X">×2</button>` +
      `<button type="button" class="bet-tool tt-pulisci" onclick="ORIGINALI.ttime.pulisci()" title="Canc">Pulisci</button></div></div>`;
  },

  /* ── puntate ── */
  libero() { return !this.occupato() && !!run; },
  segnaCaselle(o) {
    if (!this.pronto) return;
    this.$$('.tt-spot').forEach(s => { s.classList.remove('win', 'lose', 'tm'); });
    this.$('.tt-topslot').classList.remove('hit');
    if (!o) return;
    const T = o.top.match ? o.top.mult : 0;
    if (T) { const sp = this.$(`.tt-spot[data-spot="${o.top.spot}"]`); if (sp) { sp.classList.add('tm'); sp.querySelector('.sp-top').textContent = T + '×'; } }
  },
  pulisciEsito() { if (this.esito) { this.esito = null; this.segnaCaselle(); } },
  punta(k) {
    if (!this.libero() || Engine.SPOTS.indexOf(k) < 0) return;
    this.pulisciEsito();
    const v = this.bet(), cur = this.bets[k] || 0, max = run.tavolo * MAX_CASELLA;
    if (cur + v > max) { sfxError(); this.msg('Massimo <b>' + ggb(max) + '</b> per casella al tavolo da ' + fmt(run.tavolo) + '.', 'lose'); return; }
    if (somma(this.bets) + v > balance) { sfxError(); this.msg('Lo stack non basta per questa puntata.', 'lose'); return; }
    this.bets[k] = cur + v; this.undo.push({ k, v }); sfx.chip(); this.aggiorna();
  },
  annulla() {
    if (!this.libero()) return;
    const u = this.undo.pop(); if (!u) return;
    this.bets[u.k] -= u.v; if (this.bets[u.k] <= 0) delete this.bets[u.k];
    this.pulisciEsito(); sfx.chip(); this.aggiorna();
  },
  raddoppia() {
    if (!this.libero() || !somma(this.bets)) return;
    const nb = {}; for (const k in this.bets) nb[k] = this.bets[k] * 2;
    if (Object.values(nb).some(v => v > run.tavolo * MAX_CASELLA)) { sfxError(); this.msg('Raddoppio oltre il massimo per casella.', 'lose'); return; }
    if (somma(nb) > balance) { sfxError(); this.msg('Lo stack non basta per raddoppiare.', 'lose'); return; }
    for (const k in this.bets) this.undo.push({ k, v: this.bets[k] });
    this.bets = nb; this.pulisciEsito(); sfx.chip(); this.aggiorna();
  },
  pulisci() {
    if (!this.libero() || !somma(this.bets)) return;
    this.bets = {}; this.undo = []; this.pulisciEsito(); sfx.chip(); this.aggiorna();
  },

  /* ── il giro ── */
  async gira() {
    if (this.busy || !run) return false;
    const bets = Object.assign({}, this.bets), total = somma(bets);
    if (!total) { sfxError(); this.msg('Metti almeno una fiche su una casella.', 'lose'); return false; }
    if (total > balance) { sfxError(); this.msg('Lo stack non basta per queste puntate: togline qualcuna.', 'lose'); return false; }
    // paga, decide l'esito e lo salva subito
    startMusic();
    balance -= total;
    contaGiocata();
    const st = stats, p = this.pref;
    st[p + 'Partite'] = (st[p + 'Partite'] || 0) + 1;
    const o = Engine.playRound(this.forza), s = Engine.settle(bets, o), payout = s.payout;
    balance += payout;
    this.ultima = payout - total;
    if (payout > total) st[p + 'Vinte'] = (st[p + 'Vinte'] || 0) + 1;
    st[p + 'VincitaMax'] = Math.max(st[p + 'VincitaMax'] || 0, payout);
    const bonus = !Engine.NUM[o.seg], T = o.top.spot === o.seg ? o.top.mult : 1;
    const molt = bonus ? o.bonus.mult : Engine.NUM[o.seg] * T;
    if (bets[o.seg]) st[p + 'MoltMax'] = Math.max(st[p + 'MoltMax'] || 0, molt);
    if (bonus && bets[o.seg]) st[p + 'Bonus'] = (st[p + 'Bonus'] || 0) + 1;
    memScrivi();
    this.forza = null;

    this.busy = true; this.girando = true; this.totale = total; this.nascosto = payout; this.esito = null;
    this.segnaCaselle();
    this.mozzo('GIRA', 'NON SI PUNTA PIÙ');
    this.msg(ogPesca(['Non si puntano più! Si gira!', 'La ruota parte… tenetevi forte.', 'Giù le mani dalle fiche!']));
    this.aggiorna();
    document.getElementById('balance-display').textContent = ggb(balance - this.nascosto);
    const veloce = this.autoOn;
    // sul telefono la ruota può essere sopra lo schermo: la riporto in vista
    if (innerWidth <= 820) { const box = this.$('.tt-ruota-box'), r = box.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    await Promise.all([this.giraRuota(o.index, veloce ? 4200 : 7000), this.giraTop(o.top, veloce)]);
    this.girando = false;
    this.esito = o;
    this.mozzo(SEG[o.seg].label === 'TT' ? '★' : SEG[o.seg].label, bonus ? NOMI[o.seg] : 'USCITO');
    sfx.win();
    this.$$('.tt-spot').forEach(el => { const k = el.dataset.spot; if (k === o.seg) el.classList.add('win'); else if (bets[k]) el.classList.add('lose'); });
    this.storia.unshift({ seg: o.seg, top: T > 1 ? T : 0 }); this.storia = this.storia.slice(0, 14);
    this.disegnaStoria();
    if (bonus && (bets[o.seg] || !veloce)) {
      this.msg('<b>' + NOMI_BREVI[o.seg] + '!</b> ' + (bets[o.seg] ? 'Hai puntato sul bonus: si vola!' : 'Non ci hai puntato: guardatelo e piangi.'));
      await sleep(veloce ? 600 : 1400);
      await giocaBonus(o, bets[o.seg] || 0, veloce);
    }
    this.busy = false;
    const win = payout - total;
    const nome = bonus ? '<b>' + NOMI_BREVI[o.seg] + '</b>' + (bets[o.seg] ? ' a ' + fmt(o.bonus.mult) + '×' : '') : 'il <b>' + o.seg + '</b>';
    const tm = T > 1 ? ' con Top Slot <b>' + T + '×</b>' : '';
    const testo = win > 0 ? 'Esce ' + nome + tm + ': vinci ' + ggb(win) + '!'
      : win === 0 ? 'Esce ' + nome + tm + ': pari, ti ridò ' + ggb(payout) + '.'
      : payout > 0 ? 'Esce ' + nome + tm + ': rientrano ' + ggb(payout) + ', perdi ' + ggb(-win) + '.'
      : 'Esce ' + nome + tm + ': ' + ogPesca(['il banco ringrazia.', 'il Tromba si tiene ' + ggb(total) + '.', 'ritenta, sarai più fortunato.']);
    this.mostra(total, payout, testo);
    // le fiche restano sul tavolo: se lo stack non basta più, si tolgono
    if (run && somma(this.bets) > balance) { this.bets = {}; this.undo = []; this.aggiorna(); }
    return true;
  },
  async giraRuota(index, ms) {
    const n = 54, step = 360 / n, start = this.angolo, cv = this.$('.tt-ruota'), lan = this.$('.tt-lancetta');
    const target = -index * step + (Engine.rand() - .5) * step * .7;
    const final = target + 360 * Math.ceil((start + 360 * 6 - target) / 360);
    let last = -1; sfx.whoosh();
    await anim(ms, t => {
      const a = start + (final - start) * ease.out4(t); cv.style.transform = `rotate(${a}deg)`;
      const seg = Math.floor(((-a / step) % n + n + .5) % n);
      if (seg !== last) { last = seg; sfx.tick(); lan.style.transform = 'rotate(-14deg)'; setTimeout(() => lan.style.transform = '', 55); }
    });
    this.angolo = ((final % 360) + 360) % 360; cv.style.transform = `rotate(${this.angolo}deg)`;
  },
  async giraTop(top, veloce) {
    const ks = top.match ? REEL_SPOTS.indexOf(top.spot) : Engine.randInt(8);
    const km = top.match ? REEL_MULTS.indexOf(top.mult) : REEL_MULTS.length - 1;
    await Promise.all([this.reelSpot.spinTo(ks, veloce ? 2000 : 3200), this.reelMult.spinTo(km, veloce ? 2600 : 4200)]);
    if (top.match) {
      this.reelSpot.light(ks); this.reelMult.light(km); this.$('.tt-topslot').classList.add('hit');
      const sp = this.$(`.tt-spot[data-spot="${top.spot}"]`);
      if (sp) { sp.classList.add('tm'); sp.querySelector('.sp-top').textContent = top.mult + '×'; }
      sfx.big();
    }
  },
  mozzo(big, small) { this.$('.tt-mozzo-big').textContent = big; this.$('.tt-mozzo-small').textContent = small; },
  disegnaStoria() {
    this.$('.tt-storia').innerHTML = this.storia.map(h => `<span class="tt-hchip" style="background:${SEG[h.seg].bg};color:${SEG[h.seg].fg}" title="${NOMI_BREVI[h.seg] || h.seg}">${SEG[h.seg].label}${h.top ? `<i>${h.top}×</i>` : ''}</span>`).join('');
  },

  giocaManuale() { this.gira(); },
  async manoAuto() { if (somma(this.bets) > balance) return false; return this.gira(); },
  principale() { const t = somma(this.bets); return { html: 'Gira', disabled: !run || !t || t > balance }; },
  secondario(fermo) { return { html: 'Annulla', disabled: !fermo || !this.undo.length }; },
  azioneSec() { this.annulla(); },
  tasto(k) {
    if (TASTO_CASELLA[k]) { this.punta(TASTO_CASELLA[k]); return true; }
    if (k === 'u' || k === 'backspace') { this.annulla(); return true; }
    if (k === 'x') { this.raddoppia(); return true; }
    if (k === 'delete') { this.pulisci(); return true; }
    return false;
  },
  righeStats(s) {
    const p = this.pref;
    return [['Giri', s[p + 'Partite'] || 0], ['Giri in guadagno', s[p + 'Vinte'] || 0], ['Bonus presi', s[p + 'Bonus'] || 0],
      ['Moltiplicatore più alto', ogValuta(s[p + 'MoltMax'] || 0)], ['Vincita più alta', ggb(s[p + 'VincitaMax'] || 0)]];
  },
  disegna(fermo) {
    const tot = somma(this.bets), mx = run ? run.tavolo * MAX_CASELLA : 0;
    this.$$('.tt-spot').forEach(el => {
      const v = this.bets[el.dataset.spot] || 0;
      el.classList.toggle('has', v > 0);
      el.querySelector('.sp-bet').textContent = v ? ggb(v) : '';
      el.disabled = !fermo || !run;
    });
    this.$('.tt-info').innerHTML = 'Sul tavolo <b>' + ggb(tot) + '</b>' + (mx ? '<br>max ' + ggb(mx) + ' per casella' : '');
    this.$('.tt-x2').disabled = !fermo || !tot;
    this.$('.tt-pulisci').disabled = !fermo || !tot;
    if (fermo && !this.esito) this.mozzo(tot ? fmt(tot) : '🎡', tot ? 'PUNTATI · GIRA!' : 'FATE IL VOSTRO GIOCO');
  },
});
ogRegistra(TT);

/* ═════════════ BONUS: guscio comune (sopra a tutto) ═════════════ */
let veloceBonus = false;
function apriGuscio(tema, titolo, o, bet) {
  let root = document.getElementById('tt-bonus');
  if (!root) { root = document.createElement('div'); root.id = 'tt-bonus'; document.body.appendChild(root); }
  root.className = 'tt-bonus th-' + tema; root.hidden = false;
  const T = o.top.match && o.top.spot === o.seg ? o.top.mult : 1;
  root.innerHTML = `<div class="bonus-card"><div class="b-head"><h2>${titolo}</h2>${T > 1 ? `<span class="b-top">TOP SLOT ${T}×</span>` : ''}</div>
    <div class="b-bet">${bet > 0 ? `HAI PUNTATO <b>${ggb(bet)}</b>` : 'NON HAI PUNTATO: ASSISTI AL BONUS'}</div>
    <div class="b-stage"></div><div class="b-foot"></div></div>`;
  const stage = root.querySelector('.b-stage'), foot = root.querySelector('.b-foot');
  return { root, stage, foot, T, setFoot(h) { foot.innerHTML = h; }, close() { root.hidden = true; root.innerHTML = ''; } };
}
function piede(bet, mult) {
  if (bet > 0) return `MOLTIPLICATORE <b>${fmt(mult)}×</b><br>INCASSI <b class="good">${ggb(bet * (1 + mult))}</b>`;
  return `MOLTIPLICATORE <b>${fmt(mult)}×</b> &nbsp;·&nbsp; NON HAI PUNTATO`;
}
const attesa = ms => sleep(veloceBonus ? Math.round(ms * .5) : ms);
async function giocaBonus(o, bet, veloce) {
  veloceBonus = !!veloce;
  const f = { CF: bonusCF, PA: bonusPachinko, CH: bonusCashHunt, CT: bonusCrazy }[o.seg];
  try { await f(o, bet); } catch (e) { console.warn('bonus', e); }
  const r = document.getElementById('tt-bonus'); if (r) { r.hidden = true; r.innerHTML = ''; }
}

/* ===================== COIN FLIP ===================== */
async function bonusCF(o, bet) {
  const sh = apriGuscio('cf', NOMI.CF, o, bet), b = o.bonus, T = sh.T;
  sh.stage.innerHTML = `
    <div class="cf-plates"><div class="plate red"><small>ROSSO</small><b>${b.red}×</b></div><div class="plate blue"><small>BLU</small><b>${b.blue}×</b></div></div>
    <div class="cf-scene"><div class="coin"><div class="face red"><span>R</span></div><div class="face blue"><span>B</span></div></div><div class="coin-shadow"></div></div>
    <div class="b-msg"></div>`;
  const plates = sh.stage.querySelectorAll('.plate'), msg = sh.stage.querySelector('.b-msg'), coin = sh.stage.querySelector('.coin');
  sh.setFoot('Ogni lato ha il suo moltiplicatore. Vince quello che resta in alto.');
  await attesa(1800);
  if (T > 1) {
    msg.textContent = `TOP SLOT ${T}×`; sfx.big(); await attesa(900);
    plates[0].querySelector('b').textContent = `${b.red * T}×`; plates[1].querySelector('b').textContent = `${b.blue * T}×`;
    plates.forEach(p => { const e = p.querySelector('b'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); });
    await attesa(1300); msg.textContent = '';
  }
  let cur = 0;
  async function flip(side, turns) {
    const base = cur - (cur % 360), end = base + 360 * turns + (side === 'blue' ? 180 : 0), from = cur; sfx.whoosh();
    await anim(veloceBonus ? 1600 : 2700, t => {
      const a = from + (end - from) * ease.out3(t); coin.style.transform = `rotateX(${a}deg)`;
      coin.style.marginBottom = (10 + Math.sin(Math.PI * Math.min(1, t * 1.12)) * 120) + 'px';
    });
    coin.style.marginBottom = '10px'; cur = end; sfx.coin();
  }
  sh.setFoot('Il Tromba lancia la moneta…');
  if (b.rescue) {
    await flip(b.rescue.first, 4); await attesa(700);
    msg.textContent = 'RESCUE FLIP!'; sfx.dbl(); sh.setFoot('Il lato piccolo non basta: la moneta viene rilanciata!'); await attesa(1500); msg.textContent = '';
    await flip(b.rescue.second, 4);
  } else await flip(b.side, 5);
  plates.forEach((p, i) => p.classList.add((i === 0 ? 'red' : 'blue') === b.side ? 'win' : 'lose'));
  msg.className = 'b-msg big'; msg.textContent = `${fmt(b.mult)}×`; sfx.big();
  sh.setFoot(piede(bet, b.mult));
  await attesa(4200); sh.close();
}

/* ===================== PACHINKO ===================== */
async function bonusPachinko(o, bet) {
  const sh = apriGuscio('pa', NOMI.PA, o, bet), b = o.bonus, T = sh.T;
  sh.stage.innerHTML = '<canvas class="pa-canvas"></canvas><div class="b-msg"></div>';
  const cv = sh.stage.querySelector('.pa-canvas'), msg = sh.stage.querySelector('.b-msg');
  const W = Math.max(260, Math.min(400, sh.stage.clientWidth - 8)), availH = sh.stage.clientHeight - 48;
  const H = Math.round(Math.max(330, Math.min(W * 1.3, availH)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ROWS = Engine.P.pa.rows, slotW = W / 16, topH = 34, pegTop = topH + 20, slotsY = H - 62, rowH = (slotsY - 6 - pegTop) / ROWS;
  const px = x => (x - .5) * slotW, yAt = r => pegTop + r * rowH;
  let board = b.initial.map(v => v === 'D' ? 'D' : (T > 1 ? v / T : v));
  let puck = null, zone = 0, land = 0, fly = [];
  const hot = {}, lift = {}, shown = new Array(16).fill(false);
  function draw() {
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a0a33'); g.addColorStop(1, '#10031a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let z = 1; z <= 16; z++) {
      const on = z >= Engine.P.pa.zoneMin && z <= Engine.P.pa.zoneMax;
      c.fillStyle = z === zone ? '#ffe27a' : on ? 'rgba(255,209,240,.25)' : 'rgba(255,255,255,.07)';
      c.fillRect((z - 1) * slotW + 1, 4, slotW - 2, topH - 8);
      c.fillStyle = z === zone ? '#3a2500' : on ? '#ffd1f0' : 'rgba(255,255,255,.35)'; c.font = `800 ${slotW * .42}px Cinzel,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(z, px(z), topH / 2 + 1);
    }
    for (let r = 0; r < ROWS; r++) {
      const start = r % 2 === 0 ? 1 : .5, end = r % 2 === 0 ? 16 : 16.5;
      for (let x = start; x <= end; x += 1) {
        const key = r + ':' + x, h = hot[key] || 0;
        c.beginPath(); c.arc(px(x), yAt(r), 2.8 + h * 2.5, 0, 7); c.fillStyle = h ? '#ffe27a' : '#ffd1f0'; c.shadowColor = '#ff7ad9'; c.shadowBlur = h ? 14 : 4; c.fill(); c.shadowBlur = 0;
        if (h > 0) hot[key] = Math.max(0, h - .08);
      }
    }
    for (let j = 1; j <= 16; j++) {
      const v = board[j - 1], col = tierColor(v), x0 = (j - 1) * slotW;
      if (!shown[j - 1]) { c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x0 + 1, slotsY, slotW - 2, 58); c.strokeStyle = 'rgba(255,209,240,.25)'; c.lineWidth = 1; c.strokeRect(x0 + 1.5, slotsY + 1.5, slotW - 3, 55); continue; }
      c.fillStyle = col; c.globalAlpha = land === j ? 1 : .88; c.fillRect(x0 + 1, slotsY, slotW - 2, 58); c.globalAlpha = 1;
      if (land === j) { c.lineWidth = 3; c.strokeStyle = '#ffe27a'; c.strokeRect(x0 + 1.5, slotsY + 1.5, slotW - 3, 55); }
      if (lift[j]) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x0 + 1, slotsY, slotW - 2, 58); lift[j] = Math.max(0, lift[j] - .02); if (!lift[j]) delete lift[j]; }
      c.save(); c.translate(px(j), slotsY + 29); c.rotate(-Math.PI / 2); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${v === 'D' ? slotW * .4 : (String(v).length > 3 ? slotW * .46 : slotW * .56)}px Cinzel,serif`; c.fillText(v === 'D' ? 'DOUBLE' : v + '×', 0, 1); c.restore();
    }
    fly.forEach(f => {
      c.save(); c.translate(f.x, f.y); c.scale(f.s, f.s); const w = 74, h = 38;
      c.fillStyle = f.col; c.strokeStyle = '#ffe27a'; c.lineWidth = 3; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10;
      c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, 10); else c.rect(-w / 2, -h / 2, w, h); c.fill(); c.shadowBlur = 0; c.stroke();
      c.fillStyle = '#fff'; c.font = `900 ${f.txt.length > 4 ? 15 : 22}px Cinzel,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.txt, 0, 1); c.restore();
    });
    if (puck) {
      c.beginPath(); c.arc(puck.x, puck.y, slotW * .34, 0, 7); const gg = c.createRadialGradient(puck.x - 3, puck.y - 3, 1, puck.x, puck.y, slotW * .36);
      gg.addColorStop(0, '#fff6c9'); gg.addColorStop(1, '#d19a21'); c.fillStyle = gg; c.shadowColor = '#ffe27a'; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0; c.lineWidth = 1.5; c.strokeStyle = '#7a5408'; c.stroke();
    }
  }
  let running = true; (function loop() { if (!running) return; draw(); requestAnimationFrame(loop); })();
  const k = veloceBonus ? .6 : 1;
  async function drop(ev) {
    zone = ev.zone; land = 0; puck = { x: px(ev.zone), y: topH + 10 }; await attesa(500);
    await anim(380 * k, t => { puck.y = topH + 10 + (yAt(0) - topH - 10) * t * t; });
    for (let r = 0; r < ROWS; r++) {
      const x0 = px(ev.path[r]), x1 = px(ev.path[r + 1]), y0 = yAt(r), y1 = yAt(r + 1);
      hot[r + ':' + ev.path[r]] = 1; sfx.drop();
      await anim(150 * k, t => { puck.x = x0 + (x1 - x0) * ease.inOut(t); puck.y = y0 + (y1 - y0) * (t * t * .6 + t * .4) - Math.sin(Math.PI * t) * 7; });
    }
    puck.x = px(ev.slot); puck.y = slotsY + 14; land = ev.slot; sfx.coin(); await attesa(900);
  }
  sh.setFoot('I moltiplicatori entrano uno alla volta, dal più piccolo al più grande.');
  await attesa(800);
  {
    const keyOf = v => v === 'D' ? Infinity : v, vals = [...new Set(board)].sort((a, b2) => keyOf(a) - keyOf(b2));
    for (const v of vals) {
      const slots = []; board.forEach((x, i) => { if (x === v) slots.push(i); });
      const txt = v === 'D' ? 'DOUBLE' : v + '×', col = v === 'D' ? '#c9201a' : tierColor(v), cx = W / 2, cy = H * .42;
      const f = { x: cx, y: cy, s: .2, txt, col }; fly = [f]; sfx.tick();
      await anim(240 * k, t => { f.s = .2 + 1.35 * ease.out3(t); });
      await attesa(slots.length > 1 ? 240 : 150);
      fly = slots.map(() => ({ x: cx, y: cy, s: 1.55, txt, col })); sfx.whoosh();
      await anim(330 * k, t => { const e = ease.inOut(t); slots.forEach((si, n) => { const g = fly[n]; g.x = cx + (px(si + 1) - cx) * e; g.y = cy + (slotsY + 29 - cy) * e; g.s = 1.55 - .95 * e; }); });
      slots.forEach(si => { shown[si] = true; lift[si + 1] = 1; }); fly = []; sfx.drop(); await sleep(60);
    }
  }
  sh.setFoot('Il Tromba lascia cadere la pallina dall’alto.');
  await attesa(700);
  if (T > 1) {
    msg.textContent = `TOP SLOT ${T}×`; sfx.big(); await attesa(900);
    board = b.initial.slice(); for (let j = 1; j <= 16; j++) if (board[j - 1] !== 'D') lift[j] = 1; await attesa(1500); msg.textContent = '';
  }
  for (const ev of b.events) {
    if (ev.type === 'drop') {
      await drop(ev);
      if (ev.value !== 'D' && b.events[b.events.length - 1] === ev) break;
      if (ev.value === 'D') { msg.textContent = 'DOUBLE!'; sfx.dbl(); sh.setFoot('Tutti i moltiplicatori raddoppiano e la pallina cade di nuovo!'); await attesa(900); }
    } else if (ev.type === 'double') {
      board = ev.board; for (let j = 1; j <= 16; j++) lift[j] = 1; land = 0; puck = null; await attesa(1600); msg.textContent = '';
    } else if (ev.type === 'rescue') {
      msg.textContent = 'RESCUE DROP!'; sfx.dbl(); sh.setFoot('Pallina di salvataggio: i valori più bassi vengono alzati!'); await attesa(1000);
      board = ev.board; for (let j = 1; j <= 16; j++) lift[j] = 1; land = 0; puck = null; await attesa(1700); msg.textContent = '';
    }
  }
  msg.className = 'b-msg big'; msg.textContent = `${fmt(b.mult)}×`; sfx.big();
  sh.setFoot(piede(bet, b.mult));
  await attesa(4200); running = false; sh.close();
}

/* ===================== CASH HUNT ===================== */
const CH_SYMBOLS = [
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd54a"/><circle cx="12" cy="12" r="5" fill="#ff9800"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .8-5.3 4.8 1.6 7.4L12 18l-6.3 4 1.6-7.4L2 9.8 9 9z" fill="#ff7a7a"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 2l9 10-9 10L3 12z" fill="#7ad7ff"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 3l9 17H3z" fill="#b6ff7a"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="#d79cff"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.7-8 11-8 11z" fill="#ff9acb"/></svg>',
];
async function bonusCashHunt(o, bet) {
  const sh = apriGuscio('ch', NOMI.CH, o, bet), b = o.bonus, T = sh.T;
  const COLS = 9, ROWS = 12;
  sh.stage.innerHTML = '<div class="b-msg"></div><div class="ch-grid"></div><div class="b-timer" style="visibility:hidden"><i></i></div><div class="b-btnrow"><button type="button" class="b-btn" style="background:linear-gradient(#ee5846,#a31a13)" disabled>FUOCO!</button></div>';
  const msg = sh.stage.querySelector('.b-msg'), grid = sh.stage.querySelector('.ch-grid'), timer = sh.stage.querySelector('.b-timer'), fireBtn = sh.stage.querySelector('.b-btn');
  const W = Math.max(260, Math.min(560, sh.stage.clientWidth - 4)), availH = sh.stage.clientHeight - 120;
  const cs = Math.floor(Math.min(W / COLS, availH / ROWS)); grid.style.setProperty('--cs', cs + 'px'); grid.style.width = cs * COLS + 'px'; grid.style.height = cs * ROWS + 'px';
  const vals = b.board.slice(), els = [], slotOf = [];
  const posXY = s => ({ x: (s % COLS) * cs, y: Math.floor(s / COLS) * cs });
  for (let i = 0; i < COLS * ROWS; i++) {
    const d = document.createElement('div'); d.className = 'ch-cell'; d.style.width = d.style.height = cs + 'px';
    d.innerHTML = `<div class="ch-in"><div class="ch-f">${CH_SYMBOLS[(i * 7 + Math.floor(i / 5)) % 6]}</div><div class="ch-b" style="background:${tierColor(vals[i])}">${vals[i]}</div></div>`;
    slotOf[i] = i; const p = posXY(i); d.style.transform = `translate(${p.x}px,${p.y}px)`; grid.appendChild(d); els.push(d);
  }
  function backText(i) { const e = els[i].querySelector('.ch-b'); e.textContent = vals[i]; e.style.background = tierColor(vals[i]); }
  sh.setFoot('Una parete di 108 moltiplicatori. Guarda bene…');
  await attesa(1500);
  if (T > 1) { msg.textContent = `TOP SLOT ${T}×: TUTTI ×${T}`; sfx.big(); }
  els.forEach((d, i) => setTimeout(() => d.classList.add('shown'), i * 6));
  sfx.whoosh(); await attesa(3600); msg.textContent = '';
  els.forEach((d, i) => setTimeout(() => d.classList.remove('shown'), i * 4));
  await sleep(1100); msg.textContent = 'SI MESCOLA…'; sh.setFoot('Le file scorrono a destra e a sinistra, poi i simboli si rimescolano.');
  els.forEach(d => d.style.transition = 'none'); sfx.whoosh();
  const W2 = cs * COLS, kRow = Array.from({ length: ROWS }, () => Engine.randInt(COLS));
  const baseCol = i => i % COLS, rowOf = i => Math.floor(i / COLS);
  await anim(veloceBonus ? 1500 : 2600, t => {
    const e = ease.inOut(t);
    els.forEach((d, i) => {
      const r = rowOf(i), dir = r % 2 ? 1 : -1, total = (COLS * 3 + kRow[r]) * cs;
      let x = (baseCol(i) * cs + dir * total * e) % W2; if (x < 0) x += W2;
      d.style.transform = `translate(${x}px,${r * cs}px)`;
    });
    if (Math.floor(t * 40) !== Math.floor((t - .02) * 40)) sfx.tick();
  });
  els.forEach((d, i) => { const r = rowOf(i), dir = r % 2 ? 1 : -1; slotOf[i] = r * COLS + (((baseCol(i) + dir * kRow[r]) % COLS) + COLS) % COLS; });
  await sleep(250); els.forEach(d => d.style.transition = '');
  const perm = Array.from({ length: COLS * ROWS }, (_, i) => i);
  for (let i = perm.length - 1; i > 0; i--) { const j = Engine.randInt(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  els.forEach((d, i) => { slotOf[i] = perm[i]; const p = posXY(perm[i]); d.style.transform = `translate(${p.x}px,${p.y}px)`; d.querySelector('.ch-f').innerHTML = CH_SYMBOLS[Engine.randInt(CH_SYMBOLS.length)]; });
  sfx.whoosh(); await attesa(900);
  msg.textContent = 'MIRA UN SIMBOLO!';
  let target = -1, fired = false, fireResolve;
  const spettatore = bet <= 0 || veloceBonus;
  els.forEach((d, i) => d.addEventListener('click', () => {
    if (spettatore || fired) return; els.forEach(x => x.classList.remove('aim')); target = i; d.classList.add('aim'); fireBtn.disabled = false; sfx.chip();
  }));
  const firePromise = new Promise(r => fireResolve = r);
  fireBtn.addEventListener('click', () => { if (target >= 0 && !fired) fireResolve(); });
  if (spettatore) { sh.setFoot(bet > 0 ? 'Auto: mira il Tromba.' : 'Non hai puntato: il cannone sceglie a caso.'); fireBtn.style.display = 'none'; await attesa(1200); }
  else {
    sh.setFoot('Tocca un simbolo e poi FUOCO! (se il tempo scade, si spara a caso)');
    timer.style.visibility = 'visible'; const bar = timer.firstChild;
    await Promise.race([firePromise, anim(DECIDI_MS, t => { bar.style.transform = `scaleX(${1 - t})`; })]);
  }
  fired = true; fireBtn.disabled = true; timer.style.visibility = 'hidden';
  if (target < 0) { target = Engine.randInt(COLS * ROWS); els[target].classList.add('aim'); }
  msg.textContent = 'FUOCO!'; sfx.boom();
  const ball = document.createElement('div'); ball.className = 'cannonball'; grid.appendChild(ball);
  const tp = posXY(slotOf[target]), tx = tp.x + cs / 2, ty = tp.y + cs / 2, sx = cs * COLS / 2, sy = cs * ROWS + 20;
  await anim(520, t => { ball.style.left = (sx + (tx - sx) * t) + 'px'; ball.style.top = (sy + (ty - sy) * t) + 'px'; });
  ball.remove();
  // l'esito è già deciso: il bersaglio prende il valore estratto (i valori sono mescolati, la scelta è scenica)
  if (target !== b.pick) { [vals[target], vals[b.pick]] = [vals[b.pick], vals[target]]; backText(target); backText(b.pick); }
  els[target].classList.remove('aim'); els[target].classList.add('shown', 'hit'); sfx.big();
  msg.className = 'b-msg big'; msg.textContent = `${fmt(b.mult)}×`;
  sh.setFoot(piede(bet, b.mult));
  await attesa(1500);
  els.forEach((d, i) => { if (i !== target) { d.classList.add('dim'); setTimeout(() => d.classList.add('shown'), i * 5); } });
  await attesa(3800); sh.close();
}

/* ===================== TROMBA TIME (ruota da 64 con 3 flapper) ===================== */
async function bonusCrazy(o, bet) {
  const sh = apriGuscio('ct', NOMI.CT, o, bet), b = o.bonus, T = sh.T;
  const layout = Engine.P.ct.layouts[b.variant], step = 360 / 64;
  sh.stage.innerHTML = `<div class="b-msg"></div><div class="ct-wrap"><canvas class="ct-canvas"></canvas><div class="ct-hub">×</div></div>
    <div class="b-timer" style="visibility:hidden"><i></i></div>
    <div class="b-btnrow">
      <button type="button" class="b-btn" data-f="0" style="background:#1e9e5a">VERDE</button>
      <button type="button" class="b-btn" data-f="1" style="background:#2f6fe0">BLU</button>
      <button type="button" class="b-btn" data-f="2" style="background:#d9a400;color:#2a1a02;text-shadow:none">GIALLO</button>
    </div>`;
  const msg = sh.stage.querySelector('.b-msg'), wrap = sh.stage.querySelector('.ct-wrap'), cv = sh.stage.querySelector('.ct-canvas'), hub = sh.stage.querySelector('.ct-hub');
  const timer = sh.stage.querySelector('.b-timer'), btns = [...sh.stage.querySelectorAll('.b-btn')];
  const side = Math.floor(Math.max(240, Math.min(400, sh.stage.clientWidth - 8, sh.stage.clientHeight - 170)));
  wrap.style.width = wrap.style.height = side + 'px';
  const FL = [{ off: -4, col: '#1e9e5a' }, { off: 0, col: '#2f6fe0' }, { off: 4, col: '#ffcc1a' }];
  const flapEls = FL.map(f => {
    const box = document.createElement('div'); box.style.cssText = `position:absolute;inset:0;pointer-events:none;transform:rotate(${f.off * step}deg);z-index:3`;
    box.innerHTML = `<div class="ct-flap" style="--fc:${f.col};left:50%"></div>`; wrap.appendChild(box); return box.firstChild;
  });
  let disp = layout.map(v => v === 'D' ? 'D' : v * T), dk = 1, angle = 0;
  function redraw() {
    drawWheelCanvas(cv, disp.map(v => ({
      bg: v === 'D' ? '#c9201a' : tierColor(typeof v === 'number' ? v / (T * dk) : v),
      draw(c, Ro) {
        c.translate(0, -Ro * .95); c.rotate(Math.PI / 2); c.fillStyle = v === 'D' ? '#ffe27a' : '#fff';
        const t = v === 'D' ? 'DOUBLE' : String(v); c.font = `800 ${Ro * (v === 'D' ? .052 : (t.length > 3 ? .056 : .068))}px Cinzel,serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, 0, 0);
      },
    })), { rim: .05 });
    cv.style.transform = `rotate(${angle}deg)`;
  }
  redraw();
  async function spinToSegment(i, flap, ms) {
    const target = FL[flap].off * step - i * step + (Engine.rand() - .5) * step * .6;
    const final = target + 360 * Math.ceil((angle + 360 * 5 - target) / 360), start = angle; let last = -1; sfx.whoosh();
    await anim(ms, t => {
      angle = start + (final - start) * ease.out4(t); cv.style.transform = `rotate(${angle}deg)`;
      const k = Math.floor(angle / step); if (k !== last) { last = k; sfx.tick(); }
    });
    angle = final % 360; cv.style.transform = `rotate(${angle}deg)`;
  }
  sh.setFoot('Una ruota gigante con 3 flapper. Scegli il tuo colore!');
  await attesa(1800);
  if (T > 1) { msg.textContent = `TOP SLOT ${T}×: TUTTI ×${T}`; sfx.big(); await attesa(1500); msg.textContent = ''; }
  let flap = -1, chosen; const spettatore = bet <= 0 || veloceBonus; const choice = new Promise(r => chosen = r);
  btns.forEach(bt => bt.addEventListener('click', () => { if (flap >= 0) return; flap = +bt.dataset.f; sfx.chip(); chosen(); }));
  if (spettatore) { btns.forEach(x => x.style.display = 'none'); sh.setFoot(bet > 0 ? 'Auto: il flapper lo sceglie il Tromba.' : 'Non hai puntato: il flapper viene scelto a caso.'); await attesa(1200); }
  else {
    msg.textContent = 'SCEGLI UN FLAPPER'; timer.style.visibility = 'visible'; const bar = timer.firstChild;
    await Promise.race([choice, anim(DECIDI_MS, t => { bar.style.transform = `scaleX(${1 - t})`; })]);
    timer.style.visibility = 'hidden';
  }
  if (flap < 0) flap = Engine.randInt(3);
  btns.forEach((bt, i) => { bt.disabled = true; bt.classList.toggle('sel', i === flap); if (i !== flap) bt.style.opacity = .3; });
  flapEls.forEach((f, i) => f.classList.add(i === flap ? 'sel' : 'dim'));
  msg.textContent = 'SI GIRA!'; sh.setFoot('Conta il flapper che hai scelto.');
  await attesa(900); msg.textContent = '';
  let doubles = 0;
  for (let s = 0; s < b.spins.length; s++) {
    const i = b.spins[s]; hub.textContent = '…';
    await spinToSegment(i, flap, veloceBonus ? 3800 : 6200);
    const seg = layout[i], last = s === b.spins.length - 1;
    if (seg === 'D' && !last) {
      doubles++; msg.textContent = doubles === 1 ? 'DOUBLE!' : 'DOUBLE DI NUOVO!'; sfx.dbl();
      hub.textContent = doubles === 1 ? '×2' : '50×';
      sh.setFoot(doubles === 1 ? 'Tutti i moltiplicatori raddoppiano e si rigira!' : 'Il DOUBLE diventa 50× e si rigira per l’ultima volta!');
      await attesa(1500);
      if (doubles === 1) { disp = disp.map(v => v === 'D' ? 'D' : v * 2); dk = 2; }
      else { disp = disp.map(v => v === 'D' ? 50 : v); dk = 2; }
      redraw(); await attesa(1400); msg.textContent = '';
    }
  }
  hub.textContent = fmt(b.mult) + '×';
  msg.className = 'b-msg big'; msg.textContent = `${fmt(b.mult)}×`; sfx.big();
  sh.setFoot(piede(bet, b.mult));
  await attesa(4500); sh.close();
}

})();
