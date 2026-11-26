/* ════════════════════════════════════════════════════════════════
   DATABASE GOGOBAR (Firebase Realtime Database via REST)
   Script classico (niente module): definisce window.GoGoDB.
   Va caricato PRIMA di risorse/js/account.js e delle classifiche dei giochi
   (giochi/<gioco>/classifica.js), che lo usano tutte.

   L'indirizzo del database sta solo qui. Le regole sono in firebase/regole.json.

   API
     GoGoDB.URL                    → indirizzo del database, senza / finale ('' = tutto spento)
     GoGoDB.attivo                 → true se c'è un database
     GoGoDB.chiave(nome)           → chiave di un nome nel database: minuscole, e . $ # [ ] / e spazi
                                     diventano _ (Firebase non li accetta). Stesso nome = stessa riga.
     GoGoDB.richiesta(url, opzioni, negato) → Promise<json>
         fetch con timeout di 8 secondi. Le scritture (metodo diverso da GET) portano il token
         dell'account GoGoBar, se c'è: un nome preso da un account si scrive solo dai suoi dispositivi.
         Gli errori sono Error con un messaggio in italiano da mostrare così com'è;
         negato è il messaggio per un 401/403 (ogni gioco ha il suo).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var URL_DB = 'https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app';
  var QUERY = '';
  // solo per i test con gli emulatori Firebase (vedi risorse/js/account.js)
  var T = window.GOGOBAR_ACCOUNT_TEST;
  if (T) { if (T.db) URL_DB = T.db; QUERY = T.dbQuery || ''; }
  URL_DB = URL_DB.replace(/\/+$/, '');

  var TIMEOUT_MS = 8000;

  function chiave(nome) {
    return String(nome || '').trim().toLowerCase().replace(/[.$#\[\]\/\s]+/g, '_');
  }

  function conAuth(url, opzioni) {
    var metodo = (opzioni && opzioni.method) || 'GET';
    if (metodo === 'GET' || !window.GoGoAccount || !window.GoGoAccount.attivo) return Promise.resolve(url);
    return window.GoGoAccount.token().then(function (t) {
      return t ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'auth=' + encodeURIComponent(t) : url;
    }, function () { return url; });
  }

  function richiesta(url, opzioni, negato) {
    if (QUERY) url += (url.indexOf('?') < 0 ? '?' : '&') + QUERY;
    return conAuth(url, opzioni).then(function (u) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
      opzioni = opzioni || {};
      if (ctrl) opzioni.signal = ctrl.signal;
      return fetch(u, opzioni).then(function (r) {
        if (timer) clearTimeout(timer);
        if (r.status === 401 || r.status === 403) throw new Error(negato || 'Il database ha rifiutato la richiesta.');
        if (!r.ok) throw new Error('Errore classifica (' + r.status + ')');
        return r.json();
      }, function (e) {
        if (timer) clearTimeout(timer);
        throw new Error(e && e.name === 'AbortError' ? 'La classifica non risponde' : 'Classifica non raggiungibile');
      });
    });
  }

  window.GoGoDB = { URL: URL_DB, attivo: !!URL_DB, chiave: chiave, richiesta: richiesta };
})();
