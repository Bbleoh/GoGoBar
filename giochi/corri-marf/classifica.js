/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DI CORRI MARF!
   Script classico (niente module): definisce window.CorriMarfClassifica.
   Lo usano sia il gioco sia la homepage del sito.

   window.CorriMarfClassifica.attiva          → true se il servizio è configurato
   window.CorriMarfClassifica.carica(limite)  → Promise<[{ nome, punti, data }]>
       ordinata dal punteggio più alto; [] se qualcosa va storto (non lancia mai).
   window.CorriMarfClassifica.letta → true se l'ultima carica() ha avuto risposta dal database
   window.CorriMarfClassifica.salva(nome, punti) → Promise<void>
       tiene il punteggio più alto per ogni nome; lancia un Error se fallisce.
   window.CorriMarfClassifica.caricaGiocatore(nome) / salvaGiocatore(nome, { canne, record, upg })
       portafoglio e upgrade del Market online (vedi sotto).
   window.CorriMarfClassifica.caricaMissioni(nome) / salvaMissioni(nome, { grado, fatte, slot, aggiornato })
       le missioni del giocatore online.

   Servizio: Firebase Realtime Database via REST, con l'indirizzo e le richieste
   in comune in risorse/js/database.js (da caricare prima di questo file).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // il database è condiviso da tutto il sito: risorse/js/database.js (se manca, la classifica resta spenta)
  var DB = window.GoGoDB || { URL: '' };
  var DB_URL = DB.URL;
  var PERCORSO = 'corrimarf/classifica';
  var NEGATO = 'Questo nome è di un account GoGoBar: per salvarci sopra entra con il tuo account dalla home.';

  function base() { return DB_URL; }
  function chiaveDa(nome) { return DB.chiave(nome); }
  function richiesta(url, opzioni) { return DB.richiesta(url, opzioni, NEGATO); }

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

  /* ── GIOCATORI: portafoglio e upgrade del Market ─────────────────
     corrimarf/giocatori/<chiave> = { nome, canne, record, upg: { id: livello }, aggiornato }
     Se il nome è di un account GoGoBar, solo i dispositivi dell'account possono scriverci. */
  var GIOCATORI = 'corrimarf/giocatori';
  function urlGiocatore(nome) {
    return base() + '/' + GIOCATORI + '/' + encodeURIComponent(chiaveDa(String(nome || ''))) + '.json';
  }

  // Promise<{ nome, canne, record, upg, aggiornato } | null>; rifiuta se Firebase non risponde
  function caricaGiocatore(nome) {
    if (!DB_URL) return Promise.reject(new Error('Salvataggi online non attivi'));
    return richiesta(urlGiocatore(nome)).then(function (d) {
      if (!d || typeof d !== 'object') return null;
      var upg = {};
      Object.keys(d.upg || {}).forEach(function (k) { var v = Math.floor(Number(d.upg[k])); if (v > 0) upg[k] = v; });
      return { nome: String(d.nome || nome).slice(0, 20), canne: Math.max(0, Math.floor(Number(d.canne)) || 0),
               record: Math.max(0, Math.floor(Number(d.record)) || 0), upg: upg,
               aggiornato: typeof d.aggiornato === 'string' ? d.aggiornato : '' };
    });
  }

  // Salva tutto il giocatore (PUT); rifiuta con un Error se fallisce
  function salvaGiocatore(nome, dati, keepalive) {
    if (!DB_URL) return Promise.reject(new Error('Salvataggi online non attivi'));
    nome = String(nome || '').trim();
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    dati = dati || {};
    var upg = {};
    Object.keys(dati.upg || {}).forEach(function (k) {
      var v = Math.floor(Number(dati.upg[k]));
      if (/^[a-z0-9_]+$/i.test(k) && v > 0 && v <= 10) upg[k] = v;
    });
    var corpo = { nome: nome.slice(0, 20), canne: Math.max(0, Math.floor(Number(dati.canne)) || 0),
                  record: Math.min(1000000, Math.max(0, Math.floor(Number(dati.record)) || 0)),
                  upg: upg, aggiornato: new Date().toISOString() };
    return richiesta(urlGiocatore(nome), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo), keepalive: !!keepalive
    }).then(function () {});
  }

  /* ── MISSIONI: corrimarf/missioni/<chiave> = { grado, fatte, slot: [{ id, obj, n, fatta }], aggiornato }
     A parte rispetto ai giocatori: se le regole non le accettano ancora, il portafoglio si salva lo stesso. */
  var MISSIONI = 'corrimarf/missioni';
  function urlMissioni(nome) { return base() + '/' + MISSIONI + '/' + encodeURIComponent(chiaveDa(String(nome || ''))) + '.json'; }
  function numero(v, max) { return Math.min(max, Math.max(0, Math.floor(Number(v)) || 0)); }
  function pulisciSlot(slot) {
    var l = Array.isArray(slot) ? slot : slot && typeof slot === 'object' ? Object.keys(slot).sort().map(function (k) { return slot[k]; }) : [];
    return l.filter(function (z) { return z && typeof z.id === 'string' && /^[a-z0-9_]{1,24}$/i.test(z.id); }).slice(0, 3)
      .map(function (z) { return { id: z.id, obj: numero(z.obj, 10000000), n: numero(z.n, 10000000), fatta: !!z.fatta }; });
  }
  // Promise<{ grado, fatte, slot, aggiornato } | null>
  function caricaMissioni(nome) {
    if (!DB_URL) return Promise.reject(new Error('Salvataggi online non attivi'));
    return richiesta(urlMissioni(nome)).then(function (d) {
      if (!d || typeof d !== 'object') return null;
      return { grado: numero(d.grado, 100000), fatte: numero(d.fatte, 1000000), slot: pulisciSlot(d.slot),
               aggiornato: typeof d.aggiornato === 'string' ? d.aggiornato : '' };
    });
  }
  function salvaMissioni(nome, m, keepalive) {
    if (!DB_URL) return Promise.reject(new Error('Salvataggi online non attivi'));
    nome = String(nome || '').trim();
    if (!nome || !m) return Promise.reject(new Error('Niente da salvare.'));
    var corpo = { grado: numero(m.grado, 100000), fatte: numero(m.fatte, 1000000), slot: pulisciSlot(m.slot),
                  aggiornato: typeof m.aggiornato === 'string' ? m.aggiornato : new Date().toISOString() };
    return richiesta(urlMissioni(nome), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo), keepalive: !!keepalive
    }).then(function () {});
  }

  // letta: true dopo che carica() ha avuto una risposta dal database (anche vuota)
  var api = { attiva: !!DB_URL, letta: false, carica: carica, salva: salva,
              caricaGiocatore: caricaGiocatore, salvaGiocatore: salvaGiocatore,
              caricaMissioni: caricaMissioni, salvaMissioni: salvaMissioni };
  window.CorriMarfClassifica = api;
})();
