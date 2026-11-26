/* ════════════════════════════════════════════════════════════════
   LA BISCA DER TROMBA: il codice principale (lobby, nome e buy-in, blackjack, portafogli,
   trofei, salvataggi). Gli altri tavoli sono in tavoli/, uno per file, e si caricano dopo questo.
   Script classico: le funzioni e le variabili qui sono globali e i tavoli le usano.
════════════════════════════════════════════════════════════════ */
/* Tavolo in uso: 'lobby' | 'blackjack' | 'roulette' | 'slot' (roulette.js e slot.js) */
let gioco = 'lobby';
function rouletteOccupata() { return typeof rGirando !== 'undefined' && (rGirando || rAutoOn); }
function slotOccupata() { return typeof sOccupata === 'function' && sOccupata(); }
function plinkoOccupato() { return typeof pOccupata === 'function' && pOccupata(); }
function portiereOccupato() { return typeof ptOccupato === 'function' && ptOccupato(); }
function mineOccupato() { return typeof mnOccupato === 'function' && mnOccupato(); }
// Hi-Lo, Dice, Torre del Drago, Moles, Keno e Tromba Time si registrano qui (originali.js): id → gioco
const ORIGINALI = {};
function originaliOccupati() { return Object.values(ORIGINALI).some(g => g.occupato()); }
function tavoloLibero() { return phase === 'bet' && !rouletteOccupata() && !slotOccupata() && !plinkoOccupato() && !portiereOccupato() && !mineOccupato() && !originaliOccupati(); }
function aggiornaTavoliBtn() {
  const b = document.getElementById('tavoli-btn');
  if (b) b.disabled = gioco === 'lobby' || !playerName || !tavoloLibero();
}
// una serie di rigori lasciata a metà (pagina ricaricata) tiene occupato il tavolo: dalla lobby si può solo tornare in porta
function serieSospesa() { return gioco === 'lobby' && phase === 'bet' && typeof ptRound !== 'undefined' && !!ptRound && !ptTirando; }
function vaiA(dove) {
  if (!playerName) return;
  if (!tavoloLibero() && !(dove === 'portiere' && serieSospesa())) return;
  if (dove !== 'lobby' && !run) { lobbyMsg('Prima scegli il buy-in.'); return; }
  if (dove !== 'blackjack' && currentBet) { currentBet = 0; msg(''); } // le fiche non giocate tornano nel saldo
  if (gioco === 'roulette' && dove !== 'roulette' && typeof rAnnulla === 'function') rAnnulla();
  const cambia = gioco !== dove;
  gioco = dove;
  document.body.dataset.gioco = dove;
  if (cambia && dove !== 'lobby') voce('eccoci');   // il Tromba ti accoglie al tavolo
  if (dove === 'lobby') {
    aggiornaLobby();
  } else if (dove === 'roulette') {
    rEntra();
  } else if (dove === 'slot') {
    sEntra();
  } else if (dove === 'plinko') {
    pEntra();
  } else if (dove === 'portiere') {
    ptEntra();
  } else if (dove === 'mine') {
    mnEntra();
  } else if (ORIGINALI[dove]) {
    ORIGINALI[dove].entra();
  } else {
    if (!document.getElementById('message').textContent) msg('Buona fortuna, ' + playerName + '!');
  }
  updateHUD();
}
function lobbyMsg(t) {
  document.getElementById('lobby-msg').textContent = t;
  aggiornaLobby();
}

/* ════════════════════════════════════════════════════════════════
   BUY-IN E STACK
   Si paga un buy-in dal portafogli GoGoldBar e si gioca con lo stack
   (balance) su blackjack, roulette e slot. Le fiches sono il 10, 25, 50
   e 100% dello stack, arrotondate per difetto a multipli del 10% del
   buy-in; la puntata massima è 30 volte il buy-in. Da 60 volte il buy-in
   le fiches restano ferme (al tavolo da 100: 600, 1.500 e 3.000). A 100
   volte il buy-in il Tromba ti sposta al tavolo che ha quel buy-in
   (100 → 10.000, 1.000 → 100.000). Il cash-out si sblocca dopo 20
   giocate, riporta lo stack nel portafogli e va nella classifica del
   tavolo da cui la run è partita. Sotto la puntata minima si perde tutto.
   run = { tavolo, partenza, giocate } oppure null (nessun buy-in pagato).
════════════════════════════════════════════════════════════════ */
const TAVOLI = [100, 1000, 10000, 100000];
const GIOCATE_CASHOUT = 20;
const PERC_FICHES = [0.10, 0.25, 0.50, 1];
let run = null;
const numero = n => window.GoGoldBar ? GoGoldBar.formatta(n) : Math.floor(Number(n) || 0).toLocaleString('it-IT');
function passo() { return run ? run.tavolo / 10 : 0; }
function puntataMax() { return run ? run.tavolo * 30 : 0; }
function chips() {
  if (!run) return [];
  // scaglioni: le percentuali si applicano allo stack arrotondato per difetto a multipli del buy-in
  // (tavolo da 100: 100-199 → 100, 200-299 → 200...), da 60× il buy-in restano fisse
  const t = run.tavolo, max = puntataMax(), out = [];
  const base = Math.min(Math.max(t, Math.floor(balance / t) * t), t * 60);
  PERC_FICHES.forEach(f => {
    const v = Math.min(max, Math.max(passo(), Math.floor(base * f / passo()) * passo())); // per difetto a multipli del 10% del buy-in (25% di 100 → 20)
    if (!out.includes(v)) out.push(v);
  });
  return out;
}
// Cinquegirelli e Plinko: puntate fisse che non crescono con lo stack, in scala col tavolo (10/20/50/100 al tavolo da 100)
const PUNTATE_FISSE = [10, 20, 50, 100];
function puntateFisse() { return run ? PUNTATE_FISSE.map(v => v * run.tavolo / 100) : []; }
function puntataMin() { return run ? chips()[0] : 0; }
// quanto si può mettere sul tavolo in una giocata
function puntataTetto() { return Math.min(balance, puntataMax()); }
// etichetta esatta e corta: 1.5k, 2.95k, 1475, 1.25M
function chipBreve(v) { return v >= 1e6 && v % 1e4 === 0 ? v / 1e6 + 'M' : v >= 1000 && v % 10 === 0 ? v / 1000 + 'k' : String(v); }
const CHIP_COLORI = ['chip-10', 'chip-50', 'chip-100', 'chip-500'];

// le fiches di blackjack e roulette si ridisegnano quando cambiano i valori
const _chipFirme = {};
function disegnaChips(id, onclickDi, scelta) {
  const box = document.getElementById(id);
  if (!box) return;
  const c = chips(), firma = c.join(',') + '|' + scelta;
  if (_chipFirme[id] === firma && box.childElementCount === c.length) return;
  _chipFirme[id] = firma;
  box.innerHTML = c.map((v, i) => `<button class="chip ${CHIP_COLORI[i]}${i === scelta ? ' scelta' : ''}" data-v="${v}" onclick="${onclickDi(i)}" aria-label="Fiche da ${v}" title="Tasto ${i + 1}: ${numero(v)}">${chipBreve(v)}</button>`).join('');
}

function contaGiocata() { if (run) run.giocate++; }

// dopo ogni giocata: sotto la puntata minima la run è finita, a 100× il buy-in si sale di tavolo
// macchinette = true per Cinquegirelli e Plinko: lì si sale appena lo stack supera il buy-in del tavolo dopo
// (al tavolo da 100 a 1.000), anche di più tavoli in un colpo; blackjack e roulette salgono a 100× il buy-in
function fineRun(macchinette) {
  if (!run) return true;
  if (balance < passo()) { bancarotta(); return true; }
  let prossimo = 0;
  if (macchinette) { for (const t of TAVOLI) if (t > run.tavolo && balance >= t) prossimo = t; }
  else if (TAVOLI.includes(run.tavolo * 100) && balance >= run.tavolo * 100) prossimo = run.tavolo * 100;
  if (prossimo) {
    run.tavolo = prossimo;
    sblocca('salto');
    if (run.tavolo >= run.partenza * 100) sblocca('scalatore');
    if (run.tavolo >= 100000) sblocca('centomila');
    currentBet = 0;
    if (typeof sPuntI !== 'undefined') sPuntI = 0;   // nuovo tavolo: si riparte dalla puntata più bassa
    if (typeof pPuntI !== 'undefined') pPuntI = 0;
    if (typeof ptPuntI !== 'undefined') ptPuntI = 0;
    if (typeof mnPuntI !== 'undefined') mnPuntI = 0;
    if (typeof mnAutoFerma === 'function') mnAutoFerma();
    Object.values(ORIGINALI).forEach(g => g.salto());
    if (typeof sAutoStop === 'function' && sAutoOn) sAutoStop('Auto fermato: sei salito di tavolo.');
    if (typeof pAutoStop === 'function' && pAutoOn) pAutoStop('Auto fermato: sei salito di tavolo.');
    const f = puntateFisse();
    const b = document.getElementById('salto');
    b.querySelector('b').textContent = 'Il Tromba sbaraglia tutto!';
    b.querySelector('span').textContent = 'Passi al tavolo da ' + numero(prossimo) + ': ' +
      (macchinette ? 'slot, plinko e gli altri giochi da ' + ggb(f[0]) + ' a ' + ggb(f[f.length - 1]) : 'puntata max ' + ggb(puntataMax()));
    b.className = ''; void b.offsetWidth; b.className = 'show';
    sfxTrofeo();
    memScrivi();
    updateHUD();
  }
  return false;
}

function disegnaBuyIn() {
  const box = document.getElementById('buyin-tavoli');
  const w = window.GoGoldBar ? GoGoldBar.saldo() : null;
  box.innerHTML = TAVOLI.map(t => {
    const manca = w == null || w < t;
    return `<button class="buyin" ${manca ? 'disabled' : ''} onclick="compraBuyIn(${t})">` +
      `<small>Tavolo da</small><b>${numero(t)}</b><span>Buy-in ${ggb(t)}</span><span>Puntata max ${ggb(t * 30)}</span>` +
      (manca ? `<em>${w == null ? 'Serve l\'account' : 'Ti mancano ' + ggb(t - w)}</em>` : '') + '</button>';
  }).join('');
}

function aggiornaLobby() {
  document.body.dataset.run = run ? '1' : '0';
  const w = window.GoGoldBar ? GoGoldBar.saldo() : null;
  document.getElementById('lobby-portafogli').textContent = ggb(w || 0);
  // il Tromba propone il buy-in a voce, una volta ogni volta che la scelta compare
  const propone = !run && gioco === 'lobby' && !!playerName;
  if (propone && !aggiornaLobby.proposto) voce('buyin');
  aggiornaLobby.proposto = propone;
  if (!run) { disegnaBuyIn(); return; }
  document.getElementById('lobby-tavolo').textContent = 'Tavolo da ' + numero(run.tavolo);
  document.getElementById('lobby-saldo').textContent = ggb(balance);
  const c = chips(), prossimo = run.tavolo * 100;
  const parti = ['Puntata da <b>' + ggb(c[0]) + '</b> a <b>' + ggb(puntataMax()) + '</b>'];
  parti.push(run.giocate < GIOCATE_CASHOUT ? 'cash-out tra <b>' + (GIOCATE_CASHOUT - run.giocate) + '</b> giocate' : '<b>cash-out disponibile</b>');
  const dopo = TAVOLI.find(t => t > run.tavolo);
  if (dopo) parti.push('con gli altri giochi a ' + ggb(dopo) + ' sali al tavolo da ' + numero(dopo));
  if (TAVOLI.includes(prossimo)) parti.push('con blackjack o roulette a ' + ggb(prossimo) + ' sali al tavolo da ' + numero(prossimo));
  if (run.partenza !== run.tavolo) parti.push('run partita dal tavolo da ' + numero(run.partenza));
  document.getElementById('lobby-info').innerHTML = parti.join(' · ') +
    (serieSospesa() ? '<br><b>Hai una serie di rigori a metà: entra nel Portiere per incassare o tirare ancora.</b>' : '');
}
if (window.GoGoldBar) GoGoldBar.suCambio(() => aggiornaLobby());

