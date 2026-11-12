/* ════════════════════════════════════════════════════════════════
   IL PORTIERE — rigori contro il Tromba
   Si paga la puntata e si tira: scegli uno dei sei angoli della porta.
   Ogni gol fa salire la torre dei moltiplicatori; puoi incassare dopo
   qualsiasi gol, ma se il Tromba para perdi tutto. Massimo 12 tiri.
   Tre campionati: più è difficile, più para e più paga.
   Moltiplicatore dopo k gol = 0,96 / p^k (p = probabilità di segnare),
   quindi il ritorno è ~96% qualunque sia il momento in cui incassi.
   Usa lo stack, le puntate fisse di slot e plinko (puntateFisse()),
   il conteggio delle giocate e il salto di tavolo di index.html.
════════════════════════════════════════════════════════════════ */
const PT_TIRI = 12;
const PT_CAMPIONATI = {
  calcetto:  { nome: 'Calcetto',  p: 0.80 },
  seriea:    { nome: 'Serie A',   p: 0.65 },
  champions: { nome: 'Champions', p: 0.50 },
};
function ptTorre(c) {
  const p = PT_CAMPIONATI[c].p, t = [];
  for (let k = 1; k <= PT_TIRI; k++) t.push(Math.floor(0.96 / Math.pow(p, k) * 100) / 100);
  return t;
}
// i sei angoli: colonna 0-2 (sinistra, centro, destra), riga 0 alta / 1 bassa
// la testa del portiere: le facce del Tromba ritagliate dalle foto del croupier
const PT_TESTE = { init: 'assets/portiere/testa-init.webp', festoso: 'assets/portiere/testa-festoso.webp', lose: 'assets/portiere/testa-lose.webp', vincente: 'assets/portiere/testa-vincente.webp' };
Object.values(PT_TESTE).forEach(src => { const i = new Image(); i.src = src; });
const PT_ZONE = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];

let ptCamp = 'seriea';
try { const c = localStorage.getItem('biscaPortiere.camp'); if (PT_CAMPIONATI[c]) ptCamp = c; } catch (e) {}
let ptPuntI = 0;
let ptRound = null;          // { puntata, camp, gol }: la serie in corso, già aggiornata col tiro appena fatto
let ptVista = null;          // cosa mostrare mentre il pallone vola (lo stato di prima del tiro)
let ptTirando = false;
let ptPronto = false;
function ptBet() { if (typeof puntateFisse !== 'function') return 0; const c = puntateFisse(); return c[Math.min(ptPuntI, c.length - 1)] || 0; }
function ptOccupato() { return !!ptRound || ptTirando; }

// la serie in corso si salva nell'account (datiAccount in index.html): se ricarichi la pagina riprendi da dove eri.
// L'esito del tiro si decide e si salva subito, prima dell'animazione: ricaricare non annulla una parata.
function ptStato() { return ptRound ? { puntata: ptRound.puntata, camp: ptRound.camp, gol: ptRound.gol } : null; }
function ptValido(r) { return !!r && typeof r === 'object' && !!PT_CAMPIONATI[r.camp] && r.puntata > 0 && Number.isInteger(r.gol) && r.gol >= 0 && r.gol <= PT_TIRI; }
function ptRipristina(r) {
  if (ptTirando) return;
  ptRound = ptValido(r) ? { puntata: Math.floor(r.puntata), camp: r.camp, gol: r.gol } : null;
  if (ptRound) ptCamp = ptRound.camp;
  ptAggiorna();
  if (typeof updateCashoutBtn === 'function') try { updateCashoutBtn(); } catch (e) {}
}

function ptOrizzontale() { return !!(window.matchMedia && matchMedia('(max-width:760px)').matches); }
window.addEventListener('resize', () => { if (gioco === 'portiere') ptAggiorna(); });
function ptValuta(m) { return String(m).replace('.', ',') + '×'; }

/* ── costruzione ── */
function ptCostruisci() {
  if (ptPronto) return;
  ptPronto = true;
  document.getElementById('pt-zone').innerHTML = PT_ZONE.map((z, i) =>
    `<button type="button" class="pt-zona" data-i="${i}" onclick="ptTira(${i})" aria-label="Tira ${['in alto a sinistra', 'in alto al centro', 'in alto a destra', 'in basso a sinistra', 'in basso al centro', 'in basso a destra'][i]}" title="Tasto ${i + 1}"><span></span></button>`).join('');
  document.getElementById('pt-camp').innerHTML = Object.keys(PT_CAMPIONATI).map(k =>
    `<button type="button" class="bet-tool" data-c="${k}" onclick="ptCambiaCamp('${k}')">${PT_CAMPIONATI[k].nome}</button>`).join('');
}

