/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DI RESIDENT CREVIL: MORTE SUL GREPPO
   Script classico (niente module): definisce window.ResidentCrevilClassifica.
   Usa risorse/js/database.js, da caricare prima di questo file.
   Lo usano sia il gioco sia la homepage del sito.

   attiva                 → true se il database è configurato
   carica(limite, modo)   → Promise<[{ nome, punti, data }]>, punti = secondi per prendere i 10 fogli,
                            ordinata dal tempo più BASSO; [] se qualcosa va storto (non lancia mai)
   salva(nome, secondi, modo) → Promise<void>: tiene il tempo migliore (più basso) per ogni nome

   modo: 'normale' (predefinito) o 'incubo', che ha la sua classifica.
   Database: Firebase Realtime Database, percorsi residentcrevil/classifica e residentcrevil/classificaIncubo
   (regole in firebase/regole.json: si può scrivere solo un tempo più basso del precedente).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // il database è condiviso da tutto il sito: risorse/js/database.js (se manca, la classifica resta spenta)
  var DB = window.GoGoDB || { URL: '' };
  var DB_URL = DB.URL;
  var PERCORSO = 'residentcrevil/classifica';
  var NEGATO = 'Non posso salvare con questo nome (è di un account GoGoBar, o le regole del database non sono ancora aggiornate).';

  function base() { return DB_URL; }
  function chiaveDa(nome) { return DB.chiave(nome); }
  function richiesta(url, opzioni) { return DB.richiesta(url, opzioni, NEGATO); }

  // due classifiche: Normale (residentcrevil/classifica) e Incubo (residentcrevil/classificaIncubo)
  function percorso(modo) { return modo === 'incubo' ? PERCORSO + 'Incubo' : PERCORSO; }

  function carica(limite, modo) {
    limite = limite || 10;
    if (!DB_URL) return Promise.resolve([]);
    return richiesta(base() + '/' + percorso(modo) + '.json').then(function (dati) {
      if (!dati || typeof dati !== 'object') return [];
      return Object.keys(dati).map(function (k) {
        var r = dati[k] || {};
        return { nome: String(r.nome || k).slice(0, 20), punti: Math.floor(Number(r.punti)) || 0, data: typeof r.data === 'string' ? r.data : null };
      }).filter(function (r) { return r.punti > 0; })
        .sort(function (a, b) { return a.punti - b.punti; }).slice(0, limite);
    }).catch(function () { return []; });
  }

  function salva(nome, secondi, modo) {
    nome = String(nome || '').trim();
    secondi = Math.floor(Number(secondi));
    if (!DB_URL) return Promise.reject(new Error('La classifica online non è attiva.'));
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    if (!isFinite(secondi) || secondi <= 0) return Promise.reject(new Error('Tempo non valido.'));
    var url = base() + '/' + percorso(modo) + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
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
