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
     valuta(n)              → '1.234 ' + simbolo (il glifo GoGoldBar, carattere U+E000 col mini font del glifo)
     icona, glifo           → <svg> del glifo GoGoldBar, da mettere in innerHTML
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

  // il glifo della GoGoldBar (disegnato da Leo): come <svg> da mettere in innerHTML...
  var ICONA = '<svg class="ggb-ico" viewBox="205 237 649 616" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M 453 237 L 453 428 L 452 429 L 432 425 L 380 426 L 355 431 L 323 442 L 297 456 L 273 474 L 257 490 L 245 505 L 235 520 L 225 539 L 217 559 L 211 580 L 205 618 L 205 662 L 206 663 L 208 688 L 214 715 L 224 742 L 235 763 L 250 784 L 264 799 L 285 816 L 303 827 L 322 836 L 346 844 L 369 849 L 394 851 L 395 852 L 426 852 L 427 851 L 436 851 L 457 848 L 474 844 L 497 836 L 520 825 L 534 816 L 553 829 L 578 841 L 606 849 L 625 852 L 658 853 L 659 852 L 680 851 L 708 845 L 736 835 L 752 827 L 776 811 L 787 802 L 806 782 L 818 766 L 827 751 L 837 730 L 845 707 L 850 686 L 853 665 L 854 622 L 853 621 L 852 599 L 845 564 L 834 534 L 824 515 L 804 488 L 780 466 L 767 457 L 747 446 L 718 435 L 699 430 L 681 427 L 657 426 L 656 425 L 636 425 L 635 426 L 614 427 L 607 429 L 602 428 L 602 237 Z M 621 519 L 641 518 L 642 519 L 654 519 L 666 521 L 688 528 L 703 537 L 717 550 L 728 566 L 735 582 L 740 601 L 742 614 L 742 625 L 743 626 L 743 654 L 742 655 L 741 670 L 737 687 L 730 705 L 719 723 L 705 738 L 691 748 L 683 752 L 664 758 L 626 759 L 611 756 L 602 752 L 602 673 L 603 672 L 663 672 L 663 584 L 603 584 L 602 583 L 602 527 L 607 523 Z M 403 518 L 428 518 L 450 522 L 453 524 L 453 604 L 452 605 L 396 605 L 395 606 L 395 693 L 452 693 L 453 694 L 453 752 L 449 755 L 432 759 L 411 759 L 383 754 L 361 744 L 354 739 L 343 729 L 332 714 L 327 704 L 321 687 L 317 667 L 316 632 L 315 631 L 316 630 L 317 610 L 324 583 L 333 564 L 342 551 L 355 538 L 368 529 L 384 522 Z"/></svg>';
  // ...e come carattere U+E000 per i testi: un mini font con solo quel glifo, agganciato alle famiglie del sito
  var G = '\uE000';
  function valuta(n) { return formatta(n) + ' ' + G; }

  /* ── trofei ── */
  // valore in GGB per click, deciso dall'id: così vale anche nelle pagine senza contenuti.js
  function valore(tid) { return /^(cm_|bisca_|rc_)/.test(tid) ? 5 : 1; }
  var TROFEI_GIOCHI = [
    { id: 'cm_epico',          gruppo: 'Giochi', nome: 'Corri Marf! · Platino',     desc: 'Completa tutti gli achievement comuni, rari ed epici di Corri Marf!' },
    { id: 'cm_leggendario',    gruppo: 'Giochi', nome: 'Corri Marf! · Leggenda',    desc: 'Completa tutti gli achievement leggendari di Corri Marf!' },
    { id: 'cm_nascosti',       gruppo: 'Giochi', nome: 'Corri Marf! · Segreti',     desc: 'Trova tutti gli achievement nascosti di Corri Marf!' },
    { id: 'bisca_epico',       gruppo: 'Giochi', nome: 'Bisca · Platino',           desc: 'Completa tutti i trofei comuni, rari ed epici della Bisca der Tromba' },
    { id: 'bisca_leggendario', gruppo: 'Giochi', nome: 'Bisca · Leggenda',          desc: 'Completa tutti i trofei leggendari della Bisca der Tromba' },
    { id: 'rc_fogli',          gruppo: 'Giochi', nome: 'Resident Crevil · Fuori dal greppo', desc: 'Raccogli tutti e 10 i fogli nei boschi di Capricchia' }
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
    annuncia('🏆 ' + (x ? x.nome : 'Nuovo trofeo') + ' · ora guadagni ' + perClick() + ' ' + G + ' a click');
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
  var FONT = 'data:font/woff2;base64,d09GMgABAAAAAAJ8AAoAAAAAA9QAAAIzAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAAPAqCaIJbATYCJAMMCwgABCAFZgcsGw4DIL4VN66X2iNjIDYpQwLrVLcrTLDtpIS5z6E//ltRENVY2bP7hKwQWBO5Z8uOIJGpUwEWJnHkSD3B8v4upFDCgKYwGvmAIuz4+3m3SHpRP1OL10BpE5voCOfSHnBMOtHlRJnhGAeLwKI3nW+jr5O7Xw7nJMZvRRBpKdBFnABD4W5wXKZJqpmGmG98O0hY4UkmqLpCcP+/m3qn2WEUR9PlsLF4bPvYFh/LqDA+wF6EAXNQ7Woe91y2DpeUr3wRrdzwwRgjLIgdgDOuAPy+i5U1pV4DZvUZ/ABQgAac0IiIEWHYJBDUJuU+UEs3EOA0jome3wWHAMAIAABd0f53nF1ztRRpmrapKEvjukYEmpOCF0nTJLzLgmRJAgu+kBl+ZUEBS6Jv+7au8z4/BLvi1ThbgkWiB88FStXroFCirB9mmVzI5BbkZKQHXLjGCCOa3y5DhHKBrks9S3/605QFXLmp12v0d+bPDcOOFOetl0dfm904mVRljdmHwsUNOkIQhr5sKl3+o/4mokgaGVx7vP3s4zTDt5XVZkn+5Evrq2evPGOP7DAA69jjlOHkh1NW6j/n8yaCWX5KXu0a62adS06TrT1XCgAIIOBgu0qHbeoL9E/gh9pOIQF0+F3yaFQJwn0jRksBSjgAwW0t/+G5SCuAZpceUfCWESkIAII5IAAoTDFHI0bmCA7YDasKGwIKJp7hxdld099slRSY6CyjemXrMq1anwFzRjVDYUsfHZQe2G4A';
  var FAMIGLIE = ['GoGoldBar', 'Fredoka', 'DM Sans', 'DM Mono', 'Chakra Petch', 'Cinzel', 'Cinzel Decorative', 'Playfair Display'];
  // Il glifo entra nelle famiglie già usate dalla pagina: il browser unisce due font della stessa famiglia
  // solo se hanno peso e stile identici, quindi copio esattamente i pesi che la pagina ha caricato
  // (es. Fredoka 500/600/700). Le famiglie che la pagina non carica ricevono il glifo per tutti i pesi.
  var fontDati = null, fontFatti = {};
  function agganciaFont() {
    if (!window.FontFace || !document.fonts) return;
    try {
      if (!fontDati) {
        var bin = atob(FONT.split(',')[1]); fontDati = new Uint8Array(bin.length);
        for (var bi = 0; bi < bin.length; bi++) fontDati[bi] = bin.charCodeAt(bi);
      }
      var combo = {}, presenti = {};
      document.fonts.forEach(function (f) {
        if (/^U\+E000$/i.test(f.unicodeRange)) return;
        var fam = String(f.family).replace(/^["']|["']$/g, '');
        presenti[fam] = 1;
        combo[fam + '|' + f.weight + '|' + f.style] = [fam, f.weight, f.style];
      });
      FAMIGLIE.forEach(function (fam) {
        if (!presenti[fam]) ['normal', 'italic'].forEach(function (st) { combo[fam + '|1 1000|' + st] = [fam, '1 1000', st]; });
      });
      Object.keys(combo).forEach(function (k) {
        if (fontFatti[k]) return;
        // se la famiglia arriva dopo (pesi veri), la regola "tutti i pesi" va tolta: altrimenti ruberebbe il peso 400
        var c = combo[k], ff = new FontFace(c[0], fontDati.buffer.slice(0), { weight: c[1], style: c[2], unicodeRange: 'U+E000', display: 'block' });
        fontFatti[k] = ff; document.fonts.add(ff); ff.load().catch(function () {});
      });
      Object.keys(fontFatti).forEach(function (k) {
        var fam = k.split('|')[0];
        if (k.indexOf('|1 1000|') > 0 && presenti[fam]) { document.fonts.delete(fontFatti[k]); delete fontFatti[k]; }
      });
    } catch (e) {}
  }
  agganciaFont();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agganciaFont);
  window.addEventListener('load', agganciaFont);
  var CSS = '' +
    '.ggb-ico{width:.95em;height:.9em;vertical-align:-.08em;display:inline-block}' +
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
      var prezzo = document.createElement('div'); prezzo.className = 'ggb-prezzo'; prezzo.innerHTML = '<span></span>' + ICONA;
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
        p.textContent = (s.album ? 'L\'album ' : '') + s.nome + ' costa ' + valuta(s.prezzo) + '. Ne hai ' + valuta(st.saldo) + '.';
        if (manca > 0) {
          err.textContent = 'Te ne mancano ' + valuta(manca) + ': clicca il maneki neko in home per raccoglierle.';
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
    SBLOCCHI: SBLOCCHI, formatta: formatta, valuta: valuta, simbolo: G, icona: ICONA, glifo: ICONA,
    suCambio: function (fn) { if (typeof fn === 'function') ascoltatori.push(fn); },
    aggiorna: carica
  };
})();
