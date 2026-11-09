/*
 * ════════════════════════════════════════════════════════════════
 *  CONTENUTI DI GOGOBAR
 *  Questo è l'unico file da toccare per aggiungere roba al sito.
 * ════════════════════════════════════════════════════════════════
 *
 *  Ogni contenuto è un blocco { ... } dentro la sua sezione.
 *  Copia un blocco esistente, incollalo sotto e cambia i testi.
 *  Ricordati la virgola tra un blocco e l'altro!
 *
 *  Campi:
 *    titolo       → il nome grande sulla card                (obbligatorio)
 *    descrizione  → una o due frasi sotto il titolo
 *    link         → dove porta la card, es. 'giochi/mio-gioco/'
 *                   (se manca, la card è "in arrivo" e non si clicca)
 *    tag          → lista di parole, es. ['Follia', 'Wow']
 *    immagine     → (facoltativa) copertina della card, es. 'giochi/mio-gioco/copertina.jpg'
 *    inEvidenza   → true per metterla anche in cima, nella sezione "In evidenza"
 *    inArrivo     → true per mostrarla sbiadita con "in arrivo"
 *    artisti, prod, file, durata → (solo musica) vedi la sezione musica qui sotto
 *    youtube      → (solo video) il codice del video YouTube, es. 'UoCs9tTNp_0'.
 *                   Il link alla pagina Video e la copertina li fa il sito da solo.
 *
 *  L'ordine nella lista è l'ordine sul sito.
 */

