# Benvenuto su GoGoBar

Guida per chi entra a lavorare sulla repo con Claude Code. Leggila una volta; poi le regole di tutti i giorni le trova da solo Claude in [CLAUDE.md](CLAUDE.md).

## In due righe

GoGoBar (https://gogobar.org) è il sito che Leo ha fatto per divertimento per sé e gli amici: video, musica e giochi nel browser. È un sito statico su GitHub Pages, senza build: quello che finisce su `main` è online dopo circa 40 secondi. Quasi tutto il codice l'ha scritto Claude su indicazione di Leo, in italiano.

Documenti:

| File | Per cosa |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Regole, struttura e flusso di lavoro. Claude Code lo legge da solo all'avvio |
| [docs/sito.md](docs/sito.md) | Moduli comuni: contenuti, account, valuta GGB, radio, filodiffusione, Firebase |
| [docs/giochi.md](docs/giochi.md) | Bisca der Tromba, Corri Marf!, Resident Crevil: com'è fatto ognuno e cosa è già deciso |

## 1. Accessi

Chiedi a Leo:

- **GitHub:** l'invito come collaboratore su `Bbleoh/GoGoBar` (permesso Write). Accettalo da email o da https://github.com/notifications.
- **Firebase (facoltativo):** accesso alla console del progetto `gogobar-ed267`, solo se devi toccare database o regole. Senza accesso puoi lavorare lo stesso: le regole nuove le incolla Leo.

Non servono chiavi o segreti: la chiave Firebase in `js/account.js` è pubblica per natura.

## 2. Preparare il computer

Ti servono:

- `git`
- Python 3 (solo per il server locale `python3 -m http.server`)
- un browser
- facoltativo: `ffmpeg` (per convertire audio) e Node.js (per Playwright o per gli emulatori Firebase)

```bash
git clone https://github.com/Bbleoh/GoGoBar.git
cd GoGoBar
python3 -m http.server 8000
# apri http://localhost:8000/
```

Attenzione: anche in locale il sito parla con il database vero. Punteggi e GGB che fai mentre provi finiscono online. Per i giochi usa le modalità test (`#prova` su Corri Marf, vedi [CLAUDE.md](CLAUDE.md)).

## 3. Configurare Claude Code

1. Installa Claude Code seguendo https://code.claude.com/docs (installer nativo, oppure `npm install -g @anthropic-ai/claude-code`) e fai login con il tuo account Claude.
2. Apri un terminale nella cartella della repo e lancia `claude`.
3. Claude carica da solo `CLAUDE.md`: sa già che deve scrivere in italiano, alzare i `?v=N`, non toccare i segreti, lavorare su un ramo e aprire una PR.
4. Per le PR serve la CLI di GitHub: installa `gh` e fai `gh auth login`, così Claude può fare push e aprire PR a nome tuo.
5. Facoltativo: se vuoi le tue preferenze personali (es. lingua, permessi dei comandi), mettile in `~/.claude/CLAUDE.md` o in `.claude/settings.local.json`. Quest'ultimo è nel `.gitignore`: non va committato.

Funziona anche **Claude Code sul web** (https://claude.ai/code): collega il tuo GitHub, scegli la repo `Bbleoh/GoGoBar` e lavora da lì. Anche lì `CLAUDE.md` viene letto in automatico.

Una prima richiesta utile per prendere confidenza:

> Leggi CLAUDE.md e docs/, poi fammi un giro del sito e dimmi da dove partiresti per aggiungere un video nuovo.

## 4. Lavorare in due sulla stessa repo

Leo lavora soprattutto con le sessioni di Claude, che aprono PR da rami `claude/...` e le mergiano da sole quando sono provate. Quindi `main` si muove spesso.

- **Parti sempre da `main` aggiornato** e fai un ramo per ogni cosa: `git fetch origin && git checkout -B tuonome/cosa origin/main`.
- **PR piccole, un'area per volta.** Prima di aprirla, porta dentro `main` (`git merge origin/main`) e risolvi i conflitti.
- **Dillo a Leo prima di lavorare sullo stesso gioco** che sta facendo lui: i file grandi (`giochi/corri-marf/index.html`, `giochi/bisca-del-tromba/index.html`, `giochi/resident-crevil/gioco.js`, `contenuti.js`, `index.html`) vanno in conflitto facilmente.
- **Merge squash.** Mergia tu la tua PR quando è provata, a meno che non tocchi aree di Leo o roba condivisa grossa (account, GGB, regole Firebase): lì aspetta il suo ok.
- **Regole Firebase:** se le cambi, scrivi in cima alla PR "Leo deve incollare `firebase/regole.json` nella console". Fino ad allora le scritture nuove falliscono.
- **Dopo il merge** controlla che il deploy di Pages sia andato (tab Actions, workflow "pages build and deployment"). Se va in timeout, un piccolo commit nuovo su `main` lo sblocca meglio di un re-run.
- **Cache:** Pages tiene i file in cache ~10 minuti. Per vedere subito le modifiche serve il `?v=N` alzato e un Ctrl+Shift+R.

## 5. Cosa non committare

- Segreti di qualsiasi tipo: token, file di account di servizio Firebase, `.env`, password.
- File sorgente pesanti: WAV, ZIP, OBJ, modelli 3D grezzi. In repo vanno MP3 192 kbps, immagini WebP/JPG, GLB alleggeriti.
- Dati personali degli amici oltre a quelli che Leo ha già messo sul sito.

Ricorda che tutto quello che è nella repo è scaricabile da gogobar.org, anche i file `.md`.

## 6. Chi decide cosa

- Testi, nomi, battute e direzione dei giochi li decide Leo. Se un testo sembra sbagliato, chiedi prima di correggerlo: spesso è voluto.
- Musica, voci e molti disegni sono di Leo e degli amici. Gli asset esterni devono essere CC0 o CC BY, con il file di licenza accanto.
