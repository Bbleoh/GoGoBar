/* ════════════════════════════════════════════════════════════════
   MINE — il campo minato del Tromba (dal Campo Minato mandato da Leo)
   Si paga la puntata e si scoprono le caselle: ogni GoGoldBar trovata
   alza il moltiplicatore, una mina fa perdere la puntata. Si incassa
   quando si vuole. Griglia 3×3, 5×5 o 7×7, da 1 mina a tutte meno una.
   Moltiplicatore dopo k caselle sicure (N caselle, m mine):
     0,94 × Π (N−i)/(N−m−i), troncato ai centesimi; tetto 1.000×.
   Auto: premi Auto, scegli da 1 a tutte le caselle meno una, poi
   5, 10 o 20 puntate: il Tromba scopre quelle caselle a ogni mano.
   Usa lo stack, le puntate fisse di slot e plinko (puntateFisse()),
   il conteggio delle giocate e il salto di tavolo di index.html.
   Una mano lasciata a metà (pagina ricaricata) viene incassata al
   moltiplicatore raggiunto, o rimborsata se non avevi scoperto niente
   (vedi applicaAccount in index.html).
════════════════════════════════════════════════════════════════ */
const MN_RTP = 0.94;
const MN_GRIGLIE = [3, 5, 7];
const MN_PRESET = [1, 3, 5, 7];
const MN_TETTO = 1000;
const MN_GIRI_AUTO = [5, 10, 20];

