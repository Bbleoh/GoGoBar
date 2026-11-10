/* ════════════════════════════════════════════════════════════════
   GOGOLDBAR (GGB) — la valuta di GoGoBar
   Script classico, da caricare dopo js/account.js.

   Il portafogli è dell'account GoGoBar (niente account = niente GGB) ed è
   lo stesso per tutto il sito: home (clicker sul maneki neko), bisca,
   sblocchi, area personale.

   Firebase: ggb/<idAccount> = {
     saldo, click, guadagnati, spesi,     ← numeri, cambiati solo con incrementi lato server
     trofei:    { id: data },             ← ogni trofeo aggiunge GGB per click
     sbloccati: { id: data },             ← giochi e album pagati
     brani:     { slug: data },           ← brani ascoltati (per i trofei degli album)
     video:     { idYoutube: data },      ← video visti (per i trofei delle playlist)
     creato
   }

   API (window.GoGoldBar):
     pronto                 → Promise, risolta quando il portafogli è caricato (o non c'è account)
     stato()                → { account, saldo, perClick, click, guadagnati, spesi, trofei, sbloccati, brani, video }
     saldo()                → numero, oppure null senza account
     perClick()             → GGB guadagnate a ogni click sul maneki neko
     clic()                 → registra un click; ritorna le GGB guadagnate (0 senza account)
     aggiungi(n)            → Promise<saldo>: n positivo o negativo (la bisca); rifiuta se il saldo andrebbe sotto zero
     sbloccato(id)          → true se 'corrimarf' / 'reedit' è già sbloccato
     sblocca(id)            → Promise: paga e sblocca
     chiediSblocco(id)      → apre la finestra "Sblocca per N GGB"; Promise<true se sbloccato>
     albumBloccato(nome)    → true se l'album è a pagamento e non ancora sbloccato
     sbloccoDi(album)       → id dello sblocco che apre quell'album (o null)
     segui(audio, fn)       → conta i brani ascoltati su quell'<audio>; fn() = file del brano in corso
     trofeo(id)             → assegna un trofeo (una volta sola)
     ascoltato(file)        → un brano ascoltato fino in fondo
     visto(idYoutube)       → un video visto fino in fondo
     catalogo()             → [{ id, nome, desc, valore, gruppo, ok, data, fatti, totale }]
     SBLOCCHI               → { id: { nome, prezzo, album? } }
     formatta(n)            → '1.234'
     icona                  → <svg> del lingotto, da mettere in innerHTML
     suCambio(fn)           → fn(stato) a ogni cambio, anche da altre schede
     aggiorna()             → ricarica dal database
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GoGoldBar) return;
  var A = window.GoGoAccount;
  var me = document.currentScript;
  var radice = me ? new URL('../', me.src).href : '/';

  var SBLOCCHI = {
    corrimarf: { nome: 'Corri Marf!', prezzo: 5000 },
    reedit:    { nome: 'Re-edit 2026', prezzo: 10000, album: 'Re-edit 2026' }
  };
  var MEM = 'gogoldbar.v1';          // copia del portafogli per mostrarlo subito e tra le schede
  var PEND = 'gogoldbar.click.v1';   // click non ancora spediti: { id, ggb, click }
  var OSPITE = 'gogoldbar.ospite.v1';// brani e video visti prima di avere un account

  var d = null, id = null, ascoltatori = [], pronto;

  function k(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, '_').replace(/^_+|_+$/g, '') || '_'; }
  function leggiLS(c) { try { return JSON.parse(localStorage.getItem(c)); } catch (e) { return null; } }
  function scriviLS(c, v) { try { localStorage.setItem(c, JSON.stringify(v)); } catch (e) {} }
  function inc(n) { return { '.sv': { increment: n } }; }
  var ORA = { '.sv': 'timestamp' };
  function formatta(n) { var x = Math.floor(Number(n) || 0); return (x < 0 ? '-' : '') + String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function contenuti() { return (typeof CONTENUTI !== 'undefined' && CONTENUTI) || null; }

  var ICONA = '<svg class="ggb-ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M2.5 18.5 6.4 9.3h11.2l3.9 9.2z" fill="#e4b33c"/>' +
    '<path d="M6.4 9.3 8 5.5h8l1.6 3.8z" fill="#f6d77a"/>' +
    '<path d="M2.5 18.5 6.4 9.3h11.2l3.9 9.2z M6.4 9.3 8 5.5h8l1.6 3.8" fill="none" stroke="#7a5512" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M9.2 14.6h5.6" stroke="#9c6f1b" stroke-width="1.3" stroke-linecap="round"/></svg>';

  /* ── trofei ── */
  // valore in GGB per click, deciso dall'id: così vale anche nelle pagine senza contenuti.js
  function valore(tid) { return /^(cm_|bisca_)/.test(tid) ? 5 : 1; }
  var TROFEI_GIOCHI = [
    { id: 'cm_epico',          gruppo: 'Giochi', nome: 'Corri Marf! · Platino',     desc: 'Completa tutti gli achievement comuni, rari ed epici di Corri Marf!' },
    { id: 'cm_leggendario',    gruppo: 'Giochi', nome: 'Corri Marf! · Leggenda',    desc: 'Completa tutti gli achievement leggendari di Corri Marf!' },
    { id: 'cm_nascosti',       gruppo: 'Giochi', nome: 'Corri Marf! · Segreti',     desc: 'Trova tutti gli achievement nascosti di Corri Marf!' },
    { id: 'bisca_epico',       gruppo: 'Giochi', nome: 'Bisca · Platino',           desc: 'Completa tutti i trofei comuni, rari ed epici della Bisca der Tromba' },
    { id: 'bisca_leggendario', gruppo: 'Giochi', nome: 'Bisca · Leggenda',          desc: 'Completa tutti i trofei leggendari della Bisca der Tromba' }
  ];
  function slugBrano(file) { return k(String(file || '').replace(/^.*\//, '').replace(/\.[^.]+$/, '')); }
  function albumBase() {   // gli album che si hanno da subito: danno un trofeo ciascuno
    var c = contenuti(); if (!c) return [];
    return (c.musica || []).filter(function (a) {
      return !albumAPagamento(a.album) && (a.brani || []).some(function (b) { return b.file; });
    });
  }
  function albumAPagamento(nome) {
    return Object.keys(SBLOCCHI).some(function (s) { return SBLOCCHI[s].album === nome; });
  }
  function catalogo() {
    var t = d && d.trofei || {}, out = [], c = contenuti();
    var brani = d && d.brani || {}, video = d && d.video || {};
    albumBase().forEach(function (a) {
      var lista = (a.brani || []).filter(function (b) { return b.file; });
      out.push({ id: 'al_' + k(a.album), gruppo: 'Musica', nome: 'Tutto ' + a.album, desc: 'Ascolta tutti i brani di ' + a.album,
        fatti: lista.filter(function (b) { return brani[slugBrano(b.file)]; }).length, totale: lista.length });
    });
    if (c) (c.video || []).forEach(function (p) {
      var lista = (p.video || []).filter(function (v) { return v.youtube && !v.inArrivo; });
      if (!lista.length) return;
      out.push({ id: 'pl_' + k(p.playlist), gruppo: 'Video', nome: 'Maratona ' + p.playlist, desc: 'Guarda tutti i video della playlist ' + p.playlist,
        fatti: lista.filter(function (v) { return video[chiaveVideo(v.youtube)]; }).length, totale: lista.length });
    });
    out.push({ id: 'banner', gruppo: 'Home', nome: 'Occhio lungo', desc: 'Prendi il +1 che ogni tanto passa nel banner della home' });
    TROFEI_GIOCHI.forEach(function (x) { out.push(Object.assign({}, x)); });
    out.forEach(function (x) { x.valore = valore(x.id); x.ok = !!t[x.id]; x.data = t[x.id] || null; });
    return out;
  }
  function perClick() {
    var t = d && d.trofei || {};
    return 1 + Object.keys(t).reduce(function (s, tid) { return s + valore(tid); }, 0);
  }

  /* ── stato ── */
  function pend() {
    var p = leggiLS(PEND);
    return p && p.id === id ? p : { id: id, ggb: 0, click: 0 };
  }
  function stato() {
    var acc = A && A.attivo ? A.stato().account : null;
    if (!acc || !d) return { account: acc, saldo: null, perClick: 1, click: 0, guadagnati: 0, spesi: 0, trofei: {}, sbloccati: {}, brani: {}, video: {} };
    var p = pend();
    return {
      account: acc, saldo: (d.saldo || 0) + p.ggb, perClick: perClick(),
      click: (d.click || 0) + p.click, guadagnati: (d.guadagnati || 0) + p.ggb, spesi: d.spesi || 0,
      trofei: d.trofei || {}, sbloccati: d.sbloccati || {}, brani: d.brani || {}, video: d.video || {}, creato: d.creato || null
    };
  }
  function avvisa() {
    var s = stato();
    ascoltatori.forEach(function (fn) { try { fn(s); } catch (e) {} });
  }
  function memorizza() { if (id && d) scriviLS(MEM, { id: id, d: d }); }

  function db(percorso, metodo, corpo, extra) { return A.db(percorso, metodo, corpo, extra); }

  function carica() {
    var acc = A && A.attivo ? A.stato().account : null;
    if (!acc) { id = null; d = null; avvisa(); return Promise.resolve(stato()); }
    if (id !== acc.id) {
      id = acc.id;
      var m = leggiLS(MEM);
      d = m && m.id === id ? m.d : null;
      if (d) avvisa();
    }
    return db('ggb/' + id).then(function (x) {
      if (!x) {   // primo accesso: nasce il portafogli
        x = {};
        return db('ggb/' + id, 'PATCH', { creato: ORA, saldo: inc(0) }).then(function () { return {}; }, function () { return {}; });
      }
      return x;
    }).then(function (x) {
      d = x || {};
      memorizza(); avvisa();
      travasaOspite();
      spedisci();
      controllaTrofei();
      return stato();
    }, function () { if (!d) d = {}; avvisa(); return stato(); });
  }

  /* ── click ── */
  var timerSped = null, inVolo = null;
  function clic() {
    if (!id || !d) return 0;
    var n = perClick(), p = pend();
    p.ggb += n; p.click += 1;
    scriviLS(PEND, p);
    avvisa();
    clearTimeout(timerSped);
    timerSped = setTimeout(spedisci, 1200);
    return n;
  }
  function spedisci() {
    if (inVolo) return inVolo;
    var p = pend();
    if (!id || !p.ggb && !p.click) return Promise.resolve();
    scriviLS(PEND, { id: id, ggb: 0, click: 0 });
    d.saldo = (d.saldo || 0) + p.ggb; d.click = (d.click || 0) + p.click; d.guadagnati = (d.guadagnati || 0) + p.ggb;
    memorizza();
    inVolo = db('ggb/' + id, 'PATCH', { saldo: inc(p.ggb), click: inc(p.click), guadagnati: inc(p.ggb) }, { keepalive: true }).then(function () {
      inVolo = null;
      if (pend().ggb) timerSped = setTimeout(spedisci, 1200);
    }, function () {
      inVolo = null;   // offline: i click tornano in coda e riparto più tardi
      var q = pend(); q.ggb += p.ggb; q.click += p.click; scriviLS(PEND, q);
      d.saldo -= p.ggb; d.click -= p.click; d.guadagnati -= p.ggb; memorizza();
      timerSped = setTimeout(spedisci, 8000);
    });
    return inVolo;
  }
  window.addEventListener('pagehide', function () { if (pend().ggb) spedisci(); });

  /* ── movimenti (bisca, sblocchi) ── */
  function insufficiente() { var e = new Error('Non hai abbastanza GoGoldBar.'); e.insufficiente = true; return e; }
  function rileggiSaldo() {
    return db('ggb/' + id + '/saldo').then(function (s) { d.saldo = Number(s) || 0; memorizza(); avvisa(); return d.saldo; });
  }
  function aggiungi(n, extra) {
    n = Math.round(Number(n) || 0);
    if (!id || !d) return Promise.reject(new Error('Serve il tuo account GoGoBar.'));
    if (!n && !extra) return Promise.resolve(stato().saldo);
    return Promise.resolve(spedisci()).then(function () {
      var corpo = Object.assign({ saldo: inc(n) }, extra || {});
      if (n > 0) corpo.guadagnati = inc(n);
      if (n < 0) corpo.spesi = inc(-n);
      return db('ggb/' + id, 'PATCH', corpo);
    }).then(function () {
      d.saldo = (d.saldo || 0) + n;
      if (n > 0) d.guadagnati = (d.guadagnati || 0) + n;
      if (n < 0) d.spesi = (d.spesi || 0) - n;
      memorizza(); avvisa();
      return d.saldo;
    }, function (e) {
      if (e && e.negato) return rileggiSaldo().then(function () { throw insufficiente(); });
      throw e;
    });
  }

  function sbloccato(sid) { return !!(d && d.sbloccati && d.sbloccati[sid]); }
  function sblocca(sid) {
    var s = SBLOCCHI[sid];
    if (!s) return Promise.reject(new Error('Sblocco sconosciuto.'));
    if (sbloccato(sid)) return Promise.resolve(true);
    if ((stato().saldo || 0) < s.prezzo) return Promise.reject(insufficiente());
    var extra = {}; extra['sbloccati/' + sid] = ORA;
    return aggiungi(-s.prezzo, extra).then(function () {
      d.sbloccati = d.sbloccati || {}; d.sbloccati[sid] = Date.now();
      memorizza(); avvisa(); return true;
    });
  }
  function regala(sid) {   // sblocco gratis (chi aveva già giocato prima delle GGB)
    if (!id || sbloccato(sid)) return Promise.resolve();
    var corpo = {}; corpo['sbloccati/' + sid] = ORA;
    return db('ggb/' + id, 'PATCH', corpo).then(function () {
      d.sbloccati = d.sbloccati || {}; d.sbloccati[sid] = Date.now(); memorizza(); avvisa();
    });
  }
  function sbloccoDi(album) {
    return Object.keys(SBLOCCHI).find(function (s) { return SBLOCCHI[s].album === album; }) || null;
  }
  // segue un <audio>: un brano conta come ascoltato se ne hai sentito davvero almeno il 60% e sei arrivato quasi in fondo
  function segui(audio, fileAttuale) {
    var file = null, acc = 0, ultimo = 0, fatto = false;
    function controlla(t) {
      if (!fatto && file && audio.duration && acc >= audio.duration * 0.6 && t >= audio.duration * 0.9) { fatto = true; segna('brani', slugBrano(file)); }
    }
    audio.addEventListener('timeupdate', function () {
      var f = fileAttuale(), t = audio.currentTime;
      if (f !== file) { file = f; acc = 0; fatto = false; ultimo = t; return; }
      var dt = t - ultimo; ultimo = t;
      if (dt > 0 && dt < 1.5 && !audio.seeking) acc += dt;
      controlla(t);
    });
    audio.addEventListener('seeked', function () { ultimo = audio.currentTime; });
    audio.addEventListener('ended', function () { controlla(audio.duration); });
  }
  function albumBloccato(nome) {
    return Object.keys(SBLOCCHI).some(function (s) { return SBLOCCHI[s].album === nome && !sbloccato(s); });
  }

  // Corri Marf! era gratis: chi ha già dei progressi salvati lo trova sbloccato (scelta di Leo)
  var vecchiP = null;
  function controllaVecchi() {
    if (!id || !d || sbloccato('corrimarf') || !A.leggi) return Promise.resolve();
    if (vecchiP) return vecchiP;
    var acc = A.stato().account;
    var ck = A.chiave(acc.nome);
    vecchiP = Promise.all([A.leggi('corrimarf/giocatori/' + ck), A.leggi('corrimarf/classifica/' + ck).catch(function () { return null; })]).then(function (r) {
      var g = r[0] || {}, c = r[1] || {};
      var upg = g.upg && Object.keys(g.upg).some(function (u) { return g.upg[u] > 0; });
      if ((g.record || 0) > 0 || (g.canne || 0) > 0 || upg || (c.punti || 0) > 0) return regala('corrimarf');
    }).catch(function () { vecchiP = null; });
    return vecchiP;
  }

  /* ── trofei ── */
  function trofeo(tid) {
    if (!id || !d || !tid) return Promise.resolve(false);
    d.trofei = d.trofei || {};
    if (d.trofei[tid]) return Promise.resolve(false);
    d.trofei[tid] = Date.now(); memorizza(); avvisa();
    var x = catalogo().find(function (c) { return c.id === tid; });
    annuncia('🏆 ' + (x ? x.nome : 'Nuovo trofeo') + ' · ora guadagni ' + perClick() + ' GGB a click');
    var corpo = {}; corpo['trofei/' + tid] = ORA;
    return db('ggb/' + id, 'PATCH', corpo).then(function () { return true; }, function () { return false; });
  }
  function controllaTrofei() {
    if (!id || !d) return;
    catalogo().forEach(function (x) { if (!x.ok && x.totale && x.fatti >= x.totale) trofeo(x.id); });
  }
  function segna(ramo, chiave) {
    if (!chiave) return;
    if (!id || !d) {   // senza account: lo tengo da parte e lo passo all'account appena c'è
      var o = leggiLS(OSPITE) || {}; o[ramo] = o[ramo] || {}; o[ramo][chiave] = Date.now(); scriviLS(OSPITE, o);
      return;
    }
    d[ramo] = d[ramo] || {};
    if (d[ramo][chiave]) return;
    d[ramo][chiave] = Date.now(); memorizza(); avvisa();
    var corpo = {}; corpo[ramo + '/' + chiave] = ORA;
    db('ggb/' + id, 'PATCH', corpo).catch(function () {});
    controllaTrofei();
  }
  function travasaOspite() {
    var o = leggiLS(OSPITE);
    if (!o) return;
    try { localStorage.removeItem(OSPITE); } catch (e) {}
    ['brani', 'video'].forEach(function (r) { Object.keys(o[r] || {}).forEach(function (c) { segna(r, c); }); });
  }
  function chiaveVideo(yt) { return String(yt || '').replace(/[.$#\[\]\/]/g, '_'); }

  /* ── annunci (trofei) ── */
  var CSS = '' +
    '.ggb-ico{width:1em;height:1em;vertical-align:-.12em;display:inline-block}' +
    '.ggb-toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,140%);z-index:2147483000;background:#161614;color:#f4efe2;' +
    'border:1px solid #e4b33c;border-radius:999px;padding:.7rem 1.2rem;font:600 .95rem Fredoka,"DM Sans",system-ui,sans-serif;' +
    'box-shadow:0 14px 40px rgba(0,0,0,.55);transition:transform .45s cubic-bezier(.2,1.4,.4,1);max-width:calc(100vw - 32px);text-align:center}' +
    '.ggb-toast.on{transform:translate(-50%,0)}' +
    '.ggb-dlg{margin:auto;border:1px solid #2a2a26;border-radius:18px;background:#161614;color:#f4efe2;padding:1.4rem 1.3rem;width:min(400px,calc(100vw - 32px));' +
    'font-family:"DM Sans",system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6)}' +
    '.ggb-dlg::backdrop{background:rgba(0,0,0,.65)}' +
    '.ggb-dlg h2{font:700 1.45rem Fredoka,"DM Sans",sans-serif;margin:0 0 .6rem}' +
    '.ggb-dlg h2 span{color:#e4b33c}' +
    '.ggb-dlg p{margin:0 0 .9rem;color:#c9c0a9;line-height:1.45}' +
    '.ggb-dlg .ggb-prezzo{display:flex;align-items:center;justify-content:center;gap:.4rem;font:700 2rem Fredoka,sans-serif;color:#f6d77a;margin:.4rem 0 1rem}' +
    '.ggb-dlg .ggb-err{color:#ff8b77;min-height:1.2em;font-size:.9rem}' +
    '.ggb-dlg .ggb-btns{display:flex;flex-direction:column;gap:.5rem}' +
    '.ggb-dlg button,.ggb-dlg a.ggb-b{display:block;text-align:center;text-decoration:none;width:100%;border:1px solid #e4b33c;border-radius:999px;padding:.75rem 1rem;background:#e4b33c;color:#1a1408;' +
    'font:600 1rem Fredoka,"DM Sans",sans-serif;cursor:pointer}' +
    '.ggb-dlg button.ghost,.ggb-dlg a.ggb-b.ghost{background:none;color:#f6d77a}' +
    '.ggb-dlg button[disabled]{opacity:.5;cursor:not-allowed}';
  var stile = document.createElement('style'); stile.textContent = CSS;
  (document.head || document.documentElement).appendChild(stile);

  var toast = null, timerToast = null;
  function annuncia(testo) {
    if (!document.body) return;
    if (!toast) { toast = document.createElement('div'); toast.className = 'ggb-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = testo;
    requestAnimationFrame(function () { toast.classList.add('on'); });
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { toast.classList.remove('on'); }, 4200);
  }

  /* ── finestra "Sblocca per N GGB" ── */
  function chiediSblocco(sid) {
    var s = SBLOCCHI[sid];
    if (!s) return Promise.resolve(false);
    if (sbloccato(sid)) return Promise.resolve(true);
    return new Promise(function (fine) {
      var dlg = document.createElement('dialog'); dlg.className = 'ggb-dlg';
      var h = document.createElement('h2'); h.innerHTML = '🔒 <span></span>'; h.querySelector('span').textContent = s.nome;
      var p = document.createElement('p');
      var prezzo = document.createElement('div'); prezzo.className = 'ggb-prezzo'; prezzo.innerHTML = ICONA + '<span></span>';
      prezzo.querySelector('span').textContent = formatta(s.prezzo);
      var err = document.createElement('p'); err.className = 'ggb-err';
      var btns = document.createElement('div'); btns.className = 'ggb-btns';
      var vai = document.createElement('button'); vai.type = 'button';
      var no = document.createElement('button'); no.type = 'button'; no.className = 'ghost'; no.textContent = 'Non ora';
      var st = stato(), esito = false;
      if (!st.account) {
        p.textContent = 'Per sbloccarlo serve il tuo account GoGoBar: crealo (o entra) dalla home con 👤, poi raccogli GoGoldBar cliccando il maneki neko.';
        vai.textContent = '👤 Vai al tuo account';
        vai.onclick = function () {
          if (window.GoGoAccountUI) { dlg.close(); window.GoGoAccountUI.apri(); }
          else location.href = radice + '#account';
        };
      } else {
        var manca = s.prezzo - (st.saldo || 0);
        p.textContent = (s.album ? 'L\'album ' : '') + s.nome + ' costa ' + formatta(s.prezzo) + ' GoGoldBar. Ne hai ' + formatta(st.saldo) + '.';
        if (manca > 0) {
          err.textContent = 'Te ne mancano ' + formatta(manca) + ': clicca il maneki neko in home per raccoglierle.';
          vai.textContent = 'Vai al maneki neko';
          vai.onclick = function () { location.href = radice + '#neko'; };
        } else {
          vai.textContent = 'Sblocca';
          vai.onclick = function () {
            vai.disabled = true; vai.textContent = 'Pago...'; err.textContent = '';
            sblocca(sid).then(function () { esito = true; dlg.close(); annuncia('🔓 ' + s.nome + ' sbloccato!'); },
              function (e) { vai.disabled = false; vai.textContent = 'Sblocca'; err.textContent = (e && e.message) || 'Qualcosa è andato storto, riprova.'; });
          };
        }
      }
      no.onclick = function () { dlg.close(); };
      btns.append(vai, no);
      dlg.append(h, p, prezzo, err, btns);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () { dlg.remove(); fine(esito); });
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
  }

  /* ── avvio ── */
  window.addEventListener('storage', function (e) {
    if (e.key === MEM && id) { var m = leggiLS(MEM); if (m && m.id === id) { d = m.d; avvisa(); } }
    else if (e.key === PEND) avvisa();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && id) carica(); });

  if (!A || !A.attivo || !A.db) {
    pronto = Promise.resolve(stato());
  } else {
    // copia salvata: saldo e sblocchi si vedono subito, prima della risposta del database
    var acc0 = A.stato().account, m0 = leggiLS(MEM);
    if (acc0 && m0 && m0.id === acc0.id) { id = acc0.id; d = m0.d; }
    pronto = A.pronto.then(carica, carica).then(controllaVecchi).then(stato, stato);
    A.suCambio(function () {
      var acc = A.stato().account;
      if ((acc && acc.id) !== id) { vecchiP = null; carica().then(controllaVecchi); }
    });
  }
  // se i dati arrivano dopo (o cambia account) ricontrollo anche i vecchi giocatori di Corri Marf
  ascoltatori.push(function () { if (d && id) controllaVecchi(); });

  window.GoGoldBar = {
    pronto: pronto, stato: stato,
    saldo: function () { return stato().saldo; },
    perClick: perClick, clic: clic, aggiungi: aggiungi,
    sbloccato: sbloccato, sblocca: sblocca, chiediSblocco: chiediSblocco, albumBloccato: albumBloccato, sbloccoDi: sbloccoDi, segui: segui,
    trofeo: trofeo, catalogo: catalogo, annuncia: annuncia,
    ascoltato: function (file) { segna('brani', slugBrano(file)); },
    visto: function (yt) { segna('video', chiaveVideo(yt)); },
    SBLOCCHI: SBLOCCHI, formatta: formatta, icona: ICONA,
    suCambio: function (fn) { if (typeof fn === 'function') ascoltatori.push(fn); },
    aggiorna: carica
  };
})();
