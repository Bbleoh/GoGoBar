# GoGoBar

Il sito del Collettivo M.I.A.O., online su **[gogobar.org](https://gogobar.org)**.

È un sito statico: GitHub Pages pubblica così com'è la radice del ramo `main`, senza build.
Ogni cartella con un `index.html` è un indirizzo del sito, quindi **spostare o rinominare una
cartella di pagina cambia un link pubblico**: GitHub Pages non fa redirect, e il vecchio indirizzo
smette di funzionare.

## Com'è fatto il repo

```
index.html              home (giochi, musica, video, maneki neko che dà le GoGoldBar)
contenuti.js            ← l'unico file da toccare per aggiungere giochi, brani, album e video
CNAME, favicon.ico, .nojekyll   roba di GitHub Pages: non spostare

musica/  video/  profilo/  chi-siamo/     le altre pagine del sito (un index.html ciascuna)
musica/brani/           tutti gli mp3 (anche le colonne sonore dei giochi, che li prendono da qui)
musica/copertine/       copertine degli album

giochi/<gioco>/         un gioco per cartella, sempre con:
    index.html            la pagina del gioco
    copertina.jpg         la copertina della card in home
    classifica.js         classifiche e salvataggi online (li usa anche la home)
    stile.css, *.js       il codice del gioco
    sottocartelle         immagini, suoni, modelli... divisi per tipo

risorse/                tutto quello che è in comune tra le pagine
    js/                   script condivisi (vedi sotto)
    img/                  logo, maneki neko, icone del sito, planisfero
    audio/                suoni del sito (miao)

firebase/regole.json    regole del Realtime Database (da incollare nella console di Firebase)
```

### I giochi

| Cartella | Gioco | Codice |
| --- | --- | --- |
| `giochi/bisca-del-tromba/` | La Bisca der Tromba | `bisca.js` (lobby, buy-in, blackjack, portafogli, trofei), `stile.css`; gli altri tavoli in `tavoli/`, un file ciascuno; immagini, video e voci in `assets/` |
| `giochi/corri-marf/` | Corri Marf! | `gioco.js`, `stile.css`; immagini in `personaggi/`, `ogg/`, `sfondo/`, `palazzo/`, `boss/`, `fx/`, `shop/`; effetti in `sfx/` |
| `giochi/resident-crevil/` | Resident Crevil: morte sul greppo | `gioco.js` (modulo ES con three.js in `lib/`), `stile.css`, `mix.js`; `mixer.html` è il mixer dei suoni per chi sviluppa |

### Gli script condivisi (`risorse/js/`)

Sono script classici (niente build, niente moduli) che definiscono un oggetto globale.
Trovano la radice del sito da soli, partendo dal proprio indirizzo.

| File | Definisce | A cosa serve |
| --- | --- | --- |
| `database.js` | `GoGoDB` | indirizzo del database Firebase e richieste REST, usato da account e classifiche |
| `account.js` | `GoGoAccount` | account senza password (accesso anonimo + codice per collegare i dispositivi) |
| `account-ui.js` | | il pannello 👤 |
| `gogoldbar.js` | `GoGoldBar` | la valuta del sito: portafogli, trofei, sblocchi |
| `radio.js` | | la radio: suona i brani di `contenuti.js` anche dentro i giochi |
| `filodiffusione.js` | `GoGoFilo` | cambio pagina senza ricaricare, così la musica non si ferma |
| `copertina.js` | `GoGoCopertina` | copertine degli album (anche quelle provvisorie) |

L'ordine conta: `database.js` → `account.js` → `account-ui.js` / `gogoldbar.js` → `classifica.js` dei giochi.

## Come si fa

**Aggiungere un gioco, un brano, un album o un video**: si fa tutto in `contenuti.js`, le
istruzioni sono in cima al file. Per un gioco nuovo, crea `giochi/<nome>/` con `index.html` e
`copertina.jpg` e copia la struttura di un gioco che c'è già.

**Cambiare un file CSS o JS**: aumenta il numero dopo `?v=` dove viene caricato
(es. `stile.css?v=13` → `?v=14`), se no i browser continuano a usare quello vecchio.

**Provare il sito sul computer**: dalla radice del repo

```sh
python3 -m http.server 8000
```

e apri <http://localhost:8000>. Aprire i file direttamente (`file://`) non funziona: i giochi
caricano dati con `fetch` e Resident Crevil usa i moduli ES.

## Firebase

Classifiche, account e GoGoldBar stanno nel Realtime Database del progetto `gogobar-ed267`.
L'indirizzo è in `risorse/js/database.js`, la chiave API web in `risorse/js/account.js`.
Le regole sono in `firebase/regole.json`: quando le cambi, incollale anche nella console di Firebase
(Realtime Database → Regole), perché il sito non le carica da solo.