function mnMolt(N, m, k) {
  if (k <= 0) return 1;
  let p = 1;
  for (let i = 0; i < k; i++) p *= (N - i) / (N - m - i);
  return Math.min(Math.floor(MN_RTP * p * 100 + 1e-9) / 100, MN_TETTO);
}
function mnCaso(max) {
  try {
    const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
  } catch (e) { return Math.floor(Math.random() * max); }
}
function mnDisponi(N, m) {
  const idx = Array.from({ length: N }, (_, i) => i);
  for (let i = 0; i < m; i++) { const j = i + mnCaso(N - i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return new Set(idx.slice(0, m));
}

let mnGriglia = 5, mnMine = 3, mnModo = 'manuale';
try {
  const c = JSON.parse(localStorage.getItem('biscaMine.v1')) || {};
  if (MN_GRIGLIE.includes(c.griglia)) mnGriglia = c.griglia;
  if (c.mine >= 1 && c.mine < mnGriglia * mnGriglia) mnMine = c.mine;
} catch (e) {}
function mnSalvaScelte() { try { localStorage.setItem('biscaMine.v1', JSON.stringify({ griglia: mnGriglia, mine: mnMine })); } catch (e) {} }

let mnPuntI = 0;
let mnFase = 'bet';                  // 'bet' | 'play' | 'over'
let mnRound = null;                  // { puntata, griglia, mine, layout:Set, aperte:Set, k }
let mnSel = new Set();               // caselle scelte per l'auto
let mnAutoOn = false, mnAutoStop = false, mnAutoFatti = 0, mnAutoTot = 0;
let mnUltima = null;                 // netto dell'ultima mano
let mnPronto = false, mnBusy = false;
const mnN = () => mnGriglia * mnGriglia;
function mnBet() { if (typeof puntateFisse !== 'function') return 0; const c = puntateFisse(); return c[Math.min(mnPuntI, c.length - 1)] || 0; }
function mnOccupato() { return mnFase === 'play' || mnAutoOn || mnBusy; }
// la mano in corso finisce nell'account: se ricarichi, viene incassata (vedi applicaAccount)
function mnStato() { return mnFase === 'play' && mnRound ? { puntata: mnRound.puntata, griglia: mnRound.griglia, mine: mnRound.mine, k: mnRound.k } : null; }
function mnAttesa(ms) { return new Promise(r => setTimeout(r, ms)); }
const MN_BOMBA = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M40 15c4-5 8-4 11-8" fill="none" stroke="#c9a15a" stroke-width="3" stroke-linecap="round"/><circle cx="53" cy="7" r="7" fill="#ffd84a" opacity=".9"/><circle cx="53" cy="7" r="3.5" fill="#fff"/><rect x="35" y="13" width="10" height="8" rx="2" transform="rotate(35 40 17)" fill="#555"/><circle cx="29" cy="37" r="20" fill="#161616" stroke="#000" stroke-width="1.5"/><ellipse cx="22" cy="29" rx="6" ry="4" fill="#fff" fill-opacity=".35" transform="rotate(-35 22 29)"/></svg>';

/* ── costruzione ── */
function mnCostruisci() {
  if (mnPronto) return;
  mnPronto = true;
  document.getElementById('mn-griglie').innerHTML = MN_GRIGLIE.map(g =>
    `<button type="button" class="bet-tool" data-g="${g}" onclick="mnCambiaGriglia(${g})">${g}×${g}</button>`).join('');
  document.getElementById('mn-giri').innerHTML = MN_GIRI_AUTO.map(x => `<button type="button" class="bet-tool" onclick="mnAuto(${x})">${x}</button>`).join('');
  document.getElementById('mn-mine-sel').onchange = e => mnCambiaMine(+e.target.value);
  mnCampo();
}
function mnCampo() {
  const b = document.getElementById('mn-campo'), n = mnGriglia;
  b.style.setProperty('--n', n);
  b.dataset.n = n;
  let h = '';
  for (let i = 0; i < n * n; i++) h += `<button type="button" class="mn-casella" data-i="${i}" onclick="mnTocca(${i})" aria-label="Casella ${i + 1}"><span class="mn-ic"></span></button>`;
  b.innerHTML = h;
}

/* ── mano ── */
function mnInizia() {
  if (mnOccupato() && !mnAutoOn) return false;
  if (!run || mnFase === 'play') return false;
  const puntata = mnBet();
  if (!puntata) return false;
  if (balance < puntata) { sfxError(); mnMsg('Stack insufficiente! Abbassa la puntata.', 'lose'); return false; }
  startMusic();
  balance -= puntata;
  contaGiocata();
  stats.mnPartite = (stats.mnPartite || 0) + 1;
  mnRound = { puntata, griglia: mnGriglia, mine: mnMine, layout: mnDisponi(mnN(), mnMine), aperte: new Set(), k: 0 };
  mnFase = 'play';
  mnUltima = null;
  memScrivi();
  mnTono(330, .1, 'square', .04); mnTono(440, .12, 'square', .04, .08);
  mnMsg(['Si parte. Tocca una casella... e prega.', 'Il campo è minato. Cammina piano.', 'Buona fortuna. O forse no.'][Math.floor(Math.random() * 3)]);
  mnAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  return true;
}
function mnTocca(i) {
  if (mnModo === 'auto') { if (!mnAutoOn && mnFase !== 'play') mnScegli(i); return; }
  mnScopri(i);
}
function mnScopri(i) {
  const r = mnRound;
  if (mnFase !== 'play' || !r || r.aperte.has(i)) return;
  r.aperte.add(i);
  if (r.layout.has(i)) { mnFine('boom'); return; }
  r.k++;
  const N = r.griglia * r.griglia, m = mnMolt(N, r.mine, r.k);
  mnTono(520 + Math.min(r.k, 20) * 38, .16, 'triangle', .08); mnTono(780 + Math.min(r.k, 20) * 50, .2, 'sine', .04, .05);
  if (r.k >= N - r.mine) { mnFine('pulito'); return; }
  if (m >= MN_TETTO) { mnFine('tetto'); return; }
  memScrivi();   // salva il punto raggiunto (k) nell'account
  mnMsg(m >= 5 ? ['Incassa, scemo!', 'Il Tromba ti guarda e ride.', 'Incassi o sfidi la sorte?'][Math.floor(Math.random() * 3)]
               : ['Liscia.', 'Ancora vivo?', 'Il Tromba sorride... per ora.', 'Questa non esplode. La prossima chissà.'][Math.floor(Math.random() * 4)]);
  mnAggiorna();
}
function mnACaso() {
  if (mnModo === 'auto') { if (!mnAutoOn) { mnSel.clear(); mnAggiorna(); } return; }
  const r = mnRound;
  if (mnFase !== 'play' || !r) return;
  const libere = [];
  for (let i = 0; i < r.griglia * r.griglia; i++) if (!r.aperte.has(i)) libere.push(i);
  if (libere.length) mnScopri(libere[mnCaso(libere.length)]);
}
function mnIncassa() { if (mnFase === 'play' && mnRound && mnRound.k > 0) mnFine('incasso'); }
function mnFine(tipo) {
  const r = mnRound, N = r.griglia * r.griglia;
  const m = tipo === 'boom' ? 0 : mnMolt(N, r.mine, r.k), vincita = Math.floor(r.puntata * m);
  balance += vincita;
  mnUltima = vincita - r.puntata;
  mnFase = 'over';
  const pannello = document.querySelector('.mn');
  if (tipo === 'boom') {
    stats.mnBoom = (stats.mnBoom || 0) + 1;
    sfxLose(); mnTono(140, .5, 'sawtooth', .12); mnTono(90, .6, 'square', .08, .03);
    setCroupier('festoso');
    mnMsg('BOOM! Hai perso ' + ggb(r.puntata) + '.', 'lose');
    pannello.classList.remove('scuoti'); void pannello.offsetWidth; pannello.classList.add('scuoti');
  } else {
    stats.mnVinte = (stats.mnVinte || 0) + 1;
    stats.mnVincitaMax = Math.max(stats.mnVincitaMax || 0, vincita);
    stats.mnMoltMax = Math.max(stats.mnMoltMax || 0, m);
    sfxWin();
    setCroupier(m >= 10 ? 'lose' : 'init');
    mnMsg((tipo === 'pulito' ? 'Campo ripulito! ' : tipo === 'tetto' ? 'Tetto di 1.000×: incasso automatico. ' : 'Incassati ') + ggb(vincita) + ' (' + mnValuta(m) + ').', 'win');
    pannello.classList.remove('brilla'); void pannello.offsetWidth; pannello.classList.add('brilla');
  }
  controllaSaldo();
  memScrivi();
  mnAggiorna();
  document.getElementById('balance-display').textContent = ggb(balance);
  fineRun(true);   // bancarotta o salto di tavolo
}
function mnGioca() {
  if (mnModo === 'auto') { if (mnAutoOn) mnFermaAuto(); return; }
  if (mnFase === 'play') mnIncassa();
  else { if (mnFase === 'over') mnPulisci(); mnInizia(); }
}
function mnPulisci() { mnRound = null; if (mnFase === 'over') mnFase = 'bet'; }

/* ── auto ── */
async function mnAuto(giri) {
  if (mnAutoOn || mnModo !== 'auto' || !mnSel.size || mnFase === 'play' || !MN_GIRI_AUTO.includes(giri)) return;
  if (mnSel.size > mnN() - mnMine) { sfxError(); mnMsg('Hai scelto più caselle di quelle sicure: perderesti sempre.', 'lose'); return; }
  mnPulisci();
  const scelte = [...mnSel].sort((a, b) => a - b), partenza = balance;
  mnAutoOn = true; mnAutoStop = false; mnAutoFatti = 0; mnAutoTot = giri;
  mnAggiorna();
  let perche = '';
  for (let g = 0; g < mnAutoTot; g++) {
    if (mnAutoStop) { perche = 'stop'; break; }
    if (!run || balance < mnBet()) { perche = 'stack'; break; }
    if (!mnInizia()) { perche = 'stack'; break; }
    await mnAttesa(350);
    for (const i of scelte) {
      if (mnFase !== 'play') break;
      mnScopri(i);
      if (mnFase === 'play') await mnAttesa(300);
    }
    if (mnFase === 'play') mnFine('incasso');
    mnAutoFatti++;
    mnAggiorna();
    if (!run || !mnAutoOn) { perche = perche || 'tavolo'; break; }
    await mnAttesa(800);
    if (mnFase === 'over') mnPulisci();
  }
  const fermato = !mnAutoOn;
  mnAutoOn = false; mnAutoStop = false;
  if (!run) return;
  const tot = balance - partenza;
  mnMsg(({ stop: 'Auto fermato', stack: 'Auto finito: stack insufficiente' }[perche] || (fermato ? 'Auto fermo: sei salito di tavolo' : 'Auto completato')) +
    ' dopo ' + mnAutoFatti + (mnAutoFatti === 1 ? ' mano' : ' mani') + '. Totale: ' + (tot >= 0 ? '+' : '−') + ggb(Math.abs(tot)), tot >= 0 ? 'win' : 'lose');
  mnAggiorna();
}
function mnFermaAuto() { if (mnAutoOn && !mnAutoStop) { mnAutoStop = true; mnMsg('Mi fermo dopo questa mano.'); mnAggiorna(); } }
// tasto Auto: entra o esce dalla scelta delle caselle, durante l'auto lo ferma
function mnTastoAuto() {
  if (mnAutoOn) { mnFermaAuto(); return; }
  mnCambiaModo(mnModo === 'auto' ? 'manuale' : 'auto');
}
// chiamato da fineRun quando si sale di tavolo
function mnAutoFerma() { if (mnAutoOn) { mnAutoOn = false; mnAutoStop = false; } }
function mnScegli(i) {
  if (mnFase === 'over') mnPulisci();
  if (mnSel.has(i)) mnSel.delete(i);
  else if (mnSel.size >= mnN() - 1) { mnMsg('Al massimo ' + (mnN() - 1) + ' caselle su una griglia ' + mnGriglia + '×' + mnGriglia + '.'); return; }
  else mnSel.add(i);
  sfxChip(); mnAggiorna();
}

/* ── impostazioni ── */
function mnCambiaModo(m) {
  if (mnOccupato() || m === mnModo) return;
  mnModo = m; mnPulisci();
  mnMsg(m === 'auto' ? 'Tocca da 1 a ' + (mnN() - 1) + ' caselle, poi scegli 5, 10 o 20 puntate.' : 'Scegli puntata e mine, poi premi GIOCA.');
  sfxChip(); mnAggiorna();
}
function mnCambiaGriglia(g) {
  if (mnOccupato() || g === mnGriglia || !MN_GRIGLIE.includes(g)) return;
  mnGriglia = g; mnSel.clear(); mnMine = Math.min(mnMine, mnN() - 1); mnPulisci();
  mnSalvaScelte(); mnCampo(); sfxChip(); mnAggiorna();
}
function mnCambiaMine(m) {
  if (mnOccupato()) return;
  mnMine = Math.max(1, Math.min(mnN() - 1, m)); mnPulisci();
  mnSalvaScelte(); sfxChip(); mnAggiorna();
}
function mnCambiaPuntata(d) {
  if (mnOccupato()) return;
  const n = puntateFisse().length, i = Math.max(0, Math.min(n - 1, Math.min(mnPuntI, n - 1) + d));
  if (i === mnPuntI) return;
  mnPuntI = i; sfxChip(); mnAggiorna();
}

/* ── interfaccia ── */
function mnValuta(m) {
  const [i, d] = (Math.round(m * 100) / 100).toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + '×';
}
function mnMsg(t, c) {
  const e = document.getElementById('mn-msg');
  e.textContent = t; e.className = c || '';
  if (c) { void e.offsetWidth; e.classList.add('pop'); }
}
function mnTono(f, durata, tipo, vol, quando) { if (typeof sTono === 'function') sTono(f, durata, tipo, vol, quando); }
function mnAggiorna() {
  if (!mnPronto) return;
  const r = mnRound, gioca = mnFase === 'play', fermo = !mnOccupato();
  const griglia = r ? r.griglia : mnGriglia, mine = r ? r.mine : mnMine, N = griglia * griglia, k = r ? r.k : 0;
  const puntata = r && mnFase !== 'bet' ? r.puntata : mnBet();
  // striscia: ora e i prossimi 4
  let h = '';
  const ora = mnMolt(N, mine, k);
  const netto = gioca ? Math.floor(puntata * ora) - puntata : null;
  h += `<div class="mn-pill ora"><small>ORA</small>${mnValuta(ora)}${netto !== null ? `<em class="${netto >= 0 ? 'su' : 'giu'}">${netto >= 0 ? '+' : '−'}${ggb(Math.abs(netto))}</em>` : ''}</div>`;
  for (let j = 1; j <= 4; j++) {
    const kk = k + j;
    h += kk <= N - mine ? `<div class="mn-pill"><small>+${j}</small>${mnValuta(mnMolt(N, mine, kk))}</div>` : `<div class="mn-pill vuota"><small>+${j}</small>—</div>`;
  }
  document.getElementById('mn-striscia').innerHTML = h;
  // caselle
  const fine = mnFase === 'over' && r;
  const scegliendo = mnModo === 'auto' && !mnAutoOn && !gioca;
  document.querySelectorAll('#mn-campo .mn-casella').forEach((t, i) => {
    const aperta = r && r.aperte.has(i), mina = r && r.layout.has(i);
    let cls = 'mn-casella';
    if (r && (aperta || fine)) cls += (mina ? ' mina' : ' sicura') + (aperta ? ' aperta' : ' fantasma');
    if (mnModo === 'auto' && mnSel.has(i)) cls += ' scelta';
    if (t.className !== cls) {
      t.className = cls;
      t.firstChild.innerHTML = r && (aperta || fine) ? (mina ? MN_BOMBA : '<img src="assets/slot/ggb.webp?v=3" alt="">') : '';
    }
    t.disabled = scegliendo ? false : !gioca || aperta || mnBusy;
  });
  // impostazioni
  document.querySelectorAll('#mn-griglie button').forEach(b => { b.classList.toggle('scelto', +b.dataset.g === griglia); b.disabled = !fermo; });
  const preset = document.getElementById('mn-preset');
  const vuoi = MN_PRESET.filter(x => x < N);
  if (preset.dataset.n !== String(N)) {
    preset.dataset.n = N;
    preset.innerHTML = vuoi.map(x => `<button type="button" class="bet-tool" data-m="${x}" onclick="mnCambiaMine(${x})">${x}</button>`).join('');
    let o = '';
    for (let x = 1; x < N; x++) o += `<option value="${x}">${x} ${x === 1 ? 'mina' : 'mine'}</option>`;
    document.getElementById('mn-mine-sel').innerHTML = o;
  }
  preset.querySelectorAll('button').forEach(b => { b.classList.toggle('scelto', +b.dataset.m === mine); b.disabled = !fermo; });
  const sel = document.getElementById('mn-mine-sel'); sel.value = mine; sel.disabled = !fermo;
  document.getElementById('mn-riga-auto').hidden = mnModo !== 'auto';
  document.querySelectorAll('#mn-giri button').forEach(b => b.disabled = !fermo || !mnSel.size || !run || balance < mnBet());
  const sicure = N - mine;
  document.getElementById('mn-auto-info').innerHTML = (mnSel.size ? mnSel.size + ' / ' + (N - 1) + ' caselle' : 'Tocca le caselle') +
    (mnSel.size > sicure ? '<br><span class="warn">oltre ' + sicure + ' sicure: perdi sempre</span>' : '') +
    (mnAutoOn ? '<br>mano ' + Math.min(mnAutoFatti + 1, mnAutoTot) + ' di ' + mnAutoTot : '');
  // numeri
  document.getElementById('mn-saldo').textContent = ggb(balance);
  document.getElementById('mn-puntata').textContent = ggb(puntata);
  const n = typeof puntateFisse === 'function' ? puntateFisse().length : 0, pi = Math.min(mnPuntI, Math.max(0, n - 1));
  document.getElementById('mn-meno').disabled = !fermo || pi <= 0;
  document.getElementById('mn-piu').disabled = !fermo || pi >= n - 1;
  const ul = document.getElementById('mn-vincita');
  ul.textContent = mnUltima === null ? '—' : (mnUltima > 0 ? '+' : mnUltima < 0 ? '−' : '') + ggb(Math.abs(mnUltima));
  ul.className = mnUltima > 0 ? 'pos' : mnUltima < 0 ? 'neg' : '';
  // pulsanti
  const main = document.getElementById('mn-gioca'), caso = document.getElementById('mn-caso');
  caso.innerHTML = mnModo === 'auto' ? 'Svuota<br>caselle' : 'Casella<br>a caso';
  main.classList.toggle('incassa', gioca && mnModo !== 'auto');
  if (mnModo === 'auto') {
    caso.disabled = mnAutoOn || !mnSel.size;
    if (mnAutoOn) { main.disabled = mnAutoStop; main.innerHTML = mnAutoStop ? 'Fermo...' : 'Stop <small>' + mnAutoFatti + '/' + mnAutoTot + '</small>'; }
    else { main.innerHTML = '<span class="piccolo">' + (mnSel.size ? 'Scegli 5, 10 o 20' : 'Scegli le caselle') + '</span>'; main.disabled = true; }
  } else if (gioca) {
    main.disabled = !k || mnBusy;
    main.innerHTML = k ? 'Incassa <small>' + ggb(Math.floor(puntata * ora)) + '</small>' : '<span class="piccolo">Scegli una casella</span>';
    caso.disabled = mnBusy;
  } else {
    main.textContent = 'Gioca';
    main.disabled = !run || balance < mnBet();
    caso.disabled = true;
  }
  const auto = document.getElementById('mn-auto');
  auto.classList.toggle('on', mnModo === 'auto');
  auto.innerHTML = mnAutoOn ? '■ Stop' : mnModo === 'auto' ? '✕ Esci' : '⟳ Auto';
  auto.disabled = mnAutoOn ? mnAutoStop : !fermo;
  if (typeof aggiornaTavoliBtn === 'function') aggiornaTavoliBtn();
  if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
}
function mnEntra() {
  mnCostruisci();
  mnAggiorna();
  if (!document.getElementById('mn-msg').textContent) mnMsg('Scegli la puntata e quante mine nascondere. Io lucido le bombe.');
}
function mnReset() { if (!run) { mnRound = null; mnFase = 'bet'; mnAutoOn = false; } if (mnPronto) mnAggiorna(); }

// tasti: Spazio/Invio gioca o incassa · R casella a caso · ↑↓ puntata · A auto · Esc ferma l'auto
function mnTasti(e) {
  const k = e.key.toLowerCase();
  if (e.target && e.target.tagName === 'SELECT' && (k === 'arrowup' || k === 'arrowdown')) return;
  const azioni = { ' ': mnGioca, enter: mnGioca, r: mnACaso, arrowup: () => mnCambiaPuntata(1), arrowdown: () => mnCambiaPuntata(-1), '+': () => mnCambiaPuntata(1), '-': () => mnCambiaPuntata(-1),
    a: mnTastoAuto, escape: () => { if (mnAutoOn) mnFermaAuto(); else if (mnModo === 'auto') mnCambiaModo('manuale'); } };
  if (azioni[k] && !e.repeat) { e.preventDefault(); azioni[k](); }
}
