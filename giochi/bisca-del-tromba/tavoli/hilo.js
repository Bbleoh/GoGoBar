/* ════════════════════════════════════════════════════════════════
   HI-LO — la prossima carta è più alta o più bassa?
   13 ranghi, mazzo infinito (ogni carta esce con probabilità 1/13).
   Su una carta di mezzo si sceglie "alta o uguale" o "bassa o uguale":
   il pari vince. Sull'asso e sul K le scelte "alta o uguale" e "bassa
   o uguale" vincerebbero sempre (pagherebbero 0,99×, cioè si perde):
   lì si sceglie tra "più alta" / "uguale" (asso) e "uguale" / "più
   bassa" (K), così nessuna giocata fa perdere.
   Moltiplicatore di una scelta = 0,99 / probabilità; quello della mano
   è il prodotto delle scelte indovinate (RTP 99% a scelta), tetto 1.000×.
   Si può saltare la carta fino a 52 volte a mano. Si incassa quando si
   vuole; una mano lasciata a metà viene incassata al ricaricamento.
════════════════════════════════════════════════════════════════ */
const HL_RTP = 0.99, HL_SALTI = 52;
const HL_RANGHI = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const HL_SEMI = ['♠', '♥', '♦', '♣'];
function hlCarta() { const v = 1 + ogCaso(13); return { v, rank: HL_RANGHI[v - 1], suit: HL_SEMI[ogCaso(4)] }; }
// le due scelte su una carta di valore v (A=1 ... K=13): p = probabilità di vincere
function hlScelte(v) {
  if (v === 1) return { su: { t: 'piu', p: 12 / 13, nome: 'Più alta', segno: '↑' }, giu: { t: 'pari', p: 1 / 13, nome: 'Uguale', segno: '=' } };
  if (v === 13) return { su: { t: 'pari', p: 1 / 13, nome: 'Uguale', segno: '=' }, giu: { t: 'meno', p: 12 / 13, nome: 'Più bassa', segno: '↓' } };
  return { su: { t: 'piuPari', p: (14 - v) / 13, nome: 'Alta o uguale', segno: '↑' }, giu: { t: 'menoPari', p: v / 13, nome: 'Bassa o uguale', segno: '↓' } };
}
function hlVince(t, v, nv) { return { piu: nv > v, pari: nv === v, meno: nv < v, piuPari: nv >= v, menoPari: nv <= v }[t]; }
const hlMoltScelta = p => HL_RTP / p;

