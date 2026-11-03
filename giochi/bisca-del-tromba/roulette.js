/* ════════════════════════════════════════════════════════════════
   ROULETTE EUROPEA DE LA BISCA DER TROMBA
   Script classico caricato dopo lo script principale di index.html:
   usa lo stesso saldo (balance), le stesse statistiche (stats), i trofei
   (sblocca), gli effetti sonori e il salvataggio dell'account (memScrivi).

   Puntate (quanto torna indietro per ogni euro puntato, posta compresa):
     numero pieno ×36 · cavallo (2 numeri) ×18 · quartina (4 numeri) ×9 ·
     dozzina e colonna ×3 · rosso/nero, pari/dispari, 1-18/19-36 ×2.
   Con lo zero le puntate esterne perdono (niente "la partage").
════════════════════════════════════════════════════════════════ */
'use strict';

const R_ORDINE = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const R_ROSSI  = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const R_PASSO  = Math.PI * 2 / 37;

function rColore(n) { return n === 0 ? 'verde' : R_ROSSI.has(n) ? 'rosso' : 'nero'; }

// Ogni puntata: chiave → { nome, paga (vincita + posta), vince(n) }
const R_PUNTATE = {};
for (let n = 0; n <= 36; n++) R_PUNTATE['n' + n] = { nome: 'il ' + n, paga: 36, vince: x => x === n };
Object.assign(R_PUNTATE, {
  rosso:   { nome: 'rosso',   paga: 2, vince: x => R_ROSSI.has(x) },
  nero:    { nome: 'nero',    paga: 2, vince: x => x > 0 && !R_ROSSI.has(x) },
  pari:    { nome: 'pari',    paga: 2, vince: x => x > 0 && x % 2 === 0 },
  dispari: { nome: 'dispari', paga: 2, vince: x => x % 2 === 1 },
  manque:  { nome: '1-18',    paga: 2, vince: x => x >= 1 && x <= 18 },
  passe:   { nome: '19-36',   paga: 2, vince: x => x >= 19 },
  d1: { nome: '1ª dozzina', paga: 3, vince: x => x >= 1 && x <= 12 },
  d2: { nome: '2ª dozzina', paga: 3, vince: x => x >= 13 && x <= 24 },
  d3: { nome: '3ª dozzina', paga: 3, vince: x => x >= 25 },
  c1: { nome: '1ª colonna', paga: 3, vince: x => x > 0 && x % 3 === 1 },
  c2: { nome: '2ª colonna', paga: 3, vince: x => x > 0 && x % 3 === 2 },
  c3: { nome: '3ª colonna', paga: 3, vince: x => x > 0 && x % 3 === 0 },
});
// cavalli (due numeri vicini) e quartine (quattro numeri che si toccano in un angolo)
function rRegistra(nums) {
  nums = nums.slice().sort((a, b) => a - b);
  const chiave = (nums.length === 2 ? 's' : 'q') + nums.join('_');
  if (!R_PUNTATE[chiave]) R_PUNTATE[chiave] = {
    nome: (nums.length === 2 ? 'il cavallo ' : 'la quartina ') + nums.join('-'),
    paga: 36 / nums.length, vince: x => nums.includes(x), numeri: nums,
  };
  return chiave;
}
const R_INTERNE = /^[nsq]/; // pieni, cavalli e quartine; il resto sono puntate esterne

let rPuntate = {};        // chiave → euro sul tavolo
let rStoriaPuntate = [];  // per "togli l'ultima"
let rUltime = null;       // puntate del giro precedente, per "ripeti"
let rFiche = 5;           // fiche selezionata
let rGirando = false;
let rStoria = [];         // ultimi numeri usciti
let rUltimo = null;
let rModo = 'pieno';      // 'pieno' | 'cavallo' | 'quartina': cosa fa un tocco su un numero
let rPrimo = null;        // primo numero scelto per cavallo o quartina

function rTotale(p) { return Object.values(p || rPuntate).reduce((a, b) => a + b, 0); }
function rEuro(v) { return '€' + Number(v).toLocaleString('it-IT'); }
function rBreve(v) { return v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : String(v); }

