/* ════════════════════════════════════════════════════════════════
   DICE (il Dado der Tromba) — esce un numero da 0,00 a 99,99.
   Barra: sopra o sotto un bersaglio, tra due bersagli o fuori da due.
   Probabilità = casi vincenti / 10.000; moltiplicatore = 0,99 / probabilità
   (RTP 99%), troncato alla quarta cifra: è quello che paga davvero.
   Probabilità da 0,10% (990×) a 98% (1,0102×).
   Bersaglio, probabilità e moltiplicatore si scrivono a mano o si
   trascina la barra: ogni campo aggiorna tutti gli altri (anche "&").
   La giocata è istantanea: l'esito si salva prima dell'animazione.
════════════════════════════════════════════════════════════════ */
const DC_RTP = 0.99, DC_MIN = 0.001, DC_MAX = 0.98;
const DC_BARRE = [['sopra', 'Sopra'], ['sotto', 'Sotto'], ['tra', 'Tra'], ['fuori', 'Fuori']];
const dcClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dcLeggi = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const dcFmt = (x, d) => x.toFixed(d).replace('.', ',');
// probabilità di vincere (r intero 0..9999)
function dcProb(o) {
  if (o.barra === 'sopra') return (9999 - o.t) / 10000;
  if (o.barra === 'sotto') return o.t / 10000;
  if (o.barra === 'tra') return Math.max(0, o.t2 - o.t1 - 1) / 10000;
  return Math.max(0, o.t1 + (9999 - o.t2)) / 10000;
}
function dcVince(r, o) {
  if (o.barra === 'sopra') return r > o.t;
  if (o.barra === 'sotto') return r < o.t;
  if (o.barra === 'tra') return r > o.t1 && r < o.t2;
  return r < o.t1 || r > o.t2;
}
const dcMolt = p => Math.floor(DC_RTP / Math.max(p, DC_MIN) * 10000 + 1e-6) / 10000;

