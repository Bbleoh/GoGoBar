# GoGoBar · istruzioni per Claude Code

Questo file lo legge in automatico Claude Code in ogni sessione dentro questa repo.
La guida per le persone (setup, primo giro) è in [ONBOARDING.md](ONBOARDING.md).
I dettagli dei giochi sono in [docs/giochi.md](docs/giochi.md), quelli dei moduli comuni in [docs/sito.md](docs/sito.md).

## Cos'è

GoGoBar è un sito fatto per divertimento da Leo (GitHub `Bbleoh`) per sé e gli amici del Collettivo M.I.A.O.
Ospita video (YouTube non in elenco), musica (MP3 nostri) e videogiochi nel browser.

- Sito statico su **GitHub Pages**, ramo `main`, cartella radice. Dominio `gogobar.org` (file `CNAME`), copia anche su https://bbleoh.github.io/GoGoBar/.
- Nessun build, nessun bundler, nessun `package.json`: HTML, CSS e JavaScript scritti a mano. Quello che è in `main` è quello che va online (~40 s dopo il merge).
- `.nojekyll` è voluto: non toglierlo.
- Backend: solo **Firebase Realtime Database** (progetto `gogobar-ed267`) via REST, più Firebase Anonymous Auth. Niente SDK Firebase.

## Lingua e tono

- Tutto in **italiano**: testi del sito, nomi di variabili e funzioni, commenti, messaggi di commit, PR.
- I testi di gioco e i nomi li decide Leo: usa le sue frasi esatte, non riscriverle né "correggerle" (es. "La Bisca der Tromba" è voluto).
- Risposte brevi e dirette.

## Mappa della repo

| Percorso | Cosa c'è |
| --- | --- |
| `index.html` | Home: hero con mascotte (maneki neko), sezioni giochi/video/musica, carosello classifiche (`GIOCHI_CLASSIFICA`), clic sul neko = GGB |
| `contenuti.js` | **L'unica fonte dei contenuti**: `CONTENUTI.giochi`, `.video` (playlist), `.musica` (album), `.chiSiamo`. Istruzioni in testa al file |
| `video/`, `musica/`, `profilo/`, `chi-siamo/` | Pagine Video, Musica (giradischi e scaffale album), Area personale, Chi siamo |
| `js/account.js`, `js/account-ui.js` | Account senza password (Firebase Anonymous Auth + codice di abbinamento) |
| `js/gogoldbar.js` | Valuta del sito GoGoldBar (GGB), trofei, paywall |
| `js/radio.js` | Il lettore unico del sito (radio) |
| `js/filodiffusione.js` | Navigazione "morbida" tra le pagine così la musica non si ferma |
| `js/copertina.js` | Copertine segnaposto disegnate per gli album senza immagine |
| `firebase/regole.json` | Regole del database. **Leo le incolla a mano** nella console Firebase |
| `giochi/bisca-del-tromba/` | Casinò "La Bisca der Tromba" (blackjack, roulette, slot, plinko, mine, ...) |
| `giochi/corri-marf/` | "Corri Marf!", endless runner 2D su canvas, un solo `index.html` |
| `giochi/resident-crevil/` | "Resident Crevil: morte sul greppo", horror 3D in three.js r170 (in `lib/`) |
| `giochi/slenderrino/`, `BlackjackTromba/` | Solo redirect a vecchi indirizzi: lasciali |
| `musica/brani/`, `musica/copertine/`, `audio/`, `img/` | Media |

## Regole che contano

1. **Cache di Pages (~10 minuti).** I file JS/CSS si caricano con `?v=N` (es. `contenuti.js?v=28`, `radio.js?v=16`, `gogoldbar.js?v=7`). Quando modifichi un file, **alza N in tutte le pagine che lo caricano** (`grep -rn "nomefile.js?v=" .`). Una volta un `contenuti.js` vecchio in cache ha svuotato la home.
2. **Firebase.** Se cambi un percorso del database o la forma dei dati, aggiorna `firebase/regole.json` e scrivi nella PR che Leo deve incollarle nella console. Senza le regole nuove le scritture falliscono in silenzio (es. Bisca a 0 GGB, Corri Marf bloccato per tutti).
3. **Il database è quello vero.** Anche in locale (`localhost`) le scritture vanno sulle classifiche e sui portafogli reali. Per provare usa le modalità test dei giochi (sotto) o gli emulatori Firebase; non lasciare punteggi finti in classifica.
4. **JS classico, niente dipendenze npm** sul sito (unica eccezione: Resident Crevil usa moduli ES, `gioco.js` con three.js da `lib/`). Ogni pagina ha il suo codice inline in una IIFE `(function () { ... })()`. Le librerie esterne vanno copiate nella repo (come three.js in `giochi/resident-crevil/lib/`), mai da CDN.
5. **Pagine in filodiffusione** (home, musica, video, profilo, chi-siamo): il codice inline viene rieseguito a ogni visita. Dentro una IIFE, pulizia con `GoGoFilo.alUscita(fn)`, e `history.replaceState(history.state, ...)` mai con `null`. Istruzioni in testa a `js/filodiffusione.js`.
6. **Account e nomi.** L'account è globale sul sito, niente ospiti e niente omonimi nei giochi (`GoGoAccount.nomeLibero`). Le classifiche sono indicizzate per nome tramite `GoGoAccount.chiave(nome)`.
7. **Footer senza link GitHub.**
8. **Suoni:** reali/foley con licenza CC0 o CC BY (licenze in file `LICENZA*.txt` nella cartella `sfx/`), mai 8-bit. Mai inventare asset sostitutivi senza dirlo: meglio un segnaposto chiaro.
9. **Corri Marf: non limitare mai i controlli del giocatore**, neanche durante il boss. Gli exploit si risolvono col design degli attacchi.

