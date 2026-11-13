/* ════════════════════════════════════════════════════════════════
   MOLES — 7 buche disposte 2-3-2, da 1 a 6 talpe nascoste.
   Si martella una buca: se c'è una talpa il moltiplicatore sale, le
   talpe escono a farsi vedere, rientrano e cambiano posto di nascosto;
   se la buca è vuota si perde la puntata. Si incassa quando si vuole.
   Probabilità di prenderla = talpe / 7, quindi dopo k colpi
   moltiplicatore = 0,98 × (7 / talpe)^k, troncato ai centesimi (RTP 98%),
   tetto 1.000× (incasso automatico). I conti del file erano giusti.
   Sotto le buche, per ogni colpo, una mappa 2-3-2 con dov'erano tutte
   le talpe e la buca che hai colpito (verde presa, rossa vuota).
   Una mano lasciata a metà viene incassata al ricaricamento.
   Auto: quanti colpi a mano, poi 5, 10 o 20 mani.
════════════════════════════════════════════════════════════════ */
const TL_RTP = 0.98, TL_BUCHE = 7, TL_RIGHE = [2, 3, 2];
function tlMolt(m, k) { return k <= 0 ? 1 : Math.min(Math.floor(TL_RTP * Math.pow(TL_BUCHE / m, k) * 100 + 1e-6) / 100, OG_TETTO); }
function tlPosti(m) { const idx = Array.from({ length: TL_BUCHE }, (_, i) => i); for (let i = 0; i < m; i++) { const j = i + ogCaso(TL_BUCHE - i); [idx[i], idx[j]] = [idx[j], idx[i]]; } return new Set(idx.slice(0, m)); }
const TL_TALPA = '<svg viewBox="0 0 64 72" aria-hidden="true"><defs><radialGradient id="tlCorpo" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#8a6541"/><stop offset=".6" stop-color="#6b4a2f"/><stop offset="1" stop-color="#3b2614"/></radialGradient><radialGradient id="tlPancia" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#e7cfa9"/><stop offset="1" stop-color="#a47f56"/></radialGradient></defs>' +
  '<ellipse cx="32" cy="68" rx="24" ry="5" fill="#000" fill-opacity=".5"/><path d="M10 70 C10 44 20 24 32 24 C44 24 54 44 54 70 Z" fill="url(#tlCorpo)" stroke="#2a1708" stroke-width="1.2"/>' +
  '<path d="M20 70 C21 52 27 40 32 40 C37 40 43 52 44 70 Z" fill="url(#tlPancia)" stroke="#5a3f08" stroke-width=".8"/><circle cx="23" cy="32" r="5" fill="#fff"/><circle cx="41" cy="32" r="5" fill="#fff"/>' +
  '<circle cx="24" cy="33" r="2.2" fill="#150d07"/><circle cx="40" cy="33" r="2.2" fill="#150d07"/><ellipse cx="32" cy="42" rx="5.5" ry="4" fill="#f08aa5" stroke="#7a2f45" stroke-width=".8"/>' +
  '<rect x="28" y="47" width="3.6" height="6.5" rx="1.2" fill="#fff6c9" stroke="#7a5408" stroke-width=".6"/><rect x="32.4" y="47" width="3.6" height="6.5" rx="1.2" fill="#fff6c9" stroke="#7a5408" stroke-width=".6"/>' +
  '<path d="M8 42 C5 38 5 33 8 30 C11 33 13 37 13 41 Z" fill="url(#tlCorpo)"/><path d="M56 42 C59 38 59 33 56 30 C53 33 51 37 51 41 Z" fill="url(#tlCorpo)"/></svg>';
