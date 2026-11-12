/* ════════════════════════════════════════════════════════════════
   CINQUEGIRELLI: LA SLOT DE LA BISCA DER TROMBA
   Script classico caricato dopo lo script principale di index.html:
   usa lo stesso saldo (balance, cioè il portafogli GoGoldBar), le stesse
   statistiche (stats), i trofei (sblocca), gli effetti sonori e il
   salvataggio dell'account (memScrivi).

   5 rulli × 3 righe, 10 linee fisse. Le combinazioni pagano da sinistra
   a destra (3, 4 o 5 simboli uguali di fila) in "linee": una linea vale
   un decimo della puntata. Il maneki neko è il jolly (WILD) e sostituisce
   tutti tranne il BONUS. Tre o più BONUS ovunque pagano sulla puntata
   intera e danno i giri gratis, dove ogni vincita vale doppio.
════════════════════════════════════════════════════════════════ */
'use strict';

// paga[n] = quante linee (puntata/10) per n simboli di fila; per il BONUS è × la puntata intera
const S_SIMBOLI = {
  j:      { nome: 'J',               paga: { 3: 6, 4: 15, 5: 50 } },
  q:      { nome: 'Q',               paga: { 3: 6, 4: 18, 5: 60 } },
  k:      { nome: 'K',               paga: { 3: 8, 4: 20, 5: 75 } },
  a:      { nome: 'A',               paga: { 3: 10, 4: 25, 5: 100 } },
  canna:  { nome: 'Canna',           paga: { 3: 20, 4: 60, 5: 250 } },
  tromba: { nome: 'Il Tromba',       paga: { 3: 30, 4: 100, 5: 500 } },
  ggb:    { nome: 'GoGoldBar',       paga: { 3: 60, 4: 250, 5: 2000 } },
  neko:   { nome: 'Maneki neko (WILD)', paga: { 3: 100, 4: 500, 5: 5000 } },
  bonus:  { nome: 'BONUS del Tromba', paga: { 3: 2,  4: 10,  5: 50 } },
};
const S_GRATIS = { 3: 8, 4: 12, 5: 20 };   // giri gratis per 3, 4, 5 BONUS
const S_ORDINE = ['j', 'q', 'k', 'a', 'canna', 'tromba', 'ggb', 'neko', 'bonus'];
// quanto spesso esce ogni simbolo su ciascun rullo (stesso ordine di S_ORDINE)
const S_PESI = [
  [10, 10, 9, 8, 6, 4, 3, 2.5, 1.6],
  [10, 10, 9, 8, 6, 4, 3, 2.5, 1.6],
  [10, 10, 9, 8, 6, 4, 3, 2.5, 1.6],
  [10, 10, 9, 8, 6, 4, 3, 2.5, 1.6],
  [10, 10, 9, 8, 6, 4, 3, 2.5, 1.6],
];
// le 10 linee: per ogni rullo la riga (0 sopra, 1 centro, 2 sotto)
const S_LINEE = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
];
const S_COLORI_LINEE = ['#ffd84a', '#ff5a4a', '#4ad7ff', '#7dff6a', '#ff7ae6', '#ffa63d', '#a98bff', '#5affc8', '#ff4f8b', '#f4f4f4'];
// le puntate sono le fiches del tavolo (10, 25, 50, 100% dello stack, vedi BUY-IN E STACK in index.html)

function sEstrai(rullo, caso) {
  const pesi = S_PESI[rullo];
  let tot = 0; for (const p of pesi) tot += p;
  let x = (caso || Math.random)() * tot;
  for (let i = 0; i < pesi.length; i++) { x -= pesi[i]; if (x < 0) return S_ORDINE[i]; }
  return S_ORDINE[0];
}
// griglia[rullo][riga]
function sGriglia(caso) {
  const g = [];
  for (let r = 0; r < 5; r++) g.push([sEstrai(r, caso), sEstrai(r, caso), sEstrai(r, caso)]);
  return g;
}