const DC = Object.assign(ogBase('dado', { titolo: 'Dice', icona: '🎲', pref: 'dc', auto: true,
  tasti: 'Tasti: Spazio/Invio tira · I inverte · ↑↓ puntata · A auto · Esc ferma l\'auto' }), {
  barra: 'sopra', t: 5049, t1: 2500, t2: 7500, storia: [], tiro: null, trascina: null, puntata: 0,
  pausaAuto: 650,

  benvenuto() { return 'Sopra, sotto, tra o fuori: tanto il dado è mio. Scegli il bersaglio e tira.'; },
  infoModoAuto() { return 'Scegli il bersaglio, poi 5, 10 o 20 tiri: tiro io per te.'; },
  infoAuto() { return 'probabilità ' + ogPerc(dcProb(this)) + ' · ' + dcFmt(dcMolt(dcProb(this)), 4) + '×'; },
  puntataInGioco() { return this.busy ? this.puntata : 0; },
  dopo() {
    try {
      const c = JSON.parse(localStorage.getItem('biscaDado.v1')) || {};
      if (DC_BARRE.some(b => b[0] === c.barra)) { this.barra = c.barra; }
      if (Number.isInteger(c.t)) this.t = c.t;
      if (Number.isInteger(c.t1) && Number.isInteger(c.t2)) { this.t1 = c.t1; this.t2 = c.t2; }
      this.limita();
    } catch (e) {}
    const pista = this.$('.dc-pista');
    pista.addEventListener('pointerdown', e => {
      if (this.occupato()) return;
      const v = this.daPuntatore(e);
      this.trascina = this.barra === 'sopra' || this.barra === 'sotto' ? 't' : (Math.abs(v - this.t1) <= Math.abs(v - this.t2) ? 't1' : 't2');
      pista.setPointerCapture(e.pointerId); this.muovi(v); e.preventDefault();
    });
    pista.addEventListener('pointermove', e => { if (this.trascina) this.muovi(this.daPuntatore(e)); });
    ['pointerup', 'pointercancel'].forEach(ev => pista.addEventListener(ev, () => { if (this.trascina) { this.trascina = null; this.salva(); } }));
    this.$$('.dc-campo input').forEach(inp => {
      inp.addEventListener('input', () => this.scrivi(inp));
      inp.addEventListener('change', () => { this.campi(); this.salva(); });
      inp.addEventListener('blur', () => this.campi());
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
    });
  },
  salva() { try { localStorage.setItem('biscaDado.v1', JSON.stringify({ barra: this.barra, t: this.t, t1: this.t1, t2: this.t2 })); } catch (e) {} },

  htmlSx() {
    return `<div class="og-quadro">
        <div class="dc-risultato">–,––</div>
        <div class="dc-pista" aria-label="Barra del dado"><div class="dc-zone"></div><div class="dc-segno"></div><div class="dc-man" data-m="1">◆</div><div class="dc-man" data-m="2" hidden>◆</div></div>
        <div class="dc-scala"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        <div class="dc-campi">
          <label class="dc-campo"><span class="dc-l1">BERSAGLIO</span><div><input data-c="t1" inputmode="decimal" autocomplete="off"></div></label>
          <label class="dc-campo dc-c2" hidden><span>&amp;</span><div><input data-c="t2" inputmode="decimal" autocomplete="off"></div></label>
          <label class="dc-campo"><span>PROBABILITÀ</span><div><input data-c="p" inputmode="decimal" autocomplete="off"><em>%</em></div></label>
          <label class="dc-campo"><span>MOLTIPLICA</span><div><input data-c="m" inputmode="decimal" autocomplete="off"><em>×</em></div></label>
        </div>
        <div class="dc-storia" aria-label="Ultimi tiri"></div>
      </div>`;
  },
  htmlDx() {
    return `<div class="mn-riga"><span class="mn-lbl">Barra</span><div class="mn-seg dc-barre">${DC_BARRE.map(([v, l]) => `<button type="button" class="bet-tool" data-b="${v}" onclick="ORIGINALI.dado.cambiaBarra('${v}')">${l}</button>`).join('')}</div></div>
      <div class="mn-riga"><span class="mn-lbl">Vinci</span><span class="og-info dc-spiega"></span></div>`;
  },

  /* ── bersagli ── */
  limita() {
    if (this.barra === 'sopra') this.t = dcClamp(this.t, 199, 9989);
    else if (this.barra === 'sotto') this.t = dcClamp(this.t, 10, 9800);
    else {
      if (this.t1 > this.t2) [this.t1, this.t2] = [this.t2, this.t1];
      this.t1 = dcClamp(this.t1, 0, 9999); this.t2 = dcClamp(this.t2, 0, 9999);
      if (this.barra === 'tra') { if (this.t2 - this.t1 < 11) this.t2 = Math.min(9999, this.t1 + 11), this.t1 = this.t2 - 11; if (this.t2 - this.t1 > 9801) this.t2 = this.t1 + 9801; }
      else { if (this.t2 - this.t1 < 199) this.t2 = Math.min(9999, this.t1 + 199), this.t1 = this.t2 - 199; if (this.t2 - this.t1 > 9989) this.t2 = this.t1 + 9989; }
    }
  },
  // imposta la probabilità (0..1) tenendo il centro della zona
  conProb(c) {
    c = dcClamp(c, DC_MIN, DC_MAX);
    if (this.barra === 'sopra') this.t = Math.round(9999 - c * 10000);
    else if (this.barra === 'sotto') this.t = Math.round(c * 10000);
    else {
      const centro = (this.t1 + this.t2) / 2, w = this.barra === 'tra' ? Math.round(c * 10000) + 1 : Math.round(9999 - c * 10000);
      let t1 = Math.round(centro - w / 2);
      t1 = dcClamp(t1, 0, 9999 - w);
      this.t1 = t1; this.t2 = t1 + w;
    }
    this.limita();
  },
  cambiaBarra(b) {
    if (this.occupato() || b === this.barra) return;
    const c = dcProb(this);
    const prima = this.barra;
    this.barra = b;
    if ((b === 'tra' || b === 'fuori') && prima !== 'tra' && prima !== 'fuori') { this.t1 = 2500; this.t2 = 7500; }
    this.conProb(c);
    sfxChip(); this.salva(); this.aggiorna();
  },
  inverti() {
    if (this.occupato()) return;
    this.cambiaBarra({ sopra: 'sotto', sotto: 'sopra', tra: 'fuori', fuori: 'tra' }[this.barra]);
  },
  daPuntatore(e) { const r = this.$('.dc-pista').getBoundingClientRect(); return dcClamp(Math.round((e.clientX - r.left) / r.width * 10000), 0, 9999); },
  muovi(v) {
    if (this.trascina === 't') this.t = v;
    else if (this.trascina === 't1') this.t1 = Math.min(v, this.t2 - 1);
    else this.t2 = Math.max(v, this.t1 + 1);
    this.limita();
    this.aggiorna();
  },
  // un campo scritto a mano aggiorna gli altri (non se stesso, mentre scrivi)
  scrivi(inp) {
    const v = dcLeggi(inp.value);
    if (!Number.isFinite(v)) return;
    const c = inp.dataset.c, due = this.barra === 'tra' || this.barra === 'fuori';
    if (c === 't1') { if (due) this.t1 = Math.round(v * 100); else this.t = Math.round(v * 100); }
    else if (c === 't2') this.t2 = Math.round(v * 100);
    else if (c === 'p') this.conProb(v / 100);
    else if (c === 'm') this.conProb(DC_RTP / dcClamp(v, 1.0102, 990));
    this.limita();
    this.aggiorna();
  },
  campi() {
    const due = this.barra === 'tra' || this.barra === 'fuori', p = dcProb(this), att = document.activeElement;
    const val = { t1: dcFmt((due ? this.t1 : this.t) / 100, 2), t2: dcFmt(this.t2 / 100, 2), p: dcFmt(p * 100, 2), m: dcFmt(dcMolt(p), 4) };
    this.$$('.dc-campo input').forEach(inp => { if (inp !== att) inp.value = val[inp.dataset.c]; inp.disabled = this.occupato(); });
  },

  /* ── tiro ── */
  async tira() {
    if (this.busy || !run) return false;
    const p = this.paga();
    if (!p) return false;
    this.busy = true; this.puntata = p;
    const o = { barra: this.barra, t: this.t, t1: this.t1, t2: this.t2 };
    const r = ogCaso(10000), vinto = dcVince(r, o), m = vinto ? dcMolt(dcProb(o)) : 0;
    const vincita = this.incassa(p, m);   // salvato subito
    this.nascosto = vincita;
    this.aggiorna();
    const ris = this.$('.dc-risultato');
    ris.className = 'dc-risultato';
    for (let k = 0; k < 10; k++) { ris.textContent = dcFmt(ogCaso(10000) / 100, 2); ogTono(700 + Math.random() * 300, .04, 'square', .02); await ogAttesa(50); }
    const txt = dcFmt(r / 100, 2);
    ris.textContent = txt; ris.className = 'dc-risultato ' + (vinto ? 'win' : 'lose');
    const seg = this.$('.dc-segno'); seg.style.left = (r / 100) + '%'; seg.style.opacity = 1;
    this.storia.unshift({ r: txt, v: vinto }); this.storia = this.storia.slice(0, 12);
    this.busy = false;
    this.mostra(p, vincita, vinto ? ogPesca([txt + '! Prendi ' + ggb(vincita) + ' e non fare il solito.', 'Vinci ' + ggb(vincita) + ' (' + ogValuta(m) + '). Il Tromba sorride. Falso.', txt + ': ce l\'hai fatta. Mo\' raddoppia e perdi, dai.'])
      : ogPesca(['Esce ' + txt + '. Perdi ' + ggb(p) + '.', txt + '. Niente da fare: via ' + ggb(p) + '.', 'Il banco ha visto ' + txt + ' e ha pure esultato.']));
    return true;
  },
  giocaManuale() { this.tira(); },
  async manoAuto() { return this.tira(); },

  principale() { return { html: 'Tira', disabled: !run || balance < this.bet() }; },
  secondario() { return { html: 'Inverti<br><small>' + { sopra: 'sotto', sotto: 'sopra', tra: 'fuori', fuori: 'tra' }[this.barra] + '</small>', disabled: this.occupato() }; },
  azioneSec() { this.inverti(); },
  tasto(k) { if (k === 'i') { this.inverti(); return true; } return false; },

  disegna(fermo) {
    const due = this.barra === 'tra' || this.barra === 'fuori';
    const a = (due ? this.t1 : this.t) / 100, b = this.t2 / 100;
    const V = '#2fbf62', R = '#c8281e';
    const grad = { sopra: `linear-gradient(90deg,${R} 0 ${a}%,${V} ${a}% 100%)`, sotto: `linear-gradient(90deg,${V} 0 ${a}%,${R} ${a}% 100%)`,
      tra: `linear-gradient(90deg,${R} 0 ${a}%,${V} ${a}% ${b}%,${R} ${b}% 100%)`, fuori: `linear-gradient(90deg,${V} 0 ${a}%,${R} ${a}% ${b}%,${V} ${b}% 100%)` }[this.barra];
    const pista = this.$('.dc-pista');
    pista.style.background = grad;
    pista.classList.toggle('fermo', !fermo);
    const m1 = this.$('.dc-man[data-m="1"]'), m2 = this.$('.dc-man[data-m="2"]');
    m1.style.left = a + '%'; m2.style.left = b + '%'; m2.hidden = !due;
    this.$('.dc-c2').hidden = !due;
    this.$('.dc-l1').textContent = due ? 'DA' : (this.barra === 'sopra' ? 'SOPRA' : 'SOTTO');
    this.campi();
    this.$$('.dc-barre button').forEach(x => { x.classList.toggle('scelto', x.dataset.b === this.barra); x.disabled = !fermo; });
    const p = dcProb(this);
    this.$('.dc-spiega').innerHTML = ({ sopra: 'se esce più di ' + dcFmt(a, 2), sotto: 'se esce meno di ' + dcFmt(a, 2),
      tra: 'se esce tra ' + dcFmt(a, 2) + ' e ' + dcFmt(b, 2), fuori: 'se esce sotto ' + dcFmt(a, 2) + ' o sopra ' + dcFmt(b, 2) }[this.barra]) +
      '<br>' + ogPerc(p) + ' · paga ' + dcFmt(dcMolt(p), 4) + '×';
    this.$('.dc-storia').innerHTML = this.storia.map(s => `<span class="dc-badge ${s.v ? 'win' : 'lose'}">${s.r}</span>`).join('');
  },
});
ogRegistra(DC);
