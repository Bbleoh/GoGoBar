/* ════════════════════════════════════════════════════════════════
   PLINKO DER TROMBA
   Si lascia cadere una moneta dall'alto: a ogni chiodo va a destra o
   a sinistra (50 e 50) e finisce in una delle buche in fondo, che
   moltiplicano la puntata. Da 8 a 18 file di chiodi, tre livelli di
   rischio, RTP ~96% per ogni combinazione.
   Usa lo stack, le puntate fisse (puntateFisse(): 10/20/50/100) e il conteggio delle giocate di
   index.html; più monete possono cadere insieme (tenendo premuto
   LANCIA o con l'autobet da 5, 10 e 20).
════════════════════════════════════════════════════════════════ */
const P_RIGHE_MIN = 8, P_RIGHE_MAX = 18;
const P_RISCHI = { basso: 'Basso', medio: 'Medio', alto: 'Alto' };
// moltiplicatori dal bordo al centro per ogni numero di file (la tabella è simmetrica);
// calcolati per un ritorno del 96% circa con la distribuzione binomiale delle buche
const P_TABELLE = {
  basso: {8: [5.5, 2.3, 1.3, 0.8, 0.5], 9: [6.5, 3, 1.7, 0.9, 0.6], 10: [7.5, 4, 2, 1.2, 0.7, 0.5], 11: [9, 4.5, 2.2, 1.4, 0.9, 0.6], 12: [10, 5.5, 2.8, 1.7, 1.1, 0.7, 0.5], 13: [12, 6.5, 3.5, 2, 1.3, 0.8, 0.6], 14: [14, 7.5, 4.5, 2.4, 1.5, 1, 0.7, 0.5], 15: [17, 11, 5, 3, 1.6, 1.2, 0.8, 0.6], 16: [20, 11, 6, 4, 2.3, 1.3, 0.9, 0.7, 0.5], 17: [23, 13, 8, 4.5, 2.6, 1.7, 1.1, 0.7, 0.6], 18: [27, 16, 7.5, 5.5, 3.5, 2.1, 1.3, 0.9, 0.6, 0.5]},
  medio: {8: [13, 4, 1.4, 0.5, 0.3], 9: [18, 5.5, 1.7, 0.8, 0.4], 10: [26, 7, 2.7, 1.1, 0.5, 0.3], 11: [37, 10, 4, 1.4, 0.6, 0.4], 12: [53, 16, 5.5, 2.1, 0.9, 0.4, 0.3], 13: [75, 23, 7.5, 2.9, 1.2, 0.6, 0.3], 14: [110, 33, 10, 4, 1.6, 0.8, 0.4, 0.3], 15: [150, 49, 14, 5.5, 2.3, 1.1, 0.5, 0.3], 16: [210, 67, 19, 7.5, 3, 1.4, 0.7, 0.4, 0.3], 17: [310, 94, 31, 10, 4.5, 1.8, 0.9, 0.5, 0.3], 18: [430, 130, 38, 15, 6, 2.4, 1.2, 0.6, 0.4, 0.3]},
  alto: {8: [29, 4.5, 1, 0.4, 0.2], 9: [44, 8, 1.7, 0.5, 0.2], 10: [67, 12, 2.7, 0.8, 0.3, 0.2], 11: [100, 19, 4, 1.2, 0.5, 0.2], 12: [150, 29, 6.5, 1.9, 0.6, 0.3, 0.2], 13: [240, 41, 10, 2.8, 1, 0.4, 0.2], 14: [360, 69, 16, 4, 1.4, 0.5, 0.3, 0.2], 15: [540, 100, 22, 6.5, 2, 0.8, 0.4, 0.2], 16: [830, 160, 36, 9.5, 2.9, 1, 0.5, 0.3, 0.2], 17: [1000, 220, 49, 15, 4.5, 1.5, 0.7, 0.4, 0.2], 18: [1000, 240, 68, 20, 6.5, 2.5, 1, 0.5, 0.3, 0.2]},
};
function pMolt(rischio, righe) {
  const m = P_TABELLE[rischio][righe];
  return m.concat((righe % 2 ? m : m.slice(0, -1)).slice().reverse());
}

// geometria in unità logiche: il tabellone è sempre 600×480, chiodi e buche si stringono con più file
const P_W = 600, P_H = 480, P_CX = P_W / 2, P_TOP = 30;
function pGeo(n) {
  const dx = P_W / (n + 2.2);
  const bh = Math.max(20, Math.min(30, dx * 0.72));
  const bucaY = P_H - bh - 6;
  const fondo = bucaY - Math.max(16, dx * 0.55);
  const dy = (fondo - P_TOP) / (n - 1);
  return { n, dx, dy, bh, bucaY, piolo: Math.max(2.4, dx * 0.1), palla: Math.min(11, dx * 0.26), seg: 1500 / (n + 1) };
}

