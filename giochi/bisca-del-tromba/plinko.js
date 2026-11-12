/* ════════════════════════════════════════════════════════════════
   PLINKO DER TROMBA
   Si lascia cadere una moneta dall'alto: a ogni chiodo va a destra o
   a sinistra (50 e 50) e finisce in una delle 13 buche in fondo, che
   moltiplicano la puntata. Tre livelli di rischio, RTP ~96%.
   Usa lo stack, le fiches (chips()) e il conteggio delle giocate di
   index.html; più monete possono cadere insieme.
════════════════════════════════════════════════════════════════ */
const P_RIGHE = 12;
// moltiplicatori dal bordo al centro (la tabella è simmetrica)
const P_RISCHI = {
  basso: { nome: 'Basso', meta: [9, 3, 1.4, 1.2, 1.1, 1, 0.5] },
  medio: { nome: 'Medio', meta: [30, 10, 4, 2, 1, 0.6, 0.3] },
  alto:  { nome: 'Alto',  meta: [150, 25, 8, 2, 0.6, 0.2, 0.2] },
};
function pMolt(rischio) { const m = P_RISCHI[rischio].meta; return m.concat(m.slice(0, -1).reverse()); }

// geometria in unità logiche del canvas
const P_W = 600, P_DX = 40, P_DY = 33, P_TOP = 34, P_PIOLO = 4.2, P_PALLA = 9;
const P_FONDO = P_TOP + (P_RIGHE - 1) * P_DY;          // y dell'ultima fila di chiodi
const P_BUCA_Y = P_FONDO + 26, P_BUCA_H = 30, P_H = P_BUCA_Y + P_BUCA_H + 8;
const P_CX = P_W / 2;

let pRischio = 'medio';
let pPuntI = 0;
let pPalle = [];            // monete in caduta
let pStoria = [];           // ultimi moltiplicatori usciti
let pPronta = false, pCtx = null, pRaf = 0, pScala = 1;
let pLuci = {};             // chiodi e buche che si accendono: chiave → tempo
function pBet() { if (typeof chips !== 'function') return 0; const c = chips(); return c[Math.min(pPuntI, c.length - 1)] || 0; }
function pOccupata() { return pPalle.length > 0; }

function pPiolo(i, j) { return { x: P_CX + (j - (i + 2) / 2) * P_DX, y: P_TOP + i * P_DY }; }
function pBucaX(k) { return P_CX + (k - P_RIGHE / 2) * P_DX; }
function pColore(m) {
  // dal giallo (sotto 1) al rosso fuoco (moltiplicatori grossi)
  if (m >= 25) return ['#ff2d2d', '#7a0606'];
  if (m >= 8)  return ['#ff5a2d', '#801a06'];
  if (m >= 3)  return ['#ff8a2d', '#7a3306'];
  if (m >= 1.4) return ['#ffb12d', '#7a4d06'];
  if (m >= 1)  return ['#ffd23d', '#7a6006'];
  return ['#d8c27a', '#4d3f12'];
}
function pEtichetta(m) { return (m >= 10 ? m : String(m).replace('.', ',')) + '×'; }

