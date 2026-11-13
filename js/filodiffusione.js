/*
 * ════════════════════════════════════════════════════════════════
 *  FILODIFFUSIONE · la musica non si ferma quando cambi pagina
 * ════════════════════════════════════════════════════════════════
 *
 *  Tra le pagine "in filodiffusione" i link non ricaricano il sito: questo script scarica la
 *  pagina nuova e ne sostituisce solo il contenuto, così la radio (js/radio.js) continua a
 *  suonare senza buchi. L'indirizzo nella barra cambia lo stesso e avanti/indietro funzionano.
 *
 *  Per mettere una pagina in filodiffusione:
 *    1. <html lang="it" data-filodiffusione>
 *    2. nel <head>, prima di tutto il resto degli script:
 *         <script src="js/filodiffusione.js?v=1"></script>      (con ../ se la pagina è in una cartella)
 *    3. carica anche js/radio.js, prima degli script scritti nella pagina.
 *    4. il codice scritto nella pagina sta dentro (function () { ... })(), come nelle altre
 *       pagine: ogni volta che ci torni viene rieseguito da capo.
 *
 *  I link verso pagine senza filodiffusione (giochi, Video) caricano la pagina come sempre:
 *  lì la musica riprende da dove era con la "staffetta" di radio.js.
 *
 *  A ogni cambio di pagina:
 *   - gli script con src (contenuti.js, radio.js, account.js...) si caricano una volta sola;
 *   - gli script scritti nella pagina si rieseguono. I loro addEventListener su window e document
 *     e le iscrizioni suCambio / ascolta (GoGoldBar, GoGoAccount, radio) si tolgono da sole
 *     quando esci dalla pagina. Per altro da pulire (timer...) c'è GoGoFilo.alUscita(fn);
 *   - stili e contenuto della pagina si sostituiscono. Restano gli elementi con l'attributo
 *     data-resta: i moduli lo mettono su quello che aggiungono loro (radio, finestre, avvisi).
 *  Eventi su document: 'gogofilo:uscita' (prima del cambio) e 'gogofilo:pagina' (dopo).
 */