// Conta la combinazione migliore su una linea: il WILD vale per qualsiasi simbolo, il BONUS spezza
function sLinea(g, linea) {
  const celle = linea.map((riga, r) => g[r][riga]);
  // solo jolly in testa
  let nWild = 0;
  while (nWild < 5 && celle[nWild] === 'neko') nWild++;
  let migliore = null;
  if (nWild >= 3) migliore = { simbolo: 'neko', n: nWild, linee: S_SIMBOLI.neko.paga[nWild] };
  const base = celle.find(c => c !== 'neko');
  if (base && base !== 'bonus') {
    let n = 0;
    while (n < 5 && (celle[n] === base || celle[n] === 'neko')) n++;
    const p = S_SIMBOLI[base].paga[n] || 0;
    if (p && (!migliore || p > migliore.linee)) migliore = { simbolo: base, n, linee: p };
  }
  return migliore;
}

// Tutte le vincite di un giro. molt = 2 nei giri gratis.
function sValuta(g, puntata, molt) {
  molt = molt || 1;
  const linee = [];
  let unita = 0;
  S_LINEE.forEach((l, i) => {
    const v = sLinea(g, l);
    if (v) { linee.push(Object.assign({ linea: i }, v)); unita += v.linee; }
  });
  const celleBonus = [];
  g.forEach((col, r) => col.forEach((s, riga) => { if (s === 'bonus') celleBonus.push([r, riga]); }));
  const nb = Math.min(5, celleBonus.length);
  const scatter = nb >= 3 ? { n: nb, celle: celleBonus, vincita: S_SIMBOLI.bonus.paga[nb] * puntata * molt, gratis: S_GRATIS[nb] } : null;
  const vincitaLinee = Math.floor(unita * puntata / 10) * molt;
  linee.forEach(v => { v.vincita = Math.floor(v.linee * puntata / 10) * molt; });
  return { linee, scatter, vincitaLinee, totale: vincitaLinee + (scatter ? scatter.vincita : 0) };
}


/* ════════════════════════════════════════════════════════════════
   LA MACCHINETTA (DOM)
════════════════════════════════════════════════════════════════ */
let sPuntI = 0;            // quale fiche si gioca (posizione)
let sPuntataGiro = 0;      // puntata del giro in corso
function sBet() { if (typeof chips !== 'function') return 0; const c = chips(); return c[Math.min(sPuntI, c.length - 1)] || 0; }
let sGirando = false;
let sAutoOn = false, sAuto = 0;
let sGratis = 0, sGratisFatti = 0, sGratisTot = 0, sGratisPuntata = 0;
let sGrigliaOra = null;
let sGiroLinee = null;         // timer che fa scorrere le linee vincenti
let sPronta = false;

function sOccupata() { return sGirando || sAutoOn || sGratis > 0; }
function sImg(id) { return 'assets/slot/' + id + '.webp?v=2'; }
function sCella(id) {
  const d = document.createElement('div');
  d.className = 's-sim s-' + id;
  const im = document.createElement('img');
  im.src = sImg(id); im.alt = S_SIMBOLI[id].nome; im.draggable = false;
  d.appendChild(im);
  return d;
}

function sCostruisci() {
  if (sPronta) return;
  sPronta = true;
  const rulli = document.getElementById('s-rulli');
  sGrigliaOra = sGriglia();
  for (let r = 0; r < 5; r++) {
    const rullo = document.createElement('div'); rullo.className = 's-rullo';
    const striscia = document.createElement('div'); striscia.className = 's-striscia';
    sGrigliaOra[r].forEach(id => striscia.appendChild(sCella(id)));
    rullo.appendChild(striscia); rulli.appendChild(rullo);
  }
  // le immagini partono subito, così il primo giro non ha buchi
  S_ORDINE.forEach(id => { const im = new Image(); im.src = sImg(id); });
  sDisegnaTabella();
}

// altezza di una cella = un terzo del rullo (la usano le strisce che scorrono)
function sMisura() {
  const r = document.querySelector('#s-rulli .s-rullo');
  if (!r || !r.clientHeight) return 0;
  const h = r.clientHeight / 3;
  document.getElementById('slot').style.setProperty('--sh', h + 'px');
  return h;
}

function sMsg(t, c) {
  const e = document.getElementById('s-msg');
  e.textContent = t;
  e.className = c || '';
  if (c) { void e.offsetWidth; e.classList.add('pop'); }
}