/* ── TAVOLO DELLE PUNTATE ─────────────────────────────────────── */
function rCostruisciTavolo() {
  const t = document.getElementById('r-board');
  if (t.childElementCount) return;
  const cella = (chiave, testo, classe, stile, titolo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'r-cell ' + (classe || '');
    b.dataset.bet = chiave;
    b.style.cssText = stile || '';
    b.innerHTML = '<span>' + testo + '</span>';
    b.title = titolo || ('Punta su ' + R_PUNTATE[chiave].nome);
    b.setAttribute('aria-label', b.title);
    t.appendChild(b);
  };
  cella('n0', '0', 'verde', 'grid-column:1;grid-row:1/4', 'Punta sullo 0 (paga 36 volte la puntata)');
  for (let col = 0; col < 12; col++) {
    for (let riga = 0; riga < 3; riga++) {
      const n = col * 3 + (3 - riga);
      cella('n' + n, n, rColore(n), `grid-column:${col + 2};grid-row:${riga + 1}`, `Punta sul ${n} (paga 36 volte la puntata)`);
    }
  }
  // zone sui bordi: a destra del numero il cavallo con quello accanto, sopra il cavallo con
  // quello di sopra, nell'angolo in alto a destra la quartina
  const zona = (n, nums, tipo) => {
    const k = rRegistra(nums);
    const z = document.createElement('span');
    z.className = 'r-hot ' + tipo;
    z.dataset.bet = k;
    z.title = (nums.length === 2 ? 'Cavallo ' : 'Quartina ') + R_PUNTATE[k].numeri.join('-') +
      ' (paga ' + R_PUNTATE[k].paga + ' volte la puntata)';
    t.querySelector('[data-bet="n' + n + '"]').appendChild(z);
  };
  for (let n = 1; n <= 36; n++) {
    const col = Math.ceil(n / 3), inAlto = n % 3 === 0;
    if (col < 12) zona(n, [n, n + 3], 'dx');
    if (!inAlto) zona(n, [n, n + 1], 'su');
    if (col < 12 && !inAlto) zona(n, [n, n + 1, n + 3, n + 4], 'angolo');
  }
  [1, 2, 3].forEach(n => zona(n, [0, n], 'sx')); // cavalli con lo zero

  ['c3', 'c2', 'c1'].forEach((c, i) => cella(c, '×3', 'fuori', `grid-column:14;grid-row:${i + 1}`, `Punta sulla ${R_PUNTATE[c].nome} (paga 3 volte la puntata)`));
  ['d1', 'd2', 'd3'].forEach((d, i) => cella(d, ['1ª 12', '2ª 12', '3ª 12'][i], 'fuori', `grid-column:${i * 4 + 2}/span 4;grid-row:4`, `Punta sulla ${R_PUNTATE[d].nome} (paga 3 volte la puntata)`));
  [['manque', '1-18', ''], ['pari', 'Pari', ''], ['rosso', '<i class="rombo rosso"></i>', 'Rosso'],
   ['nero', '<i class="rombo nero"></i>', 'Nero'], ['dispari', 'Dispari', ''], ['passe', '19-36', '']]
    .forEach(([k, testo, nome], i) => cella(k, testo, 'fuori', `grid-column:${i * 2 + 2}/span 2;grid-row:5`,
      `Punta su ${nome || R_PUNTATE[k].nome} (paga 2 volte la puntata)`));

  t.addEventListener('click', e => {
    const c = e.target.closest('[data-bet]');
    if (!c) return;
    const k = c.dataset.bet;
    if (rModo !== 'pieno' && /^n\d+$/.test(k)) rTocca(+k.slice(1));
    else rPunta(k);
  });
  t.addEventListener('contextmenu', e => { // clic destro: togli una fiche da quella casella
    const c = e.target.closest('[data-bet]');
    if (!c) return;
    e.preventDefault();
    rTogliDa(c.dataset.bet);
  });
}

/* ── MODI: pieno, cavallo, quartina (comodi soprattutto su telefono) ──
   Cavallo: tocchi due numeri vicini. Quartina: tocchi due numeri dello stesso
   quadrato di quattro (meglio in diagonale). Dopo il primo tocco si illuminano
   i numeri che puoi scegliere come secondo. */
