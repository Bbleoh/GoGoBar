/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DE LA BISCA DER TROMBA
   Script classico (niente module): definisce window.CorriMarfClassifica.
   Lo usano sia il gioco sia la homepage del sito.

   window.CorriMarfClassifica.attiva          → true se il servizio è configurato
   window.CorriMarfClassifica.carica(limite)  → Promise<[{ nome, punti, data }]>
       ordinata dal punteggio più alto; [] se qualcosa va storto (non lancia mai).
   window.CorriMarfClassifica.letta → true se l'ultima carica() ha avuto risposta dal database
   window.CorriMarfClassifica.salva(nome, punti) → Promise<void>
       tiene il punteggio più alto per ogni nome; lancia un Error se fallisce.

   Servizio: Firebase Realtime Database via REST (fetch, HTTPS, CORS ok).
   Per attivarlo basta mettere qui sotto l'URL del database, ad esempio
   'https://gogobar-xxxxx-default-rtdb.europe-west1.firebasedatabase.app'
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DB_URL = 'https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app'; // vuoto = classifica spenta
  var PERCORSO = 'corrimarf/classifica';
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
      api.letta = true;                      // il database ha risposto: i suoi record sono quelli veri
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

  // letta: true dopo che carica() ha avuto una risposta dal database (anche vuota)
  var api = { attiva: !!DB_URL, letta: false, carica: carica, salva: salva };
  window.CorriMarfClassifica = api;
})();
