/*
 * ════════════════════════════════════════════════════════════════
 *  RADIO GOGOBAR · mini player per le pagine dei giochi
 * ════════════════════════════════════════════════════════════════
 *
 *  Suona i brani della sezione Musica (contenuti.js) dentro un gioco.
 *  Per aggiungerla a una pagina basta una riga prima di </body>:
 *
 *      <script src="../../js/radio.js?v=11"></script>
 *
 *  Il pulsante:
 *   - se nella pagina c'è un elemento con  data-gogobar-radio
 *     (es. <button class="top-btn" data-gogobar-radio>📻</button>),
 *     la radio usa quello, con lo stile della pagina;
 *   - altrimenti mette un pulsantino rotondo in basso a sinistra.
 *
 *  Mentre la radio suona, la musica del gioco (<audio id="musica">
 *  o con l'attributo data-musica) viene silenziata, e torna quando
 *  la radio si ferma. Il gioco non deve fare niente.
 */
(function () {
  if (window.GoGoBarRadio) return;
  const me = document.currentScript;
  const radice = new URL('../', me.src);            // cartella principale del sito
  const versione = new URL(me.src).search || '';

  function avvia() {
    const TUTTI = (typeof TUTTI_I_BRANI !== 'undefined') ? TUTTI_I_BRANI
      : ((typeof CONTENUTI !== 'undefined' && CONTENUTI.musica) || []).flatMap(a =>
          a.brani ? a.brani.map(b => Object.assign({ album: a.album }, b)) : [a]);
    const brani = TUTTI.filter(b => b.file);
    if (!brani.length) return;
    costruisci(brani);
  }

  // contenuti.js serve per la lista dei brani: se la pagina non l'ha già, lo carico io
  if (typeof CONTENUTI !== 'undefined') avvia();
  else {
    const s = document.createElement('script');
    s.src = new URL('contenuti.js' + versione, radice).href;
    s.onload = avvia;
    document.head.appendChild(s);
  }

  function costruisci(brani) {
    const src = b => /^(https?:)?\/\//.test(b.file) ? b.file : new URL('musica/brani/' + b.file, radice).href;
    const mmss = s => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';
    const CHIAVE = 'gogobarRadio.v1';
    const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch (e) { return {}; } };
    const scrivi = o => { try { localStorage.setItem(CHIAVE, JSON.stringify(o)); } catch (e) {} };

    const audio = new Audio();
    audio.preload = 'none';
    let corrente = Math.min(Math.max(leggi().i | 0, 0), brani.length - 1);
    let casuale = !!leggi().casuale;
    let mazzo = [];          // ordine casuale ancora da suonare
    const storico = [];      // brani già suonati, per tornare indietro in casuale

    // ── interfaccia (shadow DOM: gli stili del gioco non la toccano) ──
    const host = document.createElement('div');
    host.id = 'gogobar-radio-host';
    host.style.cssText = 'position:fixed;inset:auto;z-index:2147483000;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .fab {
    position: fixed; left: 14px; bottom: 14px; width: 46px; height: 46px; border-radius: 50%;
    border: 1px solid #3a3a33; background: #161614; color: #e4b33c; cursor: pointer;
    display: grid; place-items: center; box-shadow: 0 6px 20px rgba(0,0,0,.5);
    transition: transform .15s, border-color .2s;
  }
  .fab[hidden] { display: none; }
  .fab:hover { transform: scale(1.06); border-color: #e4b33c; }
  .fab svg { width: 22px; height: 22px; }
  .fab.on svg { animation: gira 3s linear infinite; }
  @keyframes gira { to { transform: rotate(360deg); } }
  .pannello {
    position: fixed; width: min(320px, calc(100vw - 24px)); max-height: min(70vh, 460px);
    display: none; flex-direction: column; gap: 12px; padding: 16px;
    background: rgba(18,18,16,.97); color: #f0ead6; border: 1px solid #3a3a33; border-radius: 18px;
    box-shadow: 0 18px 50px rgba(0,0,0,.6); backdrop-filter: blur(8px);
    font: 400 14px/1.35 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .pannello.aperto { display: flex; }
  .testa { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .kicker { font: 500 10.5px/1 'DM Mono', ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; color: #e4b33c; }
  .chiudi { background: none; border: 0; color: #77715f; font-size: 20px; line-height: 1; cursor: pointer; padding: 2px 4px; }
  .chiudi:hover { color: #f0ead6; }
  .titolo { font: 700 19px/1.1 'Fredoka', system-ui, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .artisti { color: #c8bfa8; font-size: 12.5px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .barra { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font: 11px 'DM Mono', ui-monospace, monospace; color: #c8bfa8; }
  input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; border-radius: 99px; background: #2a2a27; cursor: pointer;
    background-image: linear-gradient(#e4b33c, #e4b33c); background-size: var(--p, 0%) 100%; background-repeat: no-repeat; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%; background: #f6d77a; border: 0; }
  input[type=range]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: #f6d77a; border: 0; }
  .tasti { display: flex; justify-content: center; align-items: center; gap: 10px; }
  .tasti button { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #3a3a33; background: none; color: #f0ead6; cursor: pointer; display: grid; place-items: center; }
  .tasti button:hover { border-color: #e4b33c; color: #f6d77a; }
  .tasti button.play { width: 52px; height: 52px; background: #e4b33c; border-color: #e4b33c; color: #1a1408; }
  .tasti svg { width: 16px; height: 16px; fill: currentColor; }
  .tasti .play svg { width: 20px; height: 20px; }
  .tasti .spazio { width: 40px; }
  .tasti button.shuffle { border-color: transparent; color: #77715f; }
  .tasti button.shuffle:hover { color: #f0ead6; }
  .tasti button.shuffle[aria-pressed="true"] { color: #e4b33c; border-color: #e4b33c; }
  ol { list-style: none; overflow-y: auto; margin: 0 -6px; scrollbar-width: thin; scrollbar-color: #3a3a33 transparent; }
  li button { width: 100%; display: grid; grid-template-columns: 1.6rem minmax(0,1fr) auto; gap: 8px; align-items: center; text-align: left;
    background: none; border: 0; color: inherit; font: inherit; padding: 7px 6px; border-radius: 9px; cursor: pointer; }
  li button:hover { background: #1f1f1c; }
  li .n { font: 11px 'DM Mono', ui-monospace, monospace; color: #77715f; text-align: center; }
  li .t { font: 600 13.5px 'Fredoka', system-ui, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .d { font: 11px 'DM Mono', ui-monospace, monospace; color: #77715f; }
  li.attivo button { background: #22221e; }
  li.attivo .t, li.attivo .n { color: #f6d77a; }
  .album { font: 500 10.5px 'DM Mono', ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; color: #77715f; padding: 8px 6px 4px; }
  a.tutto { color: #c8bfa8; font: 500 10.5px 'DM Mono', ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; text-decoration: none; text-align: center; }
  a.tutto:hover { color: #e4b33c; }
</style>
<button class="fab" part="fab" aria-label="Radio GoGoBar" hidden>
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#0d0d0c" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#2a2a27"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="#0d0d0c"/></svg>
</button>
<div class="pannello" role="dialog" aria-label="Radio GoGoBar">
  <div class="testa"><span class="kicker">📻 Radio GoGoBar</span><button class="chiudi" aria-label="Chiudi">×</button></div>
  <div><p class="titolo"></p><p class="artisti"></p></div>
  <div class="barra"><span class="ora">0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Posizione"><span class="tot">0:00</span></div>
  <div class="tasti">
    <button class="shuffle" aria-label="Ordine casuale" aria-pressed="false" title="Ordine casuale"><svg viewBox="0 0 24 24"><path d="M17 4l4 4-4 4V9h-2.6l-2.5 3 2.5 3H17v-3l4 4-4 4v-3h-3.4L10 14.6 6.4 19H3v-2h2.4l3.3-4L5.4 9H3V7h3.4L10 11.4 13.6 7H17z"/></svg></button>
    <button class="prev" aria-label="Precedente"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
    <button class="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg></button>
    <button class="next" aria-label="Successivo"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z"/></svg></button>
    <span class="spazio" aria-hidden="true"></span>
  </div>
  <ol></ol>
  <a class="tutto" target="_blank" rel="noopener">Apri la pagina Musica ↗</a>
</div>`;
    const $ = s => root.querySelector(s);
    const pannello = $('.pannello'), fab = $('.fab'), barra = $('input'), lista = $('ol');
    $('.tutto').href = new URL('musica/', radice).href;
    document.body.appendChild(host);

    // il pulsante: quello della pagina (data-gogobar-radio) o quello rotondo
    const pagina = document.querySelector('[data-gogobar-radio]');
    const pulsante = pagina || fab;
    if (!pagina) fab.hidden = false;
    pulsante.setAttribute('aria-expanded', 'false');

    // scaletta, divisa per album
    let album;
    brani.forEach(function (b, i) {
      if (b.album !== album) {
        album = b.album;
        const l = document.createElement('li'); l.className = 'album'; l.textContent = album || 'Brani'; lista.append(l);
      }
      const li = document.createElement('li'); li.dataset.i = i;
      const bt = document.createElement('button');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = brani.slice(0, i + 1).filter(x => x.album === b.album).length;
      const t = document.createElement('span'); t.className = 't'; t.textContent = b.titolo;
      const d = document.createElement('span'); d.className = 'd'; d.textContent = b.durata || '';
      bt.append(n, t, d); li.append(bt); lista.append(li);
      bt.onclick = () => carica(i, true);
    });

    // ── apri / chiudi ──
    function posiziona() {
      const r = pulsante.getBoundingClientRect(), w = pannello.offsetWidth, h = pannello.offsetHeight;
      let x = Math.min(Math.max(12, r.left), innerWidth - w - 12);
      let y = r.bottom + 10;
      if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 10);
      pannello.style.left = x + 'px'; pannello.style.top = y + 'px';
    }
    function apri(si) {
      pannello.classList.toggle('aperto', si);
      pulsante.setAttribute('aria-expanded', String(si));
      if (si) { posiziona(); const a = lista.querySelector('li.attivo'); if (a) a.scrollIntoView({ block: 'nearest' }); }
    }
    pulsante.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); apri(!pannello.classList.contains('aperto')); });
    $('.chiudi').onclick = () => apri(false);
    addEventListener('resize', () => { if (pannello.classList.contains('aperto')) posiziona(); });
    document.addEventListener('pointerdown', e => {
      if (pannello.classList.contains('aperto') && !e.composedPath().includes(host) && !e.composedPath().includes(pulsante)) apri(false);
    });
    // i click e i tasti dentro la radio non arrivano al gioco
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'keyup', 'click'].forEach(ev =>
      host.addEventListener(ev, e => e.stopPropagation()));

    // ── riproduzione ──
    function carica(i, suona) {
      corrente = (i + brani.length) % brani.length;
      mazzo = mazzo.filter(x => x !== corrente);
      const b = brani[corrente];
      if (audio.dataset.i !== String(corrente)) {
        audio.src = src(b); audio.dataset.i = corrente;
        $('.titolo').textContent = b.titolo;
        $('.artisti').textContent = b.artisti || '';
        $('.tot').textContent = b.durata || '0:00';
        $('.ora').textContent = '0:00';
        barra.value = 0; barra.style.setProperty('--p', '0%');
        lista.querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('attivo', +li.dataset.i === corrente));
        scrivi({ i: corrente, casuale });
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: b.titolo, artist: b.artisti || 'Collettivo M.I.A.O.', album: b.album || 'GoGoBar',
            artwork: [{ src: new URL('img/maneki-neko.webp', radice).href, sizes: '689x900', type: 'image/webp' }]
          });
        }
      }
      if (suona) audio.play().catch(() => {});
    }
    const ICONA_PLAY = '<path d="M7 4v16l13-8z"/>', ICONA_PAUSA = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
    function aggiornaStato() {
      const on = !audio.paused;
      $('.play svg').innerHTML = on ? ICONA_PAUSA : ICONA_PLAY;
      $('.play').setAttribute('aria-label', on ? 'Pausa' : 'Play');
      fab.classList.toggle('on', on);
      pulsante.classList.toggle('radio-on', on);
      silenziaGioco(on);
    }
    $('.play').onclick = () => { if (audio.paused) carica(corrente, true); else audio.pause(); };
    // ── ordine casuale: pesca da un mazzo mescolato, così non ripete finché non li ha suonati tutti ──
    function mescola() {
      mazzo = brani.map((_, i) => i).filter(i => i !== corrente);
      for (let k = mazzo.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [mazzo[k], mazzo[j]] = [mazzo[j], mazzo[k]]; }
    }
    function avanti() {
      if (!casuale || brani.length < 2) return carica(corrente + 1, true);
      if (!mazzo.length) mescola();
      storico.push(corrente);
      carica(mazzo.shift(), true);
    }
    function indietro() {
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      if (casuale && storico.length) return carica(storico.pop(), true);
      carica(corrente - 1, true);
    }
    function segnaCasuale() {
      $('.shuffle').setAttribute('aria-pressed', String(casuale));
      scrivi({ i: corrente, casuale });
    }
    $('.shuffle').onclick = () => { casuale = !casuale; mazzo = []; storico.length = 0; segnaCasuale(); };
    segnaCasuale();
    $('.next').onclick = avanti;
    $('.prev').onclick = indietro;
    audio.addEventListener('play', aggiornaStato);
    audio.addEventListener('pause', aggiornaStato);
    audio.addEventListener('ended', avanti);
    audio.addEventListener('loadedmetadata', () => { $('.tot').textContent = mmss(audio.duration); });
    let trascino = false;
    audio.addEventListener('timeupdate', () => {
      if (trascino || !audio.duration) return;
      const p = audio.currentTime / audio.duration;
      barra.value = Math.round(p * 1000); barra.style.setProperty('--p', (p * 100) + '%');
      $('.ora').textContent = mmss(audio.currentTime);
    });
    barra.addEventListener('input', () => {
      trascino = true; barra.style.setProperty('--p', (barra.value / 10) + '%');
      if (audio.duration) $('.ora').textContent = mmss(barra.value / 1000 * audio.duration);
    });
    barra.addEventListener('change', () => {
      if (audio.duration) audio.currentTime = barra.value / 1000 * audio.duration;
      trascino = false;
    });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => carica(corrente, true));
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => $('.prev').click());
      navigator.mediaSession.setActionHandler('nexttrack', avanti);
    }

    // ── la musica del gioco tace mentre suona la radio ──
    const silenziati = new Set();
    const musicheGioco = () => [...document.querySelectorAll('audio#musica, audio[data-musica]')];
    function silenziaGioco(si) {
      if (si) musicheGioco().forEach(el => { if (!el.muted) { el.muted = true; silenziati.add(el); } });
      else { silenziati.forEach(el => { el.muted = false; }); silenziati.clear(); }
    }
    // se il gioco fa ripartire la sua musica mentre la radio suona, resta muta
    document.addEventListener('play', e => { if (!audio.paused && e.target !== audio) silenziaGioco(true); }, true);

    carica(corrente, false);
    window.GoGoBarRadio = { play: () => carica(corrente, true), pausa: () => audio.pause(), apri: () => apri(true), audio };
  }
})();