function rCercaPuntata(a, b) {
  const tipo = rModo === 'cavallo' ? 's' : 'q';
  const trovate = Object.keys(R_PUNTATE).filter(k => k[0] === tipo &&
    R_PUNTATE[k].numeri.includes(a) && R_PUNTATE[k].numeri.includes(b));
  return trovate.length === 1 ? trovate[0] : null;
}
function rScegliModo(m) {
  if (rGirando) return;
  rModo = m;
  rPrimo = null;
  document.querySelectorAll('#r-modi button').forEach(b => {
    b.classList.toggle('attivo', b.dataset.modo === m);
    b.setAttribute('aria-pressed', b.dataset.modo === m);
  });
  document.getElementById('r-board').dataset.modo = m;
  rSegnaScelta();
  rMsg({ pieno: 'Tocca un numero per puntarci sopra.',
         cavallo: 'Cavallo: tocca due numeri vicini (paga ×18).',
         quartina: 'Quartina: tocca due angoli opposti di un quadrato di quattro numeri (paga ×9).' }[m]);
}
function rSegnaScelta() {
  document.querySelectorAll('#r-board .r-cell').forEach(c => {
    const k = c.dataset.bet;
    if (!/^n\d+$/.test(k)) return;
    const n = +k.slice(1);
    c.classList.toggle('scelto', n === rPrimo);
    c.classList.toggle('bersaglio', rPrimo !== null && n !== rPrimo && !!rCercaPuntata(rPrimo, n));
  });
}
function rTocca(n) {
  if (rGirando) return;
  if (rPrimo === null || n === rPrimo) {
    rPrimo = rPrimo === n ? null : n;
    rSegnaScelta();
    if (rPrimo !== null) rMsg('Ora tocca ' + (rModo === 'cavallo' ? 'il numero accanto' : 'l\'angolo opposto') + ' (quelli illuminati).');
    return;
  }
  const k = rCercaPuntata(rPrimo, n);
  if (!k) { rPrimo = n; rSegnaScelta(); return; } // non è vicino: ricomincia da questo numero
  rPrimo = null;
  rSegnaScelta();
  rPunta(k);
  if (rPuntate[k]) rMsg('Puntato su ' + R_PUNTATE[k].nome + '.');
}

function rDisegnaPuntate() {
  document.querySelectorAll('#r-board [data-bet]').forEach(c => {
    const v = rPuntate[c.dataset.bet] || 0;
    let f = c.querySelector(':scope > .r-fiche');
    if (!v) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement('b'); f.className = 'r-fiche'; c.appendChild(f); }
    f.textContent = rBreve(v);
    f.dataset.v = v >= 500 ? 500 : v >= 100 ? 100 : v >= 50 ? 50 : v >= 10 ? 10 : v >= 5 ? 5 : 1;
  });
}

function rAggiorna() {
  const tot = rTotale();
  document.getElementById('r-saldo').textContent = rEuro(balance);
  document.getElementById('r-puntata').textContent = rEuro(tot);
  const libero = !rGirando;
  CHIP_VALUES.forEach(v => {
    const el = document.getElementById('r-chip-' + v);
    el.classList.toggle('scelta', v === rFiche);
    el.classList.toggle('chip-disabled', !libero || balance - tot < v);
    el.setAttribute('aria-pressed', v === rFiche);
  });
  document.getElementById('r-clear').disabled = !libero || !tot;
  document.getElementById('r-undo').disabled = !libero || !rStoriaPuntate.length;
  document.getElementById('r-repeat').disabled = !libero || !rUltime || tot > 0 || rTotale(rUltime) > balance;
  document.getElementById('r-double').disabled = !libero || !tot || tot * 2 > balance;
  document.getElementById('r-spin').disabled = !libero || !tot;
  document.getElementById('r-board').classList.toggle('bloccato', !libero);
  rDisegnaPuntate();
  updateCashoutBtn();
  aggiornaTavoliBtn();
}

function rScegliFiche(v) {
  if (rGirando) return;
  rFiche = v;
  sfxChip();
  rAggiorna();
}