let comproBuyIn = false;
async function compraBuyIn(t) {
  if (comproBuyIn || run || !playerName || !TAVOLI.includes(t)) return;
  const w = window.GoGoldBar ? GoGoldBar.saldo() : null;
  if (w == null) { lobbyMsg('Serve il tuo account GoGoBar: entra dalla home.'); return; }
  if (w < t) { sfxError(); lobbyMsg('Non hai abbastanza GoGoldBar per il tavolo da ' + numero(t) + '.'); return; }
  startMusic();
  comproBuyIn = true;
  try { await GoGoldBar.aggiungi(-t); }
  catch (e) { comproBuyIn = false; sfxError(); lobbyMsg((e && e.message) || 'Pagamento non riuscito, riprova.'); return; }
  comproBuyIn = false;
  run = { tavolo: t, partenza: t, giocate: 0 };
  balance = t; currentBet = 0; lastBet = 0;
  stats.rimonta = 0;
  resetTavolo();
  sfxChip();
  memScrivi(); syncRemoto(true);
  controllaSaldo();
  lobbyMsg('Buy-in pagato: sei al tavolo da ' + numero(t) + '. Scegli il gioco!');
  updateHUD();
}
function nuovoBuyIn() {
  resetTavolo();
  msg('');
  gioco = 'lobby'; document.body.dataset.gioco = 'lobby';
  lobbyMsg(playerName ? 'Scegli un nuovo buy-in, ' + playerName + '.' : '');
  updateHUD();
}

/* ════════════════════════════════════════════════════════════════
   ACCOUNT: il nome è l'account.
   - Nel browser: biscaTromba.v2 = { ultimo, account: { chiave: dati } }
   - Su Firebase: bisca/giocatori/<chiave> (vedi classifica.js), così
     saldo, statistiche e trofei seguono il giocatore su ogni dispositivo.
   Ogni accesso a localStorage è protetto: in navigazione privata può fallire.
════════════════════════════════════════════════════════════════ */
const MEM_KEY = 'biscaTromba.v2', MEM_V1 = 'biscaTromba.v1';
function chiaveNome(n) { return String(n || '').trim().toLowerCase(); }
function memTutto() {
  try { const m = JSON.parse(localStorage.getItem(MEM_KEY)); if (m && m.account) return m; } catch (e) {}
  const out = { ultimo: '', account: {} };
  try { // migra i dati salvati dalla versione precedente
    const v1 = JSON.parse(localStorage.getItem(MEM_V1));
    if (v1 && v1.nome) { out.ultimo = v1.nome; out.account[chiaveNome(v1.nome)] = Object.assign({ aggiornato: '' }, v1); }
  } catch (e) {}
  return out;
}
function datiAccount() {
  const serie = !run ? null : typeof ptStato === 'function' ? ptStato() : (window.ptRoundSalvato || null);   // rigori a metà
  const mano = run && typeof mnStato === 'function' ? mnStato() : null;   // mano di Mine a metà
  const orig = run ? Object.values(ORIGINALI).map(g => g.stato()).find(Boolean) || null : null;   // mano a metà di Hi-Lo, Torre o Moles
  const st = Object.assign({}, stats, { runTavolo: run ? run.tavolo : 0, runPartenza: run ? run.partenza : 0, runGiocate: run ? run.giocate : 0, runPortiere: serie, runMine: mano, runOrig: orig });
  return { nome: playerName, saldo: run ? balance : 0, ultimaPuntata: lastBet, stats: st, trofei: trofei,
           aggiornato: new Date().toISOString() };
}
/* ════════════════════════════════════════════════════════════════
   GOGOLDBAR: il saldo della bisca è il portafogli GGB dell'account,
   lo stesso di tutto il sito (risorse/js/gogoldbar.js).
   balance resta la copia locale per il tavolo; ogni volta che si salva,
   la differenza dall'ultima spedizione va al portafogli come incremento.
   Le GGB arrivate da fuori (clic sul gatto in home, altre schede) entrano
   appena il tavolo è libero.
════════════════════════════════════════════════════════════════ */
const ggb = n => (window.GoGoldBar ? GoGoldBar.formatta(n) : Math.floor(Number(n) || 0).toLocaleString('it-IT')) + ' \uE000';   // glifo GoGoldBar (mini font di risorse/js/gogoldbar.js)
// il portafogli si tocca solo col buy-in (meno) e col cash-out (più): vedi BUY-IN E STACK

// platino: tutti i trofei fino agli epici (+5 GGB a click) e poi tutti i leggendari (+5)
function controllaPlatino() {
  if (!window.GoGoldBar || !playerName) return;
  const fatti = r => TROFEI.filter(t => r.includes(t.r)).every(t => trofei[t.id]);
  if (fatti(['comune', 'raro', 'epico'])) GoGoldBar.trofeo('bisca_epico');
  if (fatti(['leggendario'])) GoGoldBar.trofeo('bisca_leggendario');
}

function memScrivi() {
  if (!playerName) return;
  const m = memTutto();
  m.ultimo = playerName;
  m.account[chiaveNome(playerName)] = datiAccount();
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch (e) {}
  syncRemoto();
}

let syncOnline = false, syncTimer = null;
function syncRemoto(subito) {
  if (!syncOnline || !window.BiscaClassifica || !BiscaClassifica.attiva || !playerName) return;
  clearTimeout(syncTimer);
  const invia = () => BiscaClassifica.salvaGiocatore(playerName, datiAccount(), !!subito)
    .then(() => statoAccount('Salvato online'))
    .catch(e => statoAccount(/account/.test((e && e.message) || '') ? e.message
                                : 'Non riesco a salvare online: per ora resta su questo browser', true));
  if (subito) invia(); else syncTimer = setTimeout(invia, 1200);
}
window.addEventListener('pagehide', () => { if (syncTimer) syncRemoto(true); });

function statoAccount(t, errore) {
  const el = document.getElementById('account-stato');
  if (el) { el.textContent = t; el.classList.toggle('err', !!errore); }
}

// Unisce i dati del browser con quelli online: trofei sommati, contatori al massimo,
// saldo e serie in corso dalla copia più recente.
const STATS_MAX = ['mani','vinte','perse','pari','blackjack','sballate','serieMax','recordSaldo','vincitaMax','cashout','cashoutMax','bancarotte',
                   'rGiri','rVinti','rPieni','rVincitaMax','sGiri','sVinti','sVincitaMax','sBonus'];
function unisciAccount(loc, rem) {
  if (!loc) return rem || null;
  if (!rem) return loc;
  const recente = (rem.aggiornato || '') >= (loc.aggiornato || '') ? rem : loc;
  const out = Object.assign({}, recente);
  out.stats = Object.assign({}, STATS_ZERO, recente.stats);
  STATS_MAX.forEach(k => {
    out.stats[k] = Math.max(Number((loc.stats || {})[k]) || 0, Number((rem.stats || {})[k]) || 0, STATS_ZERO[k] || 0);
  });
  out.trofei = Object.assign({}, loc.trofei);
  Object.entries(rem.trofei || {}).forEach(([k, d]) => {
    if (!out.trofei[k] || d < out.trofei[k]) out.trofei[k] = d;
  });
  return out;
}
function mineValida(r) { return !!r && typeof r === 'object' && [3, 5, 7].includes(r.griglia) && r.mine >= 1 && r.mine < r.griglia * r.griglia && r.puntata > 0 && Number.isInteger(r.k) && r.k >= 0; }
function mineIncassoSospeso(r) {   // stessa formula di mnMolt in mine.js
  if (!r.k) return Math.floor(r.puntata);
  const N = r.griglia * r.griglia; let p = 1;
  for (let i = 0; i < Math.min(r.k, N - r.mine); i++) p *= (N - i) / (N - r.mine - i);
  return Math.floor(r.puntata * Math.min(Math.floor(0.94 * p * 100 + 1e-9) / 100, 1000));
}
// mano a metà di Hi-Lo, Torre del Drago o Moles: { g, puntata, molt } (molt = moltiplicatore raggiunto, 1 se non avevi ancora giocato)
const ORIG_NOMI = { hilo: 'Hi-Lo', torre: 'Torre del Drago', talpe: 'Moles' };
function origValida(r) { return !!r && typeof r === 'object' && !!ORIG_NOMI[r.g] && r.puntata > 0 && r.puntata <= 100000 && r.molt >= 1 && r.molt <= 1000; }
function applicaAccount(d) {
  d = d || {};
  const st = d.stats || {};
  const sospesa = !!(st.runPortiere && typeof st.runPortiere === 'object') || mineValida(st.runMine) || origValida(st.runOrig);   // puntata ancora in gioco
  run = TAVOLI.includes(st.runTavolo) && (Number(d.saldo) > 0 || sospesa)
    ? { tavolo: st.runTavolo, partenza: TAVOLI.includes(st.runPartenza) ? st.runPartenza : st.runTavolo, giocate: Math.max(0, Math.floor(st.runGiocate) || 0) }
    : null;
  balance = run ? Math.max(0, Math.floor(d.saldo)) : 0;
  // una mano di Mine lasciata a metà: incassata al moltiplicatore raggiunto (rimborsata se non avevi scoperto niente)
  window.mineRecuperata = 0;
  if (run && mineValida(st.runMine)) { window.mineRecuperata = mineIncassoSospeso(st.runMine); balance += window.mineRecuperata; }
  window.origRecuperata = null;
  if (run && origValida(st.runOrig)) { const v = Math.floor(st.runOrig.puntata * st.runOrig.molt); window.origRecuperata = { nome: ORIG_NOMI[st.runOrig.g], v }; balance += v; }
  lastBet = Number.isFinite(d.ultimaPuntata) ? d.ultimaPuntata : 0;
  stats = Object.assign({}, STATS_ZERO, d.stats);
  delete stats.runTavolo; delete stats.runPartenza; delete stats.runGiocate; delete stats.runPortiere; delete stats.runMine; delete stats.runOrig;
  window.ptRoundSalvato = run && st.runPortiere && typeof st.runPortiere === 'object' ? st.runPortiere : null;
  if (typeof ptRipristina === 'function') ptRipristina(window.ptRoundSalvato);
  trofei = Object.assign({}, d.trofei);
}

/* ════════════════════════════════════════════════════════════════
   CLASSIFICA (servizio in classifica.js, condiviso con la home)
════════════════════════════════════════════════════════════════ */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function dataBreve(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function renderLeaderboard(entries) {
  const tbody = document.getElementById('lb-body');
  if (!entries.length) {
    const testo = window.BiscaClassifica && BiscaClassifica.attiva
      ? 'Nessun cashout ancora — sii il primo!'
      : 'La classifica online non è ancora attiva.';
    tbody.innerHTML = '<tr><td colspan="4" id="lb-empty">' + testo + '</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map((r, i) => {
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
    const rc    = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return `<tr>
      <td class="lb-rank ${rc}">${medal}</td>
      <td class="lb-name">${escHtml(r.nome)}${r.tavolo ? `<span class="lb-tav">tavolo da ${numero(r.tavolo)}</span>` : ''}</td>
      <td class="lb-score${r.punti < 0 ? ' neg' : ''}">${(r.punti > 0 ? '+' : '') + ggb(r.punti)}</td>
      <td class="lb-date">${dataBreve(r.data)}</td>
    </tr>`;
  }).join('');
}

let _lbLoaded = false;
/* cash-out che la classifica non ha preso (rete, regole Firebase): restano qui finché non entrano */
const PENDENTI_KEY = 'biscaClassificaPendenti.v1';
function pendentiLeggi() { try { return JSON.parse(localStorage.getItem(PENDENTI_KEY)) || []; } catch (e) { return []; } }
function pendentiScrivi(l) { try { l.length ? localStorage.setItem(PENDENTI_KEY, JSON.stringify(l)) : localStorage.removeItem(PENDENTI_KEY); } catch (e) {} }
function pendenteAggiungi(x) { pendentiScrivi(pendentiLeggi().concat([x])); }
let _pendentiInCorso = null;
function pendentiRiprova() {
  if (_pendentiInCorso || !window.BiscaClassifica) return _pendentiInCorso || Promise.resolve();
  const lista = pendentiLeggi();
  if (!lista.length) return Promise.resolve();
  _pendentiInCorso = (async () => {
    const restano = [];
    for (const x of lista) {
      // le voci vecchie (prima della classifica a profitto) avevano il cash-out intero in "punti"
      const profitto = x.profitto !== undefined ? x.profitto : x.punti - x.t;
      try { await BiscaClassifica.salvaProfitto(x.nome, profitto, x.t); } catch (e) { restano.push(x); }
    }
    pendentiScrivi(restano.concat(pendentiLeggi().slice(lista.length)));
    _pendentiInCorso = null;
  })();
  return _pendentiInCorso;
}
async function refreshLeaderboard() {
  const st = document.getElementById('lb-status');
  st.textContent = 'Caricamento...';
  await pendentiRiprova();
  const entries = !window.BiscaClassifica ? [] : await BiscaClassifica.carica(10);
  renderLeaderboard(entries);
  _lbLoaded = true;
  st.textContent = 'Aggiornato: ' + new Date().toLocaleTimeString('it-IT');
}

document.addEventListener('pointerdown', e => {
  const panel = document.getElementById('lb-panel');
  if (panel.classList.contains('open') && !panel.contains(e.target) && !e.target.closest('#lb-btn')) panel.classList.remove('open');
});

