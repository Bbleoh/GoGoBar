/* ════════════════════════════════════════════════════════════════
   I GIOCHI DEL TROMBA — base comune di Hi-Lo, Dice, Torre del Drago,
   Moles e Keno (dai file mandati da Leo il 13/11/2026).
   Stessa grafica di Mine: pannello verde col bordo d'oro, croupier e
   messaggio in alto, gioco a sinistra, impostazioni, stack, puntata e
   pulsanti a destra (una colonna sola sul telefono).
   Ogni gioco crea il suo oggetto con ogBase() e lo registra con
   ogRegistra(): index.html lo collega a lobby, HUD, tasti, salto di
   tavolo, statistiche e salvataggio (vedi ORIGINALI in index.html).
   Le puntate sono quelle fisse di slot, plinko, portiere e mine
   (puntateFisse(): 10/20/50/100 al tavolo da 100) e dopo ogni mano
   fineRun(true) fa bancarotta o salto di tavolo.
   Il gioco può definire: inGioco, puntataInGioco, stato, azzera,
   disegna, principale, secondario, azioneSec, giocaManuale, manoAuto,
   autoPronto, suggAuto, infoAuto, tasto, benvenuto, righeStats.
════════════════════════════════════════════════════════════════ */
const OG_GIRI = [5, 10, 20];
const OG_TETTO = 1000;

