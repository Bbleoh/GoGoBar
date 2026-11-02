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
      inEvidenza: true,
      inArrivo: true,
    },
    {
      titolo: 'La bisca del Tromba',
      descrizione: 'Godi popolo',
      link: 'giochi/bisca-del-tromba/',
      immagine: 'giochi/bisca-del-tromba/assets/sfondo-poster.jpg',
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
        { titolo: 'MEMOZZI 2',                youtube: 'UoCs9tTNp_0' },
        { titolo: 'AMICI E MARE (MEMOZZI 3)', youtube: 'xsMzE0SXMLE' },
      ],
    },
    {
      playlist: 'Kasti',
      video: [
        { titolo: 'KAST1', youtube: '5yH6RUK1ITs' },
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
        { titolo: 'BOOM BOOM CRASH', youtube: 'HT-TgkoFppo' },
      ],
    },
  ],

  musica: [
    // esempio:
    // { titolo: 'Grida scimmiesche vol. 1', descrizione: 'Il primo album', link: 'musica/', tag: ['Album'] },
  ],

};

/*
 * Lista piatta di tutti i video, con il nome della playlist su ognuno.
 * La usano la homepage e la pagina Video: qui non serve toccare niente.
 */
const TUTTI_I_VIDEO = CONTENUTI.video.flatMap(p =>
  (p.video || []).map(v => Object.assign({ playlist: p.playlist }, v))
);
