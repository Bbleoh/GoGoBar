/* ════════════════════════════════════════════════════════════════
   KENO — 40 numeri, scegli da 1 a 10 numeri, il Tromba ne estrae 10.
   Ogni tuo numero estratto è un centro; paga in base ai centri, a
   quanti numeri hai scelto e alla difficoltà.
   Tabelle: quelle del Keno di Stake (Classica, Bassa, Media, Alta),
   ricontrollate una per una con la distribuzione ipergeometrica
   (C(k,h)·C(40−k,10−h)/C(40,10)): ogni riga rende il 98,7–99% della
   puntata. Il file di prima le inventava con una formula e pagava male.
   Classica paga spesso e poco, Alta paga solo i colpi grossi (con 1
   numero Classica e Alta coincidono: 3,96×). Massimo 1.000×.
   La giocata è istantanea: l'esito si salva prima dell'estrazione animata.
   Auto: scegli i numeri, poi 5, 10 o 20 estrazioni.
════════════════════════════════════════════════════════════════ */
const KN_NUMERI = 40, KN_ESTRATTI = 10, KN_MAX = 10;
const KN_TABELLE = {
  classica: { nome: 'Classica', t: { 1: [0, 3.96], 2: [0, 1.9, 4.5], 3: [0, 1, 3.1, 10.4], 4: [0, 0.8, 1.8, 5, 22.5], 5: [0, 0.25, 1.4, 4.1, 16.5, 36],
    6: [0, 0, 1, 3.68, 7, 16.5, 40], 7: [0, 0, 0.47, 3, 4.5, 14, 31, 60], 8: [0, 0, 0, 2.2, 4, 13, 22, 55, 70], 9: [0, 0, 0, 1.55, 3, 8, 15, 44, 60, 85],
    10: [0, 0, 0, 1.4, 2.25, 4.5, 8, 17, 50, 80, 100] } },
  bassa: { nome: 'Bassa', t: { 1: [0.7, 1.85], 2: [0, 2, 3.8], 3: [0, 1.1, 1.38, 26], 4: [0, 0, 2.2, 7.9, 90], 5: [0, 0, 1.5, 4.2, 13, 300],
    6: [0, 0, 1.1, 2, 6.2, 100, 700], 7: [0, 0, 1.1, 1.6, 3.5, 15, 225, 700], 8: [0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800], 9: [0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000],
    10: [0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000] } },
  media: { nome: 'Media', t: { 1: [0.4, 2.75], 2: [0, 1.8, 5.1], 3: [0, 0, 2.8, 50], 4: [0, 0, 1.7, 10, 100], 5: [0, 0, 1.4, 4, 14, 390],
    6: [0, 0, 0, 3, 9, 180, 710], 7: [0, 0, 0, 2, 7, 30, 400, 800], 8: [0, 0, 0, 2, 4, 11, 67, 400, 900], 9: [0, 0, 0, 2, 2.5, 5, 15, 100, 500, 1000],
    10: [0, 0, 0, 1.6, 2, 4, 7, 26, 100, 500, 1000] } },
  alta: { nome: 'Alta', t: { 1: [0, 3.96], 2: [0, 0, 17.1], 3: [0, 0, 0, 81.5], 4: [0, 0, 0, 10, 259], 5: [0, 0, 0, 4.5, 48, 450],
    6: [0, 0, 0, 0, 11, 350, 710], 7: [0, 0, 0, 0, 7, 90, 400, 800], 8: [0, 0, 0, 0, 5, 20, 270, 600, 900], 9: [0, 0, 0, 0, 4, 11, 56, 500, 800, 1000],
    10: [0, 0, 0, 0, 3.5, 8, 13, 63, 500, 800, 1000] } },
};
function knMolt(d, k, h) { return k ? (KN_TABELLE[d].t[k][h] || 0) : 0; }
function knEstrai() {
  const idx = Array.from({ length: KN_NUMERI }, (_, i) => i + 1);
  for (let i = 0; i < KN_ESTRATTI; i++) { const j = i + ogCaso(KN_NUMERI - i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, KN_ESTRATTI);
}

const KN = Object.assign(ogBase('keno', { titolo: 'Keno', icona: '🔢', pref: 'kn', auto: true,
  tasti: 'Tasti: Spazio/Invio estrai · R numero a caso · C pulisci · ↑↓ puntata · A auto · Esc ferma l\'auto' }), {
  diff: 'media', scelti: new Set(), usciti: new Set(), centri: 0, estratto: false, puntata: 0, pausaAuto: 700,

  benvenuto() { return 'Scegli da 1 a 10 numeri. Io agito il sacco.'; },
  infoModoAuto() { return 'Tieni i numeri che hai scelto e scegli 5, 10 o 20 estrazioni.'; },
  infoAuto() { return this.scelti.size ? this.scelti.size + ' numeri, difficoltà ' + KN_TABELLE[this.diff].nome : 'Scegli i numeri sulla griglia'; },
  autoPronto() { return this.scelti.size > 0; },
  suggAuto() { return 'Scegli i numeri'; },
  puntataInGioco() { return this.busy ? this.puntata : 0; },
  azzera() { this.usciti = new Set(); this.centri = 0; this.estratto = false; },
  dopo() {
    try {
      const c = JSON.parse(localStorage.getItem('biscaKeno.v1')) || {};
      if (KN_TABELLE[c.diff]) this.diff = c.diff;
      if (Array.isArray(c.scelti)) this.scelti = new Set(c.scelti.filter(n => Number.isInteger(n) && n >= 1 && n <= KN_NUMERI).slice(0, KN_MAX));
    } catch (e) {}
  },
  salva() { try { localStorage.setItem('biscaKeno.v1', JSON.stringify({ diff: this.diff, scelti: [...this.scelti] })); } catch (e) {} },

  htmlSx() {
    let g = '';
    for (let n = 1; n <= KN_NUMERI; n++) g += `<button type="button" class="kn-num" data-n="${n}" onclick="ORIGINALI.keno.scegli(${n})" aria-label="Numero ${n}">${n}</button>`;
    return `<div class="og-quadro"><div class="kn-griglia">${g}</div></div><div class="kn-scala"></div>`;
  },
  htmlDx() {
    return `<div class="mn-riga"><span class="mn-lbl">Livello</span><div class="mn-seg kn-diff">${Object.entries(KN_TABELLE).map(([k, d]) => `<button type="button" class="bet-tool" data-d="${k}" onclick="ORIGINALI.keno.cambiaDiff('${k}')">${d.nome}</button>`).join('')}</div></div>
      <div class="mn-riga"><span class="mn-lbl">Numeri</span><span class="og-info kn-info"></span><div class="mn-seg" style="flex:none"><button type="button" class="bet-tool kn-dieci" onclick="ORIGINALI.keno.dieciACaso()">10 a caso</button><button type="button" class="bet-tool kn-pulisci" onclick="ORIGINALI.keno.pulisci()">Pulisci</button></div></div>`;
  },
  cambiaDiff(d) {
    if (this.occupato() || !KN_TABELLE[d] || d === this.diff) return;
    this.diff = d; this.azzera(); this.salva(); sfxChip(); this.aggiorna();
    const k = this.scelti.size;
    this.msg('Difficoltà <b>' + KN_TABELLE[d].nome + '</b>' + (k ? ': con ' + k + (k === 1 ? ' numero' : ' numeri') + ' il pieno paga ' + ogValuta(knMolt(d, k, k)) + '.' : '.'));
  },
  scegli(n) {
    if (this.occupato()) return;
    if (this.estratto) this.azzera();
    if (this.scelti.has(n)) this.scelti.delete(n);
    else if (this.scelti.size >= KN_MAX) { this.msg('Al massimo <b>10</b> numeri.'); return; }
    else this.scelti.add(n);
    this.salva(); sfxChip(); this.aggiorna();
  },
  aCaso() {
    if (this.occupato() || this.scelti.size >= KN_MAX) return;
    if (this.estratto) this.azzera();
    const liberi = []; for (let n = 1; n <= KN_NUMERI; n++) if (!this.scelti.has(n)) liberi.push(n);
    this.scelti.add(liberi[ogCaso(liberi.length)]);
    this.salva(); sfxChip(); this.aggiorna();
  },
  dieciACaso() {
    if (this.occupato()) return;
    this.azzera(); this.scelti = new Set(knEstrai());
    this.salva(); sfxChip(); this.aggiorna();
  },
  pulisci() { if (this.occupato()) return; this.azzera(); this.scelti.clear(); this.salva(); sfxChip(); this.aggiorna(); },

  async estrai() {
    if (this.busy || !run) return false;
    const k = this.scelti.size;
    if (!k) { sfxError(); this.msg('Scegli almeno un numero.', 'lose'); return false; }
    const p = this.paga();
    if (!p) return false;
    this.busy = true; this.puntata = p;
    this.azzera(); this.estratto = true;
    const usciti = knEstrai(), centri = usciti.filter(n => this.scelti.has(n)).length, m = knMolt(this.diff, k, centri);
    const vincita = this.incassa(p, m);   // salvato subito
    this.nascosto = vincita;
    ogTono(330, .1, 'square', .04); ogTono(440, .12, 'square', .04, .08);
    this.msg(ogPesca(['Si parte: dieci numeri dal sacco.', 'Mischio... e via.', 'Occhi ai numeri.']));
    this.aggiorna();
    for (let i = 0; i < usciti.length; i++) {
      const n = usciti[i];
      this.usciti.add(n);
      if (this.scelti.has(n)) { this.centri++; ogTono(520 + this.centri * 60, .18, 'triangle', .09); ogTono(780 + this.centri * 70, .22, 'sine', .05, .05); }
      else ogTono(420 + (i % 10) * 30, .07, 'square', .03);
      this.aggiorna();
      await ogAttesa(this.autoOn ? 150 : 230);
    }
    this.busy = false;
    const c = centri + (centri === 1 ? ' centro' : ' centri');
    this.mostra(p, vincita, vincita > 0 ? c + ': incassi ' + ggb(vincita) + ' (' + ogValuta(m) + ').' + (vincita < p ? ' Meglio di niente.' : '')
      : ogPesca([c + ': il sacco si tiene ' + ggb(p) + '.', c + ', niente da fare. Ritenta.', c + '. Il banco ringrazia.']));
    return true;
  },
  giocaManuale() { this.estrai(); },
  async manoAuto() { return this.estrai(); },

  principale() { return { html: 'Estrai', disabled: !run || balance < this.bet() || !this.scelti.size }; },
  secondario() { return { html: 'Numero<br>a caso', disabled: this.occupato() || this.scelti.size >= KN_MAX }; },
  azioneSec() { this.aCaso(); },
  tasto(k) {
    if (k === 'r') { this.aCaso(); return true; }
    if (k === 'c') { this.pulisci(); return true; }
    return false;
  },

  disegna(fermo) {
    const k = this.scelti.size;
    this.$$('.kn-num').forEach(b => {
      const n = +b.dataset.n, sc = this.scelti.has(n), us = this.usciti.has(n);
      const cls = 'kn-num' + (sc && us ? ' centro' : us ? ' uscito' : sc ? ' scelto' : '');
      if (b.className !== cls) { b.className = cls; b.innerHTML = sc && us ? n + '<img src="assets/slot/ggb.webp?v=3" alt="">' : n; }
      b.disabled = !fermo;
    });
    const sc = this.$('.kn-scala');
    if (!k) sc.innerHTML = '<div class="kn-avviso">Scegli da 1 a 10 numeri: qui sotto vedi quanto paga ogni centro</div>';
    else {
      const t = KN_TABELLE[this.diff].t[k], col = `style="grid-template-columns:repeat(${k + 1},1fr)"`, on = h => this.estratto && !this.busy && this.centri === h;
      sc.innerHTML = `<div class="kn-fila" ${col}>${t.map((m, h) => `<div class="kn-m${m ? '' : ' zero'}${on(h) ? ' on' : ''}">${ogBreve(m)}</div>`).join('')}</div>` +
        `<div class="kn-fila" ${col}>${t.map((m, h) => `<div class="kn-h${on(h) ? ' on' : ''}">${h} ●</div>`).join('')}</div>`;
    }
    this.$$('.kn-diff button').forEach(b => { b.classList.toggle('scelto', b.dataset.d === this.diff); b.disabled = !fermo; });
    let paga = '';
    if (k) { const t = KN_TABELLE[this.diff].t[k], da = t.findIndex(m => m > 0); paga = '<br>paga da ' + da + (da === 1 ? ' centro' : ' centri') + ' · pieno ' + ogValuta(t[k]); }
    this.$('.kn-info').innerHTML = k + ' / 10 scelti' + paga;
    this.$('.kn-dieci').disabled = !fermo;
    this.$('.kn-pulisci').disabled = !fermo || !k;
  },
});
ogRegistra(KN);