function ogCaso(max) {
  try {
    const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
  } catch (e) { return Math.floor(Math.random() * max); }
}
function ogAttesa(ms) { return new Promise(r => setTimeout(r, ms)); }
function ogNum(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
// 1,22× · 3.700× · troncato ai centesimi, così non promette mai più di quanto paga
function ogValuta(m) {
  if (m >= 1000 && Math.abs(m - Math.round(m)) < 1e-9 || m >= 10000) return ogNum(m) + '×';
  const c = Math.floor(m * 100 + 1e-6);
  return ogNum(c / 100) + ',' + String(c % 100).padStart(2, '0') + '×';
}
// corto per le tabelle strette: 3,5× · 500× · 1,55×
function ogBreve(m) { return (m >= 1000 ? ogNum(m) : String(Math.floor(m * 100 + 1e-6) / 100).replace('.', ',')) + '×'; }
function ogPerc(p) { return (Math.round(p * 10000) / 100).toFixed(2).replace('.', ',') + '%'; }
function ogTono(f, durata, tipo, vol, quando) { if (typeof sTono === 'function') sTono(f, durata, tipo, vol, quando); }
function ogPesca(a) { return a[Math.floor(Math.random() * a.length)]; }
function ogRegistra(g) { ORIGINALI[g.id] = g; }

function ogBase(id, opz) {
  return {
    id, titolo: opz.titolo, icona: opz.icona, pref: opz.pref, conAuto: !!opz.auto, tastiTesto: opz.tasti || '',
    pronto: false, puntI: 0, ultima: null, busy: false, nascosto: 0,
    modo: 'manuale', autoOn: false, autoStop: false, autoFatti: 0, autoTot: 0,
    el: null,
    $(s) { return this.el.querySelector(s); },
    $$(s) { return this.el.querySelectorAll(s); },
    bet() { if (typeof puntateFisse !== 'function') return 0; const c = puntateFisse(); return c[Math.min(this.puntI, c.length - 1)] || 0; },

    /* ── da sovrascrivere ── */
    inGioco() { return false; },          // c'è una mano aperta (puntata già pagata)
    puntataInGioco() { return 0; },
    stato() { return null; },             // mano a metà da salvare: { g, puntata, molt }
    azzera() {},                          // pulisce l'ultima mano
    disegna() {},
    htmlSx() { return ''; },
    htmlDx() { return ''; },
    dopo() {},
    principale() { return { html: 'Gioca', disabled: !run || balance < this.bet() }; },
    secondario() { return null; },
    azioneSec() {},
    giocaManuale() {},
    async manoAuto() { return false; },
    autoPronto() { return true; },
    suggAuto() { return 'Scegli 5, 10 o 20'; },
    infoAuto() { return ''; },
    tasto() { return false; },
    benvenuto() { return 'Scegli la puntata e premi GIOCA.'; },
    righeStats(s) {
      const p = this.pref;
      return [['Mani giocate', s[p + 'Partite'] || 0], ['Mani in guadagno', s[p + 'Vinte'] || 0],
        ['Moltiplicatore più alto', ogValuta(s[p + 'MoltMax'] || 0)], ['Vincita più alta', ggb(s[p + 'VincitaMax'] || 0)]];
    },

    occupato() { return this.inGioco() || this.autoOn || this.busy; },

    /* ── costruzione: la cornice è uguale per tutti ── */
    costruisci() {
      if (this.pronto) return;
      this.pronto = true;
      this.el = document.getElementById(id);
      const G = 'ORIGINALI.' + id;
      const auto = this.conAuto ? `<div class="mn-riga og-riga-auto solo-auto" hidden><span class="mn-lbl">Auto</span><span class="og-auto-info"></span>` +
        `<div class="og-giri" role="group" aria-label="Quante puntate automatiche">${OG_GIRI.map(x => `<button type="button" class="bet-tool" onclick="${G}.auto(${x})">${x}</button>`).join('')}</div></div>` : '';
      this.el.innerHTML = `<div class="mn og og-${id}">
        <h2 class="mn-titolo">${this.titolo}</h2>
        <div class="og-head"><img class="og-croupier" src="${document.getElementById('croupier-img').src}" alt="Il Tromba"><div class="og-msg" aria-live="polite"></div></div>
        <div class="mn-gioco">
          <div class="mn-sx">${this.htmlSx()}</div>
          <div class="mn-dx">
            ${this.htmlDx()}
            ${auto}
            <div class="mn-pannello vlt-pannello">
              <div class="s-info"><small>Stack</small><span class="og-saldo">0</span></div>
              <div class="s-info s-puntata"><small>Puntata</small><div><button type="button" class="og-meno" onclick="${G}.cambiaPuntata(-1)" aria-label="Abbassa la puntata">−</button><span class="og-puntata">0</span><button type="button" class="og-piu" onclick="${G}.cambiaPuntata(1)" aria-label="Alza la puntata">+</button></div></div>
              <div class="s-info"><small>Ultima</small><span class="og-vincita">—</span></div>
            </div>
            <div class="og-azioni${this.conAuto ? '' : ' senza-auto'}">
              <button class="bet-tool og-sec" type="button" onclick="${G}.azioneSec()"></button>
              <button class="btn s-gioca og-gioca" type="button" onclick="${G}.gioca()" title="Spazio o Invio">Gioca</button>
              ${this.conAuto ? `<button class="bet-tool auto og-auto" type="button" onclick="${G}.tastoAuto()" title="Tasto A: puntate automatiche">⟳ Auto</button>` : ''}
            </div>
            <div class="og-keys">${this.tastiTesto}</div>
          </div>
        </div>
      </div>`;
      this.dopo();
    },
    entra() {
      this.costruisci();
      this.aggiorna();
      if (!this.$('.og-msg').textContent) this.msg(this.benvenuto());
    },
    reset() {
      if (!run) { this.azzera(); this.autoOn = false; this.autoStop = false; this.busy = false; this.nascosto = 0; this.modo = 'manuale'; }
      if (this.pronto) this.aggiorna();
    },
    // chiamato da fineRun quando si sale di tavolo
    salto() { this.puntI = 0; if (this.autoOn) { this.autoOn = false; this.autoStop = false; } },

    /* ── soldi ── */
    // paga la puntata: torna la puntata o 0 se non si può
    paga() {
      const p = this.bet();
      if (!run || !p) return 0;
      if (balance < p) { sfxError(); this.msg('Stack insufficiente! Abbassa la puntata.', 'lose'); return 0; }
      startMusic();
      balance -= p;
      contaGiocata();
      stats[this.pref + 'Partite'] = (stats[this.pref + 'Partite'] || 0) + 1;
      this.ultima = null;
      document.getElementById('balance-display').textContent = ggb(balance);
      return p;
    },
    // mette la vincita nello stack e la salva subito (anche se poi c'è un'animazione)
    incassa(puntata, molt) {
      const vincita = Math.floor(puntata * molt + 1e-6), p = this.pref;
      balance += vincita;
      this.ultima = vincita - puntata;
      if (vincita > puntata) stats[p + 'Vinte'] = (stats[p + 'Vinte'] || 0) + 1;
      stats[p + 'VincitaMax'] = Math.max(stats[p + 'VincitaMax'] || 0, vincita);
      if (vincita > 0) stats[p + 'MoltMax'] = Math.max(stats[p + 'MoltMax'] || 0, molt);
      memScrivi();
      return vincita;
    },
    // mostra l'esito della mano, poi bancarotta o salto di tavolo
    mostra(puntata, vincita, testo) {
      this.nascosto = 0;
      const pannello = this.$('.og'), vinto = vincita >= puntata && vincita > 0;
      if (vincita > 0 && vinto) {
        sfxWin();
        setCroupier(vincita >= puntata * 10 ? 'lose' : 'init');
        pannello.classList.remove('brilla'); void pannello.offsetWidth; pannello.classList.add('brilla');
      } else {
        sfxLose();
        setCroupier('festoso');
        pannello.classList.remove('scuoti'); void pannello.offsetWidth; pannello.classList.add('scuoti');
      }
      this.msg(testo, vinto ? 'win' : 'lose');
      controllaSaldo();
      memScrivi();
      this.aggiorna();
      document.getElementById('balance-display').textContent = ggb(balance);
      fineRun(true);
    },
    chiudi(puntata, molt, testo) { this.mostra(puntata, this.incassa(puntata, molt), testo); },

    cambiaPuntata(d) {
      if (this.occupato() || typeof puntateFisse !== 'function') return;
      const n = puntateFisse().length, i = Math.max(0, Math.min(n - 1, Math.min(this.puntI, n - 1) + d));
      if (i === this.puntI) return;
      this.puntI = i; sfxChip(); this.aggiorna();
    },

    /* ── pulsanti ── */
    gioca() {
      if (this.modo === 'auto') { if (this.autoOn) this.fermaAuto(); return; }
      if (this.busy) return;
      this.giocaManuale();
    },
    tastoAuto() {
      if (!this.conAuto) return;
      if (this.autoOn) { this.fermaAuto(); return; }
      if (this.occupato()) return;
      this.modo = this.modo === 'auto' ? 'manuale' : 'auto';
      this.azzera();
      this.msg(this.modo === 'auto' ? this.infoModoAuto() : this.benvenuto());
      sfxChip(); this.aggiorna();
    },
    infoModoAuto() { return 'Prepara la mano, poi scegli 5, 10 o 20 puntate: gioca il Tromba per te.'; },
    fermaAuto() { if (this.autoOn && !this.autoStop) { this.autoStop = true; this.msg('Mi fermo dopo questa mano.'); this.aggiorna(); } },
    async auto(giri) {
      if (this.autoOn || this.modo !== 'auto' || this.occupato() || !OG_GIRI.includes(giri) || !this.autoPronto()) return;
      const partenza = balance;
      this.azzera();
      this.autoOn = true; this.autoStop = false; this.autoFatti = 0; this.autoTot = giri;
      this.aggiorna();
      let perche = '';
      for (let g = 0; g < giri; g++) {
        if (this.autoStop) { perche = 'stop'; break; }
        if (!run || balance < this.bet()) { perche = 'stack'; break; }
        if (!(await this.manoAuto())) { perche = 'stack'; break; }
        this.autoFatti++;
        this.aggiorna();
        if (!run || !this.autoOn) { perche = perche || 'tavolo'; break; }
        if (g < giri - 1) await ogAttesa(this.pausaAuto || 750);
      }
      const fermato = !this.autoOn;
      this.autoOn = false; this.autoStop = false;
      if (!run) return;
      const tot = balance - partenza;
      this.msg(({ stop: 'Auto fermato', stack: 'Auto finito: stack insufficiente' }[perche] || (fermato ? 'Auto fermo: sei salito di tavolo' : 'Auto completato')) +
        ' dopo ' + this.autoFatti + (this.autoFatti === 1 ? ' mano' : ' mani') + '. Totale: ' + (tot >= 0 ? '+' : '−') + ggb(Math.abs(tot)), tot >= 0 ? 'win' : 'lose');
      this.aggiorna();
    },

    /* ── interfaccia ── */
    msg(t, c) {
      if (!this.pronto) return;
      const e = this.$('.og-msg');
      e.innerHTML = t; e.className = 'og-msg' + (c ? ' ' + c : '');
      if (c) { void e.offsetWidth; e.classList.add('pop'); }
    },
    aggiorna(opz) {
      if (!this.pronto) return;
      const fermo = !this.occupato();
      this.disegna(fermo, opz);
      if (this.conAuto) {
        this.$$('.solo-auto').forEach(e => { e.hidden = this.modo !== 'auto'; });
        this.$$('.og-giri button').forEach(b => { b.disabled = !fermo || !run || balance < this.bet() || !this.autoPronto(); });
        this.$('.og-auto-info').innerHTML = this.infoAuto() + (this.autoOn ? '<br>mano ' + Math.min(this.autoFatti + 1, this.autoTot) + ' di ' + this.autoTot : '');
        const a = this.$('.og-auto');
        a.classList.toggle('on', this.modo === 'auto');
        a.innerHTML = this.autoOn ? '■ Stop' : this.modo === 'auto' ? '✕ Esci' : '⟳ Auto';
        a.disabled = this.autoOn ? this.autoStop : !fermo;
      }
      this.$('.og-saldo').textContent = ggb(balance - this.nascosto);
      this.$('.og-puntata').textContent = ggb(this.puntataInGioco() || this.bet());
      const n = typeof puntateFisse === 'function' ? puntateFisse().length : 0, pi = Math.min(this.puntI, Math.max(0, n - 1));
      this.$('.og-meno').disabled = !fermo || pi <= 0;
      this.$('.og-piu').disabled = !fermo || pi >= n - 1;
      const ul = this.$('.og-vincita');
      const u = this.nascosto ? null : this.ultima;
      ul.textContent = u === null ? '—' : (u > 0 ? '+' : u < 0 ? '−' : '') + ggb(Math.abs(u));
      ul.className = 'og-vincita' + (u > 0 ? ' pos' : u < 0 ? ' neg' : '');
      const main = this.$('.og-gioca');
      if (this.modo === 'auto') {
        main.classList.remove('incassa');
        if (this.autoOn) { main.disabled = this.autoStop; main.innerHTML = this.autoStop ? 'Fermo...' : 'Stop <small>' + this.autoFatti + '/' + this.autoTot + '</small>'; }
        else { main.disabled = true; main.innerHTML = '<span class="piccolo">' + (this.autoPronto() ? 'Scegli 5, 10 o 20' : this.suggAuto()) + '</span>'; }
      } else {
        const p = this.principale(fermo);
        main.classList.toggle('incassa', !!p.incassa);
        main.innerHTML = p.html;
        main.disabled = !!p.disabled || this.busy;
      }
      const sec = this.$('.og-sec'), s = this.secondario(fermo);
      sec.hidden = !s;
      if (s) { sec.innerHTML = s.html; sec.disabled = !!s.disabled; }
      if (typeof aggiornaTavoliBtn === 'function') aggiornaTavoliBtn();
      if (typeof updateCashoutBtn === 'function') updateCashoutBtn();
    },
    // tasti comuni: Spazio/Invio gioca o incassa · +/− e ↑↓ puntata · A auto · Esc ferma o esce dall'auto
    tasti(e) {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (e.target && e.target.tagName === 'SELECT' && (k === 'arrowup' || k === 'arrowdown')) return;
      if (this.tasto(k, e)) { e.preventDefault(); return; }
      const azioni = { ' ': () => this.gioca(), enter: () => this.gioca(), '+': () => this.cambiaPuntata(1), '-': () => this.cambiaPuntata(-1),
        arrowup: () => this.cambiaPuntata(1), arrowdown: () => this.cambiaPuntata(-1),
        escape: () => { if (this.autoOn) this.fermaAuto(); else if (this.modo === 'auto') this.tastoAuto(); } };
      if (this.conAuto) azioni.a = () => this.tastoAuto();
      if (azioni[k]) { e.preventDefault(); azioni[k](); }
    },
  };
}