const TL_MARTELLO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="30" y="36" width="4" height="22" rx="1.5" fill="#6b4a2f" stroke="#2a1708" stroke-width=".8"/><rect x="16" y="20" width="32" height="16" rx="3" fill="#a97c1b" stroke="#2a1708" stroke-width="1.2"/><rect x="19" y="23" width="26" height="3" rx="1" fill="#fff" fill-opacity=".35"/></svg>';
const TL_STELLA = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 L19 12 L30 12 L21 19 L24 29 L16 23 L8 29 L11 19 L2 12 L13 12 Z" fill="#f9df85" stroke="#c79a35" stroke-width=".8"/></svg>';

const TL = Object.assign(ogBase('talpe', { titolo: 'Moles', icona: '🔨', pref: 'tl', auto: true,
  tasti: 'Tasti: Spazio/Invio gioca o incassa · 1-7 buca · R colpo a caso · ↑↓ puntata · A auto · Esc ferma l\'auto' }), {
  talpe: 3, fase: 'bet', mano: null, colpiAuto: 3, pausaAuto: 750,

  inGioco() { return this.fase === 'play'; },
  puntataInGioco() { return this.mano && this.fase !== 'bet' ? this.mano.puntata : 0; },
  stato() { return this.fase === 'play' && this.mano ? { g: 'talpe', puntata: this.mano.puntata, molt: tlMolt(this.mano.talpe, this.mano.k) } : null; },
  azzera() { if (this.fase === 'over') { this.fase = 'bet'; this.mano = null; this.pulisciBuche(); } },
  benvenuto() { return 'Scegli quante talpe nascondere. Io lucido il martello.'; },
  infoModoAuto() { return 'Scegli quanti colpi do a ogni mano, poi 5, 10 o 20 mani: martello io.'; },
  infoAuto() { return this.colpiAuto + (this.colpiAuto === 1 ? ' colpo' : ' colpi') + ' a mano, poi incasso ' + ogValuta(tlMolt(this.talpe, this.colpiAuto)); },
  dopo() {
    try { const c = JSON.parse(localStorage.getItem('biscaTalpe.v1')) || {}; if (c.talpe >= 1 && c.talpe <= 6) this.talpe = c.talpe; if (c.colpi >= 1 && c.colpi <= 8) this.colpiAuto = c.colpi; } catch (e) {}
    const s = this.$('.tl-colpi');
    s.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(x => `<option value="${x}">${x} ${x === 1 ? 'colpo' : 'colpi'}</option>`).join('');
    s.onchange = e => { this.colpiAuto = +e.target.value; this.salva(); this.aggiorna(); };
  },
  salva() { try { localStorage.setItem('biscaTalpe.v1', JSON.stringify({ talpe: this.talpe, colpi: this.colpiAuto })); } catch (e) {} },

  htmlSx() {
    let i = 0;
    const righe = TL_RIGHE.map(n => '<div class="tl-riga">' + Array.from({ length: n }, () => { const b = i++; return `<button type="button" class="tl-buca" data-i="${b}" onclick="ORIGINALI.talpe.colpisci(${b})" aria-label="Buca ${b + 1}"><span class="tl-talpa">${TL_TALPA}</span><span class="tl-fx"></span></button>`; }).join('') + '</div>').join('');
    return `<div class="og-striscia tl-striscia"></div><div class="og-quadro"><div class="tl-campo">${righe}</div><div class="tl-storia" aria-label="Dov'erano le talpe a ogni colpo"></div></div>`;
  },
  htmlDx() {
    return `<div class="mn-riga"><span class="mn-lbl">Talpe</span><div class="mn-seg tl-talpe">${[1, 2, 3, 4, 5, 6].map(x => `<button type="button" class="bet-tool" data-m="${x}" onclick="ORIGINALI.talpe.cambiaTalpe(${x})">${x}</button>`).join('')}</div></div>
      <div class="mn-riga"><span class="mn-lbl">Colpo</span><span class="og-info tl-info"></span></div>
      <div class="mn-riga solo-auto" hidden><span class="mn-lbl">Colpi</span><select class="mn-scelta og-riga-sel tl-colpi" aria-label="Colpi per mano"></select></div>`;
  },
  cambiaTalpe(m) {
    if (this.occupato() || m === this.talpe || m < 1 || m > 6) return;
    this.talpe = m; this.azzera(); this.salva(); sfxChip(); this.aggiorna();
  },
  pulisciBuche() {
    if (!this.pronto) return;
    this.$$('.tl-buca').forEach(b => { b.classList.remove('su', 'martello', 'polvere', 'presa', 'vuota'); b.querySelector('.tl-fx').innerHTML = ''; });
  },
  mostraTalpe(posti, colpita, presa) {
    this.pulisciBuche();
    posti.forEach(i => this.$('.tl-buca[data-i="' + i + '"]').classList.add('su'));
    const b = this.$('.tl-buca[data-i="' + colpita + '"]');
    if (presa) { b.classList.add('presa'); b.querySelector('.tl-fx').innerHTML = TL_STELLA; }
    else { b.classList.add('polvere', 'vuota'); b.querySelector('.tl-fx').innerHTML = '💨'; }
  },

  inizia() {
    this.azzera();
    const p = this.paga();
    if (!p) return false;
    this.mano = { puntata: p, talpe: this.talpe, k: 0, posti: tlPosti(this.talpe), storia: [] };
    this.fase = 'play';
    memScrivi();
    this.pulisciBuche();
    ogTono(330, .1, 'square', .04); ogTono(440, .12, 'square', .04, .08);
    this.msg(ogPesca(['Martello in mano: le talpe sono sottoterra.', 'Buona fortuna... o forse no. Bussa e spera.', 'Giù la moneta... e occhio alle buche vuote.']));
    this.aggiorna();
    return true;
  },
  async colpisci(i) {
    const m = this.mano;
    if (this.fase !== 'play' || this.busy || !m) return;
    if (this.modo === 'auto' && !this.autoOn) return;
    this.busy = true;
    this.pulisciBuche();
    const b = this.$('.tl-buca[data-i="' + i + '"]');
    b.classList.add('martello'); b.querySelector('.tl-fx').innerHTML = TL_MARTELLO;
    this.aggiorna();
    await ogAttesa(210);
    const presa = m.posti.has(i), posti = new Set(m.posti);
    m.storia.push({ posti: [...posti], colpita: i, presa });
    if (presa) {
      m.k++;
      m.posti = tlPosti(m.talpe);   // cambiano posto di nascosto
      if (tlMolt(m.talpe, m.k) < OG_TETTO) memScrivi();
    }
    this.mostraTalpe(posti, i, presa);
    if (!presa) {
      ogTono(300, .25, 'sine', .06);
      this.aggiorna();
      await ogAttesa(900);
      this.busy = false;
      this.fine('vuota');
      return;
    }
    ogTono(180, .1, 'square', .1); ogTono(90, .15, 'sawtooth', .08, .02);
    const molt = tlMolt(m.talpe, m.k);
    if (!this.autoOn) this.msg(molt >= 5 ? ogPesca(['Incassa, scemo!', 'Il Tromba ti guarda e ride: incassi?', 'Ti stai montando la testa... incassa!'])
      : ogPesca(['Toc! Presa in testa.', 'Ancora viva? Dài ancora.', 'Il Tromba sorride... per ora.', 'Che martellata! Incassi o tiri ancora?']));
    this.aggiorna();
    await ogAttesa(720);
    if (molt >= OG_TETTO) { this.busy = false; this.fine('tetto'); return; }
    this.pulisciBuche();
    await ogAttesa(220);
    this.busy = false;
    this.aggiorna();
  },
  aCaso() { if (this.fase === 'play' && !this.busy) return this.colpisci(ogCaso(TL_BUCHE)); },
  fine(tipo) {
    const m = this.mano, molt = tipo === 'vuota' ? 0 : tlMolt(m.talpe, m.k), v = Math.floor(m.puntata * molt + 1e-6);
    this.fase = 'over';
    if (tipo !== 'vuota') this.pulisciBuche();   // se perdi le talpe restano fuori a sfotterti
    this.chiudi(m.puntata, molt, tipo === 'vuota' ? ogPesca(['Buca vuota! Perdi ' + ggb(m.puntata) + '. Il Tromba ringrazia.', 'Martellata a vuoto! Via ' + ggb(m.puntata) + '.', 'La talpa ride sottoterra. Perdi ' + ggb(m.puntata) + '.'])
      : (tipo === 'tetto' ? 'Tetto di 1.000×: incasso automatico, ' : 'Incassati ') + ggb(v) + ' (' + ogValuta(molt) + ').');
  },
  giocaManuale() {
    if (this.fase === 'play') { if (this.mano.k > 0) this.fine('incasso'); return; }
    this.inizia();
  },
  async manoAuto() {
    if (!this.inizia()) return false;
    await ogAttesa(300);
    for (let t = 0; t < this.colpiAuto && this.fase === 'play'; t++) { await this.aCaso(); if (this.fase === 'play') await ogAttesa(200); }
    if (this.fase === 'play') this.fine('incasso');
    return true;
  },

  principale() {
    if (this.fase === 'play') {
      const m = this.mano;
      return m.k ? { html: 'Incassa <small>' + ggb(Math.floor(m.puntata * tlMolt(m.talpe, m.k) + 1e-6)) + '</small>', incassa: true } : { html: '<span class="piccolo">Martella una buca</span>', disabled: true };
    }
    return { html: 'Gioca', disabled: !run || balance < this.bet() };
  },
  secondario() { return this.modo === 'auto' ? null : { html: 'Colpo<br>a caso', disabled: this.fase !== 'play' || this.busy }; },
  azioneSec() { this.aCaso(); },
  tasto(k) {
    if (k === 'r') { this.aCaso(); return true; }
    if (/^[1-7]$/.test(k) && this.modo !== 'auto') { this.colpisci(+k - 1); return true; }
    return false;
  },

  disegna(fermo) {
    const m = this.mano, talpe = m ? m.talpe : this.talpe, k = m ? m.k : 0, gioca = this.fase === 'play';
    const ora = tlMolt(talpe, k), netto = gioca ? Math.floor(m.puntata * ora + 1e-6) - m.puntata : null;
    let h = `<div class="mn-pill ora"><small>ORA</small>${ogValuta(ora)}${netto !== null ? `<em class="${netto >= 0 ? 'su' : 'giu'}">${netto >= 0 ? '+' : '−'}${ggb(Math.abs(netto))}</em>` : ''}</div>`;
    for (let j = 1; j <= 4; j++) h += `<div class="mn-pill"><small>+${j}</small>${ogValuta(tlMolt(talpe, k + j))}</div>`;
    this.$('.tl-striscia').innerHTML = h;
    this.$$('.tl-buca').forEach(b => { b.disabled = !gioca || this.busy || (this.modo === 'auto' && !this.autoOn) || this.autoOn; });
    // mappe 2-3-2: dov'erano tutte le talpe e quale buca hai colpito
    this.$('.tl-storia').innerHTML = (m ? m.storia : []).map(s => {
      let i = 0;
      return `<span class="tl-mappa${s.presa ? '' : ' no'}">` + TL_RIGHE.map(n => '<div>' + Array.from({ length: n }, () => { const b = i++; return `<i class="${s.posti.includes(b) ? 't' : ''}${b === s.colpita ? ' c' : ''}"></i>`; }).join('') + '</div>').join('') + '</span>';
    }).join('');
    this.$$('.tl-talpe button').forEach(b => { b.classList.toggle('scelto', +b.dataset.m === talpe); b.disabled = !fermo; });
    this.$('.tl-info').innerHTML = 'prendi la talpa ' + ogPerc(talpe / TL_BUCHE) + ' · ' + ogValuta(tlMolt(talpe, 1)) + ' al primo colpo';
    const s = this.$('.tl-colpi'); s.value = this.colpiAuto; s.disabled = !fermo;
  },
});
ogRegistra(TL);