let pRighe = 12, pRischio = 'medio';
try { const s = JSON.parse(localStorage.getItem('biscaPlinko.v1')); if (s && P_TABELLE[s.rischio] && s.righe >= P_RIGHE_MIN && s.righe <= P_RIGHE_MAX) { pRighe = s.righe; pRischio = s.rischio; } } catch (e) {}
function pRicorda() { try { localStorage.setItem('biscaPlinko.v1', JSON.stringify({ righe: pRighe, rischio: pRischio })); } catch (e) {} }

let pPuntI = 0;
let pPalle = [];            // monete in caduta
let pStoria = [];           // ultimi moltiplicatori usciti
let pPronta = false, pCtx = null, pRaf = 0, pScala = 1;
let pLuci = {};             // chiodi e buche che si accendono: chiave → tempo
let pAutoOn = false, pAuto = 0, pAutoTimer = null;
let pTieni = null, pUltimoLancio = 0;
const P_MAX_VOLO = 30;
function pBet() { if (typeof puntateFisse !== 'function') return 0; const c = puntateFisse(); return c[Math.min(pPuntI, c.length - 1)] || 0; }
function pOccupata() { return pPalle.length > 0 || pAutoOn; }

function pPiolo(g, i, j) { return { x: P_CX + (j - (i + 2) / 2) * g.dx, y: P_TOP + i * g.dy }; }
function pBucaX(g, k) { return P_CX + (k - g.n / 2) * g.dx; }
function pColore(m) {
  // dal giallo (sotto 1) al rosso fuoco (moltiplicatori grossi)
  if (m >= 100) return ['#ff2d6a', '#6a0628'];
  if (m >= 25) return ['#ff2d2d', '#7a0606'];
  if (m >= 8)  return ['#ff5a2d', '#801a06'];
  if (m >= 3)  return ['#ff8a2d', '#7a3306'];
  if (m >= 1.4) return ['#ffb12d', '#7a4d06'];
  if (m >= 1)  return ['#ffd23d', '#7a6006'];
  return ['#d8c27a', '#4d3f12'];
}
function pNumero(m) { return m >= 1000 ? m / 1000 + 'k' : String(m).replace('.', ','); }
function pEtichetta(m) { return pNumero(m) + '×'; }

/* ── costruzione e misura ── */
function pCostruisci() {
  if (pPronta) return;
  pPronta = true;
  pCtx = document.getElementById('p-board').getContext('2d');
  const sr = document.getElementById('p-righe');
  for (let n = P_RIGHE_MIN; n <= P_RIGHE_MAX; n++) sr.add(new Option(n + ' file', n));
  sr.value = pRighe;
  sr.addEventListener('change', () => pCambiaRighe(+sr.value));
  const sk = document.getElementById('p-rischio');
  Object.keys(P_RISCHI).forEach(k => sk.add(new Option('Rischio ' + P_RISCHI[k].toLowerCase(), k)));
  sk.value = pRischio;
  sk.addEventListener('change', () => pCambiaRischio(sk.value));
  // LANCIA: un tocco lancia una moneta, tenendo premuto continuano a scendere
  const b = document.getElementById('p-gioca');
  b.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); pTieniInizia(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, pTieniFine));
  b.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => { if (gioco === 'plinko') pMisura(); });
}
function pMisura() {
  const cv = document.getElementById('p-board');
  const w = cv.clientWidth || P_W, dpr = Math.min(window.devicePixelRatio || 1, 2);
  pScala = w / P_W;
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * P_H / P_W * dpr);
  pCtx.setTransform(cv.width / P_W, 0, 0, cv.height / P_H, 0, 0);
  pDisegna(performance.now());
}