## Segreti e cosa NON committare

- Non c'è nessun segreto nella repo e deve restare così.
- La `API_KEY` in `js/account.js` è la **chiave web pubblica** di Firebase: è fatta per stare nel browser, la sicurezza la danno le regole in `firebase/regole.json`. Va bene che sia committata.
- Mai committare: file di account di servizio Firebase (`*-firebase-adminsdk-*.json`), token, `.env`, `.claude/settings.local.json`, password della console, dati personali degli amici (oltre a nomi d'arte e foto che Leo ha messo in `contenuti.js`).
- Niente file enormi: WAV, OBJ, ZIP sorgente e modelli grezzi restano fuori. Musica in MP3 192 kbps, immagini in WebP/JPG, modelli in GLB alleggeriti.
- La repo è pubblica attraverso Pages: tutto quello che committi, anche un `.md`, è scaricabile da gogobar.org.

## Flusso di lavoro

1. Riparti sempre da `main` aggiornato: `git fetch origin main && git checkout -B <ramo> origin/main`.
2. Un ramo per richiesta, PR piccole e su un'area sola. Nomi ramo con prefisso di chi lavora (es. `leo/...`, `marco/...`, `claude/...`).
3. Prova in locale con un server statico dalla radice della repo (vedi sotto) e, se cambi la grafica, guarda la pagina con Playwright o nel browser, anche a larghezza telefono (~390 px).
4. Commit e PR in italiano su `Bbleoh/GoGoBar`, verso `main`. Nella descrizione: cosa cambia, come provarlo, se servono regole Firebase nuove.
5. Merge **squash**. Chi ha aperto la PR la mergia quando è provata (Leo ha delegato i merge). In caso di dubbio su un cambio grosso o su un'area di un altro, chiedi prima.
6. Dopo il merge controlla il workflow "pages build and deployment" (`gh api repos/Bbleoh/GoGoBar/actions/runs?per_page=3`). A volte va in timeout lato GitHub e il sito resta vecchio: un re-run può restare in coda per sempre, meglio mergiare un piccolo commit nuovo.

File a rischio conflitti quando si lavora in due: `contenuti.js`, `index.html`, `firebase/regole.json`, `giochi/bisca-del-tromba/index.html`, `giochi/corri-marf/index.html` (quasi 5.000 righe). Ribasa o fai merge di `main` prima di aprire la PR e risolvi i conflitti a mano.

## Provare in locale

```bash
python3 -m http.server 8000      # dalla radice della repo
# poi http://localhost:8000/
```

- Serve un server: aprendo i file con `file://` fetch, audio e moduli non funzionano.
- Non usare `pkill -f http.server`: salva il PID (`... & echo $! > /tmp/srv.pid`) e chiudi con `kill $(cat /tmp/srv.pid)`.
- Modalità test:
  - Corri Marf: `giochi/corri-marf/#prova` (invincibile, espone `window.corriMarfProva`: `salta`, `giu`, `vai(metri)`, `boss`, ...).
  - Resident Crevil: `window.__crevil` (es. `PROVA.tempo`, `salta`, `caccia`, `stato()`), `?veloce` accorcia le attese.
  - Account con emulatori: `window.GOGOBAR_ACCOUNT_TEST = {apiKey, db, auth, token, dbQuery}` prima di `account.js`; emulatori con `npx firebase-tools emulators:start` (namespace `demo-gogobar-default-rtdb`).
- Playwright con Chromium headless funziona per screenshot e prove; per il 3D di Resident Crevil va lento (swiftshader, ~5 fps): aspetta gli stati invece dei secondi.

## Aggiungere contenuti (i casi più comuni)

- **Video:** in `contenuti.js` → `video`, aggiungi `{ titolo, youtube: '<codice>' }` nella playlist giusta. Alza `contenuti.js?v=`.
- **Brano:** MP3 192 kbps con tag ID3 in `musica/brani/<slug>.mp3` (`ffmpeg -i in.wav -b:a 192k out.mp3`), poi `{ titolo, artisti, prod, file, durata }` nell'album. Se l'album ha `mappa` (zone cliccabili sul retro) il numero di zone deve combaciare con i brani, altrimenti si vede la lista semplice.
- **Gioco nuovo:** cartella `giochi/<nome>/` con `index.html` e `copertina.jpg` 16:9, card in `contenuti.giochi`. Per la classifica in home: un `classifica.js` con `carica(n) → Promise<[{nome, punti, data}]>` (non lancia mai) e una voce in `GIOCHI_CLASSIFICA` di `index.html`. Radio e account: vedi [docs/sito.md](docs/sito.md).

## Brand

Font Fredoka, oro `#e4b33c` su quasi nero. Logo `img/logo-miao.webp`, mascotte maneki neko, sottotitolo "MInchia Anche Org!". Ogni gioco ha il suo stile (Corri Marf: Chakra Petch e angoli smussati; Bisca: tavolo verde e oro; Resident Crevil: look PS1).