function toggleLeaderboard() {
  const panel = document.getElementById('lb-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) refreshLeaderboard();
}

/* ════════════════════════════════════════════════════════════════
   PLAYER NAME
════════════════════════════════════════════════════════════════ */
let playerName = '';
const NOME_OK = /^[\wÀ-ÿ _\-]+$/;

async function confirmName() {
  const input = document.getElementById('name-input');
  const errEl = document.getElementById('name-error');
  const btn   = document.getElementById('name-btn');
  if (contoAttivo()) {                      // si gioca solo col proprio account GoGoBar
    if (!nomeGoGo()) { vaiAllAccount(); return; }
    input.value = nomeGoGo();
  }
  const val   = input.value.trim();
  errEl.textContent = '';
  if (!val)           { errEl.textContent = 'Inserisci un nome.'; return; }
  if (val.length > 20){ errEl.textContent = 'Max 20 caratteri.'; return; }
  if (!NOME_OK.test(val)) { errEl.textContent = 'Solo lettere, numeri, spazi e trattini.'; return; }
  if (btn.disabled) return;
  startMusic(); // siamo dentro un clic: sblocca subito l'audio
  // niente omonimi: un nome preso da un account GoGoBar lo usa solo quell'account
  if (window.GoGoAccount && GoGoAccount.attivo) {
    btn.disabled = true;
    const libero = await GoGoAccount.nomeLibero(val);
    btn.disabled = false;
    if (!libero) { errEl.textContent = GoGoAccount.nomePreso(val); return; }
  }

  if (playerName) { clearTimeout(syncTimer); memScrivi(); syncRemoto(true); } // salva il giocatore precedente
  btn.disabled = true; btn.textContent = 'Apro il tuo account...';

  const locale = memTutto().account[chiaveNome(val)];
  let remoto = null, online = false;
  if (window.BiscaClassifica && BiscaClassifica.attiva) {
    try { remoto = await BiscaClassifica.caricaGiocatore(val); online = true; } catch (e) {}
  }
  btn.disabled = false; btn.textContent = 'Siediti al tavolo';

  playerName = (remoto && remoto.nome) || (locale && locale.nome) || val; // tiene le maiuscole originali
  applicaAccount(unisciAccount(locale, remoto));
  // il portafogli serve per pagare il buy-in
  if (window.GoGoldBar) { try { await GoGoldBar.pronto; } catch (e) {} }
  syncOnline = online;
  document.getElementById('overlay-name').textContent = playerName;
  document.getElementById('name-modal').style.display = 'none';
  resetTavolo();
  msg('');
  gioco = 'lobby'; document.body.dataset.gioco = 'lobby';
  if (remoto)      lobbyMsg('Bentornato, ' + playerName + '! Account caricato.');
  else if (locale) lobbyMsg('Bentornato, ' + playerName + '!');
  else if (online) lobbyMsg('Benvenuto, ' + playerName + '! Account creato.');
  else             lobbyMsg('Benvenuto, ' + playerName + '! Sei offline: per ora salvo su questo browser.');
  statoAccount(online ? (remoto ? 'Account online' : 'Account creato online') : 'Offline: salvo solo su questo browser', !online);
  if (run) lobbyMsg('Bentornato, ' + playerName + '! Sei al tavolo da ' + numero(run.tavolo) + ' con ' + ggb(balance) + '.' +
    (window.mineRecuperata ? ' La mano di Mine lasciata a metà è stata incassata: ' + ggb(window.mineRecuperata) + '.' : '') +
    (window.origRecuperata ? ' La mano di ' + window.origRecuperata.nome + ' lasciata a metà è stata incassata: ' + ggb(window.origRecuperata.v) + '.' : ''));
  else if ((window.GoGoldBar && GoGoldBar.saldo()) < TAVOLI[0]) lobbyMsg('Ciao ' + playerName + ', per il buy-in minimo servono ' + ggb(TAVOLI[0]) + ': clicca il maneki neko in home e torna.');
  else lobbyMsg('Ciao ' + playerName + '! Scegli il buy-in.');
  controllaSaldo();
  controllaPlatino();
  memScrivi();
  updateHUD();  pendentiRiprova();
}

/* Lista dei giocatori già registrati (Firebase + questo browser): un clic e sei dentro */
function scegliGiocatore(nome) {
  document.getElementById('name-input').value = nome;
  confirmName();
}
async function mostraGiocatori() {
  const box = document.getElementById('giocatori-box');
  const lista = document.getElementById('giocatori-lista');
  const tutti = new Map();
  const locali = memTutto().account;
  Object.keys(locali).forEach(k => {
    const a = locali[k] || {};
    tutti.set(k, { nome: a.nome || k, trofei: Object.keys(a.trofei || {}).length });
  });
  const disegna = () => {
    const arr = [...tutti.values()].sort((a, b) => b.trofei - a.trofei || a.nome.localeCompare(b.nome));
    lista.textContent = '';
    box.hidden = !arr.length;
    arr.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'giocatore-chip' + (chiaveNome(g.nome) === chiaveNome(playerName) ? ' attuale' : '');
      b.title = 'Gioca come ' + g.nome;
      b.textContent = (chiaveNome(g.nome) === chiaveNome(nomeGoGo()) ? '👤 ' : '') + g.nome + ' ';
      const sm = document.createElement('small');
      sm.textContent = '🏆 ' + g.trofei;
      b.appendChild(sm);
      b.addEventListener('click', () => scegliGiocatore(g.nome));
      lista.appendChild(b);
    });
  };
  disegna();
  if (window.BiscaClassifica && BiscaClassifica.attiva) {
    const remoti = await BiscaClassifica.caricaGiocatori();
    remoti.forEach(g => {
      if (!NOME_OK.test(g.nome)) return;
      const k = chiaveNome(g.nome), loc = tutti.get(k);
      tutti.set(k, { nome: g.nome, trofei: Math.max(g.trofei, loc ? loc.trofei : 0) });
    });
    disegna();
  }
}

function cambiaGiocatore() {
  if (!tavoloLibero()) return;
  chiudiStats();
  const input = document.getElementById('name-input');
  input.value = '';
  document.getElementById('name-btn').textContent = 'Siediti al tavolo';
  document.getElementById('name-intro').textContent = 'Chi gioca adesso? Scegli il tuo nome qui sotto o scrivilo.';
  mostraGiocatori();
  document.getElementById('name-modal').style.display = 'flex';
  setTimeout(() => input.focus(), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('name-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });
  setTimeout(() => input.focus(), 150);
});

/* ════════════════════════════════════════════════════════════════
   CASHOUT
════════════════════════════════════════════════════════════════ */
function cashoutPossibile() { return !!playerName && !!run && run.giocate >= GIOCATE_CASHOUT && tavoloLibero() && balance > 0; }
function updateCashoutBtn() {
  const b = document.getElementById('cashout-btn');
  b.disabled = !cashoutPossibile();
  const mancano = run ? Math.max(0, GIOCATE_CASHOUT - run.giocate) : 0;
  b.querySelector('.lbl').textContent = run && mancano ? (GIOCATE_CASHOUT - mancano) + '/' + GIOCATE_CASHOUT : 'Cashout';
  b.title = !run ? 'Prima paga un buy-in' : mancano ? 'Cash-out dopo ' + GIOCATE_CASHOUT + ' giocate: ne mancano ' + mancano : 'Incassa lo stack nel portafogli (tra una giocata e l\'altra)';
  aggiornaTavoliBtn();
}

function openCashout() {
  if (!cashoutPossibile()) return;
  document.getElementById('cashout-msg').textContent =
    `Incassi ${ggb(balance)} nel portafogli e chiudi la run. In classifica va il profitto: ${(balance - run.partenza > 0 ? '+' : '') + ggb(balance - run.partenza)} (buy-in ${ggb(run.partenza)}), come "${playerName}".`;
  document.getElementById('cashout-error').textContent = '';
  const btn = document.getElementById('cashout-confirm-btn');
  btn.disabled = false;
  btn.textContent = 'Incassa';
  document.getElementById('cashout-modal').classList.add('show');
}

function closeCashoutModal() {
  document.getElementById('cashout-modal').classList.remove('show');
}

async function executeCashout() {
  const errEl = document.getElementById('cashout-error');
  const btn   = document.getElementById('cashout-confirm-btn');
  if (!cashoutPossibile()) { closeCashoutModal(); return; }
  errEl.textContent = '';
  btn.disabled  = true;
  btn.textContent = 'Incasso...';
  const somma = balance, partenza = run.partenza;
  try {
    await GoGoldBar.aggiungi(somma);
  } catch (e) {
    errEl.textContent = (e && e.message) || 'Incasso non riuscito, riprova.';
    btn.disabled = false; btn.textContent = 'Incassa';
    return;
  }
  run = null; balance = 0; currentBet = 0;
  stats.cashout++;
  stats.cashoutMax = Math.max(stats.cashoutMax, somma);
  sblocca('incasso');
  if (stats.cashout >= 10) sblocca('pendolare');
  if (somma >= 10 * partenza) sblocca('banchiere');
  memScrivi(); syncRemoto(true);
  let nota = '';
  const profitto = somma - partenza;   // in classifica va il profitto della run, anche negativo
  try { await BiscaClassifica.salvaProfitto(playerName, profitto, partenza); }
  catch (e) {
    // non si perde: resta in coda e si riprova all'apertura della classifica e al prossimo ingresso
    pendenteAggiungi({ t: partenza, nome: playerName, profitto });
    nota = ' La classifica non ha salvato (' + ((e && e.message) || 'errore') + '): riprovo da solo appena possibile.';
  }
  closeCashoutModal();
  resetTavolo();
  gioco = 'lobby'; document.body.dataset.gioco = 'lobby';
  lobbyMsg('Incassati ' + ggb(somma) + ' nel portafogli!' + nota);
  updateHUD();
  document.getElementById('lb-panel').classList.add('open');
  refreshLeaderboard();
}

/* ════════════════════════════════════════════════════════════════
   AUDIO — music & sfx separati, music avvia sul PRIMO click
════════════════════════════════════════════════════════════════ */
let actx     = null;
let muted    = false;
let sfxOff   = false;
let musicOn  = false;
let curTrk   = 1;

/* Un solo elemento <audio> che alterna i brani: su iPhone/Safari un secondo
   elemento non "sbloccato" da un tocco resterebbe muto alla fine del primo brano. */
const BRANI = ['assets/musica-1.mp3', 'assets/musica-2.mp3'];
const AUD = document.getElementById('musica');
AUD.volume = 0.45;

function getAC() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function playTrack(n) {
  curTrk = n;
  AUD.src = BRANI[n - 1];
  if (!muted) AUD.play().catch(() => {});
}
AUD.addEventListener('ended', () => playTrack(curTrk === 1 ? 2 : 1));

function startMusic() {
  if (musicOn) return;
  musicOn = true;
  getAC();
  playTrack(1);
}

function _unlockAudio() { if (!actx) getAC(); }
['pointerdown','keydown','touchstart'].forEach(ev =>
  document.addEventListener(ev, _unlockAudio, { once: true, capture: true })
);

function toggleMute() {
  muted = !muted;
  const btn = document.getElementById('mute-btn');
  btn.textContent = muted ? '🔇' : '🔊';
  btn.classList.toggle('off', muted);
  if (muted) AUD.pause();
  else if (!musicOn) startMusic();
  else AUD.play().catch(() => {}); // riprende da dove si era fermata
}

// voci del Tromba (registrate da Leo): "buy-in" quando propone il buy-in, "eccoci" quando entri in un gioco
const VOCI = { buyin: 'assets/voci/buy-in.mp3?v=2', eccoci: 'assets/voci/eccoci.mp3?v=2' };
const _voci = {};
function voce(n) {
  if (sfxOff || !VOCI[n]) return;
  try {
    Object.values(_voci).forEach(a => { if (!a.paused) a.pause(); });   // una frase alla volta
    const a = _voci[n] || (_voci[n] = new Audio(VOCI[n]));
    a.currentTime = 0;
    AUD.volume = 0.18;   // la musica si abbassa mentre parla
    a.onended = a.onpause = () => { if (Object.values(_voci).every(x => x.paused)) AUD.volume = 0.45; };
    a.play().catch(() => { AUD.volume = 0.45; });
  } catch (e) {}
}

function toggleSfx() {
  sfxOff = !sfxOff;
  const btn = document.getElementById('sfx-btn');
  btn.textContent = sfxOff ? '🔕' : '🎵';
  btn.classList.toggle('off', sfxOff);
}

function sfxChip() {
  if (sfxOff) return;
  try {
    const c=getAC(),now=c.currentTime,o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type='sine';
    o.frequency.setValueAtTime(1600,now);o.frequency.exponentialRampToValueAtTime(700,now+.09);
    g.gain.setValueAtTime(.2,now);g.gain.exponentialRampToValueAtTime(.001,now+.13);
    o.start(now);o.stop(now+.14);
    const sz=Math.floor(c.sampleRate*.04),buf=c.createBuffer(1,sz,c.sampleRate),dd=buf.getChannelData(0);
    for(let i=0;i<sz;i++) dd[i]=(Math.random()*2-1)*(1-i/sz)*.3;
    const ns=c.createBufferSource(),ng=c.createGain();
    ns.buffer=buf;ng.gain.value=.09;ns.connect(ng);ng.connect(c.destination);ns.start(now);
  } catch(e) {}
}

function sfxCard() {
  if (sfxOff) return;
  try {
    const c=getAC(),now=c.currentTime,sz=Math.floor(c.sampleRate*.075),
          buf=c.createBuffer(1,sz,c.sampleRate),dd=buf.getChannelData(0);
    for(let i=0;i<sz;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/sz,1.4);
    const src=c.createBufferSource();src.buffer=buf;
    const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=2200;
    const g=c.createGain();g.gain.value=.3;
    src.connect(hp);hp.connect(g);g.connect(c.destination);src.start(now);
  } catch(e) {}
}

function sfxWin() {
  if (sfxOff) return;
  try {
    const c=getAC();
    [523,659,784,1047].forEach((f,i) => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='triangle';o.frequency.value=f;
      const t=c.currentTime+i*.1;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.14,t+.04);
      g.gain.exponentialRampToValueAtTime(.001,t+.38);o.start(t);o.stop(t+.39);
    });
  } catch(e) {}
}

