/* ════════════════════════════════════════════════════════════════
   TORRE DEL DRAGO — sali la torre fila per fila: in ogni fila c'è una
   sola botola, le altre pietre sono sicure. 9 file.
   Facile: 4 pietre (3 sicure, 75%) · Medio: 3 pietre (2 sicure, 66,7%)
   Difficile: 2 pietre (1 sicura, 50%).
   Moltiplicatore dopo k file = 0,98 / (probabilità sicura)^k, arrotondato
   ai centesimi (RTP 98% a qualunque altezza ti fermi). Il file di prima
   moltiplicava gli scalini già arrotondati (1,31 × 1,31 × ...): così
   l'RTP scendeva fila dopo fila (in cima a Difficile pagava 426× invece
   di 501,76×). Ora: Facile 1,31 · 1,74 · 2,32 ... 13,05×,
   Medio 1,47 · 2,21 · 3,31 ... 37,67×, Difficile 1,96 · 3,92 ... 501,76×.
   Si incassa quando si vuole; una mano lasciata a metà viene incassata
   al ricaricamento. Auto: scegli fino a che fila salire e 5, 10 o 20 mani.
════════════════════════════════════════════════════════════════ */
const TR_RTP = 0.98, TR_FILE = 9;
const TR_DIFF = { facile: { nome: 'Facile', col: 4 }, medio: { nome: 'Medio', col: 3 }, difficile: { nome: 'Difficile', col: 2 } };
const trProb = d => (TR_DIFF[d].col - 1) / TR_DIFF[d].col;
function trMolt(d, k) { return k <= 0 ? 1 : Math.min(Math.round(TR_RTP / Math.pow(trProb(d), k) * 100 + 1e-6) / 100, OG_TETTO); }