function rPunta(chiave) {
  if (rGirando || !R_PUNTATE[chiave]) return;
  const v = rFiche;
  if (rTotale() + v > balance) {
    sfxError();
    rMsg('Saldo insufficiente per questa fiche! (disponibili: ' + rEuro(balance - rTotale()) + ')', 'lose');
    return;
  }
  rPuntate[chiave] = (rPuntate[chiave] || 0) + v;
  rStoriaPuntate.push([chiave, v]);
  sfxChip();
  rTogliEsito();
  rAggiorna();
}

function rTogliDa(chiave) {
  if (rGirando || !rPuntate[chiave]) return;
  for (let i = rStoriaPuntate.length - 1; i >= 0; i--) {
    if (rStoriaPuntate[i][0] === chiave) { rRimuovi(i); return; }
  }
  delete rPuntate[chiave];
  rAggiorna();
}
function rRimuovi(i) {
  const [k, v] = rStoriaPuntate.splice(i, 1)[0];
  rPuntate[k] -= v;
  if (rPuntate[k] <= 0) delete rPuntate[k];
  sfxChip();
  rAggiorna();
}
function rAnnullaUltima() {
  if (rGirando || !rStoriaPuntate.length) return;
  rRimuovi(rStoriaPuntate.length - 1);
}
function rAnnulla() {
  if (rGirando || !rTotale()) return;
  rPuntate = {}; rStoriaPuntate = [];
  rMsg('');
  rAggiorna();
}
function rRipeti() {
  if (rGirando || !rUltime || rTotale() > 0) return;
  if (rTotale(rUltime) > balance) { sfxError(); rMsg('Non hai abbastanza per ripetere le puntate.', 'lose'); return; }
  rPuntate = Object.assign({}, rUltime);
  rStoriaPuntate = Object.entries(rPuntate).map(([k, v]) => [k, v]);
  sfxChip();
  rTogliEsito();
  rAggiorna();
}
function rRaddoppia() {
  const tot = rTotale();
  if (rGirando || !tot) return;
  if (tot * 2 > balance) { sfxError(); rMsg('Non hai abbastanza per raddoppiare.', 'lose'); return; }
  Object.keys(rPuntate).forEach(k => { rStoriaPuntate.push([k, rPuntate[k]]); rPuntate[k] *= 2; });
  sfxChip();
  rAggiorna();
}

function rMsg(t, c) {
  const e = document.getElementById('r-msg');
  e.textContent = t;
  e.className = c || '';
  if (c) { void e.offsetWidth; e.classList.add('pop'); }
}

/* ── RUOTA (canvas) ───────────────────────────────────────────── */
const rRuota = { cv: null, ctx: null, img: null, lato: 0, angolo: 0, palla: null, anim: null, ultimoT: 0 };

function rPreparaRuota() {
  const cv = document.getElementById('r-wheel');
  const lato = Math.round(cv.getBoundingClientRect().width);
  if (!lato) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (rRuota.lato === lato && rRuota.img) return true;
  rRuota.cv = cv; rRuota.lato = lato; rRuota.dpr = dpr;
  cv.width = cv.height = lato * dpr;
  rRuota.ctx = cv.getContext('2d');

  // la parte che gira, disegnata una volta sola
  const off = document.createElement('canvas');
  off.width = off.height = lato * dpr;
  const g = off.getContext('2d');
  const R = lato * dpr / 2;
  g.translate(R, R);
  R_ORDINE.forEach((n, i) => {
    const a0 = -Math.PI / 2 + (i - .5) * R_PASSO, a1 = a0 + R_PASSO;
    g.beginPath(); g.arc(0, 0, R * .8, a0, a1); g.arc(0, 0, R * .63, a1, a0, true); g.closePath();
    g.fillStyle = n === 0 ? '#1f8a4c' : R_ROSSI.has(n) ? '#b8231b' : '#141414';
    g.fill();
    g.strokeStyle = 'rgba(232,200,120,.75)'; g.lineWidth = Math.max(1, R * .008); g.stroke();
    // tasche
    g.beginPath(); g.arc(0, 0, R * .63, a0, a1); g.arc(0, 0, R * .52, a1, a0, true); g.closePath();
    g.fillStyle = i % 2 ? '#2a1a0c' : '#3a2410'; g.fill(); g.stroke();
    // numero
    g.save();
    g.rotate(-Math.PI / 2 + i * R_PASSO + Math.PI / 2);
    g.fillStyle = '#fff';
    g.font = '700 ' + Math.round(R * .085) + 'px Cinzel, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 0, -R * .715);
    g.restore();
  });
  // cono centrale con la croce
  const cono = g.createRadialGradient(-R * .1, -R * .1, R * .05, 0, 0, R * .52);
  cono.addColorStop(0, '#8a5a2b'); cono.addColorStop(.6, '#5a3414'); cono.addColorStop(1, '#2a160a');
  g.beginPath(); g.arc(0, 0, R * .52, 0, Math.PI * 2); g.fillStyle = cono; g.fill();
  g.strokeStyle = '#d4af5a'; g.lineWidth = R * .015; g.stroke();
  g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    g.save(); g.rotate(k * Math.PI / 2);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R * .3);
    g.strokeStyle = '#e8c878'; g.lineWidth = R * .04; g.stroke();
    g.beginPath(); g.arc(0, -R * .3, R * .045, 0, Math.PI * 2); g.fillStyle = '#f3dc9a'; g.fill();
    g.restore();
  }
  g.beginPath(); g.arc(0, 0, R * .08, 0, Math.PI * 2); g.fillStyle = '#f3dc9a'; g.fill();
  rRuota.img = off;
  return true;
}