/* ── costruzione e misura ── */
function pCostruisci() {
  if (pPronta) return;
  pPronta = true;
  pCtx = document.getElementById('p-board').getContext('2d');
  document.getElementById('p-rischi').innerHTML = Object.keys(P_RISCHI).map((k, i) =>
    `<button type="button" class="bet-tool" data-r="${k}" onclick="pCambiaRischio('${k}')" title="Tasto ${i + 1}">${P_RISCHI[k].nome}</button>`).join('');
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
  c.clearRect(0, 0, P_W, P_H);
  // chiodi
  for (let i = 0; i < P_RIGHE; i++) for (let j = 0; j < i + 3; j++) {
    const p = pPiolo(i, j), t = pLuci[i + ':' + j], acceso = t ? Math.max(0, 1 - (ora - t) / 380) : 0;
    if (acceso > 0) { c.fillStyle = 'rgba(255,220,120,' + (acceso * 0.45) + ')'; c.beginPath(); c.arc(p.x, p.y, P_PIOLO + 7 * acceso, 0, 7); c.fill(); }
    c.fillStyle = acceso > 0 ? '#fff4c8' : '#e8cf86';
    c.beginPath(); c.arc(p.x, p.y, P_PIOLO, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(p.x + 1, p.y + 1.4, P_PIOLO * 0.55, 0, 7); c.fill();
  }
  // buche
  const molt = pMolt(pRischio);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  molt.forEach((m, k) => {
    const x = pBucaX(k), t = pLuci['b' + k], u = t ? Math.max(0, 1 - (ora - t) / 500) : 0;
    const w = P_DX - 4, y = P_BUCA_Y + u * 6, [chiaro, scuro] = pColore(m);
    const g = c.createLinearGradient(0, y, 0, y + P_BUCA_H);
    g.addColorStop(0, chiaro); g.addColorStop(1, scuro);
    c.fillStyle = g;
    pRett(c, x - w / 2, y, w, P_BUCA_H, 6); c.fill();
    if (u > 0) { c.fillStyle = 'rgba(255,255,255,' + u * 0.5 + ')'; pRett(c, x - w / 2, y, w, P_BUCA_H, 6); c.fill(); }
    c.fillStyle = '#1a0702';
    // sul telefono il tabellone è piccolo: scritte più grosse e senza la ×
    const piccolo = pScala < 0.75, fs = piccolo ? Math.min(16, 8.5 / pScala) : 12.5;
    c.font = '800 ' + (m >= 100 ? fs * 0.88 : fs) + 'px "Cinzel", Georgia, serif';
    c.fillText(piccolo ? pEtichetta(m).slice(0, -1) : pEtichetta(m), x, y + P_BUCA_H / 2 + 1);
  });
  // monete
  pPalle.forEach(b => {
    const p = pPosizione(b, ora);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(p.x + 1.5, p.y + 2.5, P_PALLA, 0, 7); c.fill();
    const g = c.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, P_PALLA);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#f0c040'); g.addColorStop(1, '#a8761a');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, P_PALLA, 0, 7); c.fill();
    c.strokeStyle = '#7a5208'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#6a4406'; c.font = '700 11px "Cinzel", Georgia, serif';
    c.fillText('', p.x, p.y + 0.5);
  });
}
function pRett(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/* ── caduta: il percorso è deciso subito (50/50 a ogni chiodo), poi si anima ── */
const P_SEG = 125;  // ms per fila
function pPosizione(b, ora) {
  const t = (ora - b.t0) / P_SEG;
  if (t < 0) return { x: P_CX, y: P_TOP - 30 - P_PALLA };
  if (t < 1) { const u = t * t; return { x: P_CX, y: P_TOP - 30 - P_PALLA + u * 30 }; }   // entra e cade sul primo chiodo
  const s = Math.floor(t) - 1, u = t - Math.floor(t);
  if (s >= P_RIGHE) return { x: pBucaX(b.k), y: P_BUCA_Y + 6 };
  const x0 = b.xs[s], x1 = b.xs[s + 1];
  const y0 = P_TOP + s * P_DY - P_PALLA - P_PIOLO + 2;
  const y1 = s + 1 < P_RIGHE ? y0 + P_DY : P_BUCA_Y + 6;
  // piccolo rimbalzo: su di un po', poi giù sul chiodo dopo
  const y = y0 + (y1 - y0) * u * u - 12 * Math.sin(Math.PI * u) * (1 - u * 0.4);
  return { x: x0 + (x1 - x0) * u, y };
}
function pLancia() {
  if (!run || !pBet()) return;
  const puntata = pBet();
  if (balance < puntata) { sfxError(); pMsg('Stack insufficiente! Abbassa la puntata.', 'lose'); return; }
  if (pPalle.length >= 12) return;          // non esageriamo
  startMusic();
  balance -= puntata;
  contaGiocata();
  const xs = [P_CX]; let k = 0;
  for (let i = 0; i < P_RIGHE; i++) { const d = Math.random() < 0.5 ? -1 : 1; if (d > 0) k++; xs.push(xs[i] + d * P_DX / 2); }
  const b = { t0: performance.now(), xs, k, puntata, rischio: pRischio, colpiti: 0 };
  pPalle.push(b);
  pTono(880, .05, 'triangle', .05);
  pMsg('Giù la moneta...');
  pAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  if (!pRaf) pRaf = requestAnimationFrame(pAnima);
}
function pAnima(ora) {
  pPalle.slice().forEach(b => {
    const t = (ora - b.t0) / P_SEG;
    // chiodi colpiti: si accendono e fanno tic
    while (b.colpiti < P_RIGHE && t >= b.colpiti + 1) {
      const i = b.colpiti, j = Math.round((b.xs[i] - P_CX) / P_DX + (i + 2) / 2);
      pLuci[i + ':' + j] = ora;
      pTono(1500 + i * 60 + Math.random() * 120, .025, 'square', .018);
      b.colpiti++;
    }
    if (t >= P_RIGHE + 1) pArriva(b, ora);
  });
  pDisegna(ora);
  const luci = Object.values(pLuci).some(t => ora - t < 520);
  pRaf = pPalle.length || luci ? requestAnimationFrame(pAnima) : 0;
}
function pArriva(b, ora) {
  pPalle.splice(pPalle.indexOf(b), 1);
  pLuci['b' + b.k] = ora;
  const m = pMolt(b.rischio)[b.k], vincita = Math.floor(b.puntata * m);
  balance += vincita;
  pStoria.unshift(m); pStoria = pStoria.slice(0, 8);
  stats.pPalline = (stats.pPalline || 0) + 1;
  if (vincita > b.puntata) stats.pVinte = (stats.pVinte || 0) + 1;
  stats.pVincitaMax = Math.max(stats.pVincitaMax || 0, vincita);
  stats.pMoltMax = Math.max(stats.pMoltMax || 0, m);
  controllaSaldo();
  document.getElementById('p-vincita').textContent = ggb(vincita);
  if (m >= 8) {
    pTono(660, .12, 'square', .06); pTono(990, .16, 'square', .06, .1); pTono(1320, .22, 'square', .06, .2);
    setCroupier(m >= 25 ? 'festoso' : 'vincente');
    pMsg(pEtichetta(m) + '! Vinci ' + ggb(vincita), 'win');
  } else if (m > 1) { sfxWin(); pMsg(pEtichetta(m) + ': vinci ' + ggb(vincita), 'win'); }
  else if (m === 1) { pTono(520, .08, 'sine', .06); pMsg(pEtichetta(m) + ': riprendi ' + ggb(vincita), 'push'); }
  else { pTono(220, .14, 'sine', .07); pMsg(pEtichetta(m) + ': torna ' + ggb(vincita) + '. Il Tromba ringrazia.', 'lose'); }
  pAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  memScrivi();
  if (!pPalle.length) fineRun();     // a monete ferme: bancarotta o salto di tavolo
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
  const n = chips().length, i = Math.min(pPuntI, Math.max(0, n - 1));
  document.getElementById('p-meno').disabled = !libero || i <= 0;
  document.getElementById('p-piu').disabled = !libero || i >= n - 1;
  document.getElementById('p-gioca').disabled = !run || !pBet() || balance < pBet() || pPalle.length >= 12;
  document.querySelectorAll('#p-rischi button').forEach(b => { b.classList.toggle('scelto', b.dataset.r === pRischio); b.disabled = !libero; });
  document.getElementById('p-storia').innerHTML = pStoria.map(m => `<span style="background:${pColore(m)[0]}">${pEtichetta(m)}</span>`).join('');
  if (typeof aggiornaTavoliBtn === 'function') aggiornaTavoliBtn();
  if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
}
function pCambiaPuntata(d) {
  if (pOccupata()) return;
  const n = chips().length, i = Math.max(0, Math.min(n - 1, Math.min(pPuntI, n - 1) + d));
  if (i === pPuntI) return;
  pPuntI = i; sfxChip(); pAggiorna();
}
function pCambiaRischio(r) {
  if (pOccupata() || r === pRischio) return;
  pRischio = r; sfxChip(); pAggiorna(); pDisegna(performance.now());
}
function pTono(f, durata, tipo, vol, quando) { if (typeof sTono === 'function') sTono(f, durata, tipo, vol, quando); }
function pEntra() {
  pCostruisci();
  requestAnimationFrame(pMisura);
  pAggiorna();
  if (!document.getElementById('p-msg').textContent) pMsg('Scegli puntata e rischio, poi lascia cadere la moneta.');
}
function pReset() { if (pPronta) pAggiorna(); }

// tasti: Spazio/Invio lancia · ↑↓ puntata · 1 2 3 rischio
function pTasti(e) {
  const k = e.key.toLowerCase();
  const azioni = {
    ' ': pLancia, enter: pLancia,
    arrowup: () => pCambiaPuntata(1), arrowdown: () => pCambiaPuntata(-1), '+': () => pCambiaPuntata(1), '-': () => pCambiaPuntata(-1),
    '1': () => pCambiaRischio('basso'), '2': () => pCambiaRischio('medio'), '3': () => pCambiaRischio('alto'),
  };
  if (azioni[k]) { e.preventDefault(); if (!e.repeat || k === ' ' || k === 'enter') azioni[k](); }
}