/* ── tiro ── */
function ptTira(i) {
  if (ptTirando || !run || (ptRound && ptRound.gol >= PT_TIRI)) return;
  if (!ptRound) {
    const puntata = ptBet();
    if (!puntata) return;
    if (balance < puntata) { sfxError(); ptMsg('Stack insufficiente! Abbassa la puntata.', 'lose'); return; }
    startMusic();
    balance -= puntata;
    contaGiocata();
    ptRound = { puntata, camp: ptCamp, gol: 0 };
    stats.ptPartite = (stats.ptPartite || 0) + 1;
  }
  ptTirando = true;
  ptVista = ptStato();
  const gol = Math.random() < PT_CAMPIONATI[ptRound.camp].p;
  if (gol) {
    ptRound.gol++;
    stats.ptGol = (stats.ptGol || 0) + 1;
    stats.ptSerieMax = Math.max(stats.ptSerieMax || 0, ptRound.gol);
  } else {
    stats.ptParate = (stats.ptParate || 0) + 1;
    ptRound = null;
  }
  memScrivi();
  // se para si tuffa dove hai tirato, se no da un'altra parte
  let tuffo = i;
  if (gol) { const altre = [0, 1, 2, 3, 4, 5].filter(z => z !== i); tuffo = altre[Math.floor(Math.random() * altre.length)]; }
  ptAnima(i, tuffo, gol);
  ptAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
}

function ptAnima(zona, tuffo, gol) {
  const campo = document.getElementById('pt-campo'), palla = document.getElementById('pt-palla');
  const kp = document.getElementById('pt-portiere'), bersaglio = document.querySelector('.pt-zona[data-i="' + zona + '"]');
  document.querySelectorAll('.pt-zona').forEach(z => z.classList.toggle('mirata', z === bersaglio));
  const rc = campo.getBoundingClientRect(), rz = bersaglio.getBoundingClientRect(), rp = palla.getBoundingClientRect();
  const [col, riga] = PT_ZONE[zona];
  // il pallone va un po' verso l'angolo, non proprio al centro della zona
  const tx = rz.left + rz.width * (col === 0 ? 0.4 : col === 2 ? 0.6 : 0.5) - (rp.left + rp.width / 2);
  const ty = rz.top + rz.height * (riga === 0 ? 0.42 : 0.58) - (rp.top + rp.height / 2);
  ptTono(180, .09, 'sine', .25); ptTono(90, .12, 'triangle', .2);
  palla.style.transition = 'transform .5s cubic-bezier(.2,.75,.35,1)';
  palla.style.transform = `translate(${tx}px, ${ty}px) scale(.52) rotate(${(col - 1) * 540 + 360}deg)`;
  kp.className = 'tuffo-' + tuffo;
  setTimeout(() => {
    campo.classList.add(gol ? 'gol' : 'parata');
    if (gol) { ptTono(520, .1, 'square', .05); ptTono(780, .14, 'square', .05, .08); }
    else {
      ptTono(140, .18, 'sawtooth', .07);
      // respinta: il pallone schizza fuori dallo specchio
      palla.style.transition = 'transform .45s ease-out, opacity .45s ease-in';
      palla.style.transform = `translate(${tx * 1.25 + (col - 1 || (Math.random() < .5 ? -1 : 1)) * rc.width * .12}px, ${ty - rc.height * (riga ? .05 : .2)}px) scale(.45) rotate(${(col - 1) * 900}deg)`;
      palla.style.opacity = '0';
    }
    ptEsito(gol);
  }, 520);
}