function sfxLose() {
  if (sfxOff) return;
  try {
    const c=getAC();
    [300,240,190].forEach((f,i) => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.value=f;
      const t=c.currentTime+i*.13;
      g.gain.setValueAtTime(.11,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);
      o.start(t);o.stop(t+.31);
    });
  } catch(e) {}
}

function sfxError() {
  if (sfxOff) return;
  try {
    const c=getAC(),now=c.currentTime;
    [220,180].forEach((f,i) => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='square';o.frequency.value=f;
      const t=now+i*.12;
      g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);
      o.start(t);o.stop(t+.19);
    });
  } catch(e) {}
}

function sfxTrofeo() {
  if (sfxOff) return;
  try {
    const c=getAC();
    [784,988,1175,1568].forEach((f,i) => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;
      const t=c.currentTime+i*.07;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.02);
      g.gain.exponentialRampToValueAtTime(.001,t+.5);o.start(t);o.stop(t+.51);
    });
  } catch(e) {}
}

/* ════════════════════════════════════════════════════════════════
   CROUPIER
════════════════════════════════════════════════════════════════ */
const IMGS = {
  init:     'assets/croupier-init.png',
  festoso:  'assets/croupier-festoso.png',
  vincente: 'assets/croupier-vincente.png',
  lose:     'assets/croupier-lose.png',
};
Object.values(IMGS).forEach(src => { const i = new Image(); i.src = src; });
function setCroupier(s) {
  const img = document.getElementById('croupier-img');
  img.style.opacity = '0'; img.style.transform = 'translateY(14px)';
  setTimeout(() => {
    img.src = IMGS[s] || IMGS.init;
    img.style.opacity = '1'; img.style.transform = 'none';
    document.getElementById('croupier-avatar').src = img.src;
    document.getElementById('r-croupier').src = img.src;
    document.getElementById('s-croupier').src = img.src;
    document.getElementById('p-croupier').src = img.src;
    document.getElementById('pt-croupier').src = img.src;
    document.getElementById('mn-croupier').src = img.src;
    document.getElementById('r-croupier-big').src = img.src;
    document.querySelectorAll('.og-croupier').forEach(i => { i.src = img.src; });
  }, 270);
}

/* ════════════════════════════════════════════════════════════════
   CARD BUILDER
════════════════════════════════════════════════════════════════ */
function buildCard(card, hidden = false) {
  const el = document.createElement('div');
  if (hidden) { el.className = 'card back'; el.setAttribute('aria-label','carta coperta'); return el; }
  const isRed = card.suit === '♥' || card.suit === '♦';
  el.className = 'card ' + (isRed ? 'red' : 'black');
  el.setAttribute('aria-label', card.rank + ' ' + card.suit);
  const corner = `<b>${card.rank}</b><i>${card.suit}</i>`;
  el.innerHTML = `<div class="card-corner">${corner}</div><div class="card-center">${card.suit}</div><div class="card-corner bottom">${corner}</div>`;
  return el;
}

