/* ════════════════════════════════════════════════════════════════
   CLASSIFICA DE LA BISCA DER TROMBA
   Script classico (niente module): definisce window.BiscaClassifica.
   Lo usano sia il gioco sia la homepage del sito.

   window.BiscaClassifica.attiva          → true se il servizio è configurato
   window.BiscaClassifica.carica(limite)  → Promise<[{ nome, punti, data, tavolo }]>
       classifica unica: il miglior profitto (cash-out − buy-in, anche negativo) di ogni giocatore,
       ordinata dal più alto; [] se qualcosa va storto (non lancia mai).
   window.BiscaClassifica.salvaProfitto(nome, profitto, tavolo) → Promise<void>
       classifica unica bisca/profitti/<chiave> = {nome, punti, tavolo, data}: punti = cash-out − buy-in
       (anche negativo), tiene il migliore per nome; lancia un Error se fallisce.
   (bisca/classifica e bisca/classifiche sono le vecchie classifiche, non più usate.)
   window.BiscaClassifica.caricaGiocatore(nome) / salvaGiocatore(nome, dati) / caricaGiocatori()
       account per nome con saldo, statistiche e trofei (vedi sotto).

   Servizio: Firebase Realtime Database via REST, con l'indirizzo e le richieste
   in comune in risorse/js/database.js (da caricare prima di questo file).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // il database è condiviso da tutto il sito: risorse/js/database.js (se manca, la classifica resta spenta)
  var DB = window.GoGoDB || { URL: '' };
  var DB_URL = DB.URL;
  var PERCORSO = 'bisca/classifica';
  var NEGATO = 'permesso negato dal database (regole Firebase da aggiornare?)';

  function base() { return DB_URL; }
  function chiaveDa(nome) { return DB.chiave(nome); }
  function richiesta(url, opzioni) { return DB.richiesta(url, opzioni, NEGATO); }

  // classifica unica: per ogni giocatore il miglior profitto di un cash-out (cash-out − buy-in), anche negativo
  var PROFITTI = 'bisca/profitti';
  var TAVOLI = [100, 1000, 10000, 100000];

  function righe(dati) {
    if (!dati || typeof dati !== 'object') return [];
    return Object.keys(dati).map(function (k) {
      var r = dati[k] || {};
      return {
        chiave: k,
        nome: String(r.nome || k).slice(0, 20),
        punti: Math.floor(Number(r.punti)) || 0,
        tavolo: Number(r.tavolo) || null,
        data: typeof r.data === 'string' ? r.data : null
      };
    });
  }

  function carica(limite) {
    limite = limite || 10;
    if (!DB_URL) return Promise.resolve([]);
    return richiesta(base() + '/' + PROFITTI + '.json')
      .then(function (d) { return righe(d).sort(function (a, b) { return b.punti - a.punti; }).slice(0, limite); })
      .catch(function () { return []; });
  }

  // profitto = cash-out − buy-in del tavolo di partenza; tiene il migliore per nome
  function salvaProfitto(nome, profitto, tavolo) {
    nome = String(nome || '').trim();
    profitto = Math.floor(Number(profitto));
    if (!DB_URL) return Promise.reject(new Error('La classifica online non è ancora attiva.'));
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    if (!isFinite(profitto)) return Promise.reject(new Error('Punteggio non valido.'));
    var url = base() + '/' + PROFITTI + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
    return richiesta(url).then(function (attuale) {
      if (attuale && Number(attuale.punti) >= profitto) return;
      return richiesta(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome, punti: profitto, tavolo: Number(tavolo) || 0, data: new Date().toISOString() })
      });
    }).then(function () {});
  }

  function salva(nome, punti) { return salvaIn(PERCORSO, nome, punti); }

  function salvaIn(percorso, nome, punti) {
    nome = String(nome || '').trim();
    punti = Math.floor(Number(punti));
    if (!DB_URL) return Promise.reject(new Error('La classifica online non è ancora attiva.'));
    if (!nome) return Promise.reject(new Error('Nome vuoto.'));
    if (!isFinite(punti) || punti < 0) return Promise.reject(new Error('Punteggio non valido.'));
    var url = base() + '/' + percorso + '/' + encodeURIComponent(chiaveDa(nome)) + '.json';
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
    attiva: !!DB_URL, carica: carica, salva: salva, salvaProfitto: salvaProfitto, TAVOLI: TAVOLI,
    caricaGiocatore: caricaGiocatore, salvaGiocatore: salvaGiocatore, caricaGiocatori: caricaGiocatori
  };
})();