/* ── disegno ── */
function pDisegna(ora) {
  const c = pCtx;
  if (!c) return;
  const g = pGeo(pRighe);
  c.clearRect(0, 0, P_W, P_H);
  // chiodi
  for (let i = 0; i < g.n; i++) for (let j = 0; j < i + 3; j++) {
    const p = pPiolo(g, i, j), t = pLuci[i + ':' + j], acceso = t ? Math.max(0, 1 - (ora - t) / 380) : 0;
    if (acceso > 0) { c.fillStyle = 'rgba(255,220,120,' + (acceso * 0.45) + ')'; c.beginPath(); c.arc(p.x, p.y, g.piolo + g.dx * 0.17 * acceso, 0, 7); c.fill(); }
    c.fillStyle = acceso > 0 ? '#fff4c8' : '#e8cf86';
    c.beginPath(); c.arc(p.x, p.y, g.piolo, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(p.x + 1, p.y + 1.2, g.piolo * 0.55, 0, 7); c.fill();
  }
  // buche: la scritta più grande che ci sta, la × solo se c'è posto
  const molt = pMolt(pRischio, pRighe), w = g.dx - 3;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  molt.forEach((m, k) => {
    const x = pBucaX(g, k), t = pLuci['b' + k], u = t ? Math.max(0, 1 - (ora - t) / 500) : 0;
    const y = g.bucaY + u * 6, [chiaro, scuro] = pColore(m);
    const gr = c.createLinearGradient(0, y, 0, y + g.bh);
    gr.addColorStop(0, chiaro); gr.addColorStop(1, scuro);
    c.fillStyle = gr;
    pRett(c, x - w / 2, y, w, g.bh, Math.min(6, w / 4)); c.fill();
    if (u > 0) { c.fillStyle = 'rgba(255,255,255,' + u * 0.5 + ')'; pRett(c, x - w / 2, y, w, g.bh, Math.min(6, w / 4)); c.fill(); }
    c.fillStyle = '#1a0702';
    let testo = pEtichetta(m), fs = Math.max(Math.min(15, g.bh * 0.55), 9 / pScala);   // almeno 9px veri sullo schermo
    const larga = s => s.length * fs * 0.62;
    if (larga(testo) > w - 3) testo = pNumero(m);
    fs = Math.min(fs, (w - 3) / (testo.length * 0.62));
    c.font = '800 ' + fs.toFixed(1) + 'px "Cinzel", Georgia, serif';
    c.fillText(testo, x, y + g.bh / 2 + 1);
  });
  // monete
  pPalle.forEach(b => {
    const p = pPosizione(b, ora), r = b.g.palla;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(p.x + 1.5, p.y + 2.5, r, 0, 7); c.fill();
    const gr = c.createRadialGradient(p.x - r / 3, p.y - r / 3, 1, p.x, p.y, r);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#f0c040'); gr.addColorStop(1, '#a8761a');
    c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    c.strokeStyle = '#7a5208'; c.lineWidth = 1.2; c.stroke();
    if (r >= 7) { c.fillStyle = '#6a4406'; c.font = '700 ' + (r * 1.2).toFixed(1) + 'px "Cinzel", Georgia, serif'; c.fillText('', p.x, p.y + 0.5); }
  });
}
function pRett(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/* ── caduta: il percorso è deciso subito (50/50 a ogni chiodo), poi si anima ── */
function pPosizione(b, ora) {
  const g = b.g, t = (ora - b.t0) / g.seg, y00 = P_TOP - g.piolo - g.palla;
  if (t < 0) return { x: P_CX, y: y00 - 26 };
  if (t < 1) return { x: P_CX, y: y00 - 26 + t * t * 26 };   // entra e cade sul primo chiodo
  const s = Math.floor(t) - 1, u = t - Math.floor(t);
  if (s >= g.n) return { x: pBucaX(g, b.k), y: g.bucaY + 4 };
  const x0 = b.xs[s], x1 = b.xs[s + 1];
  const y0 = P_TOP + s * g.dy - g.palla - g.piolo + 1;
  const y1 = s + 1 < g.n ? y0 + g.dy : g.bucaY + 4;
  // piccolo rimbalzo: su di un po', poi giù sul chiodo dopo
  const y = y0 + (y1 - y0) * u * u - g.dy * 0.36 * Math.sin(Math.PI * u) * (1 - u * 0.4);
  return { x: x0 + (x1 - x0) * u, y };
}
function pLancia() {
  if (!run || !pBet()) return false;
  const puntata = pBet();
  if (balance < puntata) { sfxError(); pMsg('Stack insufficiente! Abbassa la puntata.', 'lose'); return false; }
  if (pPalle.length >= P_MAX_VOLO) return false;          // non esageriamo
  startMusic();
  balance -= puntata;
  contaGiocata();
  pUltimoLancio = performance.now();
  const g = pGeo(pRighe), xs = [P_CX]; let k = 0;
  for (let i = 0; i < g.n; i++) { const d = Math.random() < 0.5 ? -1 : 1; if (d > 0) k++; xs.push(xs[i] + d * g.dx / 2); }
  pPalle.push({ t0: pUltimoLancio, g, xs, k, puntata, rischio: pRischio, colpiti: 0 });
  pTono(880, .05, 'triangle', .05);
  if (!pAutoOn) pMsg('Giù la moneta...');
  pAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  if (!pRaf) pRaf = requestAnimationFrame(pAnima);
  return true;
}
function pAnima(ora) {
  pPalle.slice().forEach(b => {
    const t = (ora - b.t0) / b.g.seg;
    // chiodi colpiti: si accendono e fanno tic
    while (b.colpiti < b.g.n && t >= b.colpiti + 1) {
      const i = b.colpiti, j = Math.round((b.xs[i] - P_CX) / b.g.dx + (i + 2) / 2);
      pLuci[i + ':' + j] = ora;
      pTono(1500 + i * 50 + Math.random() * 120, .025, 'square', .016);
      b.colpiti++;
    }
    if (t >= b.g.n + 1) pArriva(b, ora);
  });
  pDisegna(ora);
  const luci = Object.values(pLuci).some(t => ora - t < 520);
  pRaf = pPalle.length || luci ? requestAnimationFrame(pAnima) : 0;
}
function pArriva(b, ora) {
  pPalle.splice(pPalle.indexOf(b), 1);
  pLuci['b' + b.k] = ora;
  const m = pMolt(b.rischio, b.g.n)[b.k], vincita = Math.floor(b.puntata * m);
  balance += vincita;
  pStoria.unshift(m); pStoria = pStoria.slice(0, 8);
  stats.pPalline = (stats.pPalline || 0) + 1;
  if (vincita > b.puntata) stats.pVinte = (stats.pVinte || 0) + 1;
  stats.pVincitaMax = Math.max(stats.pVincitaMax || 0, vincita);
  stats.pMoltMax = Math.max(stats.pMoltMax || 0, m);
  controllaSaldo();
  document.getElementById('p-vincita').textContent = ggb(vincita);
  const auto = pAutoOn ? ' · auto: ancora ' + pAuto : '';
  if (m >= 8) {
    pTono(660, .12, 'square', .06); pTono(990, .16, 'square', .06, .1); pTono(1320, .22, 'square', .06, .2);
    setCroupier(m >= 25 ? 'festoso' : 'vincente');
    pMsg(pEtichetta(m) + '! Vinci ' + ggb(vincita) + auto, 'win');
  } else if (m > 1) { sfxWin(); pMsg(pEtichetta(m) + ': vinci ' + ggb(vincita) + auto, 'win'); }
  else if (m === 1) { pTono(520, .08, 'sine', .06); pMsg(pEtichetta(m) + ': riprendi ' + ggb(vincita) + auto, 'push'); }
  else { pTono(220, .14, 'sine', .07); pMsg(pEtichetta(m) + ': torna ' + ggb(vincita) + (auto || '. Il Tromba ringrazia.'), 'lose'); }
  pAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  memScrivi();
  if (!pOccupata()) fineRun();     // a monete ferme: bancarotta o salto di tavolo
}

/* ── tenere premuto LANCIA ── */
const P_RAFFICA = 210;   // ms tra una moneta e l'altra
function pTieniInizia() {
  if (pAutoOn) return;
  pTieniFine();
  if (!pLancia()) return;
  pTieni = setInterval(() => { if (!pLancia()) pTieniFine(); }, P_RAFFICA);
}
function pTieniFine() { clearInterval(pTieni); pTieni = null; }

/* ── autobet ── */
function pAutoMenu() {
  if (pAutoOn) { pAutoStop('Auto fermato.'); return; }
  const m = document.getElementById('p-auto-menu');
  m.hidden = !m.hidden;
}
function pAutoAvvia(n) {
  document.getElementById('p-auto-menu').hidden = true;
  if (pAutoOn || !run || balance < pBet()) return;
  pAutoOn = true; pAuto = n;
  pAggiorna();
  pAutoPasso();
}
function pAutoPasso() {
  if (!pAutoOn) return;
  if (pAuto <= 0) { pAutoStop(''); return; }
  if (balance < pBet()) { pAutoStop('Auto fermato: stack insufficiente.'); return; }
  pAuto--;
  pLancia();
  pMsg('Auto: ancora ' + pAuto);
  pAutoTimer = setTimeout(pAutoPasso, 380);
}
function pAutoStop(testo) {
  clearTimeout(pAutoTimer); pAutoTimer = null;
  const era = pAutoOn;
  pAutoOn = false; pAuto = 0;
  if (testo) pMsg(testo);
  pAggiorna();
  if (era && !pPalle.length) fineRun();
}

/* ── interfaccia ── */
function pMsg(t, c) {
  const e = document.getElementById('p-msg');
  e.textContent = t; e.className = c || '';
  if (c) { void e.offsetWidth; e.classList.add('pop'); }
}
function pAggiorna() {
  if (!pPronta) return;
  const libero = !pOccupata();
  document.getElementById('p-saldo').textContent = ggb(balance);
  document.getElementById('p-puntata').textContent = ggb(pBet());
  const n = puntateFisse().length, i = Math.min(pPuntI, Math.max(0, n - 1));
  document.getElementById('p-meno').disabled = !libero || i <= 0;
  document.getElementById('p-piu').disabled = !libero || i >= n - 1;
  const puo = !!run && !!pBet() && balance >= pBet();
  document.getElementById('p-gioca').disabled = !puo || pAutoOn || pPalle.length >= P_MAX_VOLO;
  const a = document.getElementById('p-auto');
  a.disabled = !pAutoOn && (!puo || pPalle.length > 0);
  a.classList.toggle('on', pAutoOn);
  a.textContent = pAutoOn ? '■ Stop' : '⟳ Auto';
  document.getElementById('p-righe').disabled = !libero;
  document.getElementById('p-rischio').disabled = !libero;
  document.getElementById('p-storia').innerHTML = pStoria.map(m => `<span style="background:${pColore(m)[0]}">${pEtichetta(m)}</span>`).join('');
  if (typeof aggiornaTavoliBtn === 'function') aggiornaTavoliBtn();
  if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
}
function pCambiaPuntata(d) {
  if (pOccupata()) return;
  const n = puntateFisse().length, i = Math.max(0, Math.min(n - 1, Math.min(pPuntI, n - 1) + d));
  if (i === pPuntI) return;
  pPuntI = i; sfxChip(); pAggiorna();
}
function pCambiaRischio(r) {
  if (pOccupata() || r === pRischio || !P_TABELLE[r]) { document.getElementById('p-rischio').value = pRischio; return; }
  pRischio = r; document.getElementById('p-rischio').value = r;
  pRicorda(); sfxChip(); pAggiorna(); pDisegna(performance.now());
}
function pCambiaRighe(n) {
  n = Math.max(P_RIGHE_MIN, Math.min(P_RIGHE_MAX, n));
  if (pOccupata() || n === pRighe) { document.getElementById('p-righe').value = pRighe; return; }
  pRighe = n; document.getElementById('p-righe').value = n;
  pLuci = {};
  pRicorda(); sfxChip(); pAggiorna(); pDisegna(performance.now());
}
function pTono(f, durata, tipo, vol, quando) { if (typeof sTono === 'function') sTono(f, durata, tipo, vol, quando); }
function pEntra() {
  pCostruisci();
  requestAnimationFrame(pMisura);
  pAggiorna();
  if (!document.getElementById('p-msg').textContent) pMsg('Scegli file, rischio e puntata, poi lascia cadere la moneta.');
}
function pReset() { pTieniFine(); if (pAutoOn) pAutoStop(''); if (pPronta) pAggiorna(); }

// tasti: Spazio/Invio lancia (tenuti giù continuano) · ↑↓ puntata · ←→ file · 1 2 3 rischio · A auto · Esc ferma
function pTasti(e) {
  const k = e.key.toLowerCase();
  const menu = document.getElementById('p-auto-menu');
  if (pAutoOn) { if (k === 'escape' || k === 'a') { e.preventDefault(); pAutoStop('Auto fermato.'); } return; }
  if (!menu.hidden) {
    const n = { '1': 5, '2': 10, '3': 20 }[k];
    if (n) { e.preventDefault(); pAutoAvvia(n); return; }
    if (k === 'escape' || k === 'a') { e.preventDefault(); menu.hidden = true; return; }
  }
  if (k === ' ' || k === 'enter') {
    e.preventDefault();
    if (!e.repeat || performance.now() - pUltimoLancio >= P_RAFFICA) pLancia();
    return;
  }
  if (e.target && e.target.tagName === 'SELECT' && k.startsWith('arrow')) return;   // ci pensa il menù
  const azioni = {
    arrowup: () => pCambiaPuntata(1), arrowdown: () => pCambiaPuntata(-1), '+': () => pCambiaPuntata(1), '-': () => pCambiaPuntata(-1),
    arrowleft: () => pCambiaRighe(pRighe - 1), arrowright: () => pCambiaRighe(pRighe + 1),
    '1': () => pCambiaRischio('basso'), '2': () => pCambiaRischio('medio'), '3': () => pCambiaRischio('alto'),
    a: pAutoMenu,
  };
  if (azioni[k] && !e.repeat) { e.preventDefault(); azioni[k](); }
}
