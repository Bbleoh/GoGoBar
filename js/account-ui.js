/* ════════════════════════════════════════════════════════════════
   PANNELLO ACCOUNT GOGOBAR (👤)
   Script classico, da caricare dopo js/account.js.
   Ogni elemento con l'attributo data-gogobar-account diventa il pulsante
   che apre il pannello: mostra "Entra" oppure il nome dell'account.
   Se gli account sono spenti (manca la chiave API) il pulsante resta nascosto.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.GoGoAccount;
  if (!A || !A.attivo) return;

  var CSS = '' +
    '.gga{margin:auto;max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #2a2a26;border-radius:18px;background:#161614;color:#f4efe2;padding:0;width:min(420px,calc(100vw - 32px));' +
    'font-family:"DM Sans",system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6)}' +
    '.gga::backdrop{background:rgba(0,0,0,.65)}' +
    '.gga *{box-sizing:border-box}' +
    '.gga-in{padding:1.4rem 1.3rem 1.3rem;display:flex;flex-direction:column;gap:.9rem}' +
    '.gga-testa{display:flex;align-items:center;justify-content:space-between;gap:1rem}' +
    '.gga h2{font-family:Fredoka,"DM Sans",sans-serif;font-size:1.45rem;font-weight:700;margin:0}' +
    '.gga h2 span{color:#e4b33c}' +
    '.gga-x{background:none;border:0;color:#c9c0a9;font-size:1.5rem;cursor:pointer;line-height:1;padding:.2rem .4rem}' +
    '.gga p{margin:0;color:#c9c0a9;font-size:.92rem;line-height:1.45}' +
    '.gga-schede{display:grid;grid-template-columns:1fr 1fr;gap:.3rem;background:#0d0d0c;border-radius:999px;padding:.25rem}' +
    '.gga-schede button{border:0;border-radius:999px;padding:.55rem;background:none;color:#c9c0a9;font:inherit;font-size:.88rem;cursor:pointer}' +
    '.gga-schede button.on{background:#1d1d1a;color:#f6d77a}' +
    '.gga label{font-family:"DM Mono",monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#77715f}' +
    '.gga input{width:100%;margin-top:.35rem;padding:.75rem .9rem;border-radius:12px;border:1px solid #2a2a26;background:#0d0d0c;color:#f4efe2;font:inherit;font-size:1rem}' +
    '.gga input:focus{outline:2px solid #e4b33c;outline-offset:1px}' +
    '.gga input.codice{font-family:"DM Mono",monospace;font-size:1.4rem;letter-spacing:.25em;text-transform:uppercase;text-align:center}' +
    '.gga-btn{display:block;width:100%;border:1px solid #e4b33c;border-radius:999px;padding:.75rem 1rem;background:#e4b33c;color:#1a1408;' +
    'font-family:Fredoka,"DM Sans",sans-serif;font-weight:600;font-size:1rem;cursor:pointer}' +
    '.gga-btn:hover{background:#f6d77a}' +
    '.gga-btn.ghost{background:none;color:#f6d77a}' +
    '.gga-btn.ghost:hover{background:rgba(228,179,60,.1)}' +
    '.gga-btn.rosso{background:none;border-color:#d2452f;color:#ff8b77}' +
    '.gga-btn[disabled]{opacity:.55;cursor:wait}' +
    '.gga-err{color:#ff8b77!important;min-height:1.2em}' +
    '.gga-ok{color:#9fd39a!important}' +
    '.gga-codice{text-align:center;background:#0d0d0c;border:1px dashed #e4b33c;border-radius:14px;padding:1rem}' +
    '.gga-codice b{display:block;font-family:"DM Mono",monospace;font-size:2.1rem;letter-spacing:.18em;color:#f6d77a}' +
    '.gga-codice small{font-family:"DM Mono",monospace;color:#77715f;font-size:.75rem}' +
    '.gga ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.35rem}' +
    '.gga li{display:flex;align-items:center;justify-content:space-between;gap:.6rem;background:#1d1d1a;border-radius:12px;padding:.55rem .75rem;font-size:.9rem}' +
    '.gga li small{color:#77715f;font-family:"DM Mono",monospace;font-size:.7rem}' +
    '.gga li button{background:none;border:1px solid #2a2a26;border-radius:999px;color:#c9c0a9;font:inherit;font-size:.78rem;padding:.3rem .7rem;cursor:pointer}' +
    '.gga li button:hover{border-color:#d2452f;color:#ff8b77}' +
    '.gga-sez{display:flex;flex-direction:column;gap:.5rem}';

  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var dlg = document.createElement('dialog');
  dlg.className = 'gga';
  dlg.setAttribute('aria-label', 'Account GoGoBar');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) chiudi(); });   // clic sullo sfondo

  function el(tag, cls, testo) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (testo != null) e.textContent = testo;
    return e;
  }
  function bottone(testo, cls, fn) {
    var b = el('button', 'gga-btn' + (cls ? ' ' + cls : ''), testo); b.type = 'button';
    b.addEventListener('click', fn); return b;
  }
  // esegue p() con il pulsante in attesa e scrive l'errore in errEl
  function attendi(btn, errEl, testoAttesa, p) {
    var prima = btn.textContent;
    btn.disabled = true; btn.textContent = testoAttesa; errEl.textContent = '';
    return p().then(function (x) { btn.disabled = false; btn.textContent = prima; return x; }, function (e) {
      btn.disabled = false; btn.textContent = prima;
      errEl.textContent = (e && e.message) || 'Qualcosa è andato storto, riprova.';
      throw e;
    });
  }

  var timerCodice = null;
  function chiudi() { clearInterval(timerCodice); if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () { clearInterval(timerCodice); });

  function testa(titolo) {
    var t = el('div', 'gga-testa');
    var h = el('h2'); h.innerHTML = titolo;
    var x = el('button', 'gga-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi');
    x.addEventListener('click', chiudi);
    t.append(h, x); return t;
  }

  /* ── Senza account: crea oppure entra con un codice ── */
  function disegnaOspite(scheda) {
    scheda = scheda || 'crea';
    var box = el('div', 'gga-in');
    box.append(testa('Il tuo account <span>GoGoBar</span>'));
    box.append(el('p', null, 'Niente password: questo dispositivo diventa la tua chiave. Con un codice colleghi anche gli altri.'));
    var schede = el('div', 'gga-schede');
    var s1 = el('button', scheda === 'crea' ? 'on' : '', 'Nuovo account');
    var s2 = el('button', scheda === 'codice' ? 'on' : '', 'Ho già un account');
    s1.type = s2.type = 'button';
    s1.onclick = function () { disegna(disegnaOspite('crea')); };
    s2.onclick = function () { disegna(disegnaOspite('codice')); };
    schede.append(s1, s2); box.append(schede);

    var sez = el('div', 'gga-sez'), err = el('p', 'gga-err');
    if (scheda === 'crea') {
      var lab = el('label', null, 'Il tuo nome'), inp = el('input');
      inp.maxLength = 20; inp.placeholder = 'Es. Marf'; inp.autocomplete = 'nickname';
      lab.append(inp);
      var vai = bottone('Crea account', '', function () {
        attendi(vai, err, 'Creo...', function () { return A.crea(inp.value); })
          .then(function () { disegna(disegnaAccount(true)); }, function () {});
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') vai.click(); });
      sez.append(lab, el('p', null, 'Il nome resta tuo: classifiche e salvataggi con quel nome li scrive solo il tuo account. Se nei giochi lo usavi già, ritrovi tutto.'), vai, err);
      setTimeout(function () { inp.focus(); }, 30);
    } else {
      var lab2 = el('label', null, 'Codice'), inp2 = el('input', 'codice');
      inp2.maxLength = 7; inp2.placeholder = 'K7M-4QX'; inp2.autocomplete = 'off'; inp2.spellcheck = false;
      inp2.setAttribute('autocapitalize', 'characters');
      lab2.append(inp2);
      var entra = bottone('Entra', '', function () {
        attendi(entra, err, 'Controllo...', function () { return A.usaCodice(inp2.value); })
          .then(function () { disegna(disegnaAccount(false, true)); }, function () {});
      });
      inp2.addEventListener('keydown', function (e) { if (e.key === 'Enter') entra.click(); });
      sez.append(el('p', null, 'Sul dispositivo dove hai già l\'account apri 👤 e tocca "Collega un dispositivo": ti dà un codice valido 5 minuti.'), lab2, entra, err);
      setTimeout(function () { inp2.focus(); }, 30);
    }
    box.append(sez);
    return box;
  }

  /* ── Con account: codice per gli altri dispositivi, elenco, uscita ── */
  function disegnaAccount(appenaCreato, appenaEntrato) {
    var s = A.stato(), box = el('div', 'gga-in');
    box.append(testa('Ciao, <span></span>'));
    box.querySelector('h2 span').textContent = s.account.nome;
    if (appenaCreato) box.append(el('p', 'gga-ok', 'Account creato! Da ora i giochi usano questo nome.'));
    if (appenaEntrato) box.append(el('p', 'gga-ok', 'Dispositivo collegato. Bentornato!'));

    var err = el('p', 'gga-err');
    var zona = el('div', 'gga-sez');
    var colleg = bottone('Collega un dispositivo', '', function () {
      attendi(colleg, err, 'Creo il codice...', A.codice).then(function (c) {
        var riq = el('div', 'gga-codice'), b = el('b', null, c.mostra), sm = el('small');
        riq.append(b, sm);
        zona.replaceChildren(riq, el('p', null, 'Sull\'altro dispositivo apri GoGoBar, tocca 👤 → "Ho già un account" e scrivi questo codice.'), colleg);
        colleg.textContent = 'Nuovo codice';
        clearInterval(timerCodice);
        var conta = function () {
          var r = Math.max(0, Math.round((c.scade - Date.now()) / 1000));
          sm.textContent = r ? 'scade tra ' + Math.floor(r / 60) + ':' + ('0' + r % 60).slice(-2) : 'scaduto';
          if (!r) { clearInterval(timerCodice); b.style.opacity = '.35'; }
        };
        conta(); timerCodice = setInterval(conta, 1000);
        aggiornaLista();
      }, function () {});
    });
    zona.append(el('p', null, 'Per giocare dallo stesso account su un altro telefono o PC, o per ritrovarlo su un telefono nuovo.'), colleg);
    box.append(zona, err);

    box.append(el('label', null, 'Dispositivi collegati'));
    var ul = el('ul'); ul.append(el('li', null, 'Carico...'));
    box.append(ul);
    var unico = true;
    function aggiornaLista() {
      A.dispositivi().then(function (lista) {
        if (!A.stato().account) return disegna(disegnaOspite('codice'));
        ul.replaceChildren();
        unico = lista.filter(function (d) { return !d.questo; }).length === 0;
        lista.forEach(function (d) {
          var li = el('li'), t = el('span', null, d.nome + ' ');
          t.append(el('small', null, d.questo ? 'questo' : (d.data ? 'dal ' + new Date(d.data).toLocaleDateString('it-IT') : '')));
          li.append(t);
          if (!d.questo) {
            var x = el('button', null, 'Scollega'); x.type = 'button';
            x.onclick = function () {
              if (x.dataset.sicuro !== '1') { x.dataset.sicuro = '1'; x.textContent = 'Sicuro?'; return; }
              x.disabled = true;
              A.togli(d.uid).then(aggiornaLista, function (e) { err.textContent = e.message; x.disabled = false; });
            };
            li.append(x);
          }
          ul.append(li);
        });
      }, function (e) { ul.replaceChildren(el('li', null, (e && e.message) || 'Non riesco a leggere i dispositivi.')); });
    }
    aggiornaLista();

    var esci = bottone('Esci da questo dispositivo', 'rosso', function () {
      if (esci.dataset.sicuro !== '1') {
        esci.dataset.sicuro = '1';
        esci.textContent = unico ? 'Sicuro? È l\'unico dispositivo: l\'account si cancella' : 'Sicuro? Tocca di nuovo per uscire';
        return;
      }
      attendi(esci, err, 'Esco...', A.esci).then(function () { disegna(disegnaOspite('crea')); }, function () {});
    });
    box.append(esci);
    return box;
  }

  function disegna(contenuto) { dlg.replaceChildren(contenuto); }
  function apri() {
    clearInterval(timerCodice);
    disegna(A.stato().account ? disegnaAccount() : disegnaOspite());
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  }

  /* ── Pulsanti 👤 nella pagina ── */
  function aggiornaPulsanti() {
    var s = A.stato();
    [].forEach.call(document.querySelectorAll('[data-gogobar-account]'), function (b) {
      b.hidden = false;
      var ico = document.createElement('span'), txt = document.createElement('span');
      ico.className = 'gga-ico'; ico.textContent = '👤 ';
      txt.className = 'gga-txt'; txt.textContent = s.account ? s.account.nome : 'Entra';
      b.replaceChildren(ico, txt);
      b.classList.toggle('gga-dentro', !!s.account);
      b.title = s.account ? 'Il tuo account GoGoBar' : 'Crea il tuo account GoGoBar o entra con un codice';
      if (!b.dataset.ggaPronto) { b.dataset.ggaPronto = '1'; b.addEventListener('click', apri); }
    });
  }
  aggiornaPulsanti();
  A.suCambio(function () {
    aggiornaPulsanti();
    if (dlg.open && !A.stato().account) disegna(disegnaOspite('crea'));
  });
  A.pronto.then(aggiornaPulsanti);

  window.GoGoAccountUI = { apri: apri };
})();