function sAggiorna() {
  if (!sPronta) return;
  const libero = !sOccupata();
  document.getElementById('s-saldo').textContent = ggb(balance);
  document.getElementById('s-puntata').textContent = ggb(sGratis > 0 ? sGratisPuntata : sBet());
  const n = chips().length, i = Math.min(sPuntI, Math.max(0, n - 1));
  document.getElementById('s-meno').disabled = !libero || i <= 0;
  document.getElementById('s-piu').disabled = !libero || i >= n - 1;
  const gioca = document.getElementById('s-gioca');
  gioca.disabled = !libero || !run || !sBet() || balance < sBet();
  gioca.classList.toggle('gira', sGirando);
  const auto = document.getElementById('s-auto');
  auto.disabled = !sAutoOn && (!libero || !run || !sBet() || balance < sBet());
  auto.classList.toggle('attivo', sAutoOn);
  auto.innerHTML = sAutoOn ? '■ Stop <small>' + sAuto + '</small>' : '⟳ Auto';
  auto.title = sAutoOn ? 'Ferma i giri automatici (Esc)' : 'Giri automatici con questa puntata (tasto A)';
  document.getElementById('slot').classList.toggle('in-gratis', sGratis > 0);
  updateCashoutBtn();
  aggiornaTavoliBtn();
}

function sCambiaPuntata(d) {
  if (sOccupata()) return;
  const n = chips().length;
  const i = Math.max(0, Math.min(n - 1, Math.min(sPuntI, n - 1) + d));
  if (i === sPuntI) return;
  sPuntI = i;
  sfxChip();
  sAggiorna();
  sDisegnaTabella();
}

/* ── tabella delle vincite, in GoGoldBar per la puntata scelta ── */
function sDisegnaTabella() {
  const box = document.getElementById('s-tabella-righe');
  if (!box) return;
  const p = sBet(), vl = u => ggb(Math.floor(u * p / 10));
  const righe = S_ORDINE.slice().reverse().map(id => {
    const s = S_SIMBOLI[id];
    const val = id === 'bonus' ? (n => ggb(s.paga[n] * p)) : (n => vl(s.paga[n]));
    return `<div class="s-tab-riga"><img src="${sImg(id)}" alt=""><div><b>${s.nome}</b>` +
      `<span>5× ${val(5)} · 4× ${val(4)} · 3× ${val(3)}</span>` +
      (id === 'neko' ? '<small>Jolly: sostituisce tutti i simboli tranne il BONUS</small>' : '') +
      (id === 'bonus' ? '<small>Ovunque sui rulli: 3 = 8 giri gratis, 4 = 12, 5 = 20. Nei giri gratis ogni vincita vale doppio</small>' : '') +
      '</div></div>';
  }).join('');
  box.innerHTML = righe;
  document.getElementById('s-tabella-nota').textContent =
    'Puntata ' + ggb(p) + ' su 10 linee fisse. Le combinazioni pagano da sinistra a destra; su ogni linea conta la più alta.';
}
function sTabella(apri) {
  const t = document.getElementById('s-tabella');
  t.hidden = apri === undefined ? !t.hidden : !apri;
  if (!t.hidden) sDisegnaTabella();
}

/* ── suoni della macchinetta ── */
function sTono(f, durata, tipo, vol, quando) {
  if (sfxOff) return;
  try {
    const c = getAC(), t = c.currentTime + (quando || 0), o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'square'; o.frequency.value = f;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(vol || .06, t); g.gain.exponentialRampToValueAtTime(.001, t + durata);
    o.start(t); o.stop(t + durata + .02);
  } catch (e) {}
}
function sSuonoStop(r) { sTono(140 - r * 8, .12, 'sine', .22); sTono(1800, .03, 'square', .03); }
function sSuonoBonus() { [660, 880, 990, 1320].forEach((f, i) => sTono(f, .18, 'square', .07, i * .09)); }
function sSuonoGrande() { for (let i = 0; i < 14; i++) sTono(900 + (i % 4) * 220, .1, 'triangle', .08, i * .07); }
let sTickTimer = null;
function sTickAvvia() { sTickStop(); sTickTimer = setInterval(() => sTono(2200 + Math.random() * 400, .02, 'square', .015), 70); }
function sTickStop() { clearInterval(sTickTimer); sTickTimer = null; }