(function () {
  if (window.GoGoFilo) return;
  var me = document.currentScript;
  var radice = new URL('../', me.src);                 // cartella principale del sito

  var uscite = [];
  function alUscita(fn) { if (typeof fn === 'function') uscite.push(fn); }
  // true mentre gira uno script scritto nella pagina (non un file .js con src)
  function diPagina() { var s = document.currentScript; return !!(s && !s.src && s !== me); }

  var funziona = !!(window.fetch && window.DOMParser && history.pushState && window.Promise);
  window.GoGoFilo = { attiva: funziona, alUscita: alUscita, diPagina: diPagina, vai: function (u) { location.href = u; } };
  if (!funziona) return;

  // addEventListener su window e document fatti dagli script della pagina: via quando esci
  [window, document].forEach(function (t) {
    var add = t.addEventListener, rem = t.removeEventListener;
    t.addEventListener = function (tipo, fn, opz) {
      add.call(t, tipo, fn, opz);
      if (diPagina()) alUscita(function () { rem.call(t, tipo, fn, opz); });
    };
  });

  var stessoSito = function (u) { return u.origin === location.origin && u.pathname.indexOf(radice.pathname) === 0; };
  var NONFILO = 'gogofilo.no.v1';                          // pagine già viste senza filodiffusione
  var noFilo = {};
  try { noFilo = JSON.parse(sessionStorage.getItem(NONFILO)) || {}; } catch (e) {}
  function segnaNoFilo(p) { noFilo[p] = 1; try { sessionStorage.setItem(NONFILO, JSON.stringify(noFilo)); } catch (e) {} }

  // pagine scaricate (testo), tenute un minuto: il download parte già quando premi il link
  var scaricate = {};
  function scarica(url) {
    var k = url.split('#')[0];
    if (!scaricate[k]) {
      scaricate[k] = fetch(k, { credentials: 'same-origin' }).then(function (r) {
        return r.ok && /html/.test(r.headers.get('content-type') || '') ? r.text() : null;
      }).catch(function () { return null; });
      setTimeout(function () { delete scaricate[k]; }, 60000);
    }
    return scaricate[k];
  }

  // ── storia: ogni voce ha un numero, per ritrovare lo scroll tornando indietro ──
  var scroll = {}, numero = 0, voce = 0;
  var percorso = location.pathname + location.search;      // la pagina che si vede adesso
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  try { history.replaceState({ filo: 1, n: 0 }, ''); } catch (e) {}

  function linkDa(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.getAttribute('data-filo') === 'no') return null;
    var u = new URL(a.href, location.href);
    if (!stessoSito(u) || noFilo[u.pathname]) return null;
    if (u.pathname + u.search === percorso) return null;     // stessa pagina (#ancore): ci pensa il browser
    return u;
  }
  document.addEventListener('click', function (e) {
    var u = linkDa(e);
    if (!u) return;
    e.preventDefault();
    vai(u.href, true);
  });
  // il download parte appena premi, prima del click
  ['pointerdown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.type === 'pointerdown' && e.pointerType === 'touch') return;
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a || a.target) return;
      var u = new URL(a.href, location.href);
      if (stessoSito(u) && !noFilo[u.pathname] && u.pathname + u.search !== percorso) scarica(u.href);
    }, { passive: true, capture: true });
  });

  addEventListener('popstate', function (e) {
    var st = e.state || {};
    if (location.pathname + location.search === percorso) return;   // solo l'#ancora è cambiata
    vai(location.href, false, st.n);
  });

  // ── barra di caricamento (si vede solo se la pagina tarda) ──
  var barra = null, timerBarra = null;
  function caricamento(si) {
    clearTimeout(timerBarra);
    if (si) timerBarra = setTimeout(function () {
      if (!barra) {
        barra = document.createElement('div'); barra.setAttribute('data-resta', '');
        barra.style.cssText = 'position:fixed;left:0;top:0;height:3px;width:0;z-index:2147483647;background:#e4b33c;' +
          'box-shadow:0 0 10px #e4b33c;transition:width 2.5s cubic-bezier(.1,.7,.2,1),opacity .3s;pointer-events:none';
        document.body.appendChild(barra);
      }
      barra.style.opacity = '1'; barra.style.width = '0'; void barra.offsetWidth; barra.style.width = '85%';
    }, 150);
    else if (barra) { barra.style.width = '100%'; barra.style.opacity = '0'; }
  }

  var corsa = 0;
  function vai(url, nuova, n) {
    var mia = ++corsa;
    caricamento(true);
    return scarica(url).then(function (testo) {
      if (mia !== corsa) return;
      var doc = testo && new DOMParser().parseFromString(testo, 'text/html');
      if (!doc || !doc.documentElement.hasAttribute('data-filodiffusione')) {
        if (doc) segnaNoFilo(new URL(url).pathname);
        caricamento(false);
        if (nuova) location.assign(url); else location.reload();
        return;
      }
      scroll[voce] = scrollY;
      segnaCaricati();                                     // prima di cambiare indirizzo: i src relativi cambierebbero
      if (nuova) { voce = ++numero; history.pushState({ filo: 1, n: voce }, '', url); }
      else voce = n || 0;
      percorso = location.pathname + location.search;
      return sostituisci(doc).then(function () {
        if (mia !== corsa) return;
        caricamento(false);
        var h = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (nuova && h) h.scrollIntoView();
        else scrollTo(0, nuova ? 0 : (scroll[voce] || 0));
      });
    }).catch(function (err) {
      console.error('[filodiffusione]', err);
      location.href = url;
    });
  }
  window.GoGoFilo.vai = function (u) { vai(new URL(u, location.href).href, true); };

  // ── il cambio vero e proprio ──
  var caricati = {};                                       // file .js già caricati (per percorso)
  function segnaCaricati() {
    [].forEach.call(document.querySelectorAll('script[src]'), function (s) { caricati[new URL(s.src).pathname] = 1; });
  }
  var restano = function (n) { return n.nodeType === 1 && n.hasAttribute('data-resta'); };
  function chiaveStile(n, base) {
    return n.tagName === 'LINK' ? 'L' + new URL(n.getAttribute('href'), base).href : 'S' + n.textContent;
  }

  function sostituisci(doc) {
    var base = location.href;
    var head = document.head, body = document.body;

    // stili: quelli uguali restano (niente sfarfallio), gli altri si cambiano
    var vecchi = [].filter.call(head.querySelectorAll('style, link[rel~="stylesheet"]'), function (n) { return n.parentNode === head && !restano(n); });
    var nuovi = [].slice.call(doc.head.querySelectorAll('style, link[rel~="stylesheet"]'));
    var chiaviNuove = {}; nuovi.forEach(function (n) { chiaviNuove[chiaveStile(n, base)] = 1; });
    var chiaviVecchie = {}; vecchi.forEach(function (n) { chiaviVecchie[chiaveStile(n, base)] = 1; });
    var primoModulo = [].filter.call(head.children, restano)[0] || null;
    var attese = [];
    nuovi.forEach(function (n) {
      if (chiaviVecchie[chiaveStile(n, base)]) return;
      var c = document.importNode(n, true);
      if (c.tagName === 'LINK') attese.push(new Promise(function (ok) { c.onload = c.onerror = ok; setTimeout(ok, 1500); }));
      head.insertBefore(c, primoModulo);
    });

    return Promise.all(attese).then(function () {
      document.dispatchEvent(new Event('gogofilo:uscita'));
      var via = uscite; uscite = [];
      via.forEach(function (fn) { try { fn(); } catch (e) {} });

      vecchi.forEach(function (n) { if (!chiaviNuove[chiaveStile(n, base)]) n.remove(); });
      document.title = doc.title;

      // script della pagina nuova, in ordine; il resto del contenuto entra nel body
      var script = [].slice.call(doc.querySelectorAll('script'));
      script.forEach(function (s) { s.remove(); });
      [].forEach.call(doc.querySelectorAll('noscript'), function (n) { n.remove(); });

      [].slice.call(body.childNodes).forEach(function (n) { if (!restano(n)) n.remove(); });
      [].slice.call(body.attributes).forEach(function (a) { body.removeAttribute(a.name); });
      [].forEach.call(doc.body.attributes, function (a) { body.setAttribute(a.name, a.value); });
      var dove = [].filter.call(body.childNodes, restano)[0] || null;
      [].slice.call(doc.body.childNodes).forEach(function (n) { body.insertBefore(document.adoptNode(n), dove); });

      return esegui(script);
    }).then(function () {
      document.dispatchEvent(new Event('gogofilo:pagina'));
    });
  }

  function esegui(lista) {
    var p = Promise.resolve();
    lista.forEach(function (s) {
      p = p.then(function () {
        var src = s.getAttribute('src');
        var n = document.createElement('script');
        [].forEach.call(s.attributes, function (a) { n.setAttribute(a.name, a.value); });
        if (src) {
          var k = new URL(src, location.href).pathname;
          if (caricati[k]) return;
          caricati[k] = 1;
          return new Promise(function (ok) {
            n.async = false;
            n.addEventListener('load', ok); n.addEventListener('error', ok);
            document.body.appendChild(n);
          });
        }
        n.textContent = s.textContent;
        try { document.body.appendChild(n); } catch (e) { console.error(e); }
      });
    });
    return p;
  }
})();
