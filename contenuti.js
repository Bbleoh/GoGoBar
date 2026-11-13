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
    {
      titolo: 'Resident Crevil: morte sul greppo',
      descrizione: "Notte, boschi di Capricchia. Guerrino ti porta alla Fonticella Petri e si mette a menare un albero. Tu cerchi i fogli. Poi arriva Papi, alto tre metri. (Prototipo)",
      tag: ['Paura', 'Bosco', 'Papi'],
      link: 'giochi/resident-crevil/',
      immagine: 'giochi/resident-crevil/copertina.jpg?v=3',
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
  musica: [ // l'ordine qui è l'ordine degli album sul sito
    {
      album: 'OG Tracks',
      // copertina e retro del vinile (facoltativi). "mappa" dice dove sta ogni brano
      // sul retro, in percentuale: [sinistra, alto, larghezza, altezza], nell'ordine dei brani.
      copertina: 'musica/copertine/og-tracks-fronte.jpg?v=2',
      retro: 'musica/copertine/og-tracks-retro.jpg?v=4',
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
      album: 'MSF EP',
      copertina: 'musica/copertine/msf-ep-fronte.jpg',
      retro: 'musica/copertine/msf-ep-retro.jpg',
      mappa: [
        [36.57, 40.56, 28.7, 5.56], [36.57, 46.11, 28.7, 5.56], [36.57, 64.63, 28.7, 5.46],
      ],
      brani: [
        { titolo: 'GARDALAND', artisti: 'Skedaz & P-Boy',                                              file: 'gardaland.mp3', durata: '2:11' },
        { titolo: 'CANNONE',   artisti: 'The Marfalorian & Leo Gewurztraminer feat. Skedaz & P-Boy', prod: 'CiciLeo', file: 'cannone.mp3',   durata: '2:15' },
        { titolo: 'PEDOPORNO', artisti: 'CiciLeo feat. MalevolentKing, Lo Slev', prod: 'Ignazio Laroossa', file: 'pedoporno.mp3', durata: '3:37' },
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
    {
      // album segreto: compare solo a chi ha battuto il boss di Corri Marf! (vedi "sblocco" qui sotto)
      album: 'Corri Marf! OST',
      sblocco: 'corriMarfBoss',
      copertina: '',
      brani: [
        { titolo: 'LOBBY',             artisti: 'Corri Marf! OST', file: 'corri-marf-lobby.mp3',  durata: '1:18' },
        { titolo: 'CORRI MARF',        artisti: 'Corri Marf! OST', file: 'corri-marf-corsa.mp3',  durata: '4:27' },
        { titolo: 'MARF CORRI JUNGLE', artisti: 'Corri Marf! OST', file: 'corri-marf-jungle.mp3', durata: '2:42' },
        { titolo: 'MALEDOTTA MIOTTA',  artisti: 'Corri Marf! OST', file: 'corri-marf-boss.mp3',   durata: '2:17' },
        { titolo: 'TI HANNO PRESO',    artisti: 'Corri Marf! OST', file: 'corri-marf-preso.mp3',  durata: '1:38' },
      ],
    },
    {
      // album segreto: compare a chi ha preso nella Bisca tutti i trofei comuni, rari ed epici
      // (il trofeo GoGoldBar "bisca_epico", vedi "sblocco" qui sotto). Titoli e copertina provvisori.
      album: 'La Bisca der Tromba OST',
      sblocco: 'biscaEpico',
      copertina: '',
      brani: [
        { titolo: 'TROMBA BOTTATA',    artisti: 'La Bisca der Tromba OST', file: 'bisca-tromba-bottata.mp3',   durata: '3:20' },
        { titolo: 'TROMBA BOTTATA II', artisti: 'La Bisca der Tromba OST', file: 'bisca-tromba-bottata-2.mp3', durata: '3:45' },
      ],
    },
  ],

  // ── CHI SIAMO (pagina chi-siamo/) ──
  chiSiamo: {
    // 10 posti per i membri. foto: immagine quadrata in img/membri/ (es. 'img/membri/leo.webp').
    // Se foto è vuota si vede il posto "foto in arrivo"; se nome è vuoto, "Membro N".
    membri: [
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
      { nome: '', foto: '' },
    ],
    // planisfero: dove siamo stati. livello 1 = visitato, 2 = ci abitiamo adesso (0 = mai stati, non serve scriverlo).
    // lat/lon in gradi decimali (si trovano su Google Maps: tasto destro sul punto).
    luoghi: [
      { nome: 'Roma', lat: 41.9028, lon: 12.4964, livello: 2 },
    ],
  },

};

/*
 * Album segreti: un album con "sblocco" si vede solo se chi visita l'ha sbloccato su questo dispositivo.
 * corriMarfBoss = il giocatore di Corri Marf! scelto ha battuto il boss (achievement, o record oltre i 10 km).
 * biscaEpico    = l'account GoGoBar ha il trofeo "bisca_epico" (tutti i trofei della Bisca fino a epico).
 *                 Si legge dalla copia del portafogli GoGoldBar salvata sul dispositivo (gogoldbar.v1).
 * Qui non serve toccare niente.
 */
function gogobarSbloccato(chiave) {
  try {
    if (chiave === 'corriMarfBoss') {
      const nome = String(localStorage.getItem('corriMarf.nome') || '').trim().toLowerCase();
      const tutti = JSON.parse(localStorage.getItem('corriMarf.giocatori') || '{}') || {};
      const a = tutti[nome];
      return !!(nome && a && ((a.upg && +a.upg.tr_boss > 0) || +a.record > 10000));
    }
    if (chiave === 'biscaEpico') {
      const c = JSON.parse(localStorage.getItem('gogoldbar.v1') || 'null');
      return !!(c && c.d && c.d.trofei && c.d.trofei.bisca_epico);
    }
  } catch (e) {}
  return false;
}
CONTENUTI.musica = CONTENUTI.musica.filter(a => !a.sblocco || gogobarSbloccato(a.sblocco));

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