const TR = Object.assign(ogBase('torre', { titolo: 'Torre del Drago', icona: '🐲', pref: 'tr', auto: true,
  tasti: 'Tasti: Spazio/Invio gioca o incassa · 1-4 pietra · R pietra a caso · ↑↓ puntata · A auto · Esc ferma l\'auto' }), {
  diff: 'facile', fase: 'bet', mano: null, meta: 3, pausaAuto: 850,

  inGioco() { return this.fase === 'play'; },
  puntataInGioco() { return this.mano && this.fase !== 'bet' ? this.mano.puntata : 0; },
  stato() { return this.fase === 'play' && this.mano ? { g: 'torre', puntata: this.mano.puntata, molt: trMolt(this.mano.diff, this.mano.k) } : null; },
  azzera() { if (this.fase === 'over') { this.fase = 'bet'; this.mano = null; } },
  benvenuto() { return 'Scala la torre. Il drago si mangia chi sbaglia pietra.'; },
  infoModoAuto() { return 'Scegli fino a che fila salgo, poi 5, 10 o 20 mani. Io scelgo le pietre a caso.'; },
  infoAuto() { return 'Salgo fino alla fila ' + this.meta + ' e incasso ' + ogValuta(trMolt(this.diff, this.meta)); },
  dopo() {
    try { const c = JSON.parse(localStorage.getItem('biscaTorre.v1')) || {}; if (TR_DIFF[c.diff]) this.diff = c.diff; if (c.meta >= 1 && c.meta <= TR_FILE) this.meta = c.meta; } catch (e) {}
    this.costruisciTorre();
    const s = this.$('.tr-meta');
    s.innerHTML = Array.from({ length: TR_FILE }, (_, i) => `<option value="${i + 1}">fila ${i + 1}${i + 1 === TR_FILE ? ' (cima)' : ''}</option>`).join('');
    s.onchange = e => { this.meta = +e.target.value; this.salva(); this.aggiorna(); };
  },
  salva() { try { localStorage.setItem('biscaTorre.v1', JSON.stringify({ diff: this.diff, meta: this.meta })); } catch (e) {} },

  htmlSx() { return `<div class="og-striscia tr-striscia"></div><div class="tr-torre"><div class="tr-merli"></div><div class="tr-drago">🐲</div><div class="tr-file"></div></div>`; },
  htmlDx() {
    return `<div class="mn-riga"><span class="mn-lbl">Livello</span><div class="mn-seg tr-diff">${Object.entries(TR_DIFF).map(([k, d]) => `<button type="button" class="bet-tool" data-d="${k}" onclick="ORIGINALI.torre.cambiaDiff('${k}')">${d.nome}</button>`).join('')}</div></div>
      <div class="mn-riga"><span class="mn-lbl">Pietre</span><span class="og-info tr-info"></span></div>
      <div class="mn-riga solo-auto" hidden><span class="mn-lbl">Sali fino</span><select class="mn-scelta og-riga-sel tr-meta" aria-label="Fino a che fila sale l'auto"></select></div>`;
  },
  costruisciTorre() {
    const col = TR_DIFF[this.mano ? this.mano.diff : this.diff].col, box = this.$('.tr-file');
    if (box.dataset.col === String(col)) return;
    box.dataset.col = col;
    let h = '';
    for (let r = TR_FILE - 1; r >= 0; r--) {
      h += `<div class="tr-fila" data-r="${r}" style="grid-template-columns:repeat(${col},1fr);max-width:${col * 96}px">`;
      for (let c = 0; c < col; c++) h += `<button type="button" class="tr-pietra" data-c="${c}" onclick="ORIGINALI.torre.tocca(${r},${c})" aria-label="Fila ${r + 1}, pietra ${c + 1}"></button>`;
      h += '</div>';
    }
    box.innerHTML = h;
  },
  cambiaDiff(d) {
    if (this.occupato() || !TR_DIFF[d] || d === this.diff) return;
    this.diff = d; this.azzera(); this.salva(); this.costruisciTorre();
    sfxChip(); this.aggiorna();
    this.msg('Difficoltà <b>' + TR_DIFF[d].nome + '</b>: ' + TR_DIFF[d].col + ' pietre, una è la botola.');
  },

  inizia() {
    this.azzera();
    const p = this.paga();
    if (!p) return false;
    const col = TR_DIFF[this.diff].col;
    this.mano = { puntata: p, diff: this.diff, k: 0, botole: Array.from({ length: TR_FILE }, () => ogCaso(col)), scelte: [], presa: null };
    this.fase = 'play';
    memScrivi();
    this.costruisciTorre();
    ogTono(330, .1, 'square', .04); ogTono(440, .12, 'square', .04, .08);
    this.msg(ogPesca(['Si scala! Fila uno: tocca una pietra e prega.', 'Buona fortuna. O forse no. Il drago ti guarda.', 'Giù la moneta e su con le zampe.']));
    this.aggiorna();
    return true;
  },
  tocca(r, c) {
    const m = this.mano;
    if (this.fase !== 'play' || this.busy || !m || r !== m.k) return;
    if (this.modo === 'auto' && !this.autoOn) return;
    if (m.botole[r] === c) { m.presa = { r, c }; this.fine('botola'); return; }
    m.scelte[r] = c; m.k++;
    ogTono(520 + m.k * 38, .16, 'triangle', .08); ogTono(780 + m.k * 50, .2, 'sine', .04, .05);
    const molt = trMolt(m.diff, m.k);
    if (m.k >= TR_FILE) { this.fine('cima'); return; }
    if (molt >= OG_TETTO) { this.fine('tetto'); return; }
    memScrivi();
    if (!this.autoOn) this.msg(molt >= 5 ? ogPesca(['Incassa, scemo! Il drago s\'è svegliato.', 'Quassù puzza di zolfo. Incassi?', 'Troppo in alto. Il Tromba ti guarda e ride.'])
      : ogPesca(['Liscia. Sali ancora.', 'Pietra giusta. Il drago rosica.', 'Ancora vivo? Che noia.', 'Sali, sali... ma non montarti la testa.']));
    this.aggiorna();
  },
  aCaso() { if (this.fase === 'play' && this.mano && !this.busy) this.tocca(this.mano.k, ogCaso(TR_DIFF[this.mano.diff].col)); },
  fine(tipo) {
    const m = this.mano, molt = tipo === 'botola' ? 0 : trMolt(m.diff, m.k), v = Math.floor(m.puntata * molt + 1e-6);
    this.fase = 'over';
    const dr = this.$('.tr-drago');
    dr.classList.remove('felice', 'ruggito'); void dr.offsetWidth; dr.classList.add(tipo === 'botola' ? 'ruggito' : 'felice');
    this.chiudi(m.puntata, molt, tipo === 'botola' ? ogPesca(['CRACK! Fila ' + (m.k + 1) + ': botola. Il drago si mangia ' + ggb(m.puntata) + '.', 'Il drago ride, tu piangi: perdi ' + ggb(m.puntata) + '.'])
      : tipo === 'cima' ? 'Torre completa! Il drago ti saluta pure: vinci ' + ggb(v) + ' (' + ogValuta(molt) + ').'
      : (tipo === 'tetto' ? 'Tetto di 1.000×: incasso automatico, ' : 'Ti fermi con ') + ggb(v) + ' (' + ogValuta(molt) + ').');
  },
  giocaManuale() {
    if (this.fase === 'play') { if (this.mano.k > 0) this.fine('incasso'); return; }
    this.inizia();
  },
  async manoAuto() {
    if (!this.inizia()) return false;
    await ogAttesa(350);
    while (this.fase === 'play' && this.mano.k < this.meta) { this.aCaso(); if (this.fase === 'play') await ogAttesa(380); }
    if (this.fase === 'play') this.fine('incasso');
    return true;
  },

  principale() {
    if (this.fase === 'play') {
      const m = this.mano;
      return m.k ? { html: 'Incassa <small>' + ggb(Math.floor(m.puntata * trMolt(m.diff, m.k) + 1e-6)) + '</small>', incassa: true } : { html: '<span class="piccolo">Sali una fila</span>', disabled: true };
    }
    return { html: 'Gioca', disabled: !run || balance < this.bet() };
  },
  secondario() {
    if (this.modo === 'auto') return null;
    return { html: 'Pietra<br>a caso', disabled: this.fase !== 'play' || this.busy };
  },
  azioneSec() { this.aCaso(); },
  tasto(k) {
    if (k === 'r') { this.aCaso(); return true; }
    if (/^[1-4]$/.test(k) && this.fase === 'play' && this.modo !== 'auto') { const c = +k - 1; if (c < TR_DIFF[this.mano.diff].col) this.tocca(this.mano.k, c); return true; }
    return false;
  },

  disegna(fermo) {
    const m = this.mano, d = m ? m.diff : this.diff, k = m ? m.k : 0, gioca = this.fase === 'play', fine = this.fase === 'over';
    this.costruisciTorre();
    const ora = trMolt(d, k), netto = gioca ? Math.floor(m.puntata * ora + 1e-6) - m.puntata : null;
    let h = `<div class="mn-pill ora"><small>ORA</small>${ogValuta(ora)}${netto !== null ? `<em class="${netto >= 0 ? 'su' : 'giu'}">${netto >= 0 ? '+' : '−'}${ggb(Math.abs(netto))}</em>` : ''}</div>`;
    for (let j = 1; j <= 4; j++) h += k + j <= TR_FILE ? `<div class="mn-pill"><small>+${j}</small>${ogValuta(trMolt(d, k + j))}</div>` : `<div class="mn-pill vuota"><small>+${j}</small>—</div>`;
    this.$('.tr-striscia').innerHTML = h;
    this.$$('.tr-fila').forEach(f => {
      const r = +f.dataset.r, attiva = gioca && r === k && !this.busy && !(this.modo === 'auto' && !this.autoOn);
      f.classList.toggle('attiva', gioca && r === k);
      f.querySelectorAll('.tr-pietra').forEach(b => {
        const c = +b.dataset.c;
        let cls = 'tr-pietra', ic = '';
        if (m && r < m.k) { if (m.scelte[r] === c) { cls += ' scelta'; ic = '<img src="assets/slot/ggb.webp?v=3" alt="">'; } else cls += ' nascosta'; }
        else if (m && m.presa && m.presa.r === r && m.presa.c === c) { cls += ' botola'; ic = '<span>🔥</span>'; }
        else if (fine && m && m.botole[r] === c) { cls += ' botola fantasma'; ic = '<span>🔥</span>'; }
        if (b.className !== cls) { b.className = cls; b.innerHTML = ic; }
        b.disabled = !attiva;
      });
    });
    this.$$('.tr-diff button').forEach(b => { b.classList.toggle('scelto', b.dataset.d === d); b.disabled = !fermo; });
    const D = TR_DIFF[d];
    this.$('.tr-info').innerHTML = D.col + ' pietre, ' + (D.col - 1) + (D.col - 1 === 1 ? ' sicura' : ' sicure') + ' · ' + ogPerc(trProb(d)) + '<br>in cima ' + ogValuta(trMolt(d, TR_FILE));
    const s = this.$('.tr-meta'); s.value = this.meta; s.disabled = !fermo;
  },
});
ogRegistra(TR);
