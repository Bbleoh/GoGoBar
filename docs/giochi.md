# I giochi

Stato a fine novembre 2026. Per i numeri esatti fa fede il codice: qui c'è quello che serve per orientarsi e le decisioni già prese con Leo, da non rimettere in discussione senza chiedere.

## La Bisca der Tromba · `giochi/bisca-del-tromba/`

Casinò con il "Tromba" come croupier. Il titolo si scrive "La Bisca der Tromba", la cartella resta `bisca-del-tromba`.

- **Struttura:** `index.html` contiene lobby, blackjack, economia, trofei (`TROFEI`) e il registro `ORIGINALI`. Ogni altro tavolo ha il suo `nome.js` + `nome.css` caricati con `?v=N`. Il tavolo attivo è `body[data-gioco=lobby|blackjack|roulette|slot|plinko|portiere|mine|...]`.
- **Tavoli:** blackjack, roulette, slot "Cinquegirelli", Plinko, Il Portiere, Mine, e una seconda fila di "originali" (Hi-Lo, Dice, Torre del Drago, Talpe, Keno, Tromba Time) costruiti su `originali.js` (`ogBase(id, {...})`).
- **Economia a buy-in:** tavoli da 100 / 1.000 / 10.000 / 100.000 GGB pagati dal portafogli GoGoldBar. Fiches in % dello stack, puntata massima 30× il buy-in, fiches congelate a 60×, salto automatico al tavolo superiore a 100× (slot, plinko e simili saltano appena raggiungi il buy-in successivo). Cash-out solo dopo 20 giocate; in bancarotta il resto torna al portafogli.
- **Regole confermate da Leo:** il banco sta su soft 17, A+10 dopo uno split vale blackjack (3:2). La moneta del blackjack (`#moneta-btn`) arrotonda lo stack in modo equo.
- **RTP:** ogni tavolo è tarato tra ~94% e ~99% (simulazioni). Cap delle vincite 1000×.
- **Classifica unica:** `bisca/profitti/<chiave>` = `{ nome, punti, tavolo, data }`, `punti` = miglior profitto di un cash-out (cash-out − buy-in), anche negativo. API `window.BiscaClassifica` in `classifica.js`. I salvataggi falliti restano in `localStorage` `biscaClassificaPendenti.v1` e si ritentano.
- **Partite a metà** (mine, portiere, hi-lo, torre, talpe) salvate nelle stats dell'account e chiuse al ricaricamento.
- Voci del croupier in `assets/voci/`; le battute nei fumetti le scriverà Leo.

## Corri Marf! · `giochi/corri-marf/`

Endless runner laterale su canvas, in un solo `index.html` (JS ES5 in una IIFE, quasi 5.000 righe). Marf corre a destra per Roma (Laurentina, EUR, Garbatella) e tre ragazze lo inseguono.

- **Comandi:** salto, doppio salto, scivolata; canne lanciate con freccia destra o swipe in su. **Non limitare mai i controlli**, neanche nel boss: Leo ha già bocciato due volte la scivolata limitata.
- **Vite:** 3 colpi e sei preso. **Punteggio:** solo i metri. Le canne raccolte vanno nel portafogli del gioco e si spendono nel Crivo Shop e nell'Officina di Vito (potenziamenti in `upg/`).
- **Boss "MaDeLucata"** ogni 10 km (circa 8 minuti di corsa, ~267 canne). Tutto (prezzi, effetti, frequenze) è calibrato sul boss a 10 km.
- **Altro:** palazzi in cui entrare (corridoi alto/mezzo/basso), missioni giornaliere, 41 trofei (salvati come `upg/tr_<id>`), formazioni di ostacoli, sciame di jet.
- **Firebase:** `corrimarf/classifica` e `corrimarf/giocatori/<chiave>` (canne, upgrade). Un campo nuovo del giocatore va aggiunto sia a `salvaGiocatore` sia a `firebase/regole.json` (lì c'è `$altro: false`).
- **Cartelle:** `ogg/` ostacoli, `sfondo/` quartieri e landmark, `palazzo/`, `boss/`, `shop/`, `sfx/` (licenze in `LICENZA.txt`), `fx/` particelle.
- **Personaggi:** ritagliati da fogli con le parti del corpo (testa, busto, braccia, gambe) e animati con uno scheletro in canvas (`RIG_DATI`).
- **Stile UI:** font Chakra Petch, angoli smussati, bottoni a parallelogramma.
- **Test:** `#prova` = invincibile e `window.corriMarfProva`; `#beta` = boss a 500 m con 30 canne, punteggi non salvati.
- Accesso a pagamento: 5.000 GGB.

## Resident Crevil: morte sul greppo · `giochi/resident-crevil/`

Horror 3D in prima persona di notte nei boschi di Capricchia (vicino ad Amatrice), stile Slender + Alien Isolation, con look PS1. Ex "Slenderrino" (`giochi/slenderrino/` è un redirect).

- **Tecnica:** three.js r170 in `lib/`, codice in `gioco.js` (moduli ES), stile in `stile.css`. Render a bassa risoluzione con vertex snapping e dither (`ps1Shader`), texture 64 px in `texture/ps1/`. Bersaglio prestazioni: da un Poco F4 fino a un iPhone SE.
- **Mappa:** quadrato reale di 1300 m scalato a metà (`SCALA = 0.5`). I dati in `mappa/` sono in metri reali, le costanti in `gioco.js` in metri di gioco.
- **Storia:** il giocatore è Crivo. Guerrino (87 anni) è la spalla comica: ti accompagna alla Fonticella e poi prende a pugni gli alberi. Papi (uomo col cappotto nero, ~4,5 m) è l'entità che ti vuole portare dai suoi figli (Caro e Bimba). Raccogli 10 fogli (disegni da bambino), li porti a Guerrino che ti dà statuette e la roncola, poi affronti Papi nella sua casa.
- **Meccaniche:** telefono come torcia, batteria, GPS solo in quota, statuette che fanno da zone sicure e checkpoint, salvataggio in `localStorage` `residentcrevil.partita`. Difficoltà Normale e Incubo (Incubo ha la sua classifica e azzera alla morte).
- **Firebase:** `residentcrevil/classifica` e `residentcrevil/classificaIncubo` (tempo, più basso è meglio).
- **Audio:** colonna sonora di Leo (10 stem in loop sincronizzati, ognuno con il suo trigger). I volumi si regolano con `mixer.html`: Leo fa il mix lì e incolla in chat "Mix di Resident Crevil: {...}", e quei numeri vanno in `def` dentro `mix.js` (`CANALI`). Preferisci questo a cambiare volumi a orecchio.
- **Modelli:** GLB alleggeriti con gltfpack. Non mettere le clip di un export Rodin sulla mesh di un altro: gli scheletri sono diversi.
- **Debug:** `window.__crevil` (`PROVA.congela`, `PROVA.tempo`, `stato()`, `caccia()`, ...), `?veloce` accorcia le attese.
- Leo decide la direzione un pezzo alla volta: costruisci solo quello che chiede.

## Strumenti fuori dalla repo

Alcuni script di preparazione asset (ritaglio personaggi, sprite audio, texture PS1, preparazione musica, prove Playwright) e i file sorgente pesanti (WAV, ZIP dei modelli) stanno nei file di progetto di Leo, non in questa repo. Se ti servono, chiedili a Leo.
