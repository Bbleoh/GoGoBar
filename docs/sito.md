# Il sito: moduli comuni

Riassunto di come funzionano i pezzi condivisi da tutte le pagine. L'API completa di ogni modulo è scritta in testa al suo file in `js/`: leggi quella prima di cambiarlo.

## contenuti.js

Script classico che definisce `CONTENUTI` e le liste piatte `TUTTI_I_VIDEO` e `TUTTI_I_BRANI`. Le pagine calcolano comunque le liste da sole, per difesa.

- `giochi`: card `{ titolo, descrizione, link, immagine, tag, inEvidenza, inArrivo }`.
- `video`: playlist `{ playlist, video: [{ titolo, youtube }] }` (Manicalde, Memozzi, Kasti, Sketch, D'autore, Videoclip). Video YouTube "non in elenco".
- `musica`: album `{ album, copertina, retro?, mappa?, sblocco?, brani: [{ titolo, artisti, prod?, file, durata }] }`. Album: "OG Tracks", "MSF EP", "Re-edit 2026" (a pagamento in GGB), più album segreti sbloccabili giocando ("Corri Marf! OST", "La Bisca der Tromba OST"). `copertina` vuota = segnaposto disegnato da `js/copertina.js`. `mappa` = zone `[left, top, w, h]` in % sul retro, una per brano: la tracklist cliccabile.
- `chiSiamo`: `membri` (10 × `{ nome, foto }`, foto in `img/membri/`) e `luoghi` (`{ nome, lat, lon, livello }`, livello 0/1/2) per la mappa a calore su `img/planisfero.svg`.

Ogni volta che lo cambi, alza `contenuti.js?v=N` in tutte le pagine.

## Account senza password (js/account.js, js/account-ui.js)

- Ogni dispositivo fa login anonimo su Firebase (REST Identity Toolkit, niente SDK) e ottiene un `uid`.
- L'account ha come id l'`uid` del dispositivo che l'ha creato. Un secondo dispositivo si collega con un codice di 6 caratteri (mostrato `K7M-4QX`) valido 5 minuti, generato su un dispositivo già collegato. Lo stesso codice serve a recuperare l'account su un telefono nuovo.
- Database: `account/<id>` `{ nome, creato, dispositivi/<uid> }`, `uid2account/<uid>`, `nomi/<chiave>` (nomi unici), `abbinamenti/<CODICE>` `{ account, scade }`.
- Un nome preso in `nomi/` può essere scritto solo dai dispositivi di quell'account (REST con `?auth=idToken`).
- Nei giochi si gioca solo col proprio account: niente ospiti, niente cambio giocatore, niente omonimi.
- `account-ui.js` disegna il pulsante 👤 e le finestre (home, profilo). La Bisca linka invece alla home `#account`.

## GoGoldBar, la valuta (js/gogoldbar.js)

- Un portafogli per account, uguale su tutto il sito: `ggb/<idAccount>` `{ saldo, click, guadagnati, spesi, trofei, sbloccati, brani, video }`. I numeri cambiano solo con incrementi lato server.
- Si guadagna cliccando il maneki neko in home: 1 GGB a clic più i trofei (+1 per album base ascoltato tutto, +1 per playlist vista tutta, +1 per il "+1" raro nel ticker, +5 per gruppi di trofei di Corri Marf e della Bisca).
- Sblocchi a pagamento: Corri Marf 5.000 GGB (gratis per chi aveva già progressi), Re-edit 2026 10.000 GGB.
- La Bisca usa GGB: il buy-in esce dal portafogli e il cash-out ci torna.
- Il simbolo è solo il glifo di Leo (font di un carattere a U+E000 dentro il file, `GoGoldBar.valuta(n)`). Niente lingotto: è stato provato e tolto.
- I clic in attesa stanno in `localStorage` `gogoldbar.click.v1` e partono con `keepalive`.

## Radio (js/radio.js)

Il lettore unico del sito, con UI in shadow DOM.

- Nei giochi basta `<script src="../../js/radio.js?v=N"></script>`. Usa come pulsante un elemento con `data-gogobar-radio` se c'è, altrimenti mette un pulsante rotondo.
- Mentre suona silenzia `audio#musica` / `audio[data-musica]` del gioco.
- API: `ascolta`, `carica`, `avanti`, `indietro`, `playPausa`, `casuale(v)`, `loop(v)`, `occupata()`, `brani`, `corrente()`.
- Album accesi/spenti in `localStorage` `gogobarRadio.v1.spenti`. Salta gli album bloccati.
- "Staffetta": `localStorage` `gogobarSuona.v1` `{ file, t, suona, ts }` fa riprendere la musica dopo un caricamento pieno (es. home → gioco).
- La pagina Musica è solo una vista sulla radio (niente `<audio>` suo). `body data-radio="nascosta"` nasconde il pulsante.

## Filodiffusione (js/filodiffusione.js)

Navigazione senza ricaricare la pagina tra home, musica, video, profilo e chi-siamo, così la musica non si ferma. I giochi si caricano sempre per intero.

- Per attivarla: `<html lang="it" data-filodiffusione>`, `filodiffusione.js` per primo nell'head, `radio.js` prima degli script della pagina, codice inline in una IIFE.
- Gli script esterni si caricano una volta sola; quelli inline si rieseguono a ogni visita. I loro listener su `window`/`document` e le iscrizioni `suCambio`/`ascolta` si tolgono da sole all'uscita. Per il resto: `GoGoFilo.alUscita(fn)`.
- I moduli marcano con `data-resta` i nodi che aggiungono, che sopravvivono al cambio pagina.
- Eventi su `document`: `gogofilo:uscita` e `gogofilo:pagina`.
- Un video YouTube che parte mette in pausa la radio, e viceversa.

## Firebase

- Progetto `gogobar-ed267`, database `https://gogobar-ed267-default-rtdb.europe-west1.firebasedatabase.app`.
- Rami: `bisca`, `corrimarf`, `residentcrevil`, `account`, `uid2account`, `nomi`, `abbinamenti`, `ggb`.
- Le regole sono in `firebase/regole.json`. Non c'è deploy automatico: **Leo le incolla a mano** in Console Firebase → Realtime Database → Regole. Chi le cambia lo scrive nella PR.
- Le classifiche hanno lettura pubblica e scrittura solo se il punteggio è valido (e di solito solo se migliora). Niente cancellazioni dal client.
- Accesso alla console Firebase: chiedere a Leo.

## Home

- `GIOCHI_CLASSIFICA` in `index.html`: carosello con una slide per gioco. Ogni gioco espone `window.<Gioco>Classifica` con `carica(n) → Promise<[{ nome, punti, data }]>`, che non lancia mai e ritorna `[]` sugli errori.
- Ticker in alto con un "+1" raro (`window.GoGoBarTicker.raro(fn)`), miao raro al tocco del neko (`audio/miao.mp3`).
- Logo e favicon: maneki neko di Leo.
