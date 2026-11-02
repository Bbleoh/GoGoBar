/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DE LA BISCA DER TROMBA
   Script classico (niente module): definisce window.BiscaClassifica.
   Lo usano sia il gioco sia la homepage del sito.

   window.BiscaClassifica.attiva          → true se il servizio è configurato
   window.BiscaClassifica.carica(limite)  → Promise<[{ nome, punti, data }]>
       ordinata dal punteggio più alto; [] se qualcosa va storto (non lancia mai).
   window.BiscaClassifica.salva(nome, punti) → Promise<void>
       tiene il punteggio più alto per ogni nome; lancia un Error se fallisce.
   window.BiscaClassifica.caricaGiocatore(nome) / salvaGiocatore(nome, dati) / caricaGiocatori()
       account per nome con saldo, statistiche e trofei (vedi sotto).

   Servizio: Firebase Realtime Database via REST (fetch, HTTPS, CORS ok).
   Per attivarlo basta mettere qui sotto l'URL del database, ad esempio
   'https://gogobar-xxxxx-default-rtdb.europe-west1.firebasedatabase.app'
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DB_URL = 'https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app'; // vuoto = classifica spenta
  var PERCORSO = 'bisca/classifica';
  var TIMEOUT_MS = 8000;

  function base() { return DB_URL.replace(/\/+$/, ''); }

  function chiaveDa(nome) {
    // Firebase non accetta . $ # [ ] / nelle chiavi; stesso nome = stessa riga
    return nome.trim().toLowerCase().replace(/[.$#\[\]\/\s]+/g, '_');
  }

  function richiesta(url, opzioni) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    opzioni = opzioni || {};
    if (ctrl) opzioni.signal = ctrl.signal;
    return fetch(url, opzioni).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('Errore classifica (' + r.status + ')');
      return r.json();
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? 'La classifica non risponde' : 'Classifica non raggiungibile');
    });
  }

  function carica(limite) {
    limite = limite || 10;
    if (!DB_URL) return Promise.resolve([]);
    return richiesta(base() + '/' + PERCORSO + '.json').then(function (dati) {
      if (!dati || typeof dati !== 'object') return [];
      return Object.keys(dati).map(function (k) {
        var r = dati[k] || {};
        return {
          nome: String(r.nome || k).slice(0, 20),
          punti: Math.floor(Number(r.punti)) || 0,
          data: typeof r.data === 'string' ? r.data : null
        };
      }).sort(function (a, b) { return b.punti - a.punti; }).slice(0, limite);
    }).catch(function () { return []; });
  }

  function salva(nome, punti) {
    nome = String(nome || '').trim();
    punti = Math.floor(Number(punti));
    if (!DB_URL) return Promise.reject(new Error('La classifica online non è ancora attiva.'));
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    if (!isFinite(punti) || punti < 0) return Promise.reject(new Error('Punteggio non valido.'));
    var url = base() + '/' + PERCORSO + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
    return richiesta(url).then(function (attuale) {
      if (attuale && Number(attuale.punti) >= punti) return; // tiene il record migliore
      return richiesta(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome, punti: punti, data: new Date().toISOString() })
      });
    }).then(function () {});
  }

  /* ── ACCOUNT ─────────────────────────────────────────────────────
     Il nome è l'account: stessa chiave (minuscole) = stesso giocatore.
     bisca/giocatori/<chiave> = { nome, saldo, ultimaPuntata, aggiornato,
                                  stats: { contatori numerici }, trofei: { id: data ISO } }
     Le regole Firebase permettono di aggiungere trofei ma non di toglierli. */
  var GIOCATORI = 'bisca/giocatori';

  function urlGiocatore(nome) {
    return base() + '/' + GIOCATORI + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
  }

  // Promise<oggetto | null>: null se l'account non esiste ancora; rifiuta se Firebase non risponde
  function caricaGiocatore(nome) {
    if (!DB_URL) return Promise.reject(new Error('Account online non attivi'));
    return richiesta(urlGiocatore(nome)).then(function (d) {
      return d && typeof d === 'object' ? d : null;
    });
  }

  // Salva tutto l'account con un PATCH multi-percorso (i trofei uno per uno)
  function salvaGiocatore(nome, dati, keepalive) {
    if (!DB_URL) return Promise.reject(new Error('Account online non attivi'));
    var corpo = {
      nome: String(nome).trim().slice(0, 20),
      saldo: Math.max(0, Math.floor(Number(dati.saldo)) || 0),
      ultimaPuntata: Math.max(0, Math.floor(Number(dati.ultimaPuntata)) || 0),
      aggiornato: new Date().toISOString()
    };
    var st = dati.stats || {};
    Object.keys(st).forEach(function (k) {
      if (typeof st[k] === 'number' && isFinite(st[k])) corpo['stats/' + k] = st[k];
    });
    var tr = dati.trofei || {};
    Object.keys(tr).forEach(function (k) {
      if (/^[a-z0-9_]+$/i.test(k) && typeof tr[k] === 'string') corpo['trofei/' + k] = tr[k].slice(0, 30);
    });
    return richiesta(urlGiocatore(nome), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      keepalive: !!keepalive
    }).then(function () {});
  }

  // Promise<[{ nome, trofei: n, saldo, aggiornato }]> per eventuali classifiche dei trofei; [] se errore
  function caricaGiocatori() {
    if (!DB_URL) return Promise.resolve([]);
    return richiesta(base() + '/' + GIOCATORI + '.json').then(function (d) {
      if (!d || typeof d !== 'object') return [];
      return Object.keys(d).map(function (k) {
        var g = d[k] || {};
        return { nome: String(g.nome || k).slice(0, 20), trofei: Object.keys(g.trofei || {}).length,
                 saldo: Number(g.saldo) || 0, aggiornato: g.aggiornato || null };
      }).sort(function (a, b) { return b.trofei - a.trofei; });
    }).catch(function () { return []; });
  }

  window.BiscaClassifica = {
    attiva: !!DB_URL, carica: carica, salva: salva,
    caricaGiocatore: caricaGiocatore, salvaGiocatore: salvaGiocatore, caricaGiocatori: caricaGiocatori
  };
})();