function ptEsito(gol) {
  const v = ptVista, testa = document.getElementById('pt-testa');
  if (gol) {
    const n = v.gol + 1, m = ptTorre(v.camp)[n - 1];
    testa.src = PT_TESTE.lose;
    ptBanner('GOOOL!', ptValuta(m) + ' · ' + ggb(Math.floor(v.puntata * m)));
    setCroupier('lose');
    if (n >= PT_TIRI) {
      ptMsg('Dodici su dodici!', 'win');
      setTimeout(() => { ptTirando = false; ptVista = null; ptRimetti(); ptIncassa(true); }, 1300);
      return;
    }
    ptMsg('Gol! Ora vale ' + ggb(Math.floor(v.puntata * m)) + ': incassi o tiri ancora?', 'win');
  } else {
    testa.src = PT_TESTE.festoso;
    ptBanner('PARATA!', v.gol ? 'Persi ' + ggb(Math.floor(v.puntata * ptTorre(v.camp)[v.gol - 1])) : 'Il Tromba non perdona');
    ptMsg('Parata del Tromba! Hai perso la puntata' + (v.gol ? ' e i ' + v.gol + ' gol fatti.' : '.'), 'lose');
    setCroupier('festoso');
    sfxLose();
  }
  setTimeout(() => {
    ptTirando = false;
    ptVista = null;
    ptRimetti();
    ptAggiorna();
    if (!ptRound) fineRun(true);     // fine della serie: bancarotta o salto di tavolo
    if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
  }, 1300);
}

function ptRimetti() {
  const campo = document.getElementById('pt-campo'), palla = document.getElementById('pt-palla');
  campo.classList.remove('gol', 'parata');
  palla.style.transition = 'none'; palla.style.transform = 'none'; palla.style.opacity = '';
  document.getElementById('pt-portiere').className = '';
  document.getElementById('pt-testa').src = PT_TESTE.init;
  document.querySelectorAll('.pt-zona').forEach(z => z.classList.remove('mirata'));
}

function ptIncassa(tutti) {
  const r = ptRound;
  if (!r || !r.gol || ptTirando) return;
  const m = ptTorre(r.camp)[r.gol - 1], vincita = Math.floor(r.puntata * m);
  balance += vincita;
  stats.ptIncassi = (stats.ptIncassi || 0) + 1;
  stats.ptVincitaMax = Math.max(stats.ptVincitaMax || 0, vincita);
  stats.ptMoltMax = Math.max(stats.ptMoltMax || 0, m);
  controllaSaldo();
  ptRound = null;
  sfxWin();
  setCroupier(m >= 10 ? 'lose' : 'init');
  ptBanner(tutti ? 'TUTTI E 12!' : 'INCASSATO', ggb(vincita));
  ptMsg((tutti ? 'Dodici gol su dodici! ' : 'Incassati ') + ggb(vincita) + ' (' + ptValuta(m) + ').', 'win');
  document.getElementById('balance-display').textContent = ggb(balance);
  memScrivi();
  ptAggiorna();
  fineRun(true);
}