function rDisegna() {
  const { ctx, img, lato, dpr } = rRuota;
  if (!ctx) return;
  const R = lato * dpr / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, R * 2, R * 2);
  ctx.translate(R, R);
  // bordo in legno e pista della pallina (fermi)
  const legno = ctx.createRadialGradient(0, 0, R * .8, 0, 0, R);
  legno.addColorStop(0, '#2a1608'); legno.addColorStop(.35, '#6b3d17'); legno.addColorStop(.8, '#3f220c'); legno.addColorStop(1, '#1a0d04');
  ctx.beginPath(); ctx.arc(0, 0, R * .99, 0, Math.PI * 2); ctx.fillStyle = legno; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R * .99, 0, Math.PI * 2); ctx.strokeStyle = '#d4af5a'; ctx.lineWidth = R * .02; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * .8, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(212,175,90,.7)'; ctx.lineWidth = R * .012; ctx.stroke();
  // parte che gira
  ctx.save(); ctx.rotate(rRuota.angolo); ctx.drawImage(img, -R, -R); ctx.restore();
  // pallina
  if (rRuota.palla) {
    const { ang, rag } = rRuota.palla;
    const x = Math.cos(ang - Math.PI / 2) * R * rag, y = Math.sin(ang - Math.PI / 2) * R * rag, r = R * .038;
    const pg = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r);
    pg.addColorStop(0, '#fff'); pg.addColorStop(.7, '#ddd'); pg.addColorStop(1, '#8a8a8a');
    ctx.beginPath(); ctx.arc(x + r * .25, y + r * .3, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();
  }
}

// a riposo la ruota gira piano con la pallina nella tasca dell'ultimo numero
function rCiclo(t) {
  rRuota.anim = requestAnimationFrame(rCiclo);
  if (gioco !== 'roulette' || rGirando) { rRuota.ultimoT = t; return; }
  const dt = Math.min(64, t - (rRuota.ultimoT || t));
  rRuota.ultimoT = t;
  rRuota.angolo = (rRuota.angolo + dt * .00012) % (Math.PI * 2);
  if (rUltimo !== null) rRuota.palla = { ang: rRuota.angolo + R_ORDINE.indexOf(rUltimo) * R_PASSO, rag: .575 };
  rDisegna();
}

function rCasuale() {
  try {
    const a = new Uint32Array(1), lim = Math.floor(0xFFFFFFFF / 37) * 37;
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % 37;
  } catch (e) { return Math.floor(Math.random() * 37); }
}

function rTick(forte) {
  if (sfxOff) return;
  try {
    const c = getAC(), now = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = forte ? 900 : 2400 + Math.random() * 600;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(forte ? .18 : .05, now); g.gain.exponentialRampToValueAtTime(.001, now + (forte ? .12 : .03));
    o.start(now); o.stop(now + .13);
  } catch (e) {}
}