/* ── il giro ── */
function sGioca() {
  if (sGirando) return;
  const gratis = sGratis > 0;
  if (!gratis) {
    if (!run || !sBet()) return;
    if (sAutoOn && balance < sBet()) { sAutoStop('Auto fermato: stack insufficiente.'); return; }
    if (balance < sBet()) { sfxError(); sMsg('Stack insufficiente! Abbassa la puntata.', 'lose'); return; }
  }
  startMusic();
  sTabella(false);
  document.getElementById('s-auto-menu').hidden = true;
  sPulisciVincite();
  sGirando = true;
  if (gratis) {
    sGratis--; sGratisFatti++;
    sMsg('Giro gratis ' + sGratisFatti + ' di ' + (sGratisFatti + sGratis) + ' · vincite ×2');
  } else {
    sPuntataGiro = sBet();
    balance -= sPuntataGiro;
    contaGiocata();
    sMsg(sAutoOn ? 'Auto: ancora ' + sAuto + ' giri' : 'Gira, gira...');
    document.getElementById('s-vincita').textContent = '—';
  }
  setCroupier('init');
  sAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);

  const finale = sGriglia();
  const veloce = sAutoOn || gratis;
  const H = sMisura();
  const rulli = [...document.querySelectorAll('#s-rulli .s-rullo')];
  // suspense: con due BONUS già fermi gli ultimi rulli girano più a lungo
  let bonusVisti = 0, extra = 0;
  const tempi = rulli.map((_, r) => {
    if (bonusVisti >= 2 && !veloce) extra += 650;
    bonusVisti += finale[r].filter(x => x === 'bonus').length;
    return (veloce ? 520 : 820) + r * (veloce ? 170 : 260) + extra;
  });
  let fermi = 0;
  sTickAvvia();
  rulli.forEach((rullo, r) => {
    const striscia = rullo.querySelector('.s-striscia');
    const k = 12 + r * 4 + Math.round(tempi[r] / 120);
    striscia.innerHTML = '';
    finale[r].forEach(id => striscia.appendChild(sCella(id)));
    for (let i = 0; i < k; i++) striscia.appendChild(sCella(sEstrai(r)));
    sGrigliaOra[r].forEach(id => striscia.appendChild(sCella(id)));
    const da = -(k + 3) * H, dur = tempi[r];
    rullo.classList.add('gira');
    rullo.classList.toggle('suspense', !veloce && r > 1 && finale.slice(0, r).flat().filter(x => x === 'bonus').length >= 2);
    let t0 = null;
    const passo = t => {
      if (t0 === null) t0 = t;
      const x = Math.min(1, (t - t0) / dur);
      // parte veloce, rallenta e alla fine rimbalza un filo
      const e = 1 - Math.pow(1 - x, 3);
      const rimbalzo = x > .92 ? Math.sin((x - .92) / .08 * Math.PI) * H * .06 : 0;
      striscia.style.transform = `translateY(${da * (1 - e) + rimbalzo}px)`;
      if (x > .85) rullo.classList.remove('gira');
      if (x < 1) requestAnimationFrame(passo);
      else {
        striscia.style.transform = 'translateY(0)';
        // tiene solo le tre celle visibili
        while (striscia.children.length > 3) striscia.removeChild(striscia.lastChild);
        rullo.classList.remove('suspense');
        sSuonoStop(r);
        if (finale[r].includes('bonus')) sTono(1320, .15, 'square', .05);
        if (++fermi === 5) { sTickStop(); sGrigliaOra = finale; sRisultato(finale, gratis); }
      }
    };
    requestAnimationFrame(passo);
  });
}