/* ── interfaccia ── */
function ptMsg(t, c) {
  const e = document.getElementById('pt-msg');
  e.textContent = t; e.className = c || '';
  if (c) { void e.offsetWidth; e.classList.add('pop'); }
}
function ptBanner(titolo, sotto) {
  const b = document.getElementById('pt-banner');
  b.innerHTML = '<b>' + titolo + '</b>' + (sotto ? '<span>' + sotto + '</span>' : '');
  b.className = ''; void b.offsetWidth; b.className = 'show';
}
function ptAggiorna() {
  if (!ptPronto) return;
  const r = ptTirando ? ptVista : ptRound;
  const libero = !ptOccupato(), camp = r ? r.camp : ptCamp, torre = ptTorre(camp);
  const puntata = r ? r.puntata : ptBet(), gol = r ? r.gol : 0;
  document.getElementById('pt-saldo').textContent = ggb(balance);
  document.getElementById('pt-puntata').textContent = ggb(puntata);
  const n = typeof puntateFisse === 'function' ? puntateFisse().length : 0, i = Math.min(ptPuntI, Math.max(0, n - 1));
  document.getElementById('pt-meno').disabled = !libero || i <= 0;
  document.getElementById('pt-piu').disabled = !libero || i >= n - 1;
  document.querySelectorAll('#pt-camp button').forEach(b => { b.classList.toggle('scelto', b.dataset.c === camp); b.disabled = !libero; });
  const puoTirare = !!run && !ptTirando && (ptRound || (ptBet() && balance >= ptBet()));
  document.querySelectorAll('.pt-zona').forEach(z => z.disabled = !puoTirare);
  const inc = document.getElementById('pt-incassa');
  inc.disabled = !r || !gol || ptTirando;
  inc.innerHTML = gol ? 'Incassa <b>' + ggb(Math.floor(puntata * torre[gol - 1])) + '</b>' : 'Incassa';
  const info = document.getElementById('pt-campionato-info');
  if (info) info.innerHTML = PT_CAMPIONATI[camp].nome + ': segni il <b>' + Math.round(PT_CAMPIONATI[camp].p * 100) + '%</b> dei tiri, 12 gol pagano <b>' + ptValuta(torre[PT_TIRI - 1]) + '</b>';
  // torre: su schermo largo in colonna dal basso (1° gol) all'alto (12°), su telefono in riga da sinistra
  const righe = torre.map((m, k) => {
    const cls = k < gol - 1 ? 'fatto' : k === gol - 1 ? 'ora' : k === gol ? 'prossimo' : '';
    return `<li class="${cls}"><small>${k + 1}</small><b>${ptValuta(m)}</b><span>${ggb(Math.floor(puntata * m))}</span></li>`;
  });
  document.getElementById('pt-torre').innerHTML = (ptOrizzontale() ? righe : righe.reverse()).join('');
  const prossimo = document.querySelector('#pt-torre .prossimo');
  const torreEl = document.getElementById('pt-torre');
  if (prossimo && gioco === 'portiere') {   // tiene in vista il prossimo gradino senza muovere la pagina
    const verticale = torreEl.scrollHeight > torreEl.clientHeight + 2;
    if (verticale) torreEl.scrollTop = prossimo.offsetTop - torreEl.clientHeight / 2 + prossimo.offsetHeight / 2;
    else torreEl.scrollLeft = prossimo.offsetLeft - torreEl.clientWidth / 2 + prossimo.offsetWidth / 2;
  }
  document.getElementById('pt-tiri').textContent = r ? Math.min(gol + 1, PT_TIRI) + ' / ' + PT_TIRI : '—';
  if (typeof aggiornaTavoliBtn === 'function') aggiornaTavoliBtn();
  if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
}
function ptCambiaPuntata(d) {
  if (ptOccupato()) return;
  const n = puntateFisse().length, i = Math.max(0, Math.min(n - 1, Math.min(ptPuntI, n - 1) + d));
  if (i === ptPuntI) return;
  ptPuntI = i; sfxChip(); ptAggiorna();
}
function ptCambiaCamp(c) {
  if (ptOccupato() || c === ptCamp || !PT_CAMPIONATI[c]) return;
  ptCamp = c;
  try { localStorage.setItem('biscaPortiere.camp', c); } catch (e) {}
  sfxChip(); ptAggiorna();
}
function ptTono(f, durata, tipo, vol, quando) { if (typeof sTono === 'function') sTono(f, durata, tipo, vol, quando); }
function ptEntra() {
  ptCostruisci();
  ptAggiorna();
  if (ptRound && ptRound.gol >= PT_TIRI) { ptIncassa(true); return; }   // dodici gol fatti prima di ricaricare la pagina
  if (ptRound) ptMsg('Riprendi la serie: ' + ptRound.gol + ' gol fatti. Incassi o tiri?');
  else if (!document.getElementById('pt-msg').textContent) ptMsg('Scegli puntata e campionato, poi tira in un angolo. Incassa quando vuoi!');
}
function ptReset() { if (!run) { ptRound = null; ptVista = null; } if (ptPronto) ptAggiorna(); }

// tasti: 1-6 tira (1 2 3 in alto, 4 5 6 in basso) · Invio/I incassa · ↑↓ puntata · C campionato
function ptTasti(e) {
  const k = e.key.toLowerCase();
  if (/^[1-6]$/.test(k)) { e.preventDefault(); ptTira(+k - 1); return; }
  const giro = () => { const l = Object.keys(PT_CAMPIONATI); ptCambiaCamp(l[(l.indexOf(ptCamp) + 1) % l.length]); };
  const azioni = { enter: () => ptIncassa(), i: () => ptIncassa(), arrowup: () => ptCambiaPuntata(1), arrowdown: () => ptCambiaPuntata(-1), '+': () => ptCambiaPuntata(1), '-': () => ptCambiaPuntata(-1), c: giro };
  if (azioni[k] && !e.repeat) { e.preventDefault(); azioni[k](); }
}

// la serie salvata nell'account (letta da applicaAccount prima che questo file fosse caricato)
ptRipristina(window.ptRoundSalvato);
