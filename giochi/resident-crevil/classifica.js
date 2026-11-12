/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DI RESIDENT CREVIL: MORTE SUL GREPPO
   Script classico (niente module): definisce window.ResidentCrevilClassifica.
   Lo usano sia il gioco sia la homepage del sito.

   attiva                 → true se il database è configurato
   carica(limite)         → Promise<[{ nome, punti, data }]>, punti = secondi per prendere i 10 fogli,
                            ordinata dal tempo più BASSO; [] se qualcosa va storto (non lancia mai)
   salva(nome, secondi)   → Promise<void>: tiene il tempo migliore (più basso) per ogni nome

   Database: Firebase Realtime Database, percorso residentcrevil/classifica
   (regole in firebase/regole.json: si può scrivere solo un tempo più basso del precedente).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DB_URL = 'https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app';
  var PERCORSO = 'residentcrevil/classifica';
  var TIMEOUT_MS = 8000;

  function base() { return DB_URL.replace(/\/+$/, ''); }
  function chiaveDa(nome) { return nome.trim().toLowerCase().replace(/[.$#\[\]\/\s]+/g, '_'); }

  function conAuth(url, opzioni) {
    var metodo = (opzioni && opzioni.method) || 'GET';
    if (metodo === 'GET' || !window.GoGoAccount || !window.GoGoAccount.attivo) return Promise.resolve(url);
    return window.GoGoAccount.token().then(function (t) {
      return t ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'auth=' + encodeURIComponent(t) : url;
    }, function () { return url; });
  }
  function richiesta(url, opzioni) {
    return conAuth(url, opzioni).then(function (u) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
      opzioni = opzioni || {};
      if (ctrl) opzioni.signal = ctrl.signal;
      return fetch(u, opzioni).then(function (r) {
        if (timer) clearTimeout(timer);
        if (r.status === 401 || r.status === 403) throw new Error('Non posso salvare con questo nome (è di un account GoGoBar, o le regole del database non sono ancora aggiornate).');
        if (!r.ok) throw new Error('Errore classifica (' + r.status + ')');
        return r.json();
      }, function (e) {
        if (timer) clearTimeout(timer);
        throw new Error(e && e.name === 'AbortError' ? 'La classifica non risponde' : 'Classifica non raggiungibile');
      });
    });
  }

  function carica(limite) {
    limite = limite || 10;
    if (!DB_URL) return Promise.resolve([]);
    return richiesta(base() + '/' + PERCORSO + '.json').then(function (dati) {
      if (!dati || typeof dati !== 'object') return [];
      return Object.keys(dati).map(function (k) {
        var r = dati[k] || {};
        return { nome: String(r.nome || k).slice(0, 20), punti: Math.floor(Number(r.punti)) || 0, data: typeof r.data === 'string' ? r.data : null };
      }).filter(function (r) { return r.punti > 0; })
        .sort(function (a, b) { return a.punti - b.punti; }).slice(0, limite);
    }).catch(function () { return []; });
  }

  function salva(nome, secondi) {
    nome = String(nome || '').trim();
    secondi = Math.floor(Number(secondi));
    if (!DB_URL) return Promise.reject(new Error('La classifica online non è attiva.'));
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    if (!isFinite(secondi) || secondi <= 0) return Promise.reject(new Error('Tempo non valido.'));
    var url = base() + '/' + PERCORSO + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
    return richiesta(url).then(function (attuale) {
      if (attuale && Number(attuale.punti) > 0 && Number(attuale.punti) <= secondi) return; // tiene il tempo migliore
      return richiesta(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.slice(0, 20), punti: secondi, data: new Date().toISOString() })
      });
    }).then(function () {});
  }

  window.ResidentCrevilClassifica = { attiva: !!DB_URL, carica: carica, salva: salva };
})();