function sRisultato(g, gratis) {
  const puntata = gratis ? sGratisPuntata : sPuntataGiro;
  const v = sValuta(g, puntata, gratis ? 2 : 1);
  const vincita = v.totale;
  balance += vincita;
  if (gratis) sGratisTot += vincita;
  document.getElementById('s-vincita').textContent = gratis ? ggb(sGratisTot) : (vincita ? ggb(vincita) : '—');

  // statistiche e trofei
  if (!gratis) stats.sGiri = (stats.sGiri || 0) + 1;
  if (vincita > 0) { stats.sVinti = (stats.sVinti || 0) + 1; stats.sVincitaMax = Math.max(stats.sVincitaMax || 0, vincita); }
  sblocca('s_primo');
  v.linee.forEach(l => {
    if (l.simbolo === 'canna') { sblocca('s_canne'); if (l.n === 5) sblocca('s_canna5'); }
    if (l.simbolo === 'neko') sblocca('s_neko');
    if (l.simbolo === 'ggb' && l.n === 5) sblocca('s_jackpot');
    if (l.simbolo === 'tromba' && l.n === 5) sblocca('s_tromba5');
  });
  if (v.scatter) { sblocca('s_gratis'); stats.sBonus = (stats.sBonus || 0) + 1; if (v.scatter.n === 5) sblocca('s_bonus5'); }
  if (vincita >= puntata * 100) sblocca('s_cento');
  if ((stats.sGiri || 0) >= 250) sblocca('s_giri250');
  controllaSaldo();

  sMostraVincite(v);
  const grande = vincita >= puntata * 20;
  if (v.scatter) {
    sSuonoBonus();
    setCroupier('festoso');
    if (!gratis) { sGratisPuntata = sPuntataGiro; sGratisFatti = 0; sGratisTot = vincita; }
    sGratis += v.scatter.gratis;
    sBanner((gratis ? '+' : '') + v.scatter.gratis + ' GIRI GRATIS!', 'Il Tromba offre il giro · vincite ×2');
    sMsg(v.scatter.n + ' BONUS! ' + v.scatter.gratis + ' giri gratis' + (v.scatter.vincita ? ' e ' + ggb(v.scatter.vincita) : ''), 'win');
  } else if (vincita > 0) {
    if (grande) { sSuonoGrande(); sBanner(vincita >= puntata * 50 ? 'MEGA VINCITA!' : 'GRANDE VINCITA!', ggb(vincita)); }
    else sfxWin();
    setCroupier(grande ? 'festoso' : 'vincente');
    sMsg((gratis ? 'Giro gratis: ' : '') + 'Vinci ' + ggb(vincita) + (v.linee.length > 1 ? ' su ' + v.linee.length + ' linee' : ''), 'win');
  } else {
    if (!gratis) { setCroupier(Math.random() < .3 ? 'lose' : 'init'); sMsg('Niente. Il Tromba ringrazia.', 'lose'); }
    else sMsg('Giro gratis a vuoto.', 'push');
  }

  sGirando = false;
  // fine dei giri gratis: si dice il totale
  const fineGratis = gratis && sGratis === 0;
  if (fineGratis) {
    if (sGratisTot >= sGratisPuntata * 100) sblocca('s_cento');
    setTimeout(() => {
      sBanner('GIRI GRATIS FINITI', 'Hai vinto ' + ggb(sGratisTot));
      sMsg('Giri gratis finiti: hai vinto ' + ggb(sGratisTot) + '!', sGratisTot ? 'win' : 'push');
      if (sGratisTot) sfxWin();
      sAggiorna();
    }, 900);
  }
  sAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  memScrivi();

  const pausa = v.scatter ? 2600 : grande ? 2400 : vincita ? 1300 : 650;
  if (sGratis > 0) { setTimeout(sGioca, pausa + (fineGratis ? 0 : 400)); return; }
  if (fineRun()) { sAutoStop(); return; }
  if (sAutoOn) {
    if (sAuto > 0 && balance >= sBet()) setTimeout(sAutoGiro, pausa + (fineGratis ? 2200 : 0));
    else sAutoStop(sAuto > 0 ? 'Auto fermato: stack insufficiente.' : '');
  }
}

/* ── vincite: linee sullo schermo, celle che brillano, poi una linea alla volta ── */
function sCentro(r, riga) { return (r * 100 + 50) + ',' + (riga * 100 + 50); }
function sPulisciVincite() {
  clearInterval(sGiroLinee); sGiroLinee = null;
  document.getElementById('s-linee').innerHTML = '';
  document.querySelectorAll('#s-rulli .vince').forEach(c => c.classList.remove('vince'));
  document.getElementById('s-banner').className = '';
}
function sAccendi(celle) {
  const rulli = document.querySelectorAll('#s-rulli .s-rullo');
  document.querySelectorAll('#s-rulli .vince').forEach(c => c.classList.remove('vince'));
  celle.forEach(([r, riga]) => { const c = rulli[r].querySelector('.s-striscia').children[riga]; if (c) c.classList.add('vince'); });
}
function sMostraVincite(v) {
  const svg = document.getElementById('s-linee');
  const disegna = lista => {
    svg.innerHTML = lista.map(l => {
      const pts = S_LINEE[l.linea].map((riga, r) => sCentro(r, riga)).join(' ');
      return `<polyline points="${pts}" stroke="${S_COLORI_LINEE[l.linea]}"/>`;
    }).join('');
    const celle = [];
    lista.forEach(l => { for (let r = 0; r < l.n; r++) celle.push([r, S_LINEE[l.linea][r]]); });
    if (v.scatter) celle.push(...v.scatter.celle);
    sAccendi(celle);
  };
  if (!v.linee.length && !v.scatter) return;
  disegna(v.linee);
  if (v.linee.length < 2) return;
  let i = 0;
  sGiroLinee = setInterval(() => {
    if (sGirando) return;
    const l = v.linee[i++ % v.linee.length];
    disegna([l]);
    document.getElementById('s-vincita').textContent = ggb(l.vincita);
  }, 1400);
}
function sBanner(titolo, sotto) {
  const b = document.getElementById('s-banner');
  b.innerHTML = '<b></b><span></span>';
  b.querySelector('b').textContent = titolo;
  b.querySelector('span').textContent = sotto || '';
  b.className = '';
  void b.offsetWidth;
  b.className = 'show';
  clearTimeout(sBanner.t);
  sBanner.t = setTimeout(() => { b.className = ''; }, 2300);
}

