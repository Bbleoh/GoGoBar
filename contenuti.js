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
 *    inEvidenza   → true per metterla anche in cima, tra i "Malanni fatti"
 *    inArrivo     → true per mostrarla sbiadita con "in arrivo"
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
      tag: ['Bighelloni', 'Dipendenza', 'Salute'],
      inEvidenza: true,
    },
  ],

  video: [
    // esempio:
    // { titolo: 'Il grande disastro', descrizione: 'Estate 2025', link: 'video/grande-disastro/', tag: ['Vacanze'] },
  ],

  musica: [
    // esempio:
    // { titolo: 'Grida scimmiesche vol. 1', descrizione: 'Il primo album', link: 'musica/', tag: ['Album'] },
  ],

};
