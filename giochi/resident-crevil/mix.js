/* Il mix dell'audio di Resident Crevil: un canale per ogni gruppo di suoni, in dB rispetto al volume
   scritto nel codice del gioco (0 = com'è). Lo usano sia il gioco sia il mixer (mixer.html).
   Il mixer salva le modifiche nel browser (localStorage) e le manda in diretta al gioco aperto in
   un'altra scheda; "Copia il mix" dà i valori da incollare qui sotto, in def, per farli diventare
   quelli di tutti. */
export const CANALI = [
  { id: 'generale', nome: 'Generale', gruppo: 'Uscita', def: 0 },
  { id: 'ambiente', nome: 'Notte (ambiente)', gruppo: 'Ambiente', def: 0, prova: { file: 'sfx/notte.mp3', loop: true, vol: 0.275 } },
  { id: 'fosso', nome: 'Fosso', gruppo: 'Ambiente', def: 0, prova: { file: 'sfx/fosso.mp3', loop: true, vol: 0.6 } },
  { id: 'passiSottobosco', nome: 'Passi sottobosco', gruppo: 'Chi gioca', def: -6, prova: { nastro: 'passi', caselle: [0, 1, 2, 3, 4], vol: 0.4 } },
  { id: 'passiSentiero', nome: 'Passi sentiero', gruppo: 'Chi gioca', def: -3, prova: { nastro: 'passi', caselle: [10, 11, 12, 13, 14], vol: 0.4 } },
  { id: 'passiAcqua', nome: "Passi nell'acqua", gruppo: 'Chi gioca', def: 0, prova: { nastro: 'passi', caselle: [24, 25, 26, 27, 28, 32], vol: 0.45 } },
  { id: 'salto', nome: 'Atterraggio', gruppo: 'Chi gioca', def: 0, prova: { nastro: 'passi', caselle: [20, 21], vol: 0.55, ogni: 1.2 } },
  { id: 'fiatone', nome: 'Fiatone', gruppo: 'Chi gioca', def: 0, prova: { file: 'sfx/fiatone.mp3', vol: 0.25 } },
  { id: 'interfaccia', nome: 'Torcia e telefono', gruppo: 'Chi gioca', def: 0, prova: { file: 'sfx/colpo.mp3', vol: 0.08, rate: 2.6 } },
  { id: 'foglio', nome: 'Foglio preso', gruppo: 'Chi gioca', def: 0, prova: { file: 'sfx/foglio.mp3', vol: 0.9 } },
  { id: 'colpi', nome: "Colpi sull'albero", gruppo: 'Guerrino', def: 0, prova: { nastro: 'colpi', caselle: [0, 3, 6, 9, 12, 15, 18, 21], vol: 0.9, eco: true } },
  { id: 'voce', nome: 'Voce (lettere)', gruppo: 'Guerrino', def: 0, prova: { blip: true } },
  { id: 'papiPassi', nome: 'Passi di Papi', gruppo: 'Papi', def: 0, prova: { nastro: 'passi', caselle: [5, 6, 7, 8, 9], vol: 0.8, rate: 0.52 } },
  { id: 'papiVersi', nome: 'Frasche e rami', gruppo: 'Papi', def: 0, prova: { file: 'sfx/scricchiolio.mp3', vol: 0.8, rate: 0.75 } },
  { id: 'statico', nome: 'Statico', gruppo: 'Papi', def: 0, prova: { rumore: true, vol: 0.2 } },
  { id: 'cinghiale', nome: 'Cinghiale', gruppo: 'Eventi', def: 0, prova: { nastro: 'passi', caselle: [33, 34, 35, 33, 34, 35, 22], vol: 0.9, ogni: 0.09 } },
  { id: 'musica', nome: 'Colonna (tutta)', gruppo: 'Colonna sonora', def: 0 },
  { id: 'mus-foglio1', nome: 'Foglio 1', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'foglio1' } },
  { id: 'mus-foglio2', nome: 'Foglio 2', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'foglio2' } },
  { id: 'mus-foglio3', nome: 'Foglio 3', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'foglio3' } },
  { id: 'mus-foglio4', nome: 'Foglio 4', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'foglio4' } },
  { id: 'mus-foglio5', nome: 'Foglio 5', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'foglio5' } },
  { id: 'mus-prossimita', nome: 'Prossimità', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'prossimita' } },
  { id: 'mus-papi-in-vista', nome: 'Papi in vista', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'papi-in-vista' } },
  { id: 'mus-fiato', nome: 'Battito (fiato)', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'fiato' } },
  { id: 'mus-torcia', nome: 'Torcia accesa', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'torcia' } },
  { id: 'mus-distanza', nome: 'Distanza Capricchia', gruppo: 'Colonna sonora', def: 0, prova: { pezzo: 'distanza' } },
];
// volume di base di ogni pezzo della colonna nel gioco (lineare): i tre più bassi nel mix di Leo sono alzati
export const PEZZI = {
  foglio1: 1, foglio2: 1, foglio3: 1, foglio4: 1, foglio5: 1,
  prossimita: 1, 'papi-in-vista': 8, fiato: 1, torcia: 4, distanza: 4,
};
export const GIRO = 85.24, INIZIO_GIRO = 0.3;   // vedi strumenti/musica-prepara.py
export const CHIAVE = 'residentcrevil.mix', CANALE_DIRETTA = 'residentcrevil-mix';

// il mix in uso: i valori di def, più quelli salvati dal mixer in questo browser
export function caricaMix() {
  const m = {};
  for (const c of CANALI) m[c.id] = c.def;
  try { Object.assign(m, JSON.parse(localStorage.getItem(CHIAVE) || '{}')); } catch (e) {}
  return m;
}
export const lineare = db => db <= -60 ? 0 : Math.pow(10, db / 20);