/* ── GIRO ─────────────────────────────────────────────────────── */
function rGira() {
  const tot = rTotale();
  if (rGirando || !tot) return;
  if (tot > balance) { sfxError(); rMsg('Saldo insufficiente!', 'lose'); return; }
  if (!rPreparaRuota()) return;
  startMusic();
  rGirando = true;
  rPrimo = null; rSegnaScelta();
  balance -= tot;
  rUltime = Object.assign({}, rPuntate);
  rTogliEsito();
  rMsg('Rien ne va plus!');
  setCroupier('init');
  rAggiorna();
  document.getElementById('balance-display').textContent = rEuro(balance);

  const n = rCasuale(), idx = R_ORDINE.indexOf(n);
  const DURATA = 6200, ATTERRA = .78;
  const w0 = rRuota.angolo, W = Math.PI * 2 * (2.2 + Math.random() * .6);
  const ease = x => 1 - Math.pow(1 - x, 3);
  const ruotaA = x => w0 + W * ease(x);
  const b0 = Math.random() * Math.PI * 2;
  const fine = ruotaA(ATTERRA) + idx * R_PASSO;              // dove deve trovarsi la pallina quando atterra
  const giri = Math.PI * 2 * 7;
  const B = ((b0 - fine) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) + giri; // gira al contrario della ruota
  let inizio = null, ultimoSettore = null, rimbalzi = 0;

  const passo = t => {
    if (inizio === null) inizio = t;
    const x = Math.min(1, (t - inizio) / DURATA);
    rRuota.angolo = ruotaA(x);
    if (x < ATTERRA) {
      const y = x / ATTERRA;
      const ang = b0 - B * (1 - Math.pow(1 - y, 2.2));
      const rag = y < .6 ? .895 : .895 - (.895 - .575) * Math.pow((y - .6) / .4, 1.6)
                + Math.abs(Math.sin(y * 40)) * .03 * Math.max(0, y - .75);
      rRuota.palla = { ang, rag };
      const settore = Math.floor(((ang - rRuota.angolo) / R_PASSO) % 37);
      if (y > .55 && settore !== ultimoSettore) { ultimoSettore = settore; if (Math.random() < .5) rTick(false); }
    } else {
      if (!rimbalzi++) rTick(true);
      rRuota.palla = { ang: rRuota.angolo + idx * R_PASSO, rag: .575 };
    }
    rDisegna();
    if (x < 1) requestAnimationFrame(passo);
    else rRisultato(n);
  };
  requestAnimationFrame(passo);
}

