/* ════════════════════════════════════════════════════════════════
   ACCOUNT GOGOBAR, SENZA PASSWORD
   Script classico (niente module): definisce window.GoGoAccount.
   Lo usano la home (pannello 👤) e i giochi (nome del giocatore e token).

   Come funziona
   - Ogni dispositivo entra in Firebase con un accesso anonimo: riceve un
     uid tutto suo, senza email né password (Identity Toolkit via REST).
   - Un account è un nome più l'elenco dei dispositivi autorizzati.
     L'id dell'account è l'uid del dispositivo che l'ha creato.
   - Per aggiungere un altro dispositivo (o ritrovare l'account su un
     telefono nuovo) un dispositivo già collegato crea un codice come
     K7M-4QX, valido 5 minuti, e lo si scrive sull'altro.
   - Il nome dell'account è "prenotato": solo i suoi dispositivi possono
     scrivere classifiche e salvataggi dei giochi con quel nome.

   Database (Realtime Database, stesse regole in docs/regole-firebase.json)
     account/<id>          = { nome, creato, dispositivi: { <uid>: { nome, data, codice? } } }
     uid2account/<uid>     = <id>
     nomi/<chiave>         = <id>          chiave = come chiaveDa() delle classifiche
     abbinamenti/<CODICE>  = { account, creato }

   API
     GoGoAccount.attivo                → false finché manca la chiave API
     GoGoAccount.pronto                → Promise<stato>, risolta dopo il primo controllo
     GoGoAccount.stato()               → { attivo, account: { id, nome } | null }
     GoGoAccount.crea(nome)            → Promise<stato>
     GoGoAccount.codice()              → Promise<{ codice, mostra, scade }>
     GoGoAccount.usaCodice(testo)      → Promise<stato>
     GoGoAccount.dispositivi()         → Promise<[{ uid, nome, data, questo }]>
     GoGoAccount.togli(uid)            → Promise<void>  (scollega un altro dispositivo)
     GoGoAccount.esci()                → Promise<stato> (scollega questo dispositivo)
     GoGoAccount.token()               → Promise<string|null>, solo se c'è un account
     GoGoAccount.chiave(nome)          → chiave usata in nomi/ e nelle classifiche
     GoGoAccount.nomeLibero(nome)      → Promise<boolean>: false se il nome è di un altro account
     GoGoAccount.nomePreso(nome)       → messaggio da mostrare in quel caso
     GoGoAccount.suCambio(fn)          → chiama fn(stato) a ogni cambio (anche da altre schede)
    GoGoAccount.db(percorso, metodo, corpo, { keepalive }) → Promise: REST sul database con l'accesso di questo dispositivo
    GoGoAccount.leggi(percorso)       → Promise: GET pubblico senza accesso (per i rami .read: true)
   Ogni errore è un Error con un messaggio in italiano da mostrare così com'è.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API_KEY = 'AIzaSyB-sscNzrRcgPXjHdo-6QE2KKB219PbjOY';  // Chiave API web di Firebase (Impostazioni progetto → Generali). Vuota = account spenti
  var DB_URL = 'https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app';
  var AUTH_URL = 'https://identitytoolkit.googleapis.com/v1';
  var TOKEN_URL = 'https://securetoken.googleapis.com/v1';
  var DB_QUERY = '';
  // solo per i test con gli emulatori Firebase (non serve sul sito)
  var T = window.GOGOBAR_ACCOUNT_TEST;
  if (T) { API_KEY = T.apiKey || 'test'; DB_URL = T.db; AUTH_URL = T.auth; TOKEN_URL = T.token; DB_QUERY = T.dbQuery || ''; }

  var MEM = 'gogobarAccount.v1';
  var TIMEOUT_MS = 8000;
  var DURATA_CODICE = 5 * 60 * 1000;
  var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente I, O, 0, 1: non si confondono
  var NOME_OK = /^[\wÀ-ÿ _\-]+$/;

  function chiave(nome) {
    // uguale a chiaveDa() di bisca e corri-marf/classifica.js: stesso nome = stessa riga
    return String(nome || '').trim().toLowerCase().replace(/[.$#\[\]\/\s]+/g, '_');
  }

  /* ── Memoria del dispositivo ── */
  function leggiMem() {
    try { var m = JSON.parse(localStorage.getItem(MEM)); if (m && typeof m === 'object') return m; } catch (e) {}
    return {};
  }
  var mem = leggiMem();
  function scriviMem() { try { localStorage.setItem(MEM, JSON.stringify(mem)); } catch (e) {} }

  function stato() {
    return { attivo: !!API_KEY, account: mem.account ? { id: mem.account.id, nome: mem.account.nome } : null };
  }
  var ascoltatori = [];
  function avvisa() {
    var s = stato();
    ascoltatori.forEach(function (fn) { try { fn(s); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent('gogobar-account', { detail: s })); } catch (e) {}
  }
  window.addEventListener('storage', function (e) {     // login o uscita da un'altra scheda
    if (e.key !== MEM) return;
    var prima = JSON.stringify(stato());
    mem = leggiMem();
    if (JSON.stringify(stato()) !== prima) avvisa();
  });

  function errore(testo, status) { var e = new Error(testo); e.status = status || 0; return e; }

  function http(url, opz) {
    opz = opz || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    if (ctrl) opz.signal = ctrl.signal;
    return fetch(url, opz).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) {
          var e = errore((j && j.error && (j.error.message || j.error)) || ('Errore ' + r.status), r.status);
          throw e;
        }
        return j;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw errore(e && e.name === 'AbortError' ? 'Il server non risponde, riprova.' : 'Niente connessione, riprova.');
    });
  }

  /* ── Accesso anonimo e token ── */
  var inCorso = null;
  function nuovoAccesso() {
    return http(AUTH_URL + '/accounts:signUp?key=' + API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }).then(function (j) {
      mem = { uid: j.localId, refresh: j.refreshToken, token: j.idToken,
              scade: Date.now() + (Number(j.expiresIn) || 3600) * 1000, account: null };
      scriviMem();
      return mem;
    }, function (e) {
      if (/ADMIN_ONLY|OPERATION_NOT_ALLOWED/.test(e.message)) throw errore('Gli account non sono ancora attivi su Firebase.');
      throw e;
    });
  }
  function rinnova() {
    return http(TOKEN_URL + '/token?key=' + API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(mem.refresh)
    }).then(function (j) {
      mem.token = j.id_token; mem.refresh = j.refresh_token || mem.refresh;
      mem.scade = Date.now() + (Number(j.expires_in) || 3600) * 1000;
      scriviMem();
      return mem;
    }, function (e) {
      if (e.status === 400 || e.status === 401 || e.status === 403) {   // utente cancellato: si riparte da zero
        var aveva = !!mem.account;
        mem = {}; scriviMem(); if (aveva) avvisa();
        return nuovoAccesso();
      }
      throw e;
    });
  }
  // Promise<mem> con un token valido; crea l'accesso anonimo solo se serve
  function sessione() {
    if (!API_KEY) return Promise.reject(errore('Gli account non sono ancora attivi.'));
    if (mem.uid && mem.token && mem.scade - 60000 > Date.now()) return Promise.resolve(mem);
    if (!inCorso) {
      inCorso = (mem.uid && mem.refresh ? rinnova() : nuovoAccesso())
        .then(function (m) { inCorso = null; return m; }, function (e) { inCorso = null; throw e; });
    }
    return inCorso;
  }

  /* ── Database ── */
  function db(percorso, metodo, corpo, extra) {
    return sessione().then(function (m) {
      var url = DB_URL + '/' + percorso + '.json?auth=' + encodeURIComponent(m.token) + (DB_QUERY ? '&' + DB_QUERY : '');
      var opz = { method: metodo || 'GET' };
      if (extra && extra.keepalive) opz.keepalive = true;   // la richiesta arriva anche se intanto cambi pagina
      if (corpo !== undefined) { opz.headers = { 'Content-Type': 'application/json' }; opz.body = JSON.stringify(corpo); }
      return http(url, opz).catch(function (e) {
        if (e.status === 401 || e.status === 403) {
          e.negato = true;
          e.message = 'Il database ha rifiutato la richiesta: forse le regole Firebase non sono ancora aggiornate.';
        }
        throw e;
      });
    });
  }
  var ORA = { '.sv': 'timestamp' };

  function etichetta() {
    var ua = navigator.userAgent || '', cosa = 'Dispositivo', con = '';
    if (/iPhone/.test(ua)) cosa = 'iPhone';
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) cosa = 'iPad';
    else if (/Android/.test(ua)) cosa = /Mobile/.test(ua) ? 'Telefono Android' : 'Tablet Android';
    else if (/Macintosh/.test(ua)) cosa = 'Mac';
    else if (/Windows/.test(ua)) cosa = 'PC Windows';
    else if (/Linux/.test(ua)) cosa = 'PC Linux';
    if (/Edg\//.test(ua)) con = 'Edge'; else if (/Firefox|FxiOS/.test(ua)) con = 'Firefox';
    else if (/Chrome|CriOS/.test(ua)) con = 'Chrome'; else if (/Safari/.test(ua)) con = 'Safari';
    return (cosa + (con ? ' · ' + con : '')).slice(0, 40);
  }

  // Rilegge da Firebase a quale account appartiene questo dispositivo
  function controlla() {
    if (!API_KEY || !mem.uid) return Promise.resolve(stato());
    var primaJ = JSON.stringify(stato());
    return db('uid2account/' + mem.uid).then(function (id) {
      if (!id) return null;
      return db('account/' + id).then(function (a) {
        if (a && a.dispositivi && a.dispositivi[mem.uid]) return { id: id, nome: String(a.nome || '') };
        return 'tolto';
      }, function (e) { if (e.negato) return 'tolto'; throw e; });
    }).then(function (acc) {
      if (acc === 'tolto') {           // un altro dispositivo ci ha scollegati
        db('uid2account/' + mem.uid, 'DELETE').catch(function () {});
        acc = null;
      }
      mem.account = acc; scriviMem();
      if (JSON.stringify(stato()) !== primaJ) avvisa();
      return stato();
    }).catch(function () { return stato(); });   // offline: resta l'ultimo stato noto
  }

  function crea(nome) {
    nome = String(nome || '').trim();
    if (!nome) return Promise.reject(errore('Scrivi un nome.'));
    if (nome.length > 20) return Promise.reject(errore('Massimo 20 caratteri.'));
    if (!NOME_OK.test(nome)) return Promise.reject(errore('Solo lettere, numeri, spazi e trattini.'));
    if (mem.account) return Promise.reject(errore('Questo dispositivo ha già un account.'));
    var k = chiave(nome), id;
    var preso = errore('Il nome ' + nome + ' è già di un account. Se è tuo, entra con un codice da un dispositivo già collegato.');
    return sessione().then(function (m) {
      id = m.uid;
      return db('nomi/' + k);
    }).then(function (proprietario) {
      if (proprietario) throw preso;
      var disp = {}; disp[id] = { nome: etichetta(), data: ORA };
      return db('account/' + id, 'PUT', { nome: nome, creato: ORA, dispositivi: disp });
    }).then(function () {
      return db('uid2account/' + id, 'PUT', id);
    }).then(function () {
      return db('nomi/' + k, 'PUT', id).catch(function (e) {
        // qualcuno ha preso il nome un attimo prima: si annulla tutto
        return db('uid2account/' + id, 'DELETE')
          .then(function () { return db('account/' + id, 'DELETE'); })
          .catch(function () {})
          .then(function () { throw e.negato ? preso : e; });
      });
    }).then(function () {
      mem.account = { id: id, nome: nome }; scriviMem(); avvisa();
      return stato();
    });
  }

  function nuovoCodice() {
    var a = new Uint32Array(6), s = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 6; i++) s += ALFABETO[a[i] % ALFABETO.length];
    return s;
  }
  function mostra(c) { return c.slice(0, 3) + '-' + c.slice(3); }

  var ultimoCodice = null;
  function codice() {
    if (!mem.account) return Promise.reject(errore('Prima crea un account o entra con un codice.'));
    var c = nuovoCodice(), id = mem.account.id;
    var vecchio = ultimoCodice; ultimoCodice = c;
    if (vecchio) db('abbinamenti/' + vecchio, 'DELETE').catch(function () {});
    return db('abbinamenti/' + c, 'PUT', { account: id, creato: ORA }).then(function () {
      return { codice: c, mostra: mostra(c), scade: Date.now() + DURATA_CODICE };
    }, function (e) {
      if (e.negato) return controlla().then(function () { throw errore('Questo dispositivo non è più collegato all\'account.'); });
      throw e;
    });
  }

  function usaCodice(testo) {
    var c = String(testo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6) return Promise.reject(errore('Il codice ha 6 caratteri, tipo K7M-4QX.'));
    if (mem.account) return Promise.reject(errore('Questo dispositivo è già nell\'account ' + mem.account.nome + '. Esci prima.'));
    var sbagliato = errore('Codice sbagliato o scaduto. Creane uno nuovo sull\'altro dispositivo.');
    var ab, uid;
    return sessione().then(function (m) {
      uid = m.uid;
      return db('abbinamenti/' + c);
    }).then(function (x) {
      if (!x || !x.account || !(Number(x.creato) + DURATA_CODICE > Date.now() - 120000)) throw sbagliato;
      ab = x;
      return db('account/' + ab.account + '/dispositivi/' + uid, 'PUT', { nome: etichetta(), data: ORA, codice: c })
        .catch(function (e) { throw e.negato ? sbagliato : e; });
    }).then(function () {
      return db('uid2account/' + uid, 'PUT', ab.account);
    }).then(function () {
      db('abbinamenti/' + c, 'DELETE').catch(function () {});   // il codice vale una volta sola
      return db('account/' + ab.account + '/nome');
    }).then(function (nome) {
      mem.account = { id: ab.account, nome: String(nome || '') }; scriviMem(); avvisa();
      return stato();
    });
  }

  function dispositivi() {
    if (!mem.account) return Promise.resolve([]);
    return db('account/' + mem.account.id + '/dispositivi').then(function (d) {
      d = d || {};
      return Object.keys(d).map(function (u) {
        return { uid: u, nome: String((d[u] && d[u].nome) || 'Dispositivo'), data: Number(d[u] && d[u].data) || 0, questo: u === mem.uid };
      }).sort(function (a, b) { return (b.questo - a.questo) || (a.data - b.data); });
    }, function (e) {
      if (e.negato) return controlla().then(function () { return []; });
      throw e;
    });
  }

  function togli(uid) {
    if (!mem.account) return Promise.reject(errore('Nessun account su questo dispositivo.'));
    if (uid === mem.uid) return esci().then(function () {});
    return db('account/' + mem.account.id + '/dispositivi/' + uid, 'DELETE').then(function () {});
  }

  // Scollega questo dispositivo. Se era l'ultimo, l'account si cancella e il nome torna libero.
  function esci() {
    if (!mem.account) return Promise.resolve(stato());
    var acc = mem.account, uid = mem.uid;
    return db('account/' + acc.id + '/dispositivi').then(function (d) {
      var altri = Object.keys(d || {}).filter(function (u) { return u !== uid; });
      if (altri.length) return db('account/' + acc.id + '/dispositivi/' + uid, 'DELETE');
      return db('nomi/' + chiave(acc.nome), 'DELETE').catch(function () {})
        .then(function () { return db('account/' + acc.id, 'DELETE'); });
    }).catch(function (e) { if (!e.negato) throw e; }).then(function () {
      return db('uid2account/' + uid, 'DELETE').catch(function () {});
    }).then(function () {
      mem = {}; scriviMem(); avvisa();     // al prossimo accesso questo dispositivo avrà un uid nuovo
      return stato();
    });
  }

  // Promise<boolean>: true se il nome è libero o è di questo account; false se è di un altro account.
  // Se Firebase non risponde dice true: tanto le regole impediscono comunque di salvarci sopra.
  function nomeLibero(nome) {
    var k = chiave(nome);
    if (!API_KEY || !k) return Promise.resolve(true);
    return http(DB_URL + '/nomi/' + encodeURIComponent(k) + '.json' + (DB_QUERY ? '?' + DB_QUERY : '')).then(function (id) {
      return !id || !!(mem.account && mem.account.id === id);
    }, function () { return true; });
  }
  function nomePreso(nome) {
    return 'Il nome ' + String(nome).trim() + ' è già di un altro giocatore. Scegline un altro, oppure, se è tuo, entra con il tuo account dalla home (👤).';
  }

  function token() {
    if (!API_KEY || !mem.account) return Promise.resolve(null);
    return sessione().then(function (m) { return m.token; }, function () { return null; });
  }

  var pronto = controlla();

  window.GoGoAccount = {
    attivo: !!API_KEY, pronto: pronto, stato: stato, crea: crea, codice: codice, usaCodice: usaCodice,
    db: db, leggi: function (p) { return http(DB_URL + '/' + p + '.json' + (DB_QUERY ? '?' + DB_QUERY : '')); },
    dispositivi: dispositivi, togli: togli, esci: esci, token: token, chiave: chiave, nomeLibero: nomeLibero, nomePreso: nomePreso, controlla: controlla,
    suCambio: function (fn) {
      if (typeof fn !== 'function') return;
      ascoltatori.push(fn);
      var via = function () { var k = ascoltatori.indexOf(fn); if (k >= 0) ascoltatori.splice(k, 1); };
      if (window.GoGoFilo && GoGoFilo.diPagina()) GoGoFilo.alUscita(via);   // filodiffusione: via quando esci dalla pagina
      return via;
    }
  };
})();
