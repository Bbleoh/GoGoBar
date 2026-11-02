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
 *    inEvidenza   → true per metterla anche in cima, tra i "Malanni fatti"
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

  // Per i video di YouTube basta il titolo e il codice del video:
  // è la parte dopo youtu.be/ (o dopo watch?v=) nel link, senza "?si=..."
  video: [
    { titolo: 'MEMOZZI 2', youtube: 'UoCs9tTNp_0' },
    { titolo: 'MANICALDE 2', youtube: 'NNLHrwpfqOE' },
    { titolo: 'MANICALDE', youtube: 'zp_h59vQX-0' },
    { titolo: 'LA FIRMA', youtube: 'kz5BbTh3A2c' },
    { titolo: 'KAST1', youtube: '5yH6RUK1ITs' },
    { titolo: 'DOMANDE', youtube: 't4p3hHORiVU' },
    { titolo: 'CHI', youtube: 'J8jtWhEEIVs' },
    { titolo: 'BOOM BOOM CRASH', youtube: 'HT-TgkoFppo' },
    { titolo: 'AMICI E MARE (MEMOZZI 3)', youtube: 'xsMzE0SXMLE' },
    { titolo: 'MANICALDE 4', youtube: '1VXW5Fs9TMM' },
    { titolo: 'MANICALDE 3', youtube: 'nGXCsvPd3Cc' },
  ],

  musica: [
    // esempio:
    // { titolo: 'Grida scimmiesche vol. 1', descrizione: 'Il primo album', link: 'musica/', tag: ['Album'] },
  ],

};