function rRisultato(n) {
  rUltimo = n;
  const giocate = rPuntate;
  const tot = rTotale(giocate);
  let incasso = 0, vincenti = [];
  Object.entries(giocate).forEach(([k, v]) => {
    if (R_PUNTATE[k].vince(n)) { incasso += v * R_PUNTATE[k].paga; vincenti.push(k); }
  });
  balance += incasso;
  const netto = incasso - tot;

  // storia e casella vincente
  rStoria.unshift(n); rStoria = rStoria.slice(0, 14);
  rDisegnaStoria();
  const esito = document.getElementById('r-esito');
  esito.textContent = n;
  esito.className = 'show ' + rColore(n);
  document.querySelectorAll('#r-board [data-bet]').forEach(c => {
    // le caselle vincenti si illuminano sempre, i bordi (cavalli e quartine) solo se ci avevi puntato
    const vinta = R_PUNTATE[c.dataset.bet].vince(n);
    c.classList.toggle('vince', vinta && (c.classList.contains('r-cell') || !!giocate[c.dataset.bet]));
  });

  const nome = n + ' ' + (n === 0 ? 'verde' : rColore(n));
  if (incasso > 0 && netto >= 0) {
    rMsg(`Esce il ${nome}! Incassi ${rEuro(incasso)}` + (tot > 0 && netto > 0 ? ` (+${rEuro(netto)})` : ''), 'win'); sfxWin(); setCroupier(giocate['n' + n] ? 'festoso' : 'vincente');
  } else if (incasso > 0) {
    rMsg(`Esce il ${nome}. Recuperi ${rEuro(incasso)}, ma perdi ${rEuro(-netto)}`, 'push'); setCroupier('init');
  } else {
    rMsg(`Esce il ${nome}. Perdi ${rEuro(tot)}`, 'lose'); sfxLose(); setCroupier('lose');
  }

  // statistiche e trofei
  stats.rGiri++;
  if (netto > 0) { stats.rVinti++; stats.rVincitaMax = Math.max(stats.rVincitaMax, netto); }
  const pieno = giocate['n' + n] || 0;
  sblocca('r_primo');
  if (pieno) {
    stats.rPieni++;
    sblocca('r_pieno');
    if (n === 0) sblocca('r_zero');
    if (pieno >= 100) sblocca('r_pieno100');
    if (stats.rUltimoPieno === n + 1) sblocca('r_bis');
    stats.rUltimoPieno = n + 1;
  } else stats.rUltimoPieno = 0;
  if (n === 0 && !pieno && Object.keys(giocate).some(k => !R_INTERNE.test(k))) sblocca('r_zeroperso');
  const numeriCoperti = new Set();
  Object.keys(giocate).forEach(k => { for (let x = 0; x <= 36; x++) if (R_PUNTATE[k].vince(x)) numeriCoperti.add(x); });
  if (Object.keys(giocate).filter(k => k[0] === 'n').length >= 10 && pieno) sblocca('r_tappeto');
  if (numeriCoperti.size === 37) sblocca('r_tutto');
  stats.rSerieRosso = R_ROSSI.has(n) ? stats.rSerieRosso + 1 : 0;
  if (stats.rSerieRosso >= 7) sblocca('r_rossofisso');
  if (stats.rGiri >= 100) sblocca('r_giri100');
  if (netto >= 5000) sblocca('r_sbanca');
  controllaSaldo();

  rPuntate = {}; rStoriaPuntate = [];
  rGirando = false;
  rAggiorna();
  document.getElementById('balance-display').textContent = rEuro(balance);

  if (balance <= 0) { bancarotta(); return; }
  memScrivi();
}

function rTogliEsito() {
  document.getElementById('r-esito').className = '';
  document.querySelectorAll('#r-board .vince').forEach(c => c.classList.remove('vince'));
}

function rDisegnaStoria() {
  document.getElementById('r-storia').innerHTML = rStoria.length
    ? rStoria.map((x, i) => `<span class="${rColore(x)}${i ? '' : ' ultimo'}">${x}</span>`).join('')
    : '<small>Ancora nessun numero</small>';
}

/* ── ENTRATA / USCITA DAL TAVOLO ──────────────────────────────── */
function rEntra() {
  rCostruisciTavolo();
  rDisegnaStoria();
  rAggiorna();
  requestAnimationFrame(() => {
    rRuota.lato = 0; // ricalcola le misure
    if (rPreparaRuota()) rDisegna();
    if (!rRuota.anim) rRuota.anim = requestAnimationFrame(rCiclo);
  });
  if (!document.getElementById('r-msg').textContent) rMsg('Scegli una fiche e clicca sul tavolo per puntare.');
}
function rReset() {
  rPuntate = {}; rStoriaPuntate = []; rUltime = null;
  if (document.getElementById('r-board').childElementCount) { rTogliEsito(); rAggiorna(); }
}
window.addEventListener('resize', () => {
  if (gioco !== 'roulette') return;
  rRuota.lato = 0;
  if (rPreparaRuota()) rDisegna();
});

// tasti: 1-6 fiche · Invio/Spazio gira · Esc annulla · Backspace/Z togli l'ultima · R ripeti · X ×2
function rTasti(e) {
  const k = e.key.toLowerCase();
  if (/^[1-6]$/.test(e.key)) { e.preventDefault(); rScegliFiche(CHIP_VALUES[+e.key - 1]); return; }
  const modi = { p: 'pieno', c: 'cavallo', q: 'quartina' };
  if (modi[k]) { e.preventDefault(); rScegliModo(modi[k]); return; }
  const azioni = { enter: rGira, ' ': rGira, escape: rAnnulla, backspace: rAnnullaUltima, z: rAnnullaUltima, r: rRipeti, x: rRaddoppia };
  if (azioni[k]) { e.preventDefault(); azioni[k](); }
}