/* ── auto: 10, 25, 50 o 100 giri con la stessa puntata ── */
function sAutoMenu() {
  if (sAutoOn) { sAutoStop('Auto fermato.'); return; }
  if (document.getElementById('s-auto').disabled) return;
  const m = document.getElementById('s-auto-menu');
  m.hidden = !m.hidden;
}
function sAutoAvvia(giri) {
  document.getElementById('s-auto-menu').hidden = true;
  if (sOccupata()) return;
  if (!run || !sBet() || balance < sBet()) { sfxError(); sMsg('Stack insufficiente per l\'auto.', 'lose'); return; }
  sAutoOn = true; sAuto = giri;
  sAutoGiro();
}
function sAutoGiro() {
  if (!sAutoOn || sGirando || sGratis > 0) return;
  if (sAuto <= 0) { sAutoStop(); return; }
  sAuto--;
  sGioca();
}
function sAutoStop(testo) {
  if (!sAutoOn) return;
  sAutoOn = false; sAuto = 0;
  if (testo) sMsg(testo, 'push');
  sAggiorna();

}

/* ── entrata / uscita ── */
function sEntra() {
  sCostruisci();
  requestAnimationFrame(sMisura);
  sAggiorna();
  sDisegnaTabella();
  if (!document.getElementById('s-msg').textContent) sMsg('Scegli la puntata e tira la leva. Il maneki neko è il jolly!');
}
function sReset() {
  sAutoOn = false; sAuto = 0;
  if (!sGirando) { sGratis = 0; }
  if (sPronta) { sPulisciVincite(); sAggiorna(); }
}

// tasti: Spazio/Invio gioca · ↑↓ o +/- puntata · A auto · T tabella · Esc ferma o chiude
function sTasti(e) {
  const k = e.key.toLowerCase();
  const menu = document.getElementById('s-auto-menu');
  if (sAutoOn) { if (k === 'escape' || k === 'a') { e.preventDefault(); sAutoStop('Auto fermato.'); } return; }
  if (!menu.hidden) {
    const giri = { '1': 10, '2': 25, '3': 50, '4': 100 }[k];
    if (giri) { e.preventDefault(); sAutoAvvia(giri); return; }
    if (k === 'escape' || k === 'a') { e.preventDefault(); menu.hidden = true; return; }
  }
  if (k === 'escape' && !document.getElementById('s-tabella').hidden) { e.preventDefault(); sTabella(false); return; }
  const azioni = {
    ' ': sGioca, enter: sGioca, a: sAutoMenu, t: () => sTabella(),
    arrowup: () => sCambiaPuntata(1), arrowdown: () => sCambiaPuntata(-1), '+': () => sCambiaPuntata(1), '-': () => sCambiaPuntata(-1),
  };
  if (azioni[k]) { e.preventDefault(); azioni[k](); }
}

if (typeof document !== 'undefined') {
  window.addEventListener('resize', () => { if (gioco === 'slot' && !sGirando) sMisura(); });
  document.addEventListener('pointerdown', e => {
    const menu = document.getElementById('s-auto-menu');
    if (menu && !menu.hidden && !e.target.closest('.s-auto-wrap')) menu.hidden = true;
  });
}

if (typeof module !== 'undefined' && typeof document === 'undefined') {
  module.exports = { S_SIMBOLI, S_GRATIS, S_ORDINE, S_PESI, S_LINEE, sGriglia, sValuta, sLinea };
}