/* ════════════════════════════════════════════════════════════════
   DECK & MATH
════════════════════════════════════════════════════════════════ */
const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function newDeck(n=6) {
  const d=[];
  for(let i=0;i<n;i++) for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r});
  return shuffle(d);
}
function shuffle(a) { for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
function cv(c) { if(['J','Q','K'].includes(c.rank))return 10; if(c.rank==='A')return 11; return parseInt(c.rank); }
function total(h) { let t=0,a=0; for(const c of h){t+=cv(c);if(c.rank==='A')a++;} while(t>21&&a>0){t-=10;a--;} return t; }
function isBJ(h)   { return h.length===2 && total(h)===21; }
function isBust(h) { return total(h)>21; }

/* ════════════════════════════════════════════════════════════════
   GAME STATE
════════════════════════════════════════════════════════════════ */
const SALDO_INIZIALE = 0;   // il saldo vero arriva dal portafogli GoGoldBar
let deck=[], balance=SALDO_INIZIALE, currentBet=0, lastBet=0;
let dealerHand=[], playerHands=[[]], curHand=0, handBets=[0], handDoubled=[false], handResults=[], insBet=0;
let phase = 'bet';
let allInRound = false;
let minimoMano = 0;   // la puntata minima quando è partita la mano (per Spilorcio)


/* ════════════════════════════════════════════════════════════════
   STATISTICHE & TROFEI
════════════════════════════════════════════════════════════════ */
const STATS_ZERO = {
  mani:0, vinte:0, perse:0, pari:0, blackjack:0, sballate:0,
  serie:0, serieMax:0, recordSaldo:SALDO_INIZIALE, vincitaMax:0, cashout:0, cashoutMax:0, bancarotte:0,
  // serie in corso usate dai trofei
  serieBJ:0, seriePari:0, serieBancoBJ:0, serieSballo:0, seriePerse:0, serieAllin:0, rimonta:0,
  // roulette
  rGiri:0, rVinti:0, rPieni:0, rVincitaMax:0, rSerieRosso:0, rUltimoPieno:0,
  // slot
  sGiri:0, sVinti:0, sVincitaMax:0, sBonus:0,
  // plinko
  pPalline:0, pVinte:0, pVincitaMax:0, pMoltMax:0,
  // il portiere
  ptPartite:0, ptGol:0, ptParate:0, ptIncassi:0, ptVincitaMax:0, ptMoltMax:0, ptSerieMax:0,
  // mine
  mnPartite:0, mnVinte:0, mnBoom:0, mnVincitaMax:0, mnMoltMax:0,
  // hi-lo, dice, torre del drago, moles, keno (originali.js): partite, in guadagno, vincita e moltiplicatore più alti
  hlPartite:0, hlVinte:0, hlVincitaMax:0, hlMoltMax:0,
  dcPartite:0, dcVinte:0, dcVincitaMax:0, dcMoltMax:0,
  trPartite:0, trVinte:0, trVincitaMax:0, trMoltMax:0,
  tlPartite:0, tlVinte:0, tlVincitaMax:0, tlMoltMax:0,
  knPartite:0, knVinte:0, knVincitaMax:0, knMoltMax:0,
  // tromba time (tromba-time.js)
  ttPartite:0, ttVinte:0, ttVincitaMax:0, ttMoltMax:0, ttBonus:0
};
let stats  = Object.assign({}, STATS_ZERO);
let trofei = {}; // id → data ISO di sblocco

const RARITA = {
  comune:      { nome:'Comune',      ordine:0 },
  raro:        { nome:'Raro',        ordine:1 },
  epico:       { nome:'Epico',       ordine:2 },
  leggendario: { nome:'Leggendario', ordine:3 },
};
const TROFEI = [
  // ── comuni
  { id:'prima',       r:'comune', icona:'🃏', nome:'Si siede al tavolo',  desc:'Gioca la prima mano' },
  { id:'bj',          r:'comune', icona:'♠️', nome:'Blackjack!',          desc:'Fai il tuo primo blackjack' },
  { id:'tripletta',   r:'comune', icona:'🔥', nome:'Tripletta',           desc:'Vinci 3 mani di fila' },
  { id:'raddoppio',   r:'comune', icona:'✌️', nome:'Raddoppio d\'oro',    desc:'Vinci una mano raddoppiata' },
  { id:'raddoppio11', r:'comune', icona:'📐', nome:'Da manuale',          desc:'Raddoppia su 11 e vinci' },
  { id:'cento',       r:'comune', icona:'💶', nome:'Doppio o niente',     desc:'Porta lo stack al doppio del buy-in' },
  { id:'incasso',     r:'comune', icona:'🏦', nome:'Incassatore',         desc:'Fai il primo cashout' },
  { id:'rovina',      r:'comune', icona:'💸', nome:'Rovinato',            desc:'Scendi sotto la puntata minima e vai in bancarotta' },
  { id:'pareggio',    r:'comune', icona:'🤝', nome:'Patta',               desc:'Pareggia una mano col banco' },
  { id:'bancobj',     r:'comune', icona:'😈', nome:'Il Tromba ride',      desc:'Il banco ti fa blackjack' },
  { id:'ingordo',     r:'comune', icona:'💥', nome:'Ingordo',             desc:'Sballa con 22 esatti' },
  { id:'spilorcio',   r:'comune', icona:'🪙', nome:'Spilorcio',           desc:'Vinci una mano con la puntata minima' },
  { id:'moneta',      r:'comune', icona:'🪙', nome:'Testa o croce',       desc:'Vinci il lancio della moneta sugli spiccioli' },
  { id:'ventuno',     r:'comune', icona:'🎯', nome:'Ventuno sudato',      desc:'Fai 21 con 3 o più carte' },
  { id:'sedici',      r:'comune', icona:'😬', nome:'Stare sul 16',        desc:'Stai su 16 e vinci' },
  { id:'buttati',     r:'comune', icona:'🙃', nome:'Soldi buttati',       desc:'Prendi l\'assicurazione e il banco non ha blackjack' },
  // ── rari
  { id:'cinquina',    r:'raro', icona:'⚡', nome:'Inarrestabile',         desc:'Vinci 5 mani di fila' },
  { id:'split',       r:'raro', icona:'✂️', nome:'Spaccatutto',           desc:'Vinci tutte le mani di uno split' },
  { id:'splitassi',   r:'raro', icona:'🅰️', nome:'Assi divisi',           desc:'Fai split di due Assi' },
  { id:'cinquecarte', r:'raro', icona:'🖐️', nome:'Mano lunga',            desc:'Vinci con 5 o più carte' },
  { id:'assicurato',  r:'raro', icona:'🛡️', nome:'Assicurato',            desc:'Incassa un\'assicurazione' },
  { id:'allin',       r:'raro', icona:'🎲', nome:'All in',                desc:'Punta tutto il saldo e vinci' },
  { id:'veterano',    r:'raro', icona:'🎖️', nome:'Veterano',              desc:'Gioca 100 mani' },
  { id:'bj10',        r:'raro', icona:'🂡', nome:'Collezionista di assi', desc:'Fai 10 blackjack' },
  { id:'bj2',         r:'raro', icona:'⚡', nome:'Doppietta',             desc:'Blackjack in 2 mani di fila' },
  { id:'bancosballa', r:'raro', icona:'🧨', nome:'Banco in frantumi',     desc:'Il banco sballa con 5 o più carte' },
  { id:'palloncino',  r:'raro', icona:'🎈', nome:'Palloncino',            desc:'Sballa 3 mani di fila' },
  { id:'maledetto',   r:'raro', icona:'🌧️', nome:'Maledetto',             desc:'Perdi 10 mani di fila' },
  { id:'lumaca',      r:'raro', icona:'🐢', nome:'Lumaca',                desc:'Vinci con 12 o meno (il banco sballa)' },
  { id:'colpogrosso', r:'raro', icona:'💎', nome:'Colpo grosso',          desc:'Raddoppia e fai 21' },
  { id:'balena',      r:'raro', icona:'🐋', nome:'Balena',                desc:'Punta il massimo del tavolo (30 volte il buy-in) in una mano' },
  { id:'salto',       r:'raro', icona:'🪜', nome:'Promosso',              desc:'Il Tromba ti sposta al tavolo dopo' },
  { id:'pendolare',   r:'raro', icona:'💼', nome:'Pendolare',             desc:'Fai 10 cashout' },
  { id:'affezionato', r:'raro', icona:'🩹', nome:'Cliente affezionato',   desc:'Vai in bancarotta 5 volte' },
  { id:'nottambulo',  r:'raro', icona:'🦉', nome:'Nottambulo',            desc:'Gioca una mano tra le 3 e le 5 di notte' },
  // ── epici
  { id:'mille',       r:'epico', icona:'💰', nome:'Il Tromba trema',      desc:'Porta lo stack a 10 volte il buy-in' },
  { id:'scalatore',   r:'epico', icona:'🧗', nome:'Scalatore',             desc:'Sali di due tavoli nella stessa run' },
  { id:'miracolo',    r:'epico', icona:'🙏', nome:'Contro ogni pronostico', desc:'Vinci la moneta con meno del 10% di probabilità' },
  { id:'bj50',        r:'epico', icona:'🃁', nome:'Asso nella manica',    desc:'Fai 50 blackjack' },
  { id:'specchio',    r:'epico', icona:'🪞', nome:'Specchio',             desc:'Pareggia 3 mani di fila' },
  { id:'gattonero',   r:'epico', icona:'🐈‍⬛', nome:'Gatto nero',          desc:'Il banco fa blackjack 3 mani di fila' },
  { id:'forchettone', r:'epico', icona:'🍴', nome:'Forchettone',          desc:'Dividi fino ad avere 4 mani' },
  { id:'elegante',    r:'epico', icona:'🎩', nome:'Blackjack elegante',   desc:'Blackjack con Asso e Fante dello stesso seme' },
  { id:'seicarte',    r:'epico', icona:'🖖', nome:'Mano infinita',        desc:'Vinci con 6 o più carte' },
  { id:'cinque21',    r:'epico', icona:'✋', nome:'Cinque per ventuno',   desc:'Fai 21 con 5 carte' },
  { id:'sfacciato',   r:'epico', icona:'🍀', nome:'Sfacciato',            desc:'Chiedi carta su 17 o più e fai 21' },
  { id:'jackpot',     r:'epico', icona:'🎰', nome:'Jackpot',              desc:'Vinci 10 volte il buy-in del tavolo in una sola mano' },
  { id:'rimonta',     r:'epico', icona:'📈', nome:'Rimonta',              desc:'Torna al buy-in dopo essere sceso a due puntate minime o meno' },
  { id:'habitue',     r:'epico', icona:'🪑', nome:'Habitué',              desc:'Gioca 500 mani' },
  { id:'banchiere',   r:'epico', icona:'🏛️', nome:'Banchiere',            desc:'Fai un cash-out con 10 volte il buy-in' },
  { id:'collezione',  r:'epico', icona:'🏅', nome:'Bacheca piena',        desc:'Sblocca 25 trofei' },
  // ── leggendari
  { id:'diecimila',   r:'leggendario', icona:'👑', nome:'Padrone della bisca', desc:'Porta lo stack a 100 volte il buy-in' },
  { id:'centomila',   r:'leggendario', icona:'🏰', nome:'La bisca è tua',      desc:'Sali fino al tavolo da 100.000' },
  { id:'bj3',         r:'leggendario', icona:'🌩️', nome:'Fulmine a ciel sereno', desc:'Blackjack in 3 mani di fila' },
  { id:'infiamme',    r:'leggendario', icona:'☄️', nome:'In fiamme',           desc:'Vinci 10 mani di fila' },
  { id:'quattro',     r:'leggendario', icona:'🔱', nome:'Quattro su quattro',  desc:'Vinci tutte e 4 le mani di uno split' },
  { id:'settebello',  r:'leggendario', icona:'7️⃣', nome:'Tre sette',           desc:'Fai 21 con 7, 7 e 7' },
  { id:'pokerassi',   r:'leggendario', icona:'🂱', nome:'Poker d\'assi',       desc:'Tieni 4 Assi nella stessa mano' },
  { id:'sbancata',    r:'leggendario', icona:'🏆', nome:'Sbancata',            desc:'Vinci 30 volte il buy-in del tavolo in una sola mano' },
  { id:'senzapaura',  r:'leggendario', icona:'🦁', nome:'Senza paura',         desc:'Vinci 3 all in di fila' },
  { id:'civive',      r:'leggendario', icona:'🛋️', nome:'Ci vive qui',         desc:'Gioca 1.000 mani' },
  // ── roulette
  { id:'r_primo',     r:'comune', icona:'🎡', nome:'Faites vos jeux',       desc:'Gira la roulette per la prima volta' },
  { id:'r_pieno',     r:'comune', icona:'🎯', nome:'Numero secco',          desc:'Vinci puntando su un numero pieno' },
  { id:'r_zeroperso', r:'comune', icona:'🥶', nome:'Lo zero fa male',       desc:'Esce lo 0 e ti porta via le puntate esterne' },
  { id:'r_zero',      r:'raro', icona:'🟢', nome:'Zero spaccato',          desc:'Vinci puntando sullo 0' },
  { id:'r_tappeto',   r:'raro', icona:'🧺', nome:'A tappeto',              desc:'Punta su 10 o più numeri pieni e prendine uno' },
  { id:'r_giri100',   r:'raro', icona:'🌀', nome:'Mal di ruota',           desc:'Gira la roulette 100 volte' },
  { id:'r_tutto',     r:'epico', icona:'🛡️', nome:'Copro tutto',          desc:'Copri tutti i 37 numeri in un solo giro' },
  { id:'r_rossofisso',r:'epico', icona:'🌹', nome:'Rosso fisso',          desc:'Esce il rosso 7 volte di fila' },
  { id:'r_pieno100',  r:'epico', icona:'💣', nome:'Pieno da paura',       desc:'Prendi un numero pieno con 100 \uE000 o più sopra' },
  { id:'r_sbanca',    r:'leggendario', icona:'🎆', nome:'Sbanca la ruota', desc:'Vinci 5.000 \uE000 in un solo giro' },
  { id:'r_bis',       r:'leggendario', icona:'🔮', nome:'Il bis',          desc:'Prendi lo stesso numero pieno due giri di fila' },
  // slot Cinquegirelli
  { id:'s_primo',     r:'comune', icona:'🎰', nome:'Prima leva',            desc:'Gioca alla Cinquegirelli per la prima volta' },
  { id:'s_canne',     r:'comune', icona:'🌿', nome:'Giro di canne',         desc:'Fai una linea con 3 o più canne' },
  { id:'s_neko',      r:'raro', icona:'🐱', nome:'Gatto fortunato',         desc:'Fai una linea di soli maneki neko' },
  { id:'s_gratis',    r:'raro', icona:'🎁', nome:'Offre il Tromba',         desc:'Prendi i giri gratis con 3 BONUS' },
  { id:'s_giri250',   r:'raro', icona:'🔁', nome:'Leva consumata',          desc:'Gioca 250 giri alla slot' },
  { id:'s_canna5',    r:'epico', icona:'💨', nome:'Canna infinita',         desc:'Fai una linea con 5 canne' },
  { id:'s_cento',     r:'epico', icona:'💥', nome:'Cento volte tanto',      desc:'Vinci 100 volte la puntata in un giro o in un giro di bonus' },
  { id:'s_tromba5',   r:'epico', icona:'🎺', nome:'Cinque Trombe',          desc:'Fai una linea con 5 Tromba' },
  { id:'s_jackpot',   r:'leggendario', icona:'💰', nome:'Jackpot GoGoldBar', desc:'Fai una linea con 5 GoGoldBar' },
  { id:'s_bonus5',    r:'leggendario', icona:'🤑', nome:'Il Tromba impazzisce', desc:'Fai uscire 5 BONUS insieme' },
  { id:'leggenda',    r:'leggendario', icona:'🌟', nome:'Leggenda della bisca', desc:'Sblocca tutti gli altri trofei' },
];

function sblocca(id) {
  if (trofei[id] || !playerName) return;
  const t = TROFEI.find(x => x.id === id);
  if (!t) return;
  trofei[id] = new Date().toISOString();
  mostraToast(t);
  const n = Object.keys(trofei).length;
  if (n >= 25) sblocca('collezione');
  if (TROFEI.every(x => x.id === 'leggenda' || trofei[x.id])) sblocca('leggenda');
  controllaPlatino();
  memScrivi();
}

let toastCoda = Promise.resolve();
function mostraToast(t) {
  toastCoda = toastCoda.then(() => new Promise(res => {
    const box = document.getElementById('toast');
    box.className = 'r-' + t.r;
    box.innerHTML = `<span class="toast-icon">${t.icona}</span><div><b>Trofeo ${RARITA[t.r].nome.toLowerCase()}!</b><br>${escHtml(t.nome)}</div>`;
    void box.offsetWidth; box.classList.add('show');
    sfxTrofeo();
    setTimeout(() => { box.classList.remove('show'); setTimeout(res, 350); }, t.r === 'leggendario' ? 4200 : 2600);
  }));
}

// traguardi dello stack contati sul buy-in della run (pagare il buy-in non sblocca niente)
function controllaSaldo() {
  if (balance > stats.recordSaldo) stats.recordSaldo = balance;
  if (!run) return;
  const b = run.partenza;
  if (balance > 0 && balance <= 2 * passo()) stats.rimonta = 1;
  if (stats.rimonta && balance >= b && run.giocate > 0) { sblocca('rimonta'); stats.rimonta = 0; }
  if (balance >= 2 * b)   sblocca('cento');
  if (balance >= 10 * b)  sblocca('mille');
  if (balance >= 100 * b) sblocca('diecimila');
}

function apriStats() {
  const s = stats;
  const perc = s.mani ? Math.round(s.vinte / s.mani * 100) : 0;
  const euro = ggb;
  const righe = [
    ['Mani giocate', s.mani], ['Vinte', s.vinte + (s.mani ? ` (${perc}%)` : '')],
    ['Perse', s.perse], ['Pareggi', s.pari], ['Blackjack', s.blackjack], ['Sballate', s.sballate],
    ['Serie vincente migliore', s.serieMax], ['Record di saldo', euro(s.recordSaldo)],
    ['Vincita più alta in una mano', euro(s.vincitaMax)], ['Cashout', s.cashout],
    ['Cashout più alto', euro(s.cashoutMax)], ['Bancarotte', s.bancarotte],
  ];
  const rouletteRighe = [
    ['Giri di roulette', s.rGiri], ['Giri vinti', s.rVinti + (s.rGiri ? ` (${Math.round(s.rVinti / s.rGiri * 100)}%)` : '')],
    ['Numeri pieni presi', s.rPieni], ['Vincita più alta in un giro', euro(s.rVincitaMax)],
  ];
  const slotRighe = [
    ['Giri di slot', s.sGiri || 0], ['Giri vincenti', (s.sVinti || 0) + (s.sGiri ? ` (${Math.round((s.sVinti || 0) / s.sGiri * 100)}%)` : '')],
    ['Bonus presi', s.sBonus || 0], ['Vincita più alta in un giro', euro(s.sVincitaMax || 0)],
  ];
  const plinkoRighe = [
    ['Monete lanciate', s.pPalline || 0], ['Monete in guadagno', (s.pVinte || 0) + (s.pPalline ? ` (${Math.round((s.pVinte || 0) / s.pPalline * 100)}%)` : '')],
    ['Moltiplicatore più alto', (s.pMoltMax || 0) + '×'], ['Vincita più alta', euro(s.pVincitaMax || 0)],
  ];
  const portiereRighe = [
    ['Serie di rigori', s.ptPartite || 0], ['Gol / parate', (s.ptGol || 0) + ' / ' + (s.ptParate || 0)],
    ['Serie incassate', s.ptIncassi || 0], ['Gol di fila migliore', s.ptSerieMax || 0],
    ['Moltiplicatore più alto incassato', Number(s.ptMoltMax || 0).toLocaleString('it-IT') + '×'], ['Vincita più alta', euro(s.ptVincitaMax || 0)],
  ];
  const mineRighe = [
    ['Mani a Mine', s.mnPartite || 0], ['Incassate / mine prese', (s.mnVinte || 0) + ' / ' + (s.mnBoom || 0)],
    ['Moltiplicatore più alto', Number(s.mnMoltMax || 0).toLocaleString('it-IT') + '×'], ['Vincita più alta', euro(s.mnVincitaMax || 0)],
  ];
  document.getElementById('account-nome').textContent = playerName || '—';
  const riga = ([k,v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`;
  document.getElementById('stats-list').innerHTML =
    '<div class="rarita-head stat-sub">🃏 Blackjack e saldo</div>' + righe.map(riga).join('') +
    '<div class="rarita-head stat-sub">🎡 Roulette</div>' + rouletteRighe.map(riga).join('') +
    '<div class="rarita-head stat-sub">🎰 Cinquegirelli</div>' + slotRighe.map(riga).join('') +
    '<div class="rarita-head stat-sub">🔻 Plinko</div>' + plinkoRighe.map(riga).join('') +
    '<div class="rarita-head stat-sub">🧤 Il Portiere</div>' + portiereRighe.map(riga).join('') +
    '<div class="rarita-head stat-sub">💣 Mine</div>' + mineRighe.map(riga).join('') +
    Object.values(ORIGINALI).map(g => '<div class="rarita-head stat-sub">' + g.icona + ' ' + g.titolo + '</div>' + g.righeStats(s).map(riga).join('')).join('');
  const n = TROFEI.filter(t => trofei[t.id]).length;
  document.getElementById('trofei-count').textContent = `${n} / ${TROFEI.length}`;
  document.getElementById('trofei-grid').innerHTML = Object.keys(RARITA).map(r => {
    const lista = TROFEI.filter(t => t.r === r);
    const presi = lista.filter(t => trofei[t.id]).length;
    return `<div class="rarita-head r-${r}">${RARITA[r].nome} <small>${presi}/${lista.length}</small></div>` +
      lista.map(t => {
        const ok = !!trofei[t.id];
        const quando = ok ? 'Sbloccato il ' + new Date(trofei[t.id]).toLocaleDateString('it-IT') : 'Ancora da sbloccare';
        return `<div class="trofeo r-${r} ${ok?'ok':''}" title="${escHtml(quando)}">
          <span class="trofeo-icon">${ok ? t.icona : '🔒'}</span>
          <b>${escHtml(t.nome)}</b><small>${escHtml(t.desc)}</small></div>`;
      }).join('');
  }).join('');
  document.getElementById('stats-modal').classList.add('show');
}
function chiudiStats() { document.getElementById('stats-modal').classList.remove('show'); }
function azzeraStats() {
  if (!document.getElementById('stats-reset').dataset.sure) {
    const b = document.getElementById('stats-reset');
    b.dataset.sure = '1'; b.textContent = 'Sicuro? Clicca di nuovo';
    setTimeout(() => { delete b.dataset.sure; b.textContent = 'Azzera statistiche'; }, 3000);
    return;
  }
  stats = Object.assign({}, STATS_ZERO, { recordSaldo: balance });
  memScrivi();
  apriStats();
}

/* ════════════════════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════════════════════ */
function updateHUD() {
  disegnaChips('chips-row', i => 'addChip(' + i + ')', -1);
  document.getElementById('balance-display').textContent = ggb(balance);
  document.getElementById('bet-display').textContent     = ggb(currentBet);
  updateCashoutBtn();
  updateChipStates();
  updateBetTools();
  if (gioco === 'roulette' && typeof rAggiorna === 'function') rAggiorna();
  if (gioco === 'slot' && typeof sAggiorna === 'function') sAggiorna();
  if (gioco === 'plinko' && typeof pAggiorna === 'function') pAggiorna();
  if (gioco === 'portiere' && typeof ptAggiorna === 'function') ptAggiorna();
  if (gioco === 'mine' && typeof mnAggiorna === 'function') mnAggiorna();
  if (ORIGINALI[gioco]) ORIGINALI[gioco].aggiorna();
  if (gioco === 'lobby') aggiornaLobby();
  aggiornaMoneta();
}

function updateChipStates() {
  const canBet = (phase === 'bet');
  const resta = puntataTetto() - currentBet;
  document.querySelectorAll('#chips-row .chip').forEach(el => {
    const ok = canBet && resta >= Number(el.dataset.v);
    el.classList.toggle('chip-disabled', !ok);
    el.classList.toggle('chip-available', ok);
  });
}

function updateBetTools() {
  const canBet = phase === 'bet' && !!run && balance > 0;
  const tetto = puntataTetto();
  document.getElementById('repeat-btn').disabled = !canBet || lastBet <= 0 || currentBet === Math.min(lastBet, tetto);
  document.getElementById('double-bet-btn').disabled = !canBet || currentBet <= 0 || currentBet * 2 > tetto;
  document.getElementById('clear-bet-btn').disabled = !canBet || currentBet <= 0;
  const allin = document.getElementById('allin-btn');
  allin.disabled = !canBet || currentBet === tetto;
  allin.textContent = run && balance > puntataMax() ? 'Max' : 'All in';
  document.getElementById('deal-btn').disabled = !canBet || currentBet < puntataMin();
}

function msg(t, c='') {
  const e=document.getElementById('message');
  e.textContent=t; e.className=c;
  if (c) { void e.offsetWidth; e.classList.add('pop'); } // piccolo "pop" sui risultati
}

function renderD(all=false) {
  const el=document.getElementById('dealer-hand'); el.innerHTML='';
  dealerHand.forEach((c,i) => el.appendChild(buildCard(c, i===1 && !all)));
  document.getElementById('dealer-score').textContent =
    all ? 'Banco: '+total(dealerHand)+(isBust(dealerHand)?' 💀':'') : 'Banco: '+cv(dealerHand[0]);
}

function renderP() {
  const ct=document.getElementById('player-hands'); ct.innerHTML='';
  playerHands.forEach((h,i) => {
    const div=document.createElement('div');
    div.className='split-hand'+(i===curHand&&phase==='player'&&playerHands.length>1?' active-hand':'');
    const row=document.createElement('div'); row.className='cards-row';
    h.forEach(c => row.appendChild(buildCard(c)));
    const b=document.createElement('div'); b.className='score-badge'+(handResults[i]?' '+handResults[i]:'');
    const t2=total(h);
    const etichetta = playerHands.length>2 ? (i+1)+'ª: ' : playerHands.length>1 ? 'Mano '+(i+1)+': ' : '';
    b.textContent=etichetta+(playerHands.length>1&&isBJ(h)?'Blackjack!':t2+(t2>21?' 💀':''));
    if (playerHands.length>1&&isBJ(h)) b.classList.add('bj');
    div.appendChild(row); div.appendChild(b); ct.appendChild(div);
  });
  document.getElementById('player-score').textContent='';
  adattaMani();
}

/* Dopo uno split le mani restano su una riga sola: se non ci stanno, le carte
   si rimpiccioliscono (prima la seconda mano finiva sotto, fuori dal tavolo). */
function adattaMani() {
  const ct = document.getElementById('player-hands');
  ct.style.removeProperty('--cw');
  ct.style.flexWrap = '';
  const carta = ct.querySelector('.card');
  if (!carta) return;
  let cw = carta.offsetWidth;
  while (ct.scrollWidth > ct.clientWidth + 1 && cw > 34) {
    cw -= 3;
    ct.style.setProperty('--cw', cw + 'px');
  }
  if (ct.scrollWidth > ct.clientWidth + 1) { // ancora troppo larghe: vanno a capo e si mostra la mano in gioco
    ct.style.flexWrap = 'wrap';
    const attiva = ct.querySelector('.active-hand');
    if (attiva) attiva.scrollIntoView({ block: 'nearest' });
  }
}
window.addEventListener('resize', () => { if (playerHands.length > 1 || playerHands[0].length > 4) adattaMani(); });

function btns(h,s,d,sp) {
  ['btn-hit','btn-stand','btn-double','btn-split'].forEach((id,i) => {
    document.getElementById(id).disabled = ![h,s,d,sp][i];
  });
}

function betArea(on) {
  document.getElementById('chips-row').style.pointerEvents = on ? 'auto' : 'none';
  document.getElementById('chips-row').style.opacity       = on ? '1'    : '.42';
  document.body.dataset.mode = on ? 'bet' : 'play'; // il dock mostra fiches oppure azioni
  updateHUD();
}


/* ════════════════════════════════════════════════════════════════
   BET
════════════════════════════════════════════════════════════════ */
function addChip(i) { const v = chips()[i]; if (v) addBet(v, i); }
function addBet(v, i) {
  if (phase !== 'bet' || !run) return;
  const el = document.querySelectorAll('#chips-row .chip')[i];
  if (currentBet + v > puntataTetto()) {
    sfxError();
    if (el) {
      el.classList.add('chip-shake');
      setTimeout(() => el.classList.remove('chip-shake'), 400);
    }
    msg(currentBet + v > balance ? 'Stack insufficiente per questa fiche! (disponibili: ' + ggb(balance - currentBet) + ')'
                                 : 'Puntata massima del tavolo: ' + ggb(puntataMax()) + '.', 'lose');
    setTimeout(() => { if (phase==='bet' && !currentBet) msg(''); }, 2500);
    return;
  }
  sfxChip();
  currentBet += v;
  updateHUD();
}

function clearBet() {
  if (phase !== 'bet') return;
  currentBet = 0;
  updateHUD();
  msg('');
}

function repeatBet() {
  if (phase !== 'bet' || lastBet <= 0 || !run) return;
  currentBet = Math.min(lastBet, puntataTetto());
  sfxChip();
  if (currentBet < lastBet) msg('Punto il massimo possibile (' + ggb(currentBet) + ').', 'push');
  updateHUD();
}

function allIn() {
  if (phase !== 'bet' || !run || balance <= 0 || currentBet === puntataTetto()) return;
  currentBet = puntataTetto();
  sfxChip();
  updateHUD();
}

function doubleBet() {
  if (phase !== 'bet' || currentBet <= 0) return;
  if (currentBet * 2 > puntataTetto()) { sfxError(); msg(currentBet * 2 > balance ? 'Non hai abbastanza per raddoppiare la puntata.' : 'Oltre la puntata massima del tavolo (' + ggb(puntataMax()) + ').', 'lose'); return; }
  currentBet *= 2;
  sfxChip();
  updateHUD();
}

/* ════════════════════════════════════════════════════════════════
   DEAL
════════════════════════════════════════════════════════════════ */
function deal() {
  if (phase !== 'bet' || currentBet <= 0 || !run) return;
  if (currentBet > balance) { msg('Stack insufficiente!','lose'); return; }
  if (currentBet < puntataMin()) { sfxError(); msg('Puntata minima: ' + ggb(puntataMin()) + '.', 'lose'); return; }
  if (currentBet > puntataMax()) { sfxError(); msg('Puntata massima: ' + ggb(puntataMax()) + '.', 'lose'); return; }
  if (deck.length < 52) deck = newDeck(6);
  contaGiocata();

  startMusic();
  allInRound = currentBet === balance;
  if (currentBet >= puntataMax()) sblocca('balena');
  minimoMano = puntataMin();
  const ora = new Date().getHours();
  if (ora >= 3 && ora < 5) sblocca('nottambulo');
  lastBet = currentBet;
  balance -= currentBet;
  phase = 'deal';
  betArea(false); btns(false,false,false,false);
  memScrivi(); // la puntata è già scalata: ricaricare la pagina non la restituisce

  dealerHand  = [deck.pop(), deck.pop()];
  playerHands = [[deck.pop(), deck.pop()]];
  handBets    = [currentBet];
  handDoubled = [false];
  handResults = [];
  curHand=0; insBet=0;

  [0,160,320,480].forEach(t => setTimeout(sfxCard, t));
  renderD(false); renderP();
  msg('Buona fortuna... o forse no.');
  setCroupier('init');

  if (dealerHand[0].rank==='A') {
    phase='insurance';
    // in all in (o col saldo sotto metà puntata) l'assicurazione non si può pagare: il Sì resta spento
    const puoi = Math.floor(handBets[0]/2) > 0 && Math.floor(handBets[0]/2) <= balance;
    document.getElementById('ins-yes').disabled = !puoi;
    document.getElementById('ins-yes').title = puoi ? '' : 'Non hai saldo per l\'assicurazione';
    document.getElementById('insurance-bar').classList.add('show');
    return;
  }
  dopoAssicurazione();
}

/* Il banco controlla la carta coperta (con Asso o figura/10 scoperti):
   se ha blackjack la mano finisce subito, prima che il giocatore punti altro. */
function dopoAssicurazione() {
  phase='player';
  if (cv(dealerHand[0]) >= 10 && isBJ(dealerHand)) {
    msg('Il banco controlla la carta coperta...');
    setTimeout(finishRound, 700);
    return;
  }
  if (dealerHand[0].rank==='A' || cv(dealerHand[0])===10) {
    if (insBet > 0) msg('Il banco non ha blackjack: assicurazione persa.');
    else msg('Il banco non ha blackjack. Tocca a te.');
  }
  if (isBJ(playerHands[0])) { finishRound(); return; }
  enableActions();
}

/* ════════════════════════════════════════════════════════════════
   INSURANCE
════════════════════════════════════════════════════════════════ */
function takeInsurance() {
  if (phase !== 'insurance' || document.getElementById('ins-yes').disabled) return;
  const cost=Math.floor(handBets[0]/2);
  if(cost<=0||cost>balance) { msg('Saldo insufficiente per l\'assicurazione.','lose'); declineInsurance(); return; }
  sfxChip();
  insBet=cost; balance-=cost; updateHUD(); memScrivi();
  document.getElementById('insurance-bar').classList.remove('show');
  dopoAssicurazione();
}
function declineInsurance() {
  if (phase !== 'insurance') return;
  document.getElementById('insurance-bar').classList.remove('show');
  dopoAssicurazione();
}

/* ════════════════════════════════════════════════════════════════
   PLAYER ACTIONS
════════════════════════════════════════════════════════════════ */
function enableActions() {
  const h=playerHands[curHand];
  const canD=h.length===2&&balance>=handBets[curHand];
  const canS=h.length===2&&cv(h[0])===cv(h[1])&&balance>=handBets[curHand]&&playerHands.length<4;
  btns(true,true,canD,canS);
}
function hit() {
  if(phase!=='player' || document.getElementById('btn-hit').disabled) return;
  const prima = total(playerHands[curHand]);
  sfxCard(); playerHands[curHand].push(deck.pop());
  if (prima >= 17 && total(playerHands[curHand]) === 21) sblocca('sfacciato');
  if (playerHands[curHand].filter(c => c.rank === 'A').length >= 4) sblocca('pokerassi');
  btns(false,false,false,false); renderP();
  if(isBust(playerHands[curHand]) || total(playerHands[curHand])===21) setTimeout(next,400);
  else btns(true,true,false,false);
}
function stand() {
  if(phase!=='player' || document.getElementById('btn-stand').disabled) return;
  btns(false,false,false,false); next();
}
function doubleDown() {
  if(phase!=='player' || document.getElementById('btn-double').disabled) return;
  sfxChip(); sfxCard();
  balance-=handBets[curHand]; handBets[curHand]*=2; handDoubled[curHand]=true;
  currentBet=handBets.reduce((a,b)=>a+b,0); updateHUD(); memScrivi();
  playerHands[curHand].push(deck.pop()); renderP(); btns(false,false,false,false);
  setTimeout(next,400);
}
function splitHand() {
  if(phase!=='player' || document.getElementById('btn-split').disabled) return;
  sfxChip(); balance-=handBets[curHand];
  const h=playerHands[curHand],nh=[h.pop()];
  if (nh[0].rank === 'A') sblocca('splitassi');
  h.push(deck.pop()); nh.push(deck.pop());
  playerHands.splice(curHand+1,0,nh); handBets.splice(curHand+1,0,handBets[curHand]);
  handDoubled.splice(curHand+1,0,false);
  if (playerHands.length >= 4) sblocca('forchettone');
  currentBet=handBets.reduce((a,b)=>a+b,0); updateHUD(); memScrivi();
  sfxCard(); iniziaMano();
}
function next() {
  curHand++;
  if(curHand<playerHands.length) iniziaMano();
  else dealerPlay();
}
// dopo uno split: se la mano di turno è Asso + 10 è blackjack, lo si dice subito e la mano non si gioca
function iniziaMano() {
  renderP();
  if (playerHands.length > 1 && isBJ(playerHands[curHand])) {
    btns(false,false,false,false);
    msg('Mano ' + (curHand + 1) + ': BLACKJACK! Paga 3 a 2, passa alla prossima.', 'win');
    sfxChip(); setCroupier('lose');
    setTimeout(next, 1100);
    return;
  }
  enableActions();
}

/* ════════════════════════════════════════════════════════════════
   DEALER
════════════════════════════════════════════════════════════════ */
function dealerPlay() {
  phase='dealer'; btns(false,false,false,false); sfxCard(); renderD(true); renderP();
  if(playerHands.every(h=>isBust(h))) { finishRound(); return; }
  msg('Il banco gioca...');
  setTimeout(dealerStep, 500);
}
function dealerStep() {
  if(total(dealerHand)<17) { sfxCard(); dealerHand.push(deck.pop()); renderD(true); setTimeout(dealerStep,650); }
  else finishRound();
}

/* ════════════════════════════════════════════════════════════════
   SETTLE
════════════════════════════════════════════════════════════════ */
function finishRound() {
  phase='end'; btns(false,false,false,false); renderD(true); renderP();
  const dT=total(dealerHand), dBJ=isBJ(dealerHand);
  let messages=[], result='lose';
  let guadagno = 0; // netto della mano (vincite - puntate)

  // L'assicurazione paga 2:1: torna la posta più il doppio
  if(insBet>0) {
    if(dBJ) { balance+=insBet*3; guadagno+=insBet*2; messages.push('Assicurazione pagata! +'+ggb(insBet*2)); sblocca('assicurato'); }
    else { guadagno-=insBet; sblocca('buttati'); }
  }

  let vinteMani = 0;
  playerHands.forEach((h,i) => {
    const bet=handBets[i], pT=total(h),
          pBJ=isBJ(h), // anche dopo uno split Asso + figura è blackjack (scelta di Leo)
          lbl=playerHands.length>1?'Mano '+(i+1)+': ':'';
    let vinta = false;
    let esito='lose';
    if(isBust(h))          { guadagno-=bet; stats.sballate++; messages.push(lbl+'Sballato! -'+ggb(bet)); }
    else if(dBJ&&!pBJ)     { guadagno-=bet; messages.push(lbl+'Banco fa Blackjack! -'+ggb(bet)); }
    else if(pBJ&&!dBJ)     { const w=Math.floor(bet*2.5);balance+=w;guadagno+=w-bet;result='bj';vinta=true;esito='win';stats.blackjack++;messages.push(lbl+'BLACKJACK! +'+ggb(w-bet)); }
    else if(isBust(dealerHand)||pT>dT) { balance+=bet*2;guadagno+=bet;if(result!=='bj')result='win';vinta=true;esito='win';messages.push(lbl+'Hai vinto! +'+ggb(bet)); }
    else if(pT===dT)       { balance+=bet;if(result==='lose')result='push';esito='push';messages.push(lbl+'Pareggio. '+ggb(bet)+' rimborsati.'); }
    else                   { guadagno-=bet; messages.push(lbl+'Banco vince! -'+ggb(bet)); }
    handResults[i]=esito;
    if (esito==='push') sblocca('pareggio');
    if (pT===22) sblocca('ingordo');
    if (pT===21 && h.length>=3) sblocca('ventuno');
    if (pT===21 && h.length===5) sblocca('cinque21');
    if (pT===21 && h.length===3 && h.every(c => c.rank==='7')) sblocca('settebello');
    if (handDoubled[i] && pT===21) sblocca('colpogrosso');
    if (pBJ && h[0].suit===h[1].suit && h.some(c => c.rank==='J')) sblocca('elegante');
    if (vinta) {
      vinteMani++;
      if (handDoubled[i]) sblocca('raddoppio');
      if (handDoubled[i] && total(h.slice(0,2))===11) sblocca('raddoppio11');
      if (h.length >= 5) sblocca('cinquecarte');
      if (h.length >= 6) sblocca('seicarte');
      if (pT===16 && !handDoubled[i]) sblocca('sedici');
      if (pT<=12) sblocca('lumaca');
    }
  });

  // statistiche: una "mano" = un giro, vinto se il netto è positivo
  stats.mani++;
  if (guadagno > 0)      { stats.vinte++; stats.serie++; }
  else if (guadagno < 0) { stats.perse++; stats.serie=0; }
  else                   { stats.pari++; }
  stats.serieMax = Math.max(stats.serieMax, stats.serie);
  stats.vincitaMax = Math.max(stats.vincitaMax, guadagno);

  // serie in corso
  const tutteSballate = playerHands.every(h => isBust(h));
  stats.serieBJ      = result==='bj' ? stats.serieBJ+1 : 0;
  stats.seriePari    = (guadagno===0 && handResults.every(r => r==='push')) ? stats.seriePari+1 : 0;
  stats.serieBancoBJ = dBJ ? stats.serieBancoBJ+1 : 0;
  stats.serieSballo  = tutteSballate ? stats.serieSballo+1 : 0;
  stats.seriePerse   = guadagno<0 ? stats.seriePerse+1 : 0;
  stats.serieAllin   = allInRound ? (guadagno>0 ? stats.serieAllin+1 : 0) : stats.serieAllin;
  const puntataTot   = handBets.reduce((a,b)=>a+b,0);

  sblocca('prima');
  if (result==='bj') sblocca('bj');
  if (dBJ) sblocca('bancobj');
  if (stats.serie >= 3)  sblocca('tripletta');
  if (stats.serie >= 5)  sblocca('cinquina');
  if (stats.serie >= 10) sblocca('infiamme');
  if (stats.blackjack >= 10) sblocca('bj10');
  if (stats.blackjack >= 50) sblocca('bj50');
  if (stats.serieBJ >= 2) sblocca('bj2');
  if (stats.serieBJ >= 3) sblocca('bj3');
  if (stats.seriePari >= 3) sblocca('specchio');
  if (stats.serieBancoBJ >= 3) sblocca('gattonero');
  if (stats.serieSballo >= 3) sblocca('palloncino');
  if (stats.seriePerse >= 10) sblocca('maledetto');
  if (stats.serieAllin >= 3) sblocca('senzapaura');
  if (playerHands.length > 1 && vinteMani === playerHands.length) sblocca('split');
  if (playerHands.length >= 4 && vinteMani === playerHands.length) sblocca('quattro');
  if (isBust(dealerHand) && dealerHand.length >= 5) sblocca('bancosballa');
  if (puntataTot <= minimoMano && guadagno > 0) sblocca('spilorcio');
  if (allInRound && guadagno > 0) sblocca('allin');
  if (run && guadagno >= 10 * run.tavolo) sblocca('jackpot');
  if (run && guadagno >= 30 * run.tavolo) sblocca('sbancata');
  if (stats.mani >= 100)  sblocca('veterano');
  if (stats.mani >= 500)  sblocca('habitue');
  if (stats.mani >= 1000) sblocca('civive');
  controllaSaldo();

  renderP();
  updateHUD();
  const cls=result==='win'||result==='bj'?'win':result==='push'?'push':'lose';
  msg(messages.join(' | '), cls);
  if(result==='win'||result==='bj') sfxWin(); else if(result==='lose') sfxLose();

  if(result==='bj')        setCroupier('festoso');
  else if(result==='win')  setCroupier('vincente');
  else if(result==='lose') setCroupier('lose');
  else                     setCroupier('init');

  currentBet=0; updateHUD();
  if (fineRun()) return;
  memScrivi();
  setTimeout(() => { phase='bet'; betArea(true); aggiornaMoneta(); }, 1050);
}

/* ════════════════════════════════════════════════════════════════
   TESTA O CROCE: se al blackjack lo stack non è un multiplo della
   puntata minima del tavolo (al tavolo da 100: 75, 135...), dietro al
   tavolo, alla sinistra del Tromba, scende una moneta. Cliccandola ti
   giochi gli spiccioli: indovini → arrotondato per eccesso, sbagli → per
   difetto. La probabilità è spiccioli / puntata minima (al tavolo da
   1.000 con 1.001 rischi 1 per prenderne 99: 1%; con 1.099 il 99%),
   così il lancio è sempre alla pari.
════════════════════════════════════════════════════════════════ */
let _moneta = null, monetaFuori = false, monetaTimer = null;
function spiccioli() { return run && balance >= passo() ? balance % passo() : 0; }
function aggiornaMoneta() {
  const btn = document.getElementById('moneta-btn');
  if (!btn) return;
  const serve = gioco === 'blackjack' && spiccioli() > 0;
  clearTimeout(monetaTimer);
  if (gioco !== 'blackjack') { monetaFuori = false; btn.className = ''; }
  else if (serve && !monetaFuori) {   // scende dall'alto girando su se stessa
    monetaFuori = true;
    btn.className = ''; void btn.offsetWidth; btn.className = 'vis entra';
    monetaTimer = setTimeout(() => { if (monetaFuori) btn.className = 'vis'; }, 1000);
  } else if (!serve && monetaFuori) { // torna giù dietro al tavolo
    monetaFuori = false;
    btn.className = 'vis esce';
    monetaTimer = setTimeout(() => { if (!monetaFuori) btn.className = ''; }, 650);
  }
  const ok = serve && phase === 'bet' && !currentBet && !_moneta;
  btn.disabled = !ok;
  const r = spiccioli(), u = passo();
  btn.title = !serve ? '' : ok ? 'Testa o croce: ti giochi ' + numero(r) + ' di spiccioli (tasto M)' : 'Testa o croce: tra una mano e l\'altra, a tavolo vuoto';
}
function percMoneta(r, u) {
  const p = r / u * 100;
  return (p >= 10 ? Math.round(p) : p >= 1 ? Math.round(p * 10) / 10 : Math.round(p * 100) / 100).toLocaleString('it-IT') + '%';
}
function apriMoneta() {
  const btn = document.getElementById('moneta-btn');
  if (!btn || btn.disabled || _moneta) return;
  const u = passo(), r = spiccioli();
  if (!r) return;
  _moneta = { r, u, su: balance - r + u, giu: balance - r, lanciata: false };
  document.getElementById('moneta-msg').innerHTML =
    'Hai ' + ggb(r) + ' di spiccioli. Indovina e il Tromba arrotonda a <b>' + ggb(_moneta.su) + '</b>, sbagli e scendi a <b>' + ggb(_moneta.giu) + '</b>.' +
    '<br><span class="moneta-prob">Probabilità di indovinare: <b>' + percMoneta(r, u) + '</b></span>';
  const m = document.getElementById('moneta');
  m.classList.remove('lancio'); m.style.transition = 'none'; m.style.transform = 'rotateY(0deg)';
  const e = document.getElementById('moneta-esito'); e.textContent = ''; e.className = '';
  document.querySelectorAll('#moneta-btns button').forEach(b => b.disabled = false);
  document.getElementById('moneta-modal').classList.add('show');
  aggiornaMoneta();
}
function chiudiMoneta() {
  if (!_moneta || _moneta.lanciata) return;
  _moneta = null;
  document.getElementById('moneta-modal').classList.remove('show');
  aggiornaMoneta();
}
function sceltaMoneta(scelta) {
  if (!_moneta || _moneta.lanciata) return;
  _moneta.lanciata = true;
  document.querySelectorAll('#moneta-btns button').forEach(b => b.disabled = true);
  const vinto = Math.random() < _moneta.r / _moneta.u;
  const uscita = vinto ? scelta : (scelta === 'testa' ? 'croce' : 'testa');
  const m = document.getElementById('moneta');
  void m.offsetWidth;
  m.style.transition = 'transform 1.8s cubic-bezier(.2,.7,.25,1)';
  m.style.transform = 'rotateY(' + (360 * 6 + (uscita === 'croce' ? 180 : 0)) + 'deg)';
  m.classList.add('lancio');
  sfxChip();
  setTimeout(() => {
    const prima = balance;
    balance = vinto ? _moneta.su : _moneta.giu;
    const e = document.getElementById('moneta-esito');
    e.className = vinto ? 'win' : 'lose';
    e.textContent = 'È uscito ' + uscita + '! ' + (vinto ? 'Indovinato: +' : 'Sbagliato: -') + ggb(Math.abs(balance - prima));
    if (vinto) { sfxWin(); sblocca('moneta'); if (_moneta.r / _moneta.u < 0.1) sblocca('miracolo'); } else sfxLose();
    controllaSaldo();
    memScrivi();
    setTimeout(() => {
      document.getElementById('moneta-modal').classList.remove('show'); _moneta = null;
      updateHUD();
      fineRun();   // sotto la puntata minima si chiude, oltre la soglia si sale di tavolo
    }, 1500);
  }, 1850);
}
// sugli schermi bassi il Tromba diventa un avatar: la moneta va nell'angolo del tavolo
function postoMoneta() {
  const btn = document.getElementById('moneta-btn');
  const basso = window.matchMedia && matchMedia('(max-height:700px)').matches;
  const dove = document.getElementById(basso ? 'table' : 'croupier-panel');
  if (btn && btn.parentNode !== dove) dove.appendChild(btn);
}
window.addEventListener('resize', postoMoneta);

/* ════════════════════════════════════════════════════════════════
   RESET
════════════════════════════════════════════════════════════════ */
function bancarotta() {
  // gli spiccioli sotto la puntata minima tornano nel portafogli
  const resto = Math.max(0, Math.floor(balance));
  const rEl = document.getElementById('overlay-resto');
  rEl.style.display = resto > 0 ? '' : 'none';
  if (resto > 0) {
    rEl.innerHTML = 'Gli spiccioli rimasti (' + ggb(resto) + ') tornano nel portafogli.';
    GoGoldBar.aggiungi(resto).catch(() => { rEl.textContent = 'Non sono riuscito a rimettere gli spiccioli nel portafogli, riprova più tardi.'; });
  }
  run = null; balance = 0; currentBet = 0;
  stats.bancarotte++;
  sblocca('rovina');
  if (stats.bancarotte >= 5) sblocca('affezionato');
  memScrivi();
  setTimeout(() => document.getElementById('overlay').classList.add('show'), 1300);
}
function resetTavolo() {
  currentBet=0; deck=newDeck(6);
  dealerHand=[]; playerHands=[[]]; handBets=[0]; handDoubled=[false]; handResults=[]; curHand=0; insBet=0; phase='bet';
  ['dealer-hand','player-hands'].forEach(id => document.getElementById(id).innerHTML='');
  ['dealer-score','player-score'].forEach(id => document.getElementById(id).textContent='');
  setCroupier('init'); btns(false,false,false,false); betArea(true);
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('insurance-bar').classList.remove('show');
  closeCashoutModal();
  if (typeof rReset === 'function') rReset();
  if (typeof sReset === 'function') sReset();
  if (typeof pReset === 'function') pReset();
  if (typeof ptReset === 'function') ptReset();
  if (typeof mnReset === 'function') mnReset();
  Object.values(ORIGINALI).forEach(g => g.reset());
}
// dopo una bancarotta si riparte con un nuovo buy-in (nuovoBuyIn, sopra)

/* ════════════════════════════════════════════════════════════════
   SCORCIATOIE DA TASTIERA
   C carta · S stai · D raddoppia · P split · Invio distribuisci
   R ripeti puntata · X raddoppia puntata · Esc annulla puntata
   Assicurazione: Y sì · N no
════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT') return;
  if (document.getElementById('name-modal').style.display !== 'none') return;
  if (document.querySelector('dialog.gga[open]') || e.target.closest('input, textarea')) return; // pannello account aperto
  if (document.getElementById('cashout-modal').classList.contains('show')) {
    if (e.key === 'Escape') closeCashoutModal();
    return;
  }
  if (document.getElementById('moneta-modal').classList.contains('show')) {
    const sc = { t: 'testa', c: 'croce' }[e.key.toLowerCase()];
    if (sc) { e.preventDefault(); sceltaMoneta(sc); }
    else if (e.key === 'Escape') chiudiMoneta();
    return;
  }
  if (document.getElementById('stats-modal').classList.contains('show')) {
    if (e.key === 'Escape') chiudiStats();
    return;
  }
  if (e.key === 'Escape' && document.getElementById('lb-panel').classList.contains('open')) { toggleLeaderboard(); return; }
  if (document.getElementById('overlay').classList.contains('show')) return;
  if (gioco === 'lobby') {
    const t = { b: 'blackjack', r: 'roulette', s: 'slot', p: 'plinko', g: 'portiere', m: 'mine', h: 'hilo', d: 'dado', t: 'torre', o: 'talpe', k: 'keno', w: 'ttime' }[e.key.toLowerCase()];
    if (t && run) { e.preventDefault(); vaiA(t); }
    return;
  }
  if (gioco === 'roulette') { rTasti(e); return; }
  if (gioco === 'slot') { sTasti(e); return; }
  if (gioco === 'plinko') { pTasti(e); return; }
  if (gioco === 'portiere') { ptTasti(e); return; }
  if (gioco === 'mine') { mnTasti(e); return; }
  if (ORIGINALI[gioco]) { ORIGINALI[gioco].tasti(e); return; }
  const k = e.key.toLowerCase();
  const azioni = {
    player:    { c: hit, s: stand, d: doubleDown, p: splitHand },
    insurance: { y: takeInsurance, n: declineInsurance },
    bet:       { enter: deal, r: repeatBet, x: doubleBet, escape: clearBet, 7: allIn, m: apriMoneta },
  }[phase] || {};
  if (phase === 'bet' && /^[1-4]$/.test(e.key)) { e.preventDefault(); addChip(+e.key - 1); return; }
  const fn = azioni[k];
  if (fn) { e.preventDefault(); fn(); }
});

/* ════════════════════════════════════════════════════════════════
   ACCOUNT GOGOBAR — lo stesso 👤 della home: se sei entrato, giochi con quel nome
════════════════════════════════════════════════════════════════ */
function statoGoGo() {
  return (window.GoGoAccount && GoGoAccount.attivo) ? GoGoAccount.stato() : null;
}
function nomeGoGo() { const st = statoGoGo(); return st && st.account ? st.account.nome : ''; }

function avvisoAccount(t) { if (gioco === 'lobby') lobbyMsg(t); else msg(t); }
function contoAttivo() { return !!statoGoGo(); }

// l'account si crea e si gestisce dalla home (👤): da qui ci si va e basta
function vaiAllAccount() {
  if (playerName && !tavoloLibero()) return avvisoAccount('Finisci prima la giocata.');
  if (playerName) { clearTimeout(syncTimer); memScrivi(); syncRemoto(true); }
  location.href = '../../#account';
}
function aggiornaPillola() {
  const b = document.getElementById('gg-account');
  if (!contoAttivo()) { b.hidden = true; return; }
  const n = nomeGoGo();
  b.hidden = false;
  b.querySelector('.gga-txt').textContent = n || 'Entra';
  b.classList.toggle('gga-dentro', !!n);
  b.title = n ? 'Giochi come ' + n + ' (account GoGoBar, si gestisce dalla home)' : 'Entra con il tuo account GoGoBar dalla home';
}

// finestra d'ingresso: col tuo account ti siedi e basta, senza account si passa dalla home
function modaleAccount() {
  if (!contoAttivo()) return;
  const n = nomeGoGo(), btn = document.getElementById('name-btn'), intro = document.getElementById('name-intro');
  document.getElementById('name-error').textContent = '';
  if (n) {
    document.getElementById('name-input').value = n;
    intro.textContent = 'Giochi come ' + n + ', con il tuo account GoGoBar. Saldo, statistiche e trofei restano tuoi su ogni dispositivo.';
    btn.textContent = 'Siediti al tavolo';
  } else {
    intro.textContent = 'Per giocare alla bisca serve il tuo account GoGoBar: entra o crealo dalla home (👤 in alto) e torna qui.';
    btn.textContent = '👤 Entra dalla home';
  }
}

// entri o esci dall'account (dalla home, anche in un'altra scheda): la bisca si adegua
let ultimoGoGo = null;
function suCambioAccount(st) {
  const n = st && st.account ? st.account.nome : '';
  const prima = ultimoGoGo;
  aggiornaPillola();
  if (n === prima) return;
  ultimoGoGo = n;
  if (!playerName) { modaleAccount(); return; }
  if (n && chiaveNome(n) === chiaveNome(playerName)) return;
  if (!tavoloLibero()) {
    avvisoAccount(n ? 'Account cambiato: a fine giocata giochi come ' + n + '.' : 'Sei uscito dall\'account GoGoBar.');
    return;
  }
  if (n) { chiudiStats(); scegliGiocatore(n); }
  else { chiudiStats(); modaleAccount(); document.getElementById('name-modal').style.display = 'flex'; }
}
// se l'account cambia mentre una mano è in corso, il cambio avviene al primo tavolo libero
setInterval(() => {
  if (!contoAttivo() || !playerName || !tavoloLibero()) return;
  const n = nomeGoGo();
  if (document.getElementById('name-modal').style.display !== 'none') return;
  if (!n) { chiudiStats(); modaleAccount(); document.getElementById('name-modal').style.display = 'flex'; }
  else if (chiaveNome(n) !== chiaveNome(playerName)) { chiudiStats(); scegliGiocatore(n); }
}, 1500);

/* ════════════════════════════════════════════════════════════════
   INIT — riprende saldo, nome e statistiche salvati
════════════════════════════════════════════════════════════════ */
(function init() {
  const m = memTutto();
  mostraGiocatori();
  const acc = m.ultimo ? m.account[chiaveNome(m.ultimo)] : null;
  if (m.ultimo) {
    document.getElementById('name-input').value = m.ultimo;
    document.getElementById('name-btn').textContent = 'Continua come ' + m.ultimo;
    document.getElementById('name-input').addEventListener('input', () => {
      document.getElementById('name-btn').textContent = 'Siediti al tavolo';
    }, { once: true });
  }
  // account GoGoBar: si gioca solo con quello con cui sei entrato dalla home
  if (contoAttivo()) {
    document.body.classList.add('con-account');
    ultimoGoGo = nomeGoGo();
    modaleAccount(); aggiornaPillola();
    GoGoAccount.pronto.then(() => suCambioAccount(GoGoAccount.stato()));
    GoGoAccount.suCambio(suCambioAccount);
  }
})();
deck = newDeck(6);
postoMoneta();
betArea(true);
setCroupier('init');