const CONTENUTI = {

  giochi: [
    {
      titolo: 'Corri Marf!',
      descrizione: "Allora, è un gioco stra mega divertente perché c'è Marf che corre e scappa dalle femmine.",
      tag: ['Follia', 'Divertimento', 'Wow'],
      link: 'giochi/corri-marf/',
      immagine: 'giochi/corri-marf/copertina.jpg?v=5',
      inEvidenza: true,
    },
    {
      titolo: 'La Bisca der Tromba',
      descrizione: 'Godi popolo',
      link: 'giochi/bisca-del-tromba/',
      immagine: 'giochi/bisca-del-tromba/assets/copertina.jpg?v=2',
      tag: ['Bighelloni', 'Dipendenza', 'Salute'],
      inEvidenza: true,
    },
  ],

  // I video sono divisi in playlist, nell'ordine in cui appaiono sul sito.
  // Per ogni video di YouTube basta il titolo e il codice del video:
  // è la parte dopo youtu.be/ (o dopo watch?v=) nel link, senza "?si=..."
  // Per aggiungere una playlist, copia un blocco { playlist: ..., video: [...] }.
  video: [
    {
      playlist: 'Manicalde',
      video: [
        { titolo: 'MANICALDE',   youtube: 'zp_h59vQX-0' },
        { titolo: 'MANICALDE 2', youtube: 'NNLHrwpfqOE' },
        { titolo: 'MANICALDE 3', youtube: 'nGXCsvPd3Cc' },
        { titolo: 'MANICALDE 4', youtube: '1VXW5Fs9TMM', inEvidenza: true },
      ],
    },
    {
      playlist: 'Memozzi',
      video: [
        { titolo: 'MEMOZZI',                  youtube: '2k0ky_m0tAY' },
        { titolo: 'MEMOZZI 2',                youtube: 'UoCs9tTNp_0' },
        { titolo: 'AMICI E MARE (MEMOZZI 3)', youtube: 'xsMzE0SXMLE' },
      ],
    },
    {
      playlist: 'Kasti',
      video: [
        { titolo: 'KAST1', youtube: '5yH6RUK1ITs' },
        { titolo: 'K4STI', youtube: '5xMz43UlNfc' },
      ],
    },
    {
      playlist: 'Sketch',
      video: [
        { titolo: 'LA FIRMA', youtube: 'kz5BbTh3A2c' },
        { titolo: 'CHI',      youtube: 'J8jtWhEEIVs' },
        { titolo: 'DOMANDE',  youtube: 't4p3hHORiVU' },
      ],
    },
    {
      playlist: "D'autore",
      video: [
        { titolo: 'BOOM BOOM CRASH',     youtube: 'HT-TgkoFppo' },
        { titolo: 'RESIDENT CREVIL',     youtube: '3_oo7r0jScw' },
        { titolo: 'SOLVAY DI ROSIGNANO', youtube: 'l0CBPRt9ULA' },
      ],
    },
    {
      playlist: 'Videoclip',
      video: [
        { titolo: 'SONO STATO IO', youtube: '6TXW76pfs5c' },
      ],
    },
  ],

  // La musica è divisa in album, nell'ordine in cui appaiono sul sito.
  // Il file MP3 va nella cartella musica/brani/.
  // Per aggiungere un brano, copia una riga e cambia i testi.
  // Per un album nuovo, copia un blocco { album: ..., copertina: ..., brani: [...] }.
  // copertina: immagine quadrata in img/copertine/ (es. 'img/copertine/og-tracks.jpg').
  // Se la lasci vuota ('') il sito disegna una copertina provvisoria col nome dell'album.
  // (Se hai un WAV, mandalo in chat: lo converto io in MP3.)
  musica: [
    {
      album: 'OG Tracks',
      // copertina e retro del vinile (facoltativi). "mappa" dice dove sta ogni brano
      // sul retro, in percentuale: [sinistra, alto, larghezza, altezza], nell'ordine dei brani.
      copertina: 'musica/copertine/og-tracks-fronte.jpg',
      retro: 'musica/copertine/og-tracks-retro.jpg?v=2',
      mappa: [
        [42.78, 33.06, 27.96, 5.05], [42.78, 38.1, 27.96, 5.28], [42.78, 43.38, 27.96, 9.35],
        [42.78, 52.73, 27.96, 5.23], [42.78, 57.96, 27.96, 5.23], [42.78, 63.19, 27.96, 9.35],
        [42.78, 72.55, 27.96, 13.43], [42.78, 85.97, 27.96, 5.14],
      ],
      brani: [
        { titolo: 'SQUALO',            artisti: 'C-Rischio feat. Cele-Kun',                         prod: 'StepLeo', file: 'squalo.mp3',            durata: '2:14' },
        { titolo: 'REGINA CRIVI',      artisti: 'feat. C-Rischio, Malevolent Marf, VickyDicky',     prod: 'StepLeo', file: 'regina-crivi.mp3',      durata: '2:33' },
        { titolo: 'FUOCO E FARFALLE',  artisti: 'feat. C-Rischio, Celeperù, MarkyMarko, CiciLeo',   prod: 'StepLeo', file: 'fuoco-e-farfalle.mp3',  durata: '2:42' },
        { titolo: 'SECCO SLE',         artisti: 'feat. Lil Criver, Fiskiabad, CiciLeo',             prod: 'StepLeo', file: 'secco-sle.mp3',         durata: '2:40' },
        { titolo: 'FIORE',             artisti: 'CiciLeo feat. C-Rischio (LilCriver & Fiskiabad)',  file: 'fiore.mp3',             durata: '3:17' },
        { titolo: 'BENTORNATO MARCO',  artisti: 'Collettivo M.I.A.O.',                              file: 'bentornato-marco.mp3',  durata: '5:45' },
        { titolo: 'PAURA DELLE TETTE', artisti: 'Fiskiabad, LilCriver feat. CiciLeo, MarkyMarko',   prod: 'StepLeo', file: 'paura-delle-tette.mp3', durata: '6:03' },
        { titolo: 'CIAO PALLE',        artisti: 'MarkyMarco feat. C-Rischio, Chil(l)yCele, CiciLeo', file: 'ciao-palle.mp3',        durata: '4:45' },
      ],
    },
    {
      album: 'Re-edit 2026',
      copertina: '',
      brani: [
        { titolo: 'FIORE (re-edit 2026)',            artisti: 'C-Rischio, CiciLeo',                              file: 'fiore-re-edit-2026.mp3',            durata: '3:43' },
        { titolo: 'FUOCO E FARFALLE (re-edit 2026)', artisti: 'feat. C-Rischio, Celeperù, MarkyMarko, CiciLeo', prod: 'StepLeo', file: 'fuoco-e-farfalle-re-edit-2026.mp3', durata: '2:46' },
        { titolo: 'REGINA CRIVI (re-edit 2026)',     artisti: 'feat. C-Rischio, Malevolent Marf, VickyDicky',   prod: 'StepLeo', file: 'regina-crivi-re-edit-2026.mp3',     durata: '2:54' },
        { titolo: 'SECCO SLE (re-edit 2026)',        artisti: 'feat. Lil Criver, Fiskiabad, CiciLeo',           prod: 'StepLeo', file: 'secco-sle-re-edit-2026.mp3',        durata: '2:53' },
      ],
    },
  ],

};

/*
 * Lista piatta di tutti i video, con il nome della playlist su ognuno.
 * La usano la homepage e la pagina Video: qui non serve toccare niente.
 */
const TUTTI_I_VIDEO = CONTENUTI.video.flatMap(p =>
  (p.video || []).map(v => Object.assign({ playlist: p.playlist }, v))
);

/*
 * Lista piatta di tutti i brani, con il nome dell'album su ognuno.
 * La usano la homepage e la pagina Musica: qui non serve toccare niente.
 */
const TUTTI_I_BRANI = CONTENUTI.musica.flatMap(a =>
  (a.brani || []).map(b => Object.assign({ album: a.album, copertina: a.copertina || '' }, b))
);