const HL = Object.assign(ogBase('hilo', { titolo: 'Hi-Lo', icona: '♠️', pref: 'hl',
  tasti: 'Tasti: Spazio/Invio gioca o incassa · ↑↓ alta o bassa (puntata prima di giocare) · S salta la carta' }), {
  fase: 'bet', carta: null, molt: 1, prese: 0, salti: HL_SALTI, storia: [], puntata: 0,

  inGioco() { return this.fase === 'play'; },
  puntataInGioco() { return this.fase !== 'bet' ? this.puntata : 0; },
  stato() { return this.fase === 'play' ? { g: 'hilo', puntata: this.puntata, molt: Math.min(this.molt, OG_TETTO) } : null; },
  azzera() { if (this.fase === 'over') { this.fase = 'bet'; this.carta = null; this.storia = []; this.molt = 1; this.prese = 0; } },
  benvenuto() { return 'Più alta o più bassa? Scegli la puntata e premi GIOCA, io giro la carta.'; },

  htmlSx() {
    return `<div class="og-striscia tre hl-striscia"></div>
      <div class="og-quadro">
        <div class="hl-tavolo">
          <div class="hl-fantasma">K<small>il re è la più alta</small>↑</div>
          <div class="hl-carta"></div>
          <div class="hl-fantasma">A<small>l'asso è la più bassa</small>↓</div>
        </div>
        <div class="hl-storia" aria-label="Carte uscite"></div>
      </div>
      <div class="hl-scelte">
        <button type="button" class="hl-op su" data-d="su" onclick="ORIGINALI.hilo.scegli('su')"></button>
        <button type="button" class="hl-op giu" data-d="giu" onclick="ORIGINALI.hilo.scegli('giu')"></button>
      </div>`;
  },

  giocaManuale() {
    if (this.fase === 'play') { if (this.prese > 0) this.fine('incasso'); return; }
    this.azzera();
    const p = this.paga();
    if (!p) return;
    this.puntata = p; this.fase = 'play'; this.molt = 1; this.prese = 0; this.salti = HL_SALTI;
    this.carta = hlCarta();
    this.storia = [{ carta: this.carta, badge: 'VIA', cls: 'via' }];
    memScrivi();
    sfxCard();
    this.msg(ogPesca(['Esce <b>' + this.carta.rank + this.carta.suit + '</b>. Alta o bassa?', 'Carta <b>' + this.carta.rank + this.carta.suit + '</b>. Decidi.', 'Buona fortuna. La carta è <b>' + this.carta.rank + this.carta.suit + '</b>.']));
    this.aggiorna(true);
  },
  async scegli(d) {
    if (this.fase !== 'play' || this.busy || !this.carta) return;
    const s = hlScelte(this.carta.v)[d], v = this.carta.v;
    this.busy = true;
    const nc = hlCarta();
    const vinto = hlVince(s.t, v, nc.v);
    this.carta = nc;
    if (vinto) {
      this.molt *= hlMoltScelta(s.p);
      this.prese++;
      this.storia.push({ carta: nc, badge: ogValuta(Math.min(this.molt, OG_TETTO)), cls: '' });
      if (this.molt < OG_TETTO) memScrivi();
    } else this.storia.push({ carta: nc, badge: '✗', cls: 'no' });
    sfxCard();
    this.aggiorna(true);
    await ogAttesa(380);
    this.busy = false;
    if (!vinto) { this.fine('persa', nc); return; }
    ogTono(520 + Math.min(this.prese, 20) * 38, .16, 'triangle', .08); ogTono(780 + Math.min(this.prese, 20) * 50, .2, 'sine', .04, .05);
    if (this.molt >= OG_TETTO) { this.fine('tetto'); return; }
    const m = ogValuta(this.molt);
    this.msg(this.molt >= 5 ? ogPesca(['<b>' + m + '</b>! Incassa, scemo!', 'Il Tromba ti guarda e ride. <b>' + m + '</b>: incassi?'])
      : nc.v === v ? ogPesca(['Pari! E da noi il pari vince: <b>' + m + '</b>.', 'Uguale! <b>' + m + '</b>.'])
      : ogPesca(['Liscia. Sei a <b>' + m + '</b>: incassi o tiri ancora?', 'Ci hai preso! <b>' + m + '</b>.', 'Bravo. Non montarti la testa: <b>' + m + '</b>.']));
    this.aggiorna();
  },
  salta() {
    if (this.fase !== 'play' || this.busy || this.salti <= 0) return;
    this.salti--;
    this.carta = hlCarta();
    if (this.storia.length === 1) this.storia[0].carta = this.carta;   // prima carta cambiata: resta il VIA
    else this.storia.push({ carta: this.carta, badge: 'SALTA', cls: 'salta' });
    sfxCard();
    this.msg(ogPesca(['Non ti piace? Eccone un\'altra.', 'Salti? Fai il difficile. Carta nuova.', 'Gira, gira... carta cambiata.']));
    this.aggiorna(true);
  },
  fine(tipo, carta) {
    const p = this.puntata, m = tipo === 'persa' ? 0 : Math.min(this.molt, OG_TETTO);
    this.fase = 'over';
    const v = Math.floor(p * m + 1e-6);
    this.chiudi(p, m, tipo === 'persa' ? 'Esce <b>' + carta.rank + carta.suit + '</b>: sbagliato. Perdi ' + ggb(p) + '.'
      : (tipo === 'tetto' ? 'Tetto di 1.000×: incasso automatico, ' : 'Incassati ') + ggb(v) + ' (' + ogValuta(m) + ').');
  },

  principale() {
    if (this.fase === 'play') return this.prese ? { html: 'Incassa <small>' + ggb(Math.floor(this.puntata * Math.min(this.molt, OG_TETTO) + 1e-6)) + '</small>', incassa: true }
      : { html: '<span class="piccolo">Alta o bassa?</span>', disabled: true };
    return { html: 'Gioca', disabled: !run || balance < this.bet() };
  },
  secondario() {
    return { html: 'Salta carta<br><small>' + this.salti + (this.salti === 1 ? ' volta' : ' volte') + '</small>', disabled: this.fase !== 'play' || this.busy || this.salti <= 0 };
  },
  azioneSec() { this.salta(); },
  tasto(k) {
    if (this.fase === 'play') {
      if (k === 'arrowup' || k === 'h' || k === '1') { this.scegli('su'); return true; }
      if (k === 'arrowdown' || k === 'l' || k === '2') { this.scegli('giu'); return true; }
    }
    if (k === 's') { this.salta(); return true; }
    return false;
  },

  disegna(fermo, gira) {
    const c = this.carta, gioca = this.fase === 'play';
    const sc = c ? hlScelte(c.v) : null;
    const m = Math.min(this.molt, OG_TETTO);
    const netto = gioca ? Math.floor(this.puntata * m + 1e-6) - this.puntata : null;
    let h = `<div class="mn-pill ora"><small>ORA</small>${ogValuta(m)}${netto !== null ? `<em class="${netto >= 0 ? 'su' : 'giu'}">${netto >= 0 ? '+' : '−'}${ggb(Math.abs(netto))}</em>` : ''}</div>`;
    ['su', 'giu'].forEach(d => {
      h += sc ? `<div class="mn-pill"><small>${sc[d].t === 'pari' ? 'UGUALE' : d === 'su' ? 'ALTA ↑' : 'BASSA ↓'}</small>${ogValuta(hlMoltScelta(sc[d].p))}</div>`
        : `<div class="mn-pill vuota"><small>${d === 'su' ? 'ALTA' : 'BASSA'}</small>—</div>`;
    });
    this.$('.hl-striscia').innerHTML = h;
    const box = this.$('.hl-carta');
    box.innerHTML = '';
    const el = buildCard(c || {}, !c);
    if (gira) el.classList.add('gira');
    el.style.animation = gira ? '' : 'none';
    box.appendChild(el);
    const st = this.$('.hl-storia');
    st.innerHTML = this.storia.map((s, i) => `<div class="hl-voce${gira && i === this.storia.length - 1 ? ' nuova' : ''}">${buildCard(s.carta).outerHTML}<span class="hl-badge ${s.cls}">${s.badge}</span></div>`).join('');
    st.scrollLeft = st.scrollWidth;
    ['su', 'giu'].forEach(d => {
      const b = this.$('.hl-op[data-d="' + d + '"]'), s = sc ? sc[d] : null;
      b.className = 'hl-op ' + (s && s.t === 'pari' ? 'uguale' : d);
      b.innerHTML = s ? `${s.nome} ${s.segno}<small>${ogPerc(s.p)} · ${ogValuta(hlMoltScelta(s.p))}</small>` : (d === 'su' ? 'Più alta ↑' : 'Più bassa ↓') + '<small>—</small>';
      b.disabled = !gioca || this.busy;
    });
  }
});
ogRegistra(HL);
