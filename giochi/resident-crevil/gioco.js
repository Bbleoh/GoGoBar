/* ════════════════════════════════════════════════════════════════
   RESIDENT CREVIL: MORTE SUL GREPPO — prototipo
   Notte nei boschi di Capricchia (Amatrice). Guerrino ti porta alla
   Fonticella Petri, si stanca e si mette a prendere a pugni un albero.
   Tu cerchi i 10 fogli. Dopo qualche minuto nel bosco arriva Papi,
   alto tre metri: se ti prende, ricominci dall'ultimo foglio.

   Mappa: il quadrato vero di 1300 m centrato su 42.6263 N, 13.3445 E, rimpicciolito a metà in tutte
   e tre le direzioni (SCALA): nel gioco è largo 650 m e le pendenze restano quelle vere.
   Coordinate di gioco: x = est (m), z = sud (m), y = quota di gioco (quota vera × SCALA).
   File in mappa/ (in misure vere): terreno.bin (quote, griglia 261x261 ogni 5 m, uint16 in 5 cm sopra
   i 1000 m), bosco.png (densità alberi), colori.jpg (colore del suolo), osm.json (case, strade, fossi).
   Prova veloce: ?veloce (attese corte).
════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from './lib/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './lib/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from './lib/addons/utils/BufferGeometryUtils.js';
import { PEZZI, GIRO, INIZIO_GIRO, CANALE_DIRETTA, caricaMix, lineare } from './mix.js?v=4';

const VELOCE = /veloce/.test(location.search);
const PROVA = { congela: false, tempo: 1 };   // per i test: ferma la storia (Guerrino e Papi), accelera il tempo
const SCALA = 0.5;   // quanto è rimpicciolita la mappa vera
const HALF = 650 * SCALA, N = 261, CELLA = 5 * SCALA, LIMITE = 615 * SCALA;
const NB = 13;       // il bosco è a blocchi di 50 m
const TOCCO = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOCCO) document.body.classList.add('tocco');
// le indicazioni dei tasti seguono quello che stai usando: tastiera e mouse, controller o dita
let INGRESSO = TOCCO ? 'tocco' : 'tastiera';
const TASTI = {
  prendi: { tastiera: 'E', pad: 'X', tocco: 'PRENDI' },
  mena: { tastiera: 'clic o E', pad: 'X', tocco: 'COLPISCI' },
  torcia: { tastiera: 'F', pad: 'RB', tocco: '🔦' },
  telefono: { tastiera: 'M', pad: 'Y', tocco: 'GPS' },
  statuetta: { tastiera: 'G', pad: 'LB', tocco: 'STATUA' },
};
const tasto = a => TASTI[a][INGRESSO];
function usaIngresso(chi) {
  if (chi === INGRESSO) return;
  INGRESSO = chi;
  document.body.classList.remove('in-tastiera', 'in-pad', 'in-tocco'); document.body.classList.add('in-' + chi);
  const pr = document.getElementById('prendi'); if (pr) pr.dataset.cosa = '';   // si riscrive col tasto giusto
}
document.body.classList.add('in-' + INGRESSO);
addEventListener('keydown', () => usaIngresso('tastiera'), true);
let tUltimoTocco = -1e9;   // dopo un tocco il browser finge anche il mouse: per un attimo non gli credo
const mouseVero = () => performance.now() - tUltimoTocco > 1000;
addEventListener('mousedown', () => { if (mouseVero()) usaIngresso('tastiera'); }, true);
addEventListener('mousemove', e => { if (mouseVero() && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) usaIngresso('tastiera'); }, true);
addEventListener('touchstart', () => { tUltimoTocco = performance.now(); usaIngresso('tocco'); }, { capture: true, passive: true });

/* ── testi (Leo li cambierà: sono tutti qui) ── */
const BATTUTE = {
  dieci: ["Dieci fogli. Portali a Guerrino, alla Fonticella."],
  roncola: [
    "Dieci? Bravo. Damme qua 'sti scarabocchi, ce faccio er foco.",
    "Te', pija la roncola. L'altra bestia sta su in cima, verso levante: la casa co' le punte.",
    "Vacce e fallo secco. Io intanto finisco co' st'albero.",
  ],
  intro: [
    "Oh, eccote. Tu sei Crivo, giusto? Er fijo de... vabbè, nun importa.",
    "Io so' Guerrino. Stanotte te porto alla Fonticella Petri, che è qui vicino.",
    "Accendi 'sta torcia, va'. Io ar buio ce vedo uguale. Abitudine.",
    "Statte dietro e nun te perde. Qua se so' persi pure i cani da tartufo.",
  ],
  strada: [
    "Da regazzino qua ce venivo a fa' la legna co' mi' padre. Co' la roncola, mica co' 'ste motoseghe.",
    "Senti che silenzio? D'estate ce stanno i grilli. D'inverno... d'inverno ce sto io.",
    "Quell'albero lì l'ho piantato io. Ner cinquantotto. O ner sessantotto. Comunque è venuto storto.",
    "Ahò, piano. C'ho ottantasett'anni, mica venti.",
  ],
  fonte: [
    "Ecco la Fonticella Petri. Fermamose.",
    "Uff... aspetta... nun c'ho più er fiato.",
  ],
  seduto: [
    "Me metto a sede' un attimo sulla Fonticella.",
    "Tu intanto va' a cercà i fogli attaccati agli alberi. So' dieci. Trovali tutti prima che arriva l'altra bestia.",
    "Sur telefono c'hai la mappa. Ma er GPS quaggiù nun pija: pe' sapé 'ndo stai devi salì in arto.",
  ],
  sfogo: [
    "Mo' me so' stancato pure d'esse stanco.",
    "'St'albero me guarda storto da quarant'anni. Mo' je faccio vede' io.",
  ],
  statuetta: [
    "Me dai 'sto disegno? Tie', pìate 'sta statuetta mia. L'ho fatta io, de bronzo. Piantala in terra, che quello nun s'avvicina.",
    "N'antro scarabocchio? Vabbè. Eccote n'antra statuetta. Somiglia, eh?",
    "Er foglio a me, la statuetta a te. Piantala dove te pare, ma una vorta sola.",
  ],
  statuette: ["Tutti 'sti fogli? Tie', ecco le statuette. Una pe' foglio, so' onesto.", "Quanti! Pìate 'ste statuette, che io c'ho da menà."],
  pausa: ["Pausa. Er pugno ce l'ho, er fiato no.", "Mezzo minuto e ricomincio, eh.", "Me riposo, ma l'albero nun se ne va."],
  mena: ["Pija questa!", "E questa è pe' mi' cognato!", "Nun me guardà, cerca i fogli!", "Quarant'anni che me guardi storto!", "Ahia. Vabbè, continuo.", "Er fiato nun ce l'ho, ma er pugno sì."],
  indietro: ["Daje, che c'hai le gambe de ricotta?", "Ahò, de qua!", "Nun me fa' tornà indietro.", "Sbrighete, che fa freddo."],
  caccia: ["CRIVO! È ARIVATA L'ALTRA BESTIA!", "Nun la guardà fissa, che je piace!", "Corri, Crivo! L'altra bestia è arta quattro metri e mezzo, mica è scema!", "Ahò, bestia! Lassalo stà, che è er fijo de...!", "Viè alla Fonticella, che qua l'altra bestia nun ce mette piede!"],
  cascato: ["Er Greppo nun perdona. Manco io ce vado più.", "Te l'avevo detto de guardà 'ndo metti i piedi.", "Giù dar Greppo ce so' cascate pure le capre."],
  preso: ["L'altra bestia è arta quattro metri e mezzo. Tu no.", "L'altra bestia s'è ripresa i fogli.", "Guerrino nun ha manco smesso de menà l'albero.", "Te l'avevo detto: nun la guardà fissa.", "L'altra bestia nun corre. L'altra bestia arriva."],
};

/* ── DOM ── */
const $ = id => document.getElementById(id);
const ui = {
  lampo: $('lampo'),
  fogli: $('fogli'), fiato: $('fiato'), prendi: $('prendi'),
  dialogo: $('dialogo'), chi: $('chi'), battuta: $('battuta'), didascalia: $('didascalia'),
  foglioGrande: $('foglio-grande'), statico: $('statico'), buio: $('buio'), effetti: $('effetti'),
};
function mostra(id, si) { $(id).classList.toggle('nascosto', !si); }
// impostazioni di chi gioca (menu Impostazioni), salvate nel browser
const IMPOSTA = { sens: 1, volume: 1, musica: 1, invertiY: false };
try { Object.assign(IMPOSTA, JSON.parse(localStorage.getItem('residentcrevil.impostazioni') || '{}')); } catch (e) {}
function salvaImpostazioni() { try { localStorage.setItem('residentcrevil.impostazioni', JSON.stringify(IMPOSTA)); } catch (e) {} }
// il controller (Xbox 360 e simili, mappatura standard): letto a ogni fotogramma in leggiPad()
const pad = { x: 0, y: 0, gx: 0, gy: 0, corri: false, attivo: false, prima: [] };

/* ════════ RENDERER E SCENA ════════ */
const canvas = $('scena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scena = new THREE.Scene();
const NEBBIA = new THREE.Color(0x262a2e);   // nebbia grigia: contro, Papi è una sagoma nera
scena.background = NEBBIA;
scena.fog = new THREE.FogExp2(NEBBIA, 0.034);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 95);
const camLobby = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 1600);   // la lobby: la mappa dall'alto
scena.add(camera);
// il telefono in mano si disegna a parte, sopra, a piena risoluzione: la mappa sullo schermo deve leggersi
const telCanvas = document.createElement('canvas'); telCanvas.id = 'telefono3d'; canvas.after(telCanvas);
const rendTel = new THREE.WebGLRenderer({ canvas: telCanvas, alpha: true, antialias: false });
rendTel.setPixelRatio(1); rendTel.outputColorSpace = THREE.SRGBColorSpace; rendTel.setClearColor(0x000000, 0);
const scenaTel = new THREE.Scene(), camTel = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 3);
let telDisegnato = false;

/* ── resa da PS1 ──
   Il gioco è disegnato a 270 righe e ingrandito a pixel netti; i vertici scattano sulla griglia dei
   pixel (il tremolio dei poligoni della PS1); i colori sono a 15 bit col retino 4x4; le texture sono
   piccole (64 px) e senza sfumatura fra un pixel e l'altro. */
const PS1 = { altezza: 270, ris: { value: new THREE.Vector2(240, 135) } };
function ps1Shader(sh) {
  sh.uniforms.ps1Ris = PS1.ris;
  sh.vertexShader = 'uniform vec2 ps1Ris;\n' + sh.vertexShader.replace('#include <project_vertex>',
    '#include <project_vertex>\n\tgl_Position.xy = floor(gl_Position.xy / gl_Position.w * ps1Ris + 0.5) / ps1Ris * gl_Position.w;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
	{
		const mat4 retino = mat4(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
		ivec2 px = ivec2(mod(gl_FragCoord.xy, 4.0));
		gl_FragColor.rgb = floor(gl_FragColor.rgb * 31.0 + (retino[px.x][px.y] + 0.5) / 16.0) / 31.0;
	}`);
}
function ps1(mat) { mat.onBeforeCompile = ps1Shader; return mat; }
function texPs1(t, sx = 1, sy = sx) {
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(sx, sy);
  return t;
}
function ridimensiona() {
  const h = PS1.altezza, w = Math.max(160, Math.round(h * innerWidth / innerHeight));
  renderer.setSize(w, h, false);
  PS1.ris.value.set(w / 2, h / 2);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  { camLobby.aspect = camera.aspect; camLobby.updateProjectionMatrix(); }
  // il telefono a metà strada: pixel il doppio più piccoli del bosco (PS1.altezza), ma sempre pixel
  const hT = Math.min(innerHeight * (devicePixelRatio || 1), PS1.altezza * 2);
  rendTel.setSize(Math.round(hT * innerWidth / innerHeight), hT, false); camTel.aspect = camera.aspect; camTel.updateProjectionMatrix();
}
ridimensiona();
const cielo = new THREE.HemisphereLight(0x4a5a7a, 0x10120c, 1.1);
scena.add(cielo);
const luna = new THREE.DirectionalLight(0x8090b0, 0.25);
// all'inizio la notte è chiara; più vai avanti più si fa buio: tutto nero dopo 3 minuti nel bosco (o 9 fogli)
const LAMPO = new THREE.Color(0x8a93a8);
const BUIO = { k: 0, chiaro: new THREE.Color(0x262a2e), scuro: new THREE.Color(0x0b0e11) };   // non nero pieno: le sagome degli alberi restano
function aggiornaBuio(dt) {
  const ob = storia === 'intro' || storia === 'strada' || storia === 'fonte' ? 0 : Math.min(1, io.fogli / 9 + io.tempo / 180);
  BUIO.k += (ob - BUIO.k) * Math.min(1, dt / 8);
  const k = BUIO.k;
  NEBBIA.copy(BUIO.chiaro).lerp(BUIO.scuro, k); scena.fog.color.copy(NEBBIA);
  cielo.intensity = 1.1 - k * 0.8 + EV.lampo * 2.4; luna.intensity = 0.25 - k * 0.21 + EV.lampo * 1.5;
  if (EV.lampo > 0) scena.fog.color.lerp(LAMPO, EV.lampo * 0.5);
  ui.lampo.style.opacity = (EV.lampo * 0.4).toFixed(3);
  scena.fog.density = (0.034 + k * 0.01) * (1 + EV.nebbia * 1.7);
}
luna.position.set(-0.4, 1, 0.3);
scena.add(luna);
// la torcia di Crivo
const TORCIA_MAX = 120;
const torcia = new THREE.SpotLight(0xffe6c0, TORCIA_MAX, 48, 0.42, 0.5, 1.25);
torcia.position.set(0.18, -0.12, 0.1);
camera.add(torcia);
torcia.target.position.set(0, -0.6, -6);
camera.add(torcia.target);
const alone = new THREE.PointLight(0xffe6c0, 1.2, 6, 2);   // un po' di luce vicino alle mani
camera.add(alone);

addEventListener('resize', () => {
  ridimensiona();
  controllaOrizzontale();
});

/* ════════ CARICAMENTO ════════ */
const gestore = new THREE.LoadingManager();
gestore.onProgress = (u, fatti, tot) => { $('prog').style.width = Math.round(fatti / tot * 100) + '%'; };
const caricaTex = new THREE.TextureLoader(gestore);
const caricaAudio = new THREE.AudioLoader(gestore);
const caricaFile = new THREE.FileLoader(gestore);
const gltf = new GLTFLoader(gestore);
gltf.setMeshoptDecoder(MeshoptDecoder);

function promessa(loader, url, opz) {
  return new Promise((ok, ko) => loader.load(url, ok, undefined, ko));
}
function immagineDati(url) {
  return promessa(caricaTex, url).then(t => {
    const c = document.createElement('canvas');
    c.width = t.image.width; c.height = t.image.height;
    const g = c.getContext('2d'); g.drawImage(t.image, 0, 0);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  });
}
caricaFile.setResponseType('arraybuffer');

// texture da PS1 (Kenney e Poly Haven, CC0): vedi texture/LICENZA.txt
const TEX_PS1 = ['erba', 'terra', 'roccia', 'ciottoli', 'acqua', 'tetto', 'muro', 'corteccia', 'fronde'], TEX = {};
const SUONI = ['notte', 'fosso', 'colpo', 'foglio', 'fiatone', 'scricchiolio', 'frasche', 'passi', 'colpi'];
const buf = {};

const pronto = Promise.all([
  promessa(caricaFile, 'mappa/terreno.bin'),
  immagineDati('mappa/bosco.png'),
  promessa(caricaTex, 'mappa/colori.jpg'),
  fetch('mappa/osm.json').then(r => r.json()),
  promessa(gltf, 'modelli/guerrino.glb?v=2'),
  promessa(gltf, 'modelli/roncola.glb').catch(() => null),
  promessa(gltf, 'modelli/papi.glb'),
  ...TEX_PS1.map(n => promessa(caricaTex, 'texture/ps1/' + n + '.png')),
  ...SUONI.map(s => promessa(caricaAudio, 'sfx/' + s + '.mp3').then(b => { buf[s] = b; }, () => {})),
]).then(([bin, bosco, colori, osm, modello, roncola, modelloPapi, ...resto]) => {
  TEX_PS1.forEach((n, i) => { TEX[n] = texPs1(resto[i]); });
  costruisci(bin, bosco, colori, osm, modello, roncola, modelloPapi, [TEX.corteccia, TEX.fronde]);
  const statue = promessa(gltf, 'modelli/statuetta.glb').then(creaStatuette, e => console.warn('statuetta non caricata', e));
  promessa(gltf, 'modelli/mano-telefono.glb').then(creaManoTelefono, e => console.warn('mano col telefono non caricata', e));
  // i figli di Papi arrivano dopo, mentre giochi già
  Promise.all([promessa(gltf, 'modelli/caro.glb?v=2'), promessa(gltf, 'modelli/bimba.glb?v=2')])
    .then(([c, b]) => { creaFiglio(caro, c); creaFiglio(bimba, b); })
    .catch(e => console.warn('figli di Papi non caricati', e));
  return statue;   // le statuette servono già per chi riparte da un salvataggio
});

/* ════════ TERRENO ════════ */
let Q;   // Float32Array quote
function quota(x, z) {
  let fx = (x + HALF) / CELLA, fz = (z + HALF) / CELLA;
  fx = Math.min(N - 1.001, Math.max(0, fx)); fz = Math.min(N - 1.001, Math.max(0, fz));
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
  // stessi triangoli della PlaneGeometry (diagonale da (i,j+1) a (i+1,j))
  if (u + v < 1) return Q[k] + (Q[k + 1] - Q[k]) * u + (Q[k + N] - Q[k]) * v;
  return Q[k + N + 1] + (Q[k + N] - Q[k + N + 1]) * (1 - u) + (Q[k + 1] - Q[k + N + 1]) * (1 - v);
}

// maschera del suolo: rosso = strade e sentieri, verde = quanto bosco c'è
function texMaschera(bosco, osm) {
  const L = 1024, c = document.createElement('canvas'); c.width = c.height = L;
  const g = c.getContext('2d'), img = g.createImageData(L, L), d = img.data;
  for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    const k = (j * L + i) * 4;
    d[k + 1] = bosco.d[((j * bosco.h / L | 0) * bosco.w + (i * bosco.w / L | 0)) * 4]; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#f00'; g.lineJoin = g.lineCap = 'round';
  const px = q => (q + HALF) / (HALF * 2) * L;
  for (const [tipo, pts] of osm.strade) {
    g.lineWidth = (tipo === 't' || tipo === 'p' ? 2.2 : 3.6) / (HALF * 2) * L;
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(px(p[0]), px(p[1])) : g.moveTo(px(p[0]), px(p[1]))); g.stroke();
  }
  const fatto = g.getImageData(0, 0, L, L).data;
  SENTIERI = new Uint8Array(L * L);
  for (let i = 0; i < L * L; i++) SENTIERI[i] = fatto[i * 4] > 110 ? 1 : 0;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}
let SENTIERI = null;   // griglia 1024x1024: 1 = strada o sentiero
function suSentiero(x, z) {
  if (!SENTIERI) return false;
  const i = (x + HALF) / (HALF * 2) * 1024 | 0, j = (z + HALF) / (HALF * 2) * 1024 | 0;
  return i >= 0 && j >= 0 && i < 1024 && j < 1024 && SENTIERI[j * 1024 + i] === 1;
}
function pendenza(x, z) { return Math.hypot(quota(x + 1, z) - quota(x - 1, z), quota(x, z + 1) - quota(x, z - 1)) / 2; }

function creaTerreno(colori, bosco, osm) {
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Q[i]);
  geo.computeVertexNormals();
  colori.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: colori });
  const maschera = texMaschera(bosco, osm);
  // sul suolo le texture hanno le mipmap (a scatti): senza, da lontano sfarfalla tutto
  for (const n of ['erba', 'terra', 'roccia']) { TEX[n].generateMipmaps = true; TEX[n].minFilter = THREE.NearestMipmapNearestFilter; TEX[n].needsUpdate = true; }
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tErba: { value: TEX.erba }, tTerra: { value: TEX.terra }, tRoccia: { value: TEX.roccia }, tMaschera: { value: maschera } });
    sh.vertexShader = 'varying float vPend;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPend = 1.0 - normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D tErba, tTerra, tRoccia, tMaschera;\nvarying float vPend;')
      .replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec2 uvP = vMapUv * ${(HALF * 2 / 3).toFixed(1)};   // una piastrella ogni 3 metri
		vec4 mk = texture2D(tMaschera, vMapUv);
		vec3 terra = texture2D(tTerra, uvP).rgb;
		vec3 suolo = mix(texture2D(tErba, uvP).rgb * 1.25, terra * vec3(0.55, 0.47, 0.34), mk.g * 0.92);   // nel bosco: lettiera di foglie
		suolo = mix(suolo, terra * 0.95, min(1.0, mk.r * 1.4));                                              // strade e sentieri
		suolo = mix(suolo, texture2D(tRoccia, uvP * 0.5).rgb * 0.7, smoothstep(0.17, 0.3, vPend));           // sul ripido: roccia
		diffuseColor.rgb = suolo * mix(vec3(1.0), diffuseColor.rgb * 6.0, 0.3) * 1.5;
	}`);
    ps1Shader(sh);
  };
  const m = new THREE.Mesh(geo, mat);
  m.matrixAutoUpdate = false;
  scena.add(m);
}

/* ════════ BOSCO ════════ */
function rand(seme) {
  let s = seme >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
// alberi fatti a mano con texture CC0 di Poly Haven (island_tree_01): corteccia vera e fronde
// fatte di foglie vere ritagliate (texture/fronde.webp: a sinistra latifoglia, a destra abete)
function tronco(r0, r1, h, segs = 7, alti = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, h, segs, alti, true).translate(0, h / 2, 0);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, p.getY(i) / 1.4);
  return g;
}
function ramoLegno(base, az, incl, lung, r) {
  const g = tronco(r, r * 0.35, lung, 4);
  g.rotateZ(-incl); g.rotateY(az); g.translate(base.x, base.y, base.z);
  return g;
}
// una fronda: piano col ramo che parte dal basso; crociata = due piani a 90°
function fronda(lista, base, az, incl, w, h, conifera, centro, croce = true) {
  const u0 = conifera ? 0.5 : 0, u1 = conifera ? 1 : 0.5;
  for (let k = 0; k < (croce ? 2 : 1); k++) {
    const g = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    g.rotateY((croce ? k : 1) * Math.PI / 2);   // da sola: piatta, come un ramo d'abete
    g.rotateZ(-incl); g.rotateY(az); g.translate(base.x, base.y, base.z);
    // normali "a palla" dal centro della chioma: luce morbida, niente lati neri
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - centro.x, (p.getY(i) - centro.y) * 0.7 + 0.4, p.getZ(i) - centro.z).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
    lista.push(g);
  }
}
function modelliAlberi() {
  const r = rand(5), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const modelli = [];
  // A: latifoglia (cerro, faggio): chioma larga
  {
    const legno = [tronco(0.3, 0.17, 6.2)], fr = [], c = V(0, 6.4, 0);
    for (let i = 0; i < 5; i++) { const az = i * 1.26 + r() * 0.5; legno.push(ramoLegno(V(0, 3.6 + i * 0.5, 0), az, 0.75 + r() * 0.3, 2.4, 0.09)); }
    for (let i = 0; i < 13; i++) {
      const az = i * 2.4 + r() * 0.6, y = 3.9 + r() * 2.6, d = 0.2 + r() * 0.5;
      fronda(fr, V(Math.sin(az) * d, y, Math.cos(az) * d), az, 0.55 + r() * 0.6, 3.2 + r(), 3.6 + r() * 1.2, false, c);
    }
    for (let i = 0; i < 4; i++) fronda(fr, V((r() - 0.5) * 0.8, 6.6, (r() - 0.5) * 0.8), r() * 6.28, r() * 0.35, 3, 3.2, false, c);
    modelli.push([legno, fr]);
  }
  // B: faggio alto e sottile
  {
    const legno = [tronco(0.24, 0.12, 9.5)], fr = [], c = V(0, 9, 0);
    for (let i = 0; i < 4; i++) legno.push(ramoLegno(V(0, 6.5 + i * 0.6, 0), i * 1.6 + r(), 0.6 + r() * 0.3, 1.8, 0.07));
    for (let i = 0; i < 10; i++) {
      const az = i * 2.4 + r() * 0.6, y = 6.6 + r() * 2.8;
      fronda(fr, V(Math.sin(az) * 0.2, y, Math.cos(az) * 0.2), az, 0.45 + r() * 0.5, 2.4 + r() * 0.8, 3 + r(), false, c);
    }
    fronda(fr, V(0, 9.3, 0), 0, 0.1, 2.4, 2.6, false, c);
    modelli.push([legno, fr]);
  }
  // C: abete / pino nero: palchi di rami che pendono
  {
    const legno = [tronco(0.25, 0.04, 10, 6)], fr = [], c = V(0, 5, 0);
    const palchi = 7;
    for (let j = 0; j < palchi; j++) {
      const y = 1.6 + j * 1.15, lung = 3.4 - j * 0.38, n = 6 - (j > 4 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const az = i * 6.28 / n + j * 0.7 + r() * 0.3;
        fronda(fr, V(0, y, 0), az, 1.75 + r() * 0.2, lung * 0.75, lung, true, V(0, y, 0), false);
      }
    }
    fronda(fr, V(0, 9.2, 0), 0, 0, 1, 1.4, true, c);
    modelli.push([legno, fr]);
  }
  // D: cespuglio
  {
    const fr = [], c = V(0, 0.2, 0);
    for (let i = 0; i < 6; i++) { const az = i * 1.05 + r() * 0.4; fronda(fr, V(0, -0.1, 0), az, 0.6 + r() * 0.5, 1.5, 1.6, false, c); }
    modelli.push([[], fr]);
  }
  const unisci = l => {
    if (!l.length) return null;
    const g = mergeGeometries(l.map(x => { x = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; }));
    g.clearGroups(); return g;
  };
  return modelli.map(([a, b]) => [unisci(a), unisci(b)]);
}
function materialiAlberi(corteccia, fronde) {
  const legno = ps1(new THREE.MeshLambertMaterial({ map: corteccia, color: 0x9a9088 }));
  const foglie = new THREE.MeshLambertMaterial({ map: fronde, color: 0x7c8670, alphaTest: 0.42, side: THREE.DoubleSide });
  // il retro delle fronde non va al buio: tengo la normale "a palla" su tutti e due i lati
  foglie.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n\tnormal *= faceDirection;\n#endif');
    ps1Shader(sh);
  };
  return [legno, foglie];
}

const TRONCHI = new Map();   // griglia 10 m → [{x,z,r,mesh,i,s}]
function chiaveG(x, z) { return ((x + HALF) / 10 | 0) * 1000 + ((z + HALF) / 10 | 0); }
function aggiungiTronco(t) { const k = chiaveG(t.x, t.z); let l = TRONCHI.get(k); if (!l) TRONCHI.set(k, l = []); l.push(t); }
function tronchiVicini(x, z, raggio, fn) {
  const r = Math.ceil(raggio / 10);
  const ci = (x + HALF) / 10 | 0, cj = (z + HALF) / 10 | 0;
  for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
    const l = TRONCHI.get(i * 1000 + j); if (l) for (const t of l) fn(t);
  }
}

const BLOCCHI = [];   // pezzi di bosco 50x50 m, accesi solo vicino al giocatore
const BLOCCO = new Map();   // numero del blocco → gruppo
// posto libero: non addosso ai fogli, alla Fonticella o al punto di partenza
function libero(x, z, largo = 0) {
  return !zonaGreppo(x, z) && !FOGLI_ANCORE.some(f => Math.hypot(f.x - x, f.z - z) < 2.5 + largo) && Math.hypot(FONTE.x - x, FONTE.z - z) > 5 + largo && Math.hypot(io.x - x, io.z - z) > 4 + largo;
}
function bloccoDi(x, z) {
  const LATO = HALF * 2 / NB;
  const bi = Math.max(0, Math.min(NB - 1, (x + HALF) / LATO | 0)), bj = Math.max(0, Math.min(NB - 1, (z + HALF) / LATO | 0)), k = bj * NB + bi;
  let g = BLOCCO.get(k);
  if (!g) {
    g = new THREE.Group(); g.userData.cx = (bi + 0.5) * LATO - HALF; g.userData.cz = (bj + 0.5) * LATO - HALF;
    BLOCCO.set(k, g); scena.add(g); BLOCCHI.push(g);
  }
  return g;
}
// niente tronchi in mezzo a strade e sentieri (serve per il sentiero nuovo del Greppo, che attraversa il bosco)
let STRADE_SEG = [];
function suStrada(x, z) {
  for (const [ax, az, bx, bz, w] of STRADE_SEG) {
    if (x < Math.min(ax, bx) - w || x > Math.max(ax, bx) + w || z < Math.min(az, bz) - w || z > Math.max(az, bz) + w) continue;
    const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1, k = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
    if (Math.hypot(x - ax - ex * k, z - az - ez * k) < w) return true;
  }
  return false;
}
function creaBosco(bosco, osm, fogliPos, texAlberi) {
  STRADE_SEG = [];
  for (const [tipo, s] of osm.strade) for (let i = 1; i < s.length; i++) STRADE_SEG.push([s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], tipo === 't' || tipo === 'p' ? 1.6 : 2.4]);
  const geos = modelliAlberi();
  const mats = materialiAlberi(...texAlberi);
  const r = rand(1234);
  const dens = (x, z) => {
    const i = Math.min(bosco.w - 1, Math.max(0, Math.round((x + HALF) / (HALF * 2) * (bosco.w - 1))));
    const j = Math.min(bosco.h - 1, Math.max(0, Math.round((z + HALF) / (HALF * 2) * (bosco.h - 1))));
    return bosco.d[(j * bosco.w + i) * 4] / 255;
  };
  const lista = [];   // [x, z, tipo, scala, rot]
  const PASSO = 5.2;
  for (let z = -HALF + 2; z < HALF - 2; z += PASSO) for (let x = -HALF + 2; x < HALF - 2; x += PASSO) {
    const px = x + r() * PASSO, pz = z + r() * PASSO;
    const bordo = Math.max(Math.abs(px), Math.abs(pz)) > LIMITE - 10 ? 1 : 0;   // bordo della mappa: muro di alberi
    if (r() > Math.max(dens(px, pz), bordo) || !libero(px, pz) || vicinoCasa(px, pz) || suStrada(px, pz)) continue;
    const q = r(); const tipo = q < 0.5 ? 0 : q < 0.72 ? 1 : 2;
    lista.push([px, pz, tipo, 0.75 + r() * 0.6, r() * 6.28]);
  }
  for (let z = -HALF + 2; z < HALF - 2; z += 7) for (let x = -HALF + 2; x < HALF - 2; x += 7) {
    const px = x + r() * 7, pz = z + r() * 7;
    if (r() > dens(px, pz) * 0.55 || !libero(px, pz) || vicinoCasa(px, pz)) continue;
    lista.push([px, pz, 3, 0.6 + r() * 0.9, r() * 6.28]);
    CESPUGLI.push([px, pz, lista[lista.length - 1][3]]);
  }
  // i fogli: ognuno sulla superficie verticale più vicina al punto di Leo, un tronco o il muro di una casa;
  // in mezzo a un prato senza niente intorno ci pianto un albero
  const TR = [[0.3, 0.17, 6.2], [0.24, 0.12, 9.5], [0.25, 0.04, 10]];   // raggio in basso, in cima, altezza (modelliAlberi)
  FOGLI_ANCORE.length = 0;
  const raggioT = t => { const [r0, r1, h] = TR[t[2]]; return t[3] * r0 - (r0 - r1) * 1.45 / h; };
  const coperto = (x, z, io) => lista.some(t => t !== io && t[2] < 3 && Math.hypot(t[0] - x, t[1] - z) < raggioT(t) + 0.06);   // dentro un altro tronco
  for (const [fx, fz] of fogliPos) {
    let best = null, bd = 14;
    for (const t of lista) {
      if (t[2] > 2) continue;
      const rt = raggioT(t);   // il tronco all'altezza del foglio
      const d = Math.hypot(t[0] - fx, t[1] - fz) - rt + (t[2] === 2 ? 12 : 0);   // gli abeti hanno i rami bassi che coprono il foglio: solo se non c'è altro
      if (d >= bd) continue;
      const a = Math.atan2(fx - t[0], fz - t[1]), x = t[0] + Math.sin(a) * (rt + 0.025), z = t[1] + Math.cos(a) * (rt + 0.025);
      if (coperto(x + Math.sin(a) * 0.3, z + Math.cos(a) * 0.3, t) || coperto(x, z, t)) continue;
      bd = d; best = { x, z, dir: a, y: quota(t[0], t[1]) + 1.45 };
    }
    for (const pts of osm.case) {
      if (pts.length < 3) continue;
      let cx = 0, cz = 0; for (const q of pts) { cx += q[0] / pts.length; cz += q[1] / pts.length; }
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez;
        if (L < 0.5) continue;
        const k = Math.max(0.1, Math.min(0.9, ((fx - ax) * ex + (fz - az) * ez) / L)), px = ax + ex * k, pz = az + ez * k;
        const d = Math.hypot(fx - px, fz - pz);
        if (d >= bd) continue;
        let nx = -ez, nz = ex; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
        if ((px - cx) * nx + (pz - cz) * nz < 0) { nx = -nx; nz = -nz; }   // la faccia di fuori
        bd = d; best = { x: px + nx * 0.03, z: pz + nz * 0.03, dir: Math.atan2(nx, nz), y: quota(px + nx, pz + nz) + 1.45 };
      }
    }
    if (!best) {
      lista.push([fx, fz, 0, 1.35, 0]);
      const rt = 1.35 * 0.3 - 0.13 * 1.45 / 6.2;
      best = { x: fx, z: fz + rt + 0.025, dir: 0, y: quota(fx, fz) + 1.45 };
    }
    FOGLI_ANCORE.push(best);
  }
  // l'albero che Guerrino prende a pugni, accanto alla Fonticella
  lista.push([FONTE.x + 4.2, FONTE.z - 2.6, 0, 1.25, 1.1]);

  const LATO = HALF * 2 / NB;
  const perBlocco = new Map();
  for (const t of lista) {
    const bi = Math.min(NB - 1, (t[0] + HALF) / LATO | 0), bj = Math.min(NB - 1, (t[1] + HALF) / LATO | 0);
    const k = bj * NB + bi; let b = perBlocco.get(k);
    if (!b) perBlocco.set(k, b = [[], [], [], []]);
    b[t[2]].push(t);
  }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), su = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [k, tipi] of perBlocco) {
    const g = bloccoDi(((k % NB) + 0.5) * LATO - HALF, ((k / NB | 0) + 0.5) * LATO - HALF);
    tipi.forEach((l, tipo) => {
      if (!l.length) return;
      const ims = geos[tipo].map((geo, k) => geo && new THREE.InstancedMesh(geo, mats[k], l.length)).filter(Boolean);
      l.forEach((t, i) => {
        qq.setFromAxisAngle(su, t[4]); sc.set(t[3], t[3] * (0.9 + (i % 5) * 0.06), t[3]);
        v.set(t[0], quota(t[0], t[1]) - 0.15, t[1]);
        m4.compose(v, qq, sc); for (const im of ims) im.setMatrixAt(i, m4);
        if (tipo < 3) aggiungiTronco({ x: t[0], z: t[1], r: (tipo === 1 ? 0.22 : 0.28) * t[3] + 0.05, mesh: ims, i, s: t[3], sy: sc.y, rot: t[4], y: v.y });
      });
      for (const im of ims) { im.computeBoundingSphere(); g.add(im); }
    });
  }
  FRONDE_MAT = mats[1];
}
let FRONDE_MAT = null;
const CESPUGLI = [];   // [x, z, scala]: dove Papi si accovaccia

/* ════════ SOTTOBOSCO: STERPAGLIE E PIETRE ════════ */
// due ciuffi disegnati a mano a 64 px: a sinistra sterpi secchi, a destra erba alta e felci
function texSterpi() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d'), r = rand(31);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {   // sterpi: rametti secchi che si aprono a ventaglio e si biforcano
    const a = (r() - 0.5) * 2.1, l = 26 + r() * 34, x0 = 32 + (r() - 0.5) * 10, x1 = x0 + Math.sin(a) * l, y1 = 64 - Math.cos(a) * l;
    g.strokeStyle = ['#7d6a45', '#5f5034', '#93825a', '#4c4029', '#a39468'][i % 5]; g.lineWidth = r() < 0.3 ? 2 : 1;
    g.beginPath(); g.moveTo(x0, 64); g.quadraticCurveTo(x0 + Math.sin(a) * l * 0.4 + (r() - 0.5) * 8, 64 - l * 0.5, x1, y1); g.stroke();
    if (r() < 0.6) { const b = a + (r() - 0.5) * 1.4; g.lineWidth = 1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(Math.max(1, Math.min(62, x1 + Math.sin(b) * 9)), Math.max(1, y1 - Math.cos(b) * 9)); g.stroke(); }
  }
  for (let i = 0; i < 34; i++) {   // erba alta
    const a = (r() - 0.5) * 1.5, l = 18 + r() * 40, x0 = 96 + (r() - 0.5) * 22, x1 = Math.max(66, Math.min(126, x0 + Math.sin(a) * l)), y1 = 64 - Math.cos(a) * l;
    g.strokeStyle = ['#56633a', '#6f7a48', '#3f4a2c', '#87854f', '#4a5a34'][i % 5]; g.lineWidth = r() < 0.5 ? 2 : 1;
    g.beginPath(); g.moveTo(x0, 64); g.quadraticCurveTo(x0, 64 - l * 0.6, x1, y1); g.stroke();
  }
  // niente mezze trasparenze: i pixel o ci sono o no, come sulla PS1
  const img = g.getImageData(0, 0, 128, 64), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 90 ? 255 : 0;
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function geoSterpo() {
  // due piani in croce di sterpi e uno d'erba di traverso
  const l = [];
  [[0, 0], [Math.PI / 2, 0], [Math.PI / 4, 1]].forEach(([rot, quale]) => {
    const g = new THREE.PlaneGeometry(1.1, 0.9).translate(0, 0.43, 0), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (quale + uv.getX(i)) / 2);
    g.rotateY(rot);
    const pp = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < pp.count; i++) { v.set(pp.getX(i), 0.8, pp.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    l.push(g.toNonIndexed());
  });
  const g = mergeGeometries(l); g.clearGroups(); return g;
}
function geoPietra(seme) {
  // un sasso: icosaedro schiacciato e ammaccato, a facce piatte
  const g = new THREE.IcosahedronGeometry(1, 0), pp = g.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const k = 0.78 + rand(Math.round((x * 31 + y * 57 + z * 91) * 1000) + seme)() * 0.44;   // stesso spigolo, stessa ammaccatura
    pp.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function creaSottobosco(bosco) {
  const r = rand(4321);
  const dens = (x, z) => bosco.d[(Math.min(bosco.h - 1, Math.max(0, Math.round((z + HALF) / (HALF * 2) * (bosco.h - 1)))) * bosco.w + Math.min(bosco.w - 1, Math.max(0, Math.round((x + HALF) / (HALF * 2) * (bosco.w - 1))))) * 4] / 255;
  const inCasa = (x, z) => CASE.some(c => x > c.minx - 1 && x < c.maxx + 1 && z > c.minz - 1 && z < c.maxz + 1);
  const viaLibera = (x, z, m) => !suSentiero(x, z) && !suSentiero(x + m, z) && !suSentiero(x - m, z) && !suSentiero(x, z + m) && !suSentiero(x, z - m);
  const sterpi = new Map(), pietre = new Map();
  const metti = (mappa, x, z, dati) => { const g = bloccoDi(x, z); let l = mappa.get(g); if (!l) mappa.set(g, l = []); l.push(dati); };
  const M = LIMITE + 20;
  // sterpaglie: fitte nel bosco, rade nei prati, niente su strade e sentieri
  for (let z = -M; z < M; z += 3.3) for (let x = -M; x < M; x += 3.3) {
    const px = x + r() * 3.3, pz = z + r() * 3.3, q = r(), s = 0.55 + r() * 0.75 + (r() < 0.08 ? 0.6 : 0), rot = r() * 6.28;
    if (q > 0.2 + dens(px, pz) * 0.55 || suSentiero(px, pz) || inCasa(px, pz) || vicinoCasa(px, pz) || Math.hypot(FONTE.x - px, FONTE.z - pz) < 2.4 || pendenza(px, pz) > 0.7) continue;
    metti(sterpi, px, pz, [px, pz, s, s * (0.8 + r() * 0.5), rot, 0, 0]);
  }
  // pietre: piccole dappertutto, medie ogni tanto, grandi rare (di più sul ripido e lungo i fossi)
  const giro = (passo, prob, da, a, largo) => {
    for (let z = -M; z < M; z += passo) for (let x = -M; x < M; x += passo) {
      const px = x + r() * passo, pz = z + r() * passo, q = r(), s = da + r() * (a - da), rot = r() * 6.28, sy = 0.7 + r() * 0.6, tx = (r() - 0.5) * 0.5, tz = (r() - 0.5) * 0.5;
      const aspro = pendenza(px, pz) > 0.3 || distFosso(px, pz) < 7 ? 1.8 : 1;
      if (q > prob * aspro || inCasa(px, pz) || vicinoCasa(px, pz) || !viaLibera(px, pz, largo) || (largo > 0.5 && !libero(px, pz, largo))) continue;
      metti(pietre, px, pz, [px, pz, s, s * sy, rot, tx, tz]);
      if (s > 0.33) aggiungiTronco({ x: px, z: pz, r: s * 0.8, mesh: null, basso: true });   // contro le medie e le grandi si sbatte
    }
  };
  giro(4.6, 0.42, 0.1, 0.26, 0.4);
  giro(10.5, 0.4, 0.34, 0.7, 1.4);
  giro(25, 0.34, 0.9, 1.7, 2.6);

  const matSterpi = new THREE.MeshLambertMaterial({ map: texSterpi(), color: 0xb0aa98, alphaTest: 0.5, side: THREE.DoubleSide });
  matSterpi.onBeforeCompile = FRONDE_MAT.onBeforeCompile;
  const matPietra = ps1(new THREE.MeshLambertMaterial({ map: TEX.roccia, color: 0x9a9892, flatShading: true }));
  const gS = geoSterpo(), gP = geoPietra(3);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const monta = (mappa, geo, mat, affonda) => {
    for (const [g, l] of mappa) {
      const im = new THREE.InstancedMesh(geo, mat, l.length);
      l.forEach((t, i) => {
        e.set(t[5], t[4], t[6]); qq.setFromEuler(e); sc.set(t[2], t[3], t[2]);
        v.set(t[0], quota(t[0], t[1]) - affonda * t[3], t[1]);
        m4.compose(v, qq, sc); im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere(); g.add(im);
    }
  };
  monta(sterpi, gS, matSterpi, 0.04);
  monta(pietre, gP, matPietra, 0.3);
}

/* ════════ ACQUA DEI FOSSI ════════ */
// una striscia d'acqua lungo ogni fosso, che scorre in discesa (la texture cammina)
let acquaFossi = null;
// Il Greppo (Leo, 16/11): uno sperone in quota a nord; davanti, a valle, un salto di roccia a strapiombo.
// Ci si arriva col sentiero viola; chi ci cade dentro muore.
const GREPPO = { x: 101, z: -292, salto: 13 };
const SENTIERO_GREPPO = [[23, 77], [26, 77], [37, 65], [42, 47], [42, -21], [25, -60], [-2, -89], [-29, -97], [-90, -69], [-137, -58], [-240, -64], [-253, -84], [-240, -140], [-244, -178], [-238, -191], [-214, -211], [-172, -230], [-158, -264], [-128, -283], [-87, -289], [-40, -310 + 3], [25, -309 + 3], [66, -296], [81, -299], [94, -294], [101, -292]];
// quanto scende il terreno nel punto (dx, dz) rispetto al Greppo: il ciglio è un arco 5 m a sud dello sperone
function saltoGreppo(dx, dz) {
  const ax = Math.abs(dx); if (ax > 30) return 0;
  const s = dz - (5 + (dx / 20) * (dx / 20) * 5);   // metri oltre il ciglio
  if (s <= 0) return 0;
  const lato = ax < 20 ? 1 : 1 - (ax - 20) / 10, giu = Math.min(1, s / 2.4), risale = s < 9 ? 1 : Math.max(0, 1 - (s - 9) / 24);
  return GREPPO.salto * giu * risale * lato * lato * (3 - 2 * lato);
}
function scavaGreppo() {
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = saltoGreppo(i * CELLA - HALF - GREPPO.x, j * CELLA - HALF - GREPPO.z);
    if (d > 0) Q[j * N + i] -= d;
  }
}
// niente alberi sul ciglio e sulla parete: dal Greppo si deve vedere il vuoto
function zonaGreppo(x, z) {
  const dx = x - GREPPO.x, dz = z - GREPPO.z;
  return Math.abs(dx) < 32 && dz > -4 && dz < 5 + (dx / 20) * (dx / 20) * 5 + 9;
}

// I fossi scendono sempre: lungo ogni fosso il livello dell'acqua può solo calare verso valle.
// Dove il terreno fa una gobba (una stradina su un argine) taglio il letto sotto quel livello,
// e dove una strada passa sopra al fosso c'è un ponticello di legno (Leo, 16/11).
let PROFILI = [];   // [{pts: [[x,z]...], liv: [quota dell'acqua...], verso}]
const PONTI = [];   // {x, z, rx, rz, L, W, yA, yB, arco}
function preparaFossiEPonti(osm) {
  PROFILI = [];
  for (const f of FOSSI) {
    if (f.length < 2) continue;
    const pts = [];   // un punto ogni metro e un quarto
    for (let i = 1; i < f.length; i++) {
      const [ax, az] = f[i - 1], [bx, bz] = f[i], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.25));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    const liv = pts.map(([x, z]) => quota(x, z));
    const verso = liv[0] > liv[liv.length - 1] ? 1 : -1;
    if (verso > 0) for (let i = 1; i < liv.length; i++) liv[i] = Math.min(liv[i], liv[i - 1]);
    else for (let i = liv.length - 2; i >= 0; i--) liv[i] = Math.min(liv[i], liv[i + 1]);
    PROFILI.push({ pts, liv, verso });
  }
  // scavo: vicino al fosso il terreno non sta mai sopra il livello dell'acqua (raccordo dopo 1,8 m)
  for (const { pts, liv } of PROFILI) for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k], i0 = Math.floor((x - 3.4 + HALF) / CELLA), j0 = Math.floor((z - 3.4 + HALF) / CELLA);
    for (let j = j0; j <= j0 + 3; j++) for (let i = i0; i <= i0 + 3; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const d = Math.hypot(i * CELLA - HALF - x, j * CELLA - HALF - z); if (d > 3.4) continue;
      const lim = liv[k] - 0.06 + Math.max(0, d - 1.8) * 0.5;
      if (Q[j * N + i] > lim) Q[j * N + i] = lim;
    }
  }
  // i ponti di pietra: dove una strada o un sentiero taglia un fosso. Gli estremi stanno sul percorso stesso,
  // abbastanza lontano dal fosso da poggiare sul terreno vero (fuori dallo scavo): così combaciano
  const incrocio = (a, b, c, d) => {
    const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]); if (Math.abs(den) < 1e-9) return null;
    const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den, u = -((a[0] - b[0]) * (a[1] - c[1]) - (a[1] - b[1]) * (a[0] - c[0])) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), u] : null;
  };
  // da un punto della strada (segmento j, frazione u) cammino lungo la strada per d metri, avanti (+1) o indietro (-1)
  const lungo = (s, j, u, d, verso) => {
    let x = s[j - 1][0] + (s[j][0] - s[j - 1][0]) * u, z = s[j - 1][1] + (s[j][1] - s[j - 1][1]) * u, k = verso > 0 ? j : j - 1;
    while (d > 0 && k >= 0 && k < s.length) {
      const l = Math.hypot(s[k][0] - x, s[k][1] - z);
      if (l >= d) { x += (s[k][0] - x) * d / l; z += (s[k][1] - z) * d / l; return [x, z]; }
      d -= l; x = s[k][0]; z = s[k][1]; k += verso;
    }
    return [x, z];
  };
  for (const pr of PROFILI) for (const [tipo, s] of osm.strade) for (let j = 1; j < s.length; j++) for (let i = 1; i < pr.pts.length; i++) {
    const q = incrocio(pr.pts[i - 1], pr.pts[i], s[j - 1], s[j]);
    if (!q || Math.max(Math.abs(q[0]), Math.abs(q[1])) > LIMITE - 4 || PONTI.some(o => Math.hypot(o.x - q[0], o.z - q[1]) < 8)) continue;
    let fx = pr.pts[i][0] - pr.pts[i - 1][0], fz = pr.pts[i][1] - pr.pts[i - 1][1]; const lf = Math.hypot(fx, fz) || 1; fx /= lf; fz /= lf;
    let rx = s[j][0] - s[j - 1][0], rz = s[j][1] - s[j - 1][1]; const l0 = Math.hypot(rx, rz) || 1; rx /= l0; rz /= l0;
    const seno = Math.max(0.45, Math.abs(rx * fz - rz * fx)), mezza = Math.min(6.5, 3.9 / seno);
    const A = lungo(s, j, q[2], mezza, -1), B = lungo(s, j, q[2], mezza, 1);
    const cx = (A[0] + B[0]) / 2, cz = (A[1] + B[1]) / 2, L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (L < 4) continue;
    const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
    const yA = quota(A[0], A[1]), yB = quota(B[0], B[1]), aQ = (q[0] - cx) * ux + (q[1] - cz) * uz;
    const acqua = pr.liv[i] + 0.14, tQ = aQ / L + 0.5;
    const arco = Math.max(0.3, acqua + 1.75 - (yA + (yB - yA) * tQ));   // sotto ci passa l'acqua con un metro e mezzo d'aria
    PONTI.push({ x: cx, z: cz, rx: ux, rz: uz, L, W: tipo === 't' || tipo === 'p' ? 2.4 : 3.4, yA, yB, arco, aQ, acqua });
  }
}
// Il sentiero del Greppo l'ha disegnato Leo sulla mappa, non segue il terreno: qui gli rifaccio il terreno
// intorno (Leo, 17/11). Lungo il sentiero il profilo è lisciato, di traverso è in piano (una cengia scavata
// nel pendio), e vicino al ponte sale o scende con calma fino alle spalle, alla loro quota.
function spianaSentiero(s) {
  const pts = [], prog = [];   // un punto ogni metro, con i metri fatti dall'inizio
  for (let i = 1; i < s.length; i++) {
    const [ax, az] = s[i - 1], [bx, bz] = s[i], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); prog.push((prog.length ? prog[prog.length - 1] : 0) + (k ? l / n : 0)); }
  }
  const n = pts.length, h0 = pts.map(([x, z]) => quota(x, z));
  // profilo lisciato (media su ±8 m, due passate), al massimo 2 m sopra o sotto il terreno vero
  let h = h0.slice();
  for (let pass = 0; pass < 2; pass++) {
    const o = h.slice();
    for (let k = 0; k < n; k++) { let t = 0, c = 0; for (let q = Math.max(0, k - 8); q <= Math.min(n - 1, k + 8); q++) { t += o[q]; c++; } h[k] = t / c; }
  }
  for (let k = 0; k < n; k++) h[k] = Math.max(h0[k] - 2, Math.min(h0[k] + 2, h[k]));
  // i ponti: il tratto sopra il fosso non lo tocco; davanti alle spalle 3 m in piano, poi al massimo il 40% di pendenza
  const salta = new Uint8Array(n), vicino = (x, z) => { let b = 0, m = Infinity; for (let k = 0; k < n; k++) { const d = Math.hypot(pts[k][0] - x, pts[k][1] - z); if (d < m) { m = d; b = k; } } return [b, m]; };
  for (const p of PONTI) {
    if (vicino(p.x, p.z)[1] > 1.5) continue;
    const ends = [[p.x - p.rx * p.L / 2, p.z - p.rz * p.L / 2, p.yA], [p.x + p.rx * p.L / 2, p.z + p.rz * p.L / 2, p.yB]].map(([x, z, y]) => [vicino(x, z)[0], y]);
    const lo = Math.min(ends[0][0], ends[1][0]), hi = Math.max(ends[0][0], ends[1][0]);
    for (let k = lo + 1; k < hi; k++) salta[k] = 1;
    for (const [ke, y] of ends) for (let k = 0; k < n; k++) {
      if (k > lo && k < hi) continue;
      const d = Math.max(0, Math.abs(prog[k] - prog[ke]) - 3);   // 3 m in piano davanti alla spalla
      h[k] = Math.max(y - 0.4 * d, Math.min(y + 0.4 * d, h[k]));
    }
  }
  // sul terreno: ogni nodo prende il punto di sentiero più vicino; in piano fino a 1,7 m, raccordo fino a 6 m
  const best = new Map();
  for (let k = 0; k < n; k++) {
    const [x, z] = pts[k], i0 = Math.floor((x - 6 + HALF) / CELLA), j0 = Math.floor((z - 6 + HALF) / CELLA);
    for (let j = j0; j <= j0 + 5; j++) for (let i = i0; i <= i0 + 5; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const d = Math.hypot(i * CELLA - HALF - x, j * CELLA - HALF - z), id = j * N + i, b = best.get(id);
      if (d < 6 && (!b || d < b[0])) best.set(id, [d, k]);
    }
  }
  for (const [id, [d, k]] of best) {
    if (salta[k]) continue;
    const kk = d < 1.7 ? 1 : 1 - (d - 1.7) / 4.3, w = kk * kk * (3 - 2 * kk);
    let y = Q[id] + (h[k] - Q[id]) * w;
    // vicino all'acqua il terreno può solo scendere: il letto dei fossi resta sgombro
    if (y > Q[id] && distFosso((id % N) * CELLA - HALF, (id / N | 0) * CELLA - HALF) < 3.6) y = Q[id];
    Q[id] = y;
  }
  // sotto le spalle (la muratura piena, fuori dall'arco) il terreno arriva alla quota del ponte:
  // la griglia è di 2,5 m e senza questo, appena sceso dal ponte, ci sarebbe una buca verso il fosso
  for (const p of PONTI) {
    if (vicino(p.x, p.z)[1] > 1.5) continue;
    const luce = Math.min(p.L / 2 - 1.1, 2.6), i0 = Math.floor((p.x - p.L + HALF) / CELLA), j0 = Math.floor((p.z - p.L + HALF) / CELLA);
    for (let j = j0; j <= j0 + Math.ceil(2 * p.L / CELLA); j++) for (let i = i0; i <= i0 + Math.ceil(2 * p.L / CELLA); i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const dx = i * CELLA - HALF - p.x, dz = j * CELLA - HALF - p.z, a = dx * p.rx + dz * p.rz, b = -dx * p.rz + dz * p.rx;
      if (Math.abs(b) < p.W / 2 + 1.2 && Math.abs(a) > luce + 0.5 && Math.abs(a) <= p.L / 2 + 0.3) Q[j * N + i] = (a < 0 ? p.yA : p.yB) - 0.05;
    }
  }
}
// il piano del ponte sotto i piedi (null se non ci sei sopra)
function sulPonte(x, z) {
  for (const p of PONTI) {
    const dx = x - p.x, dz = z - p.z, a = dx * p.rx + dz * p.rz, b = -dx * p.rz + dz * p.rx;
    if (Math.abs(a) < p.L / 2 && Math.abs(b) < p.W / 2) return pianoPonte(p, a / p.L + 0.5);
  }
  return null;
}
function pianoPonte(p, t) { return p.yA + (p.yB - p.yA) * t + p.arco * Math.pow(Math.sin(t * Math.PI), 0.7) + 0.03; }
function suoloIo(x, z) { const q = quota(x, z), p = sulPonte(x, z); return p === null ? q : Math.max(q, p); }
// Ponte di pietra ad arco (fatto qui, su misura: ogni ponte ha la sua luce e le sue sponde):
// spalle e arco ribassato in conci, piano in ciottoli, parapetti bassi
function creaPonti() {
  if (!PONTI.length) return;
  const pietra = ps1(new THREE.MeshLambertMaterial({ map: texPs1(TEX.muro.clone(), 1 / 2.2), color: 0x9b958a }));
  const selciato = ps1(new THREE.MeshLambertMaterial({ map: texPs1(TEX.ciottoli.clone(), 1 / 1.4), color: 0x8f8a80 }));
  const muri = [], piani = [];
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const metti = (lista, geo, x, y, z, rx, ry) => { e.set(rx, ry, 0, 'YXZ'); qq.setFromEuler(e); v.set(x, y, z); m4.compose(v, qq, sc); geo.applyMatrix4(m4); lista.push(geo); };
  for (const p of PONTI) {
    const ry = Math.atan2(p.rx, p.rz), n = Math.max(6, Math.round(p.L / 0.8));
    // il corpo: profilo lungo il ponte (sopra il piano, sotto un arco ribassato sul fosso) estruso per la larghezza
    const fondo = p.acqua - 1.6, sp = p.acqua + 0.05, luce = Math.min(p.L / 2 - 1.1, 2.6);
    const sotto = pianoPonte(p, p.aQ / p.L + 0.5) - 0.42, freccia = Math.max(0.35, Math.min(luce, sotto - sp));
    const R = (luce * luce + freccia * freccia) / (2 * freccia), cy = sp + freccia - R, a0 = Math.asin(Math.min(1, luce / R));
    const forma = new THREE.Shape();
    forma.moveTo(-p.L / 2, fondo);
    for (let i = 0; i <= n; i++) { const tt = i / n; forma.lineTo((tt - 0.5) * p.L, pianoPonte(p, tt) - 0.12); }
    forma.lineTo(p.L / 2, fondo);
    forma.lineTo(p.aQ + luce, fondo); forma.lineTo(p.aQ + luce, sp);
    for (let i = 0; i <= 10; i++) { const an = a0 - 2 * a0 * i / 10; forma.lineTo(p.aQ + Math.sin(an) * R, cy + Math.cos(an) * R); }
    forma.lineTo(p.aQ - luce, fondo);
    forma.lineTo(-p.L / 2, fondo);
    const corpo = new THREE.ExtrudeGeometry(forma, { depth: p.W, bevelEnabled: false });
    corpo.translate(0, 0, -p.W / 2);
    // le UV dell'estrusione sono in metri: la texture del muro (una ogni 2,2 m) si ripete da sola
    metti(muri, corpo, p.x, 0, p.z, 0, ry - Math.PI / 2);
    // il piano in ciottoli e i parapetti, a pezzi che seguono la schiena del ponte
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, y0 = pianoPonte(p, t0), y1 = pianoPonte(p, t1), lseg = Math.hypot(p.L / n, y1 - y0) + 0.03;
      const am = ((t0 + t1) / 2 - 0.5) * p.L, ym = (y0 + y1) / 2, pend = Math.atan2(y1 - y0, p.L / n);
      const xm = p.x + p.rx * am, zm = p.z + p.rz * am;
      metti(piani, new THREE.BoxGeometry(p.W - 0.5, 0.1, lseg), xm, ym - 0.05, zm, -pend, ry);
      for (const s of [-1, 1]) {
        const ox = -p.rz * s * (p.W / 2 - 0.13), oz = p.rx * s * (p.W / 2 - 0.13);
        metti(muri, new THREE.BoxGeometry(0.26, 0.62, lseg), xm + ox, ym + 0.2, zm + oz, -pend, ry);
      }
    }
  }
  const unisci = l => mergeGeometries(l.map(x => { x = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; }));
  for (const [l, mat] of [[muri, pietra], [piani, selciato]]) { const m = new THREE.Mesh(unisci(l), mat); m.matrixAutoUpdate = false; scena.add(m); }
}

function creaAcqua() {
  acquaFossi = TEX.acqua.clone(); texPs1(acquaFossi, 1, 1); acquaFossi.generateMipmaps = true; acquaFossi.minFilter = THREE.NearestMipmapNearestFilter; acquaFossi.needsUpdate = true;
  const mat = ps1(new THREE.MeshLambertMaterial({ map: acquaFossi, color: 0x86aabb, emissive: 0x13232b, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
  for (const { pts, liv, verso } of PROFILI) {
    let lung = 0;
    const PEZZO = 40;   // pezzi da 50 m: quelli fuori vista non si disegnano
    for (let i0 = 0; i0 < pts.length - 1; i0 += PEZZO) {
      const pos = [], uv = [], nor = [], idx = [];
      for (let i = i0; i <= Math.min(pts.length - 1, i0 + PEZZO); i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], pt = pts[i];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        if (i > i0) lung += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]);
        // larga da una sponda all'altra: i bordi entrano nel terreno, così non resta mai sospesa
        const w = 2.3, vv = lung / 4.6 * verso;
        const y = liv[i] + 0.14;   // il livello scende sempre verso valle (preparaFossiEPonti)
        pos.push(pt[0] + tz * w, y, pt[1] - tx * w, pt[0] - tz * w, y, pt[1] + tx * w);
        uv.push(0, vv, 1, vv); nor.push(0, 1, 0, 0, 1, 0);
        const k = (i - i0) * 2;
        if (i > i0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; scena.add(m);
    }
  }
}

/* ════════ EVENTI A CASO: IL CINGHIALE ════════ */
// ogni tanto, lontano, un cinghiale attraversa di corsa davanti a te
const cinghiale = { g: new THREE.Group(), attivo: false, prossimo: Infinity, x: 0, z: 0, dx: 0, dz: 0, fine: 0, fase: 0, zampe: [], voce: null, passi: null, grugnito: 0 };
function creaCinghiale() {
  const pelo = ps1(new THREE.MeshLambertMaterial({ color: 0x4a3d32, flatShading: true }));
  const scuro = ps1(new THREE.MeshLambertMaterial({ color: 0x2a221c, flatShading: true }));
  const osso = ps1(new THREE.MeshLambertMaterial({ color: 0xcfc6a8, flatShading: true }));
  const corpo = new THREE.Group(), pezzo = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; corpo.add(m); return m; };
  pezzo(new THREE.SphereGeometry(0.5, 6, 4).scale(0.62, 0.74, 1.3), pelo, 0, 0.64, 0);                  // il corpo, alto di spalle
  pezzo(new THREE.BoxGeometry(0.1, 0.16, 0.9), scuro, 0, 1.0, 0.12);                                    // la criniera sulla schiena
  pezzo(new THREE.ConeGeometry(0.3, 0.8, 5), pelo, 0, 0.52, 0.86, Math.PI / 2 + 0.25);                  // la testa a cuneo
  pezzo(new THREE.BoxGeometry(0.16, 0.14, 0.1), scuro, 0, 0.4, 1.24);                                   // il grugno
  for (const s of [-1, 1]) {
    pezzo(new THREE.ConeGeometry(0.07, 0.18, 4), scuro, s * 0.15, 0.82, 0.62);                          // le orecchie
    pezzo(new THREE.ConeGeometry(0.025, 0.14, 4), osso, s * 0.1, 0.46, 1.16, -0.3);                     // le zanne
  }
  pezzo(new THREE.BoxGeometry(0.04, 0.22, 0.04), scuro, 0, 0.7, -0.66, 0.5);                            // la coda
  for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.38], [0.2, -0.38]]) {
    const anca = new THREE.Group(); anca.position.set(x, 0.46, z);
    const zampa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.1), scuro); zampa.position.y = -0.23; anca.add(zampa);
    corpo.add(anca); cinghiale.zampe.push(anca);
  }
  cinghiale.corpo = corpo; cinghiale.g.add(corpo); cinghiale.g.visible = false;
  scena.add(cinghiale.g);
}
function lanciaCinghiale(t) {
  // parte di lato, a 25-35 m davanti a te, e attraversa
  const av = avanti(), lato = Math.random() < 0.5 ? 1 : -1, D = 24 + Math.random() * 10;
  cinghiale.dx = -av.z * lato; cinghiale.dz = av.x * lato;
  cinghiale.x = io.x + av.x * D - cinghiale.dx * 45; cinghiale.z = io.z + av.z * D - cinghiale.dz * 45;
  cinghiale.attivo = true; cinghiale.fine = t + 7; cinghiale.fase = 0; cinghiale.grugnito = t + 0.6; cinghiale.rumore = 0;
  cinghiale.g.visible = true;
  cinghiale.prossimo = t + (VELOCE ? 40 : 150) + Math.random() * (VELOCE ? 20 : 200);
}
function aggiornaCinghiale(dt, t) {
  if (!cinghiale.attivo) {
    const quieto = (storia === 'solo' || storia === 'caccia') && papi.stato === 'assente';
    if (t > cinghiale.prossimo && quieto && Math.hypot(io.x - tel.paese[0], io.z - tel.paese[1]) > 60) lanciaCinghiale(t);
    return;
  }
  const c = cinghiale, V = 15;
  let dx = c.dx, dz = c.dz;
  tronchiVicini(c.x + dx * 1.2, c.z + dz * 1.2, 1.6, tr => {   // schiva tronchi e pietre
    const ox = c.x + dx * 1.2 - tr.x, oz = c.z + dz * 1.2 - tr.z, od = Math.hypot(ox, oz) || 1;
    if (od < tr.r + 0.7) { dx += ox / od * 0.9; dz += oz / od * 0.9; }
  });
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  c.x += dx * V * dt; c.z += dz * V * dt; c.fase += dt * 24;
  const y = quota(c.x, c.z);
  c.g.position.set(c.x, y, c.z);
  c.g.rotation.y = Math.atan2(dx, dz);
  // galoppo: davanti e dietro sfasate, il corpo che beccheggia
  c.corpo.position.y = Math.abs(Math.sin(c.fase * 0.5)) * 0.12;
  c.corpo.rotation.x = Math.sin(c.fase) * 0.09;
  c.zampe.forEach((z, i) => { z.rotation.x = Math.sin(c.fase + (i < 2 ? 0 : 2.4) + (i % 2) * 0.5) * 0.9; });
  if (c.voce && t > c.grugnito && buf.cing1) {
    c.grugnito = t + 2.2 + Math.random() * 2;
    if (c.voce.isPlaying) c.voce.stop();
    c.voce.setBuffer(buf[Math.random() < 0.5 ? 'cing1' : 'cing2']); c.voce.setPlaybackRate(0.85 + Math.random() * 0.25); c.voce.setVolume(0.9 * mixG('cinghiale')); c.voce.play();
  }
  // il galoppo: tre zoccoli ravvicinati e una pausa (ta-ta-tam), un giro ogni 0,26 s
  if (c.passi && (c.rumore -= dt) < 0 && buf.zoc1) {
    c.colpo = ((c.colpo || 0) + 1) % 4;
    c.rumore = c.colpo === 3 ? 0.11 : 0.05;
    if (c.colpo !== 3) {
      const a = new THREE.PositionalAudio(ascolto);
      a.setRefDistance(7); a.setRolloffFactor(0.9); a.setBuffer(buf['zoc' + (1 + c.colpo)]);
      a.setPlaybackRate(0.9 + Math.random() * 0.2); a.setVolume((c.colpo === 2 ? 1 : 0.7) * mixG('cinghiale'));
      c.g.add(a); a.play(); a.onEnded = () => { a.isPlaying = false; c.g.remove(a); a.disconnect(); };
    }
  }
  if (t > c.fine || Math.hypot(c.x - io.x, c.z - io.z) > 80) { c.attivo = false; c.g.visible = false; }
}

/* ════════ PAESE ════════ */
const CASE = [];   // [{pts, minx, maxx, minz, maxz}]
function creaPaese(osm) {
  const muri = [], tetti = [];
  const r = rand(77);
  for (const pts of osm.case) {
    if (pts.length < 3) continue;
    const forma = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    let qmin = Infinity, qmax = -Infinity;
    for (const p of pts) { const q = quota(p[0], p[1]); qmin = Math.min(qmin, q); qmax = Math.max(qmax, q); }
    const h = 3.6 + r() * 2.2 + (qmax - qmin);
    const g = new THREE.ExtrudeGeometry(forma, { depth: h, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, qmin - 0.8 + h, 0);
    muri.push(g);
    // tetto: una lastra scura che sporge un po'
    const tetto = new THREE.ExtrudeGeometry(forma, { depth: 0.3, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.15, bevelSegments: 1 });
    tetto.rotateX(Math.PI / 2); tetto.translate(0, qmin - 0.8 + h + 0.35, 0);
    tetti.push(tetto);
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    CASE.push({ pts, minx, maxx, minz, maxz });
  }
  if (!muri.length) return;
  const unisci = l => { const g = mergeGeometries(l.map(x => x.index ? x.toNonIndexed() : x)); g.clearGroups(); return g; };
  scena.add(new THREE.Mesh(unisci(muri), ps1(new THREE.MeshLambertMaterial({ map: texPs1(TEX.muro, 1 / 3.4) }))));   // pietra a corsi con le finestre
  scena.add(new THREE.Mesh(unisci(tetti), ps1(new THREE.MeshLambertMaterial({ map: texPs1(TEX.tetto, 1 / 1.6), color: 0x8a7a70 }))));
}
function spingiFuoriCase(p, raggio) {
  for (const c of CASE) {
    if (p.x < c.minx - raggio || p.x > c.maxx + raggio || p.z < c.minz - raggio || p.z > c.maxz + raggio) continue;
    const pts = c.pts; let dentro = false, best = Infinity, bx = 0, bz = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > p.z) !== (zj > p.z) && p.x < (xj - xi) * (p.z - zi) / (zj - zi) + xi) dentro = !dentro;
      const dx = xj - xi, dz = zj - zi, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - xi) * dx + (p.z - zi) * dz) / L));
      const cx = xi + t * dx, cz = zi + t * dz, d = Math.hypot(p.x - cx, p.z - cz);
      if (d < best) { best = d; bx = cx; bz = cz; }
    }
    if (dentro || best < raggio) {
      let nx = p.x - bx, nz = p.z - bz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if (dentro) { nx = -nx; nz = -nz; }
      p.x = bx + nx * raggio; p.z = bz + nz * raggio;
    }
  }
}

/* ════════ FONTICELLA ════════ */
const FONTE = { x: -13.5, z: 156.5, rot: 0.6 + Math.PI };   // a 70 m di strada dalla fine del paese; la vasca guarda a nord-ovest
// un punto contato dalla Fonticella: lx = di lato, lz = davanti alla vasca (metri)
function daFonte(lx, lz) { const c = Math.cos(FONTE.rot), s = Math.sin(FONTE.rot); return [FONTE.x + lx * c + lz * s, FONTE.z - lx * s + lz * c]; }
function creaFonte() {
  const pietra = ps1(new THREE.MeshLambertMaterial({ map: TEX.ciottoli, color: 0x8f8a80 }));
  const g = new THREE.Group();
  // la vasca è cava: fondo e quattro sponde, il bordo all'altezza di una seduta (55 cm)
  const pezzo = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pietra); m.position.set(x, y, z); g.add(m); };
  const L = 2.2, P = 1, H = 0.55, S = 0.14;
  pezzo(L, 0.18, P, 0, 0.09, 0);
  pezzo(L, H, S, 0, H / 2, P / 2 - S / 2); pezzo(L, H, S, 0, H / 2, -P / 2 + S / 2);
  pezzo(S, H, P - 2 * S, L / 2 - S / 2, H / 2, 0); pezzo(S, H, P - 2 * S, -L / 2 + S / 2, H / 2, 0);
  const muro = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.4), pietra); muro.position.set(0, 0.8, -0.6); g.add(muro);
  const tAcqua = texPs1(TEX.acqua.clone(), 2, 1); tAcqua.generateMipmaps = true; tAcqua.minFilter = THREE.NearestMipmapNearestFilter; tAcqua.needsUpdate = true;
  const acqua = new THREE.Mesh(new THREE.PlaneGeometry(L - 2 * S, P - 2 * S), ps1(new THREE.MeshLambertMaterial({ map: tAcqua, color: 0x4a6a78, emissive: 0x04080a })));
  FONTE.acqua = tAcqua;
  acqua.rotation.x = -Math.PI / 2; acqua.position.y = H - 0.1; g.add(acqua);   // dieci centimetri sotto il labbro
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), ps1(new THREE.MeshLambertMaterial({ color: 0x333333 })));
  tubo.rotation.x = Math.PI / 2; tubo.position.set(0, 1.1, -0.3); g.add(tubo);
  g.position.set(FONTE.x, quota(FONTE.x, FONTE.z), FONTE.z);
  g.rotation.y = FONTE.rot;
  scena.add(g);
  aggiungiTronco({ x: FONTE.x, z: FONTE.z, r: 1.1, mesh: null });
}

/* ════════ FOGLI ════════ */
// [x, z]: i punti che Leo ha messo sulla mappa disegnabile (16/11). Il foglio va inchiodato
// sulla superficie verticale più vicina: un tronco o il muro di una casa (vedi creaBosco)
const FOGLI_POS = [
  [9, -30], [102, 265], [-135, 73], [-218, 235], [52, -173],
  [120, -302], [-119, -169], [209, 49], [224, -128], [-254, -14],
];
const FOGLI_ANCORE = [];   // {x, z, dir}: dove sta davvero ogni foglio, e verso dove guarda
const FOGLI = [];
function texFoglio() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 90;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 90); gr.addColorStop(0, '#efeadb'); gr.addColorStop(1, '#bcb39c');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 90);
  g.strokeStyle = 'rgba(90,70,40,.25)'; g.beginPath(); g.moveTo(0, 45); g.lineTo(64, 43); g.stroke();
  g.fillStyle = '#333'; g.beginPath(); g.arc(32, 6, 2, 0, 6.28); g.fill();   // il chiodo
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function creaFogli() {
  const geo = new THREE.PlaneGeometry(0.21 * 1.3, 0.297 * 1.3);   // un 30% più grandi (Leo)
  const mat = ps1(new THREE.MeshLambertMaterial({ map: texFoglio(), color: 0x9a968c, emissive: 0x24221b, side: THREE.DoubleSide }));   // un filo più chiari al buio
  for (const { x: px, z: pz, dir, y } of FOGLI_ANCORE) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, y, pz);
    m.rotation.y = dir;
    m.rotation.z = (Math.random() - 0.5) * 0.2;
    scena.add(m);
    FOGLI.push({ m, x: px, z: pz, preso: false });
  }
}

/* ════════ PERSONAGGI: GUERRINO E PAPI ════════ */
// Guerrino: l'export nuovo di Leo da Rodin, tutto dallo stesso file (modello, scheletro e 9 animazioni:
// mischiare il modello vecchio con le animazioni nuove gli storceva spalle e braccia)
// (jab, combo, affondo, stanco, calcioAlto, pugno, calcio, calcio2, cammina).
// Papi: alto 3 metri, animazioni gattona, salto, corsa, striscia.
const guerrino = { g: new THREE.Group(), x: 0, z: 0, rot: 0, tappa: 0, vel: 0, prossimo: 0, mena: false, tinta: 0x77716a, scala: 1 };
const papi = { g: new THREE.Group(), x: 0, z: 0, rot: 0, vel: 0, stato: 'assente', prossimo: 0, fine: 0, tinta: 0x5c5a58, scala: 4.5 / 1.89, pres: 0, presV: 0, vis: 0 };
function preparaPersonaggio(p, modello) {
  const m = modello.scene;
  p.mat = [];
  // Lambert come il resto della scena: col PBR la torcia li sbianca
  m.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const v = o.material;
    o.material = ps1(new THREE.MeshLambertMaterial({ map: v.map || null, normalMap: v.normalMap || null, color: p.tinta }));
    p.mat.push(o.material);
  });
  m.scale.setScalar(p.scala);
  p.corpo = m; p.g.add(m);
  p.mixer = new THREE.AnimationMixer(m);
  p.az = {}; p.v0 = {};
  for (const clip of modello.animations) {
    // tolgo lo spostamento in avanti delle anche: dove va lo decide il gioco.
    // v0 = metri al secondo dell'animazione originale (già in scala)
    const tr = clip.tracks.find(t => /Hips\.position$/.test(t.name));
    if (tr) {
      const v = tr.values, n = v.length / 3;
      p.v0[clip.name] = Math.max(0.3, Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]) / clip.duration * p.scala);
      for (let i = 0; i < n; i++) { v[i * 3] = v[0]; v[i * 3 + 2] = v[2]; }
    }
    p.az[clip.name] = p.mixer.clipAction(clip);
  }
  p.corrente = null; p.nomeAz = '';
  scena.add(p.g);
}
// passa a un'animazione con una dissolvenza; una = una volta sola e resta sull'ultimo fotogramma
function recita(p, nome, una = false, fade = 0.25) {
  const a = p.az[nome]; if (!a) return null;
  if (p.corrente === a && !una) return a;
  a.reset(); a.setLoop(una ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = una; a.timeScale = 1;
  a.play();
  if (p.corrente && p.corrente !== a) p.corrente.crossFadeTo(a, fade, false);
  p.corrente = a; p.nomeAz = nome;
  return a;
}
function finita(p) { const a = p.corrente; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - 0.02); }

function creaGuerrino(modello, roncola) {
  preparaPersonaggio(guerrino, modello);
  const m = guerrino.corpo, osso = n => m.getObjectByName(n);
  // posa da fermo: il fotogramma della camminata con i piedi più vicini
  const cam = guerrino.az.cammina;
  if (cam) {
    cam.play();
    const clip = cam.getClip(), piedeS = osso('LeftFoot'), piedeD = osso('RightFoot'), a = new THREE.Vector3(), b = new THREE.Vector3();
    let best = 0, bd = Infinity;
    for (let t = 0; t < clip.duration; t += clip.duration / 32) {
      guerrino.mixer.setTime(t); m.updateMatrixWorld(true);
      const d = piedeS.getWorldPosition(a).distanceTo(piedeD.getWorldPosition(b));
      if (d < bd) { bd = d; best = t; }
    }
    guerrino.tFermo = best; cam.stop();
    recita(guerrino, 'cammina');
  }
  // la roncola di Leo in mano destra: il manico passa dentro il pugno (asse x della mano, dal mignolo
  // all'indice), la lama esce dal lato del pollice col filo verso le nocche
  const mano = osso('RightHand');
  if (roncola && mano) {
    const r = roncola.scene;
    r.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = ps1(new THREE.MeshLambertMaterial({ map: o.material.map, color: 0x9c9890 })); } });
    r.position.set(0, -1.65, 0);            // il punto del manico che sta nel palmo (modello alto 1,9)
    const giro = new THREE.Group(); giro.add(r); giro.rotation.y = -Math.PI / 2;
    const perno = new THREE.Group(); perno.add(giro);
    perno.scale.setScalar(0.27); perno.position.set(0, 0.13, 0.03); perno.rotation.set(0, 0, Math.PI / 2);
    mano.add(perno); guerrino.roncola = perno;
    creaRoncolaMia(r);
  }
}
function creaPapi(modello) {
  preparaPersonaggio(papi, modello);
  for (const m of papi.mat) m.fog = false;   // la nebbia gliela metto io: vedi aspettoPapi
  papi.g.visible = false;
  recita(papi, 'gattona');
  // gli occhi: un filo di luce verde, che nell'ombra delle fratte lo tradisce
  papi.testa = papi.corpo.getObjectByName('Head');
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c2.fillStyle = gr; c2.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;   // piccolo da lontano: senza mipmap non si spegne
  papi.occhi = [-1, 1].map(lato => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x7dff70, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    s.userData.lato = lato; s.visible = false; scena.add(s); return s;
  });
}
const _occhio = new THREE.Vector3(), OCCHI = [0.04, 0, 0.19];
function occhiPapi() {
  if (!papi.occhi || !papi.testa) return;
  const su = papi.g.visible && papi.pres > 0.02 && papi.stato !== 'assente' && papi.stato !== 'preso';
  for (const s of papi.occhi) s.visible = su;
  if (!su) return;
  papi.testa.updateWorldMatrix(true, false);
  const d = Math.hypot(io.x - papi.x, io.z - papi.z), nebbia = Math.exp(-Math.pow(scena.fog.density * d, 2) * 0.6);
  for (const s of papi.occhi) {
    // in coordinate della testa (modello alto 1,89; l'asse y dell'osso guarda in giù): sopra l'osso e un dito in avanti
    papi.testa.localToWorld(_occhio.set(s.userData.lato * OCCHI[0], OCCHI[1], OCCHI[2]));
    s.position.copy(_occhio);
    const lato = 0.03 + Math.min(d, 60) * 0.014;    // mai meno di un paio di pixel, anche da lontano
    s.scale.set(lato, lato, 1);
    s.material.opacity = 0.75 * papi.pres * Math.max(0.3, nebbia) * Math.max(0, Math.min(1, (d - 2.5) / 3));   // da vicino lo vedi in faccia: il riflesso sparisce
  }
}
// Da lontano Papi è una sagoma nera contro la nebbia grigia (prende meno nebbia degli alberi, così
// stacca); da vicino, alla torcia, si vede com'è. Compare e sparisce sfumando nella nebbia.
function aspettoPapi(dt) {
  occhiPapi();
  if (!papi.g.visible) return;
  const passo = dt / 1.1;
  papi.pres += Math.max(-passo, Math.min(passo, papi.presV - papi.pres));
  if (papi.pres <= 0 && papi.presV <= 0) { papi.g.visible = false; return; }
  const d = Math.hypot(io.x - papi.x, io.z - papi.z);
  const luce = fase === 'morto' ? 1 : Math.max(0, Math.min(1, (10 - d) / 5));
  const nebbia = (1 - Math.exp(-Math.pow(scena.fog.density * d, 2))) * 0.4;
  for (const m of papi.mat) {
    m.color.setHex(papi.tinta).multiplyScalar(luce * papi.pres);
    m.emissive.copy(NEBBIA).multiplyScalar(1 - papi.pres * (1 - nebbia));
  }
}
function mostraPapi() { papi.g.visible = true; papi.pres = 0; papi.presV = 1; }
function viaPapi(subito) { papi.presV = 0; if (subito) { papi.pres = 0; papi.g.visible = false; } }
// fermo: non ha un'animazione da fermo, tengo un fotogramma. Accovacciato: quello della strisciata
const PAPI_FERMO = ['salto', 0], PAPI_GIU = ['striscia', 0.35];
function papiInPiedi(fade = 0.3, posa = PAPI_FERMO) {
  const a = recita(papi, posa[0], true, fade);
  if (a) { a.time = a.getClip().duration * posa[1]; a.paused = true; }
}
const papiGiu = (fade = 0.3) => papiInPiedi(fade, PAPI_GIU);

function animaGuerrino(dt) {
  if (!guerrino.mixer) return;
  guerrino.g.visible = Math.hypot(guerrino.x - io.x, guerrino.z - io.z) < 75;
  if (!guerrino.g.visible && !guerrino.mena) return;
  const cam = guerrino.az.cammina;
  if (guerrino.corrente === cam && cam) {
    const v = guerrino.vel || 0;
    if (v > 0.05) { cam.paused = false; cam.timeScale = v / (guerrino.v0.cammina || 1.2); }
    else { cam.paused = true; cam.time += (guerrino.tFermo - cam.time) * Math.min(1, dt * 6); }
  }
  guerrino.mixer.update(dt);
}
function animaPapi(dt) {
  if (!papi.mixer || !papi.g.visible) return;
  const a = papi.corrente;
  if (a && (papi.nomeAz === 'corsa' || papi.nomeAz === 'gattona' || papi.nomeAz === 'striscia')) {
    const v = papi.vel || 0;
    a.paused = v < 0.05;
    if (v >= 0.05) a.timeScale = Math.min(3, v / (papi.v0[papi.nomeAz] || 1));
  }
  papi.mixer.update(dt);
}

/* ════════ AUDIO ════════ */
const ascolto = new THREE.AudioListener();
camera.add(ascolto);
let ambiente, fosso, fiatone, rumore, rumoreGain;
// il mix (mix.js): un volume in dB per ogni gruppo di suoni, che Leo regola dal mixer (mixer.html)
const MIX = caricaMix();
const mixG = id => lineare(MIX[id] ?? 0);
function applicaMix() {
  ascolto.setMasterVolume(mixG('generale') * IMPOSTA.volume);
  if (ambiente) ambiente.setVolume(0.275 * mixG('ambiente'));
  if (MUS.bus) MUS.bus.gain.value = mixG('musica') * IMPOSTA.musica;
  for (const n in MUS.pezzi) MUS.pezzi[n].ob = -1;   // al prossimo giro riprendono il volume nuovo
}
// il mixer aperto in un'altra scheda manda il mix in diretta
try {
  const bc = new BroadcastChannel(CANALE_DIRETTA);
  bc.onmessage = e => {
    if (e.data && e.data.mix) { Object.assign(MIX, e.data.mix); applicaMix(); }
    if (e.data && e.data.chi) bc.postMessage({ gioco: true });
  };
} catch (e) {}
function suono(nome, vol = 1, rate = 1, canale = null) {
  if (!buf[nome]) return null;
  const a = new THREE.Audio(ascolto); a.setBuffer(buf[nome]); a.setVolume(vol * (canale ? mixG(canale) : 1)); a.setPlaybackRate(rate); a.play();
  return a;
}
function preparaAudio() {
  const loop = (nome, vol) => { if (!buf[nome]) return null; const a = new THREE.Audio(ascolto); a.setBuffer(buf[nome]); a.setLoop(true); a.setVolume(vol); return a; };
  ambiente = loop('notte', 0.275 * mixG('ambiente'));   // −6 dB (Leo)
  fosso = loop('fosso', 0);
  // statico: rumore bianco generato
  const ctx = ascolto.context, len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  rumore = new THREE.Audio(ascolto); rumore.setBuffer(b); rumore.setLoop(true); rumore.setVolume(0);
  const posizionale = (dove, rif, y) => {
    const a = new THREE.PositionalAudio(ascolto);
    a.setRefDistance(rif); a.setRolloffFactor(0.9); a.setDistanceModel('inverse'); a.position.set(0, y, 0);
    dove.add(a); return a;
  };
  // i colpi di Guerrino sull'albero rimbombano nel bosco: si sentono da lontano e ti riportano da lui
  pugnoAudio = posizionale(guerrino.g, 10, 1.2); pugnoAudio.setDistanceModel('linear'); pugnoAudio.setRolloffFactor(0);   // il volume lo fa colpiLontano()
  { const f = eco(ascolto.context); pugnoAudio.setFilters(f); pugnoUmido = f.umido; }
  papiVoce = posizionale(papi.g, 8, 2);
  papiPassi = posizionale(papi.g, 7, 0.2);
  cinghiale.voce = posizionale(cinghiale.g, 9, 0.6);
  cinghiale.passi = posizionale(cinghiale.g, 7, 0.2);
  tagliaPassi();
  applicaMix();
}
// l'eco del bosco (Leo, 16/11): non un riverbero ma ripetizioni distinte, sempre più scure, come
// il colpo che torna indietro dal versante di fronte
function eco(ctx) {
  const dentro = ctx.createGain(), fuori = ctx.createGain(), umido = ctx.createGain();
  const ritardo = ctx.createDelay(2), ritorno = ctx.createGain(), scuro = ctx.createBiquadFilter();
  ritardo.delayTime.value = 0.42; ritorno.gain.value = 0.42;
  scuro.type = 'lowpass'; scuro.frequency.value = 1700;
  dentro.connect(ritardo); ritardo.connect(scuro); scuro.connect(ritorno); ritorno.connect(ritardo);
  scuro.connect(umido); umido.connect(fuori); umido.gain.value = 0.4;
  const r = [dentro, fuori]; r.umido = umido;
  return r;   // three collega dentro → fuori: è il suono asciutto; le ripetizioni ci si sommano
}
// sfx/passi.mp3 è un nastro a caselle da 1,2 s: 5 passi sul sottobosco, 5 di corsa, 5 sul sentiero,
// 5 di corsa, i due atterraggi del salto, i due grugniti del cinghiale, 5 passi nell'acqua, 3 di corsa,
// l'atterraggio nell'acqua e 3 zoccoli (Oculus Audio Pack, CC BY 4.0, e il Nature Sounds Pack di Leo).
// sfx/colpi.mp3: 12 colpi di roncola e 12 pugni sull'albero, caselle da 1,7 s (registrati da Leo)
const NASTRO = ['s1', 's2', 's3', 's4', 's5', 'sc1', 'sc2', 'sc3', 'sc4', 'sc5', 't1', 't2', 't3', 't4', 't5', 'tc1', 'tc2', 'tc3', 'tc4', 'tc5', 'giuS', 'giuT', 'cing1', 'cing2',
  'a1', 'a2', 'a3', 'a4', 'a5', 'ac1', 'ac2', 'ac3', 'giuA', 'zoc1', 'zoc2', 'zoc3'];
function taglia(b, nomi, casella, lung) {
  if (!b) return;
  const ctx = ascolto.context, R = b.sampleRate, d = b.getChannelData(0), len = Math.round(lung * R);
  nomi.forEach((n, k) => {
    const da = Math.round((k * casella + 0.01) * R), o = ctx.createBuffer(1, len, R);
    o.getChannelData(0).set(d.subarray(da, Math.min(d.length, da + len)));
    buf[n] = o;
  });
}
function tagliaPassi() {
  taglia(buf.passi, NASTRO.map(n => n), 1.2, 1.16);
  taglia(buf.colpi, Array.from({ length: 24 }, (_, k) => (k < 12 ? 'ron' : 'pug') + (k % 12)), 1.7, 1.66);
}
// dove metti i piedi: sentiero, acqua (guadi il fosso) o sottobosco
function suolo() { return sulPonte(io.x, io.z) !== null ? 'sentiero' : distFosso(io.x, io.z) < 1.1 ? 'acqua' : suSentiero(io.x, io.z) ? 'sentiero' : 'sottobosco'; }
let ultimoPasso = 0;
function suonoPasso(corre) {
  const s = suolo(), max = s === 'acqua' && corre ? 3 : 5;
  let n; do { n = 1 + (Math.random() * max | 0); } while (n === ultimoPasso && max > 1);
  ultimoPasso = n;
  const nome = s === 'acqua' ? 'a' + (corre ? 'c' : '') + n : (s === 'sentiero' ? 't' : 's') + (corre ? 'c' : '') + n;
  const canale = s === 'acqua' ? 'passiAcqua' : s === 'sentiero' ? 'passiSentiero' : 'passiSottobosco';
  suono(nome, (corre ? 0.5 : 0.4) * (io.giu ? 0.45 : 1) * (io.tDrummini > 0 ? 0.35 : 1), 0.94 + Math.random() * 0.12, canale);
}
// la voce di Guerrino: un colpetto d'onda quadra a ogni lettera, come nei giochi vecchi
let blipBuf = null;
function blip() {
  const ctx = ascolto.context;
  if (!blipBuf) {
    const n = ctx.sampleRate * 0.05 | 0; blipBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = blipBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = ((i / ctx.sampleRate * 132) % 1 < 0.5 ? 1 : -1) * Math.min(1, i / 30) * Math.pow(1 - i / n, 1.6);
  }
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = blipBuf; s.playbackRate.value = 0.86 + Math.random() * 0.3; g.gain.value = 0.085 * mixG('voce');
  s.connect(g); g.connect(ascolto.getInput()); s.start();
}

/* ════════ COLONNA SONORA (i dieci pezzi di Leo) ════════
   Sono lunghi tutti uguale (un giro = 85,24 s) e girano insieme, a tempo, dal primo all'ultimo: il gioco
   alza e abbassa ciascuno secondo quello che succede.
     foglio1..5      entrano uno alla volta e restano: al 2°, 4°, 6°, 8° e 10° foglio
     prossimita      sale da 30 m da Papi, al massimo a 2 m
     papi-in-vista   finché Papi è nell'inquadratura
     fiato           mentre recuperi il fiato
     torcia          finché la torcia è accesa
     distanza        sale man mano che ti allontani da Capricchia
   Nei file il giro ha 0,25 s di coda prima e 0,25 s di testa dopo: una finestra lunga un giro si chiude
   senza scatto ovunque cada, anche col ritardo che aggiunge l'mp3. */
const MUS = {
  giro: GIRO, da: INIZIO_GIRO, t0: 0, bus: null, tic: 0, pezzi: {},
  // frequenza del file, secondi di salita e di discesa. Il volume di base è in mix.js (PEZZI): i tre pezzi
  // più bassi nel mix di Leo (papi-in-vista, torcia, distanza) sono alzati, se no non si sentono
  elenco: {
    foglio1: [24000, 1.4, 1.4], foglio2: [24000, 1.4, 1.4], foglio3: [24000, 1.4, 1.4], foglio4: [24000, 1.4, 1.4], foglio5: [24000, 1.4, 1.4],
    prossimita: [24000, 0.35, 0.6], 'papi-in-vista': [44100, 0.15, 0.5], fiato: [24000, 0.12, 0.12], torcia: [44100, 0.06, 0.12], distanza: [24000, 1, 1],
  },
};
function caricaPezzo(nome) {
  if (MUS.pezzi[nome] || !MUS.bus) return;
  const ctx = ascolto.context, [hz] = MUS.elenco[nome];
  const pz = MUS.pezzi[nome] = { g: ctx.createGain(), ob: 0, pronto: false };
  pz.g.gain.value = 0; pz.g.connect(MUS.bus);
  fetch('musica/' + nome + '.mp3').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(dati => {
    // decodifico alla frequenza del file e non a quella della scheda audio: metà della memoria
    let dec = ctx;
    try { dec = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, hz); } catch (e) {}
    return new Promise((ok, ko) => { const pr = dec.decodeAudioData(dati, ok, ko); if (pr && pr.catch) pr.catch(ko); });
  }).then(b => {
    const s = ctx.createBufferSource(), da = Math.max(0, Math.min(MUS.da, b.duration - MUS.giro - 0.01));
    s.buffer = b; s.loop = true; s.loopStart = da; s.loopEnd = Math.min(b.duration, da + MUS.giro);
    s.connect(pz.g);
    const quando = ctx.currentTime + 0.06;
    if (!MUS.t0) MUS.t0 = quando;
    s.start(quando, da + ((quando - MUS.t0) % MUS.giro));   // entra a tempo con quelli che già girano
    pz.pronto = true; pz.ob = -1;
  }).catch(e => { console.warn('colonna sonora: ' + nome + ' non caricato', e); });
}
function avviaMusica() {
  if (MUS.bus) return;
  MUS.bus = ascolto.context.createGain(); MUS.bus.gain.value = mixG('musica') * IMPOSTA.musica; MUS.bus.connect(ascolto.getInput());
  for (const n of ['torcia', 'distanza', 'fiato']) caricaPezzo(n);
}
function aggiornaMusica(dt) {
  if (!MUS.bus || (MUS.tic -= dt) > 0) return;
  MUS.tic = 0.1;
  const ob = {}, lim = v => Math.max(0, Math.min(1, v));
  for (let k = 1; k <= 5; k++) {
    if (io.fogli >= 2 * k - 1) caricaPezzo('foglio' + k);   // lo scarico un foglio prima che serva
    ob['foglio' + k] = io.fogli >= 2 * k ? 1 : 0;
  }
  if (storia === 'solo' || storia === 'caccia') { caricaPezzo('prossimita'); caricaPezzo('papi-in-vista'); }
  const ce = papi.stato !== 'assente' && papi.g.visible && fase !== 'vinto';
  ob.prossimita = ce ? lim((30 - Math.hypot(io.x - papi.x, io.z - papi.z)) / 28) * papi.pres : 0;
  ob['papi-in-vista'] = ce && papi.vis > 0 ? 1 : 0;
  ob.fiato = lim((1 - io.fiato) * 1.3);   // il battito: sale mentre consumi il fiato, scende mentre lo recuperi
  ob.torcia = io.torcia ? 1 : 0;
  ob.distanza = lim((380 - Math.hypot(io.x - CASA.x, io.z - CASA.z)) / 330);   // più ti avvicini alla casa di Papi, più sale (pieno a 50 m)
  const ora = ascolto.context.currentTime;
  for (const n in MUS.pezzi) {
    const pz = MUS.pezzi[n], v = ob[n] || 0;
    if (!pz.pronto || Math.abs(v - pz.ob) < 0.004) continue;
    const e = MUS.elenco[n];
    pz.g.gain.setTargetAtTime(v * PEZZI[n] * mixG('mus-' + n), ora, (v > pz.ob ? e[1] : e[2]) / 3);
    pz.ob = v;
  }
}
// nella lobby suona già la notte: parte al primo clic o tasto (prima il browser non lascia partire l'audio)
function ambienteLobby() {
  if (!ambiente) return false;
  ascolto.context.resume?.();
  if (!ambiente.isPlaying) { sfumaDentro(); ambiente.play(); }
  return true;
}
// quando l'audio parte, il volume generale sale da zero in mezzo secondo: niente scatto nelle casse
function sfumaDentro() {
  const g = ascolto.gain.gain, t = ascolto.context.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(mixG('generale') * IMPOSTA.volume, t + 0.6);
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, function primo() {
  if (fase !== 'menu' && !document.body.classList.contains('lobby')) return;
  if (ambienteLobby()) for (const e of ['pointerdown', 'keydown', 'touchstart']) removeEventListener(e, primo, true);
}, true);
function avviaLoop() {
  for (const a of [ambiente, fosso, rumore]) if (a && !a.isPlaying) a.play();
}

/* ════════ GIOCATORE ════════ */
const io = {
  x: -75, z: 192, yaw: -Math.PI / 2, pitch: -0.05, fiato: 1, sfinito: false, batteria: 1, torcia: false,   // si parte a torcia spenta
  passi: 0, dondolo: 0, fogli: 0, statuette: 0, scambiati: 0, check: { x: -75, z: 192 }, morti: 0, tempo: 0, vel: 0, alto: 0, vy: 0, botta: 0, recupera: false, giu: false, hGiu: 0, fiatoneFatto: false,
};
const tasti = {};
const joy = { x: 0, y: 0, attivo: false, id: null, ox: 0, oy: 0 };
let corriTouch = false;
let fase = 'menu';          // menu | gioco | pausa | morto | vinto
let storia = 'intro';       // intro | strada | fonte | solo | caccia | fine
let tStoria = 0, attesa = 0, livello = 0, staticoV = 0, tCaccia = 0;

function avanti() { return new THREE.Vector3(-Math.sin(io.yaw), 0, -Math.cos(io.yaw)); }

addEventListener('keydown', e => {
  tasti[e.code] = true;
  if (fase !== 'gioco') return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) salta(); }
  if (e.code === 'KeyF') cambiaTorcia();
  if (e.code === 'KeyE') provaPrendere();
  if (e.code === 'KeyM') apriTelefono();
  if (e.code === 'KeyG') piantaStatuetta();
  if (e.code === 'KeyZ' && tel.aperto) zoomTelefono();
  if ((e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) accovacciati();
});
addEventListener('keyup', e => { tasti[e.code] = false; });
function cambiaTorcia() {
  if (io.torcia) { io.torcia = false; suono('colpo', 0.08, 2.6, 'interfaccia'); return; }   // spegnere: subito
  if (io.batteria <= 0 || TEL3D.gesto >= 0 || fase !== 'gioco') return;
  TEL3D.gesto = 0; TEL3D.scossi = 0;   // accendere: alzi il telefono a schermo spento e lo scuoti tre volte
  if (!tel.aperto) schermoNero();
}
function accovacciati(si = !io.giu) { if (fase === 'gioco') { io.giu = si; $('t-giu')?.classList.toggle('premuto', si); } }
function salta() {
  if (fase !== 'gioco' || io.alto > 0 || io.sfinito) return;
  if (io.giu) { accovacciati(false); return; }   // da accovacciato: ti rialzi
  io.vy = 3.4; io.alto = 0.001; io.fiato = Math.max(0, io.fiato - 0.04);   // mezzo metro, e costa un po' di fiato
}

canvas.addEventListener('click', () => {
  if (fase !== 'gioco' || TOCCO) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  else provaPrendere();
});
document.addEventListener('pointerlockchange', () => {
  if (!TOCCO && document.pointerLockElement !== canvas && fase === 'gioco') pausa(true);
});
addEventListener('mousemove', e => {
  if (fase !== 'gioco' || document.pointerLockElement !== canvas) return;
  const k = 0.0022 * IMPOSTA.sens;
  io.yaw -= e.movementX * k; io.pitch -= e.movementY * k * (IMPOSTA.invertiY ? -1 : 1);
  io.pitch = Math.max(-1.3, Math.min(1.3, io.pitch));
});

// touch: metà sinistra joystick, metà destra guardare
const sguardo = { id: null, x: 0, y: 0 };
addEventListener('touchstart', e => {
  if (fase !== 'gioco') return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('button')) continue;
    if (tel.aperto && toccaSchermo(t.clientX, t.clientY)) { zoomTelefono(); continue; }   // lo zoom: un tocco sullo schermo del telefono
    if (t.clientX < innerWidth * 0.45 && joy.id === null) {
      joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0;
      const j = $('joy'); j.style.left = t.clientX + 'px'; j.style.top = t.clientY + 'px'; j.classList.add('on');
    } else if (sguardo.id === null) { sguardo.id = t.identifier; sguardo.x = t.clientX; sguardo.y = t.clientY; }
  }
}, { passive: true });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), M = 50;
      if (l > M) { dx *= M / l; dy *= M / l; }
      joy.x = dx / M; joy.y = dy / M;
      $('joy-pomello').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (t.identifier === sguardo.id) {
      io.yaw -= (t.clientX - sguardo.x) * 0.0055 * IMPOSTA.sens; io.pitch -= (t.clientY - sguardo.y) * 0.0045 * IMPOSTA.sens * (IMPOSTA.invertiY ? -1 : 1);
      io.pitch = Math.max(-1.2, Math.min(1.2, io.pitch));
      sguardo.x = t.clientX; sguardo.y = t.clientY;
    }
  }
}, { passive: true });
function fineTocco(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').classList.remove('on'); $('joy-pomello').style.transform = ''; }
    if (t.identifier === sguardo.id) sguardo.id = null;
  }
}
addEventListener('touchend', fineTocco); addEventListener('touchcancel', fineTocco);
const bCorri = $('t-corri');
bCorri.addEventListener('touchstart', e => { e.preventDefault(); corriTouch = !corriTouch; bCorri.classList.toggle('premuto', corriTouch); });
$('t-torcia').addEventListener('touchstart', e => { e.preventDefault(); cambiaTorcia(); });
$('t-prendi').addEventListener('touchstart', e => { e.preventDefault(); provaPrendere(); });
$('t-salta').addEventListener('touchstart', e => { e.preventDefault(); salta(); });
$('t-giu').addEventListener('touchstart', e => { e.preventDefault(); accovacciati(); });
$('t-statua').addEventListener('touchstart', e => { e.preventDefault(); piantaStatuetta(); });

function muoviGiocatore(dt) {
  let ax = 0, az = 0;
  if (tasti.KeyW || tasti.ArrowUp) az -= 1;
  if (tasti.KeyS || tasti.ArrowDown) az += 1;
  if (tasti.KeyA || tasti.ArrowLeft) ax -= 1;
  if (tasti.KeyD || tasti.ArrowRight) ax += 1;
  if (joy.id !== null) { ax += joy.x; az += joy.y; }
  ax += pad.x; az += pad.y;
  let l = Math.hypot(ax, az); if (l > 1) { ax /= l; az /= l; l = 1; }
  const vuoleCorrere = (tasti.ShiftLeft || tasti.ShiftRight || corriTouch || pad.corri) && l > 0.3 && az < 0.2;
  if (vuoleCorrere && io.giu) accovacciati(false);
  const corre = vuoleCorrere && !io.sfinito && io.fiato > 0;
  if (corre) { io.fiato -= dt / 9 * (io.tCorndog > 0 ? 0.5 : 1); if (io.fiato <= 0) { io.fiato = 0; io.sfinito = true; } }
  else { io.fiato = Math.min(1, io.fiato + dt / (io.sfinito ? 14 : 10)); if (io.sfinito && io.fiato > 0.35) io.sfinito = false; }
  // senza fiato: un fiatone solo, non in loop
  if (io.fiato < 0.3 && !io.fiatoneFatto) { io.fiatoneFatto = true; suono('fiatone', 0.25, 0.95 + Math.random() * 0.1, 'fiatone'); }
  if (io.fiato > 0.7) io.fiatoneFatto = false;
  io.recupera = !corre && io.fiato < 1;
  const acqua = distFosso(io.x, io.z) < 1.1 && sulPonte(io.x, io.z) === null;
  const vmax = (corre ? 5.1 : io.giu ? 1.15 : 2.3) * (acqua ? 0.7 : 1);
  const s = Math.sin(io.yaw), c = Math.cos(io.yaw);
  let dx = (ax * c + az * s) * vmax * dt, dz = (-ax * s + az * c) * vmax * dt;
  // pendenza: in salita ripida si rallenta, oltre i 40° non si sale
  const q0 = suoloIo(io.x, io.z), q1 = suoloIo(io.x + dx, io.z + dz), passo = Math.hypot(dx, dz);
  if (passo > 0) {
    const pend = (q1 - q0) / passo;
    if (pend > 1.4) { dx = 0; dz = 0; } else if (pend > 0.85) { dx *= 0.15; dz *= 0.15; } else if (pend > 0.3) { const k = 1 - (pend - 0.3) * 0.9; dx *= k; dz *= k; }
  }
  const p = { x: io.x + dx, z: io.z + dz };
  // coi piedi nel fosso la corrente ti trascina verso valle
  if (acqua && !io.alto) { const c = corrente(io.x, io.z); if (c) { p.x += c[0] * 1.0 * dt; p.z += c[1] * 1.0 * dt; } }
  // tronchi
  tronchiVicini(p.x, p.z, 2, t => {
    const ddx = p.x - t.x, ddz = p.z - t.z, d = Math.hypot(ddx, ddz), m = t.r + 0.32;
    if (d < m && d > 0.0001) { p.x = t.x + ddx / d * m; p.z = t.z + ddz / d * m; }
  });
  spingiFuoriCase(p, 0.35);
  // Guerrino è ciccia e ossa: non gli passi attraverso
  if (guerrino.mixer) {
    const gx = p.x - guerrino.x, gz = p.z - guerrino.z, gd = Math.hypot(gx, gz), gm = 0.62;
    if (gd < gm && gd > 1e-4) { p.x = guerrino.x + gx / gd * gm; p.z = guerrino.z + gz / gd * gm; }
  }
  p.x = Math.max(-LIMITE, Math.min(LIMITE, p.x)); p.z = Math.max(-LIMITE, Math.min(LIMITE, p.z));
  // giù dal ciglio: sulla parete del Greppo non si sta in piedi
  if (!io.alto && sulPonte(p.x, p.z) === null && pendenza(p.x, p.z) > 1.4 && suoloIo(p.x, p.z) < suoloIo(io.x, io.z) - 0.02) { io.x = p.x; io.z = p.z; cadi(); return; }
  const fatto = Math.hypot(p.x - io.x, p.z - io.z);
  io.vel = fatto / Math.max(dt, 1e-4);
  io.x = p.x; io.z = p.z;
  // il salto
  if (io.alto > 0) {
    io.vy -= 11 * dt; io.alto += io.vy * dt;
    if (io.alto <= 0) { io.alto = 0; io.vy = 0; io.botta = 1; io.passi = 0; const s = suolo(); suono(s === 'acqua' ? 'giuA' : s === 'sentiero' ? 'giuT' : 'giuS', 0.55, 0.95 + Math.random() * 0.1, s === 'acqua' ? 'passiAcqua' : 'salto'); }
  } else io.passi += fatto;
  io.botta = Math.max(0, io.botta - dt * 5);
  const lungo = corre ? 1.25 : io.giu ? 0.6 : 0.8;
  if (io.passi > lungo) { io.passi = 0; suonoPasso(corre); }
  if (!io.alto) io.dondolo += fatto * (corre ? 5.2 : 6.5);
  const bob = Math.sin(io.dondolo) * (corre ? 0.07 : 0.035) * Math.min(1, io.vel);
  io.hGiu += ((io.giu ? 1 : 0) - io.hGiu) * Math.min(1, dt * 8);
  camera.position.set(io.x, suoloIo(io.x, io.z) + 1.65 - io.hGiu * 0.7 + bob + io.alto - Math.sin(io.botta * Math.PI) * 0.09 - (acqua ? 0.12 : 0), io.z);
  camera.rotation.set(io.pitch, io.yaw, Math.sin(io.dondolo * 0.5) * 0.006 * io.vel, 'YXZ');
}

function aggiornaTorcia(dt, t) {
  const carica = vicinoStatua();   // vicino a una statuetta il telefono non si scarica
  if (io.torcia && !carica) io.batteria = Math.max(0, io.batteria - dt / (VELOCE ? 300 : 900));
  if (tel.aperto && !carica) io.batteria = Math.max(0, io.batteria - dt / (VELOCE ? 600 : 2400));   // anche lo schermo acceso
  if (io.batteria <= 0 && (io.torcia || !io.morto)) { io.torcia = false; if (!io.morto) { io.morto = true; didascalia('Il telefono è morto. Niente torcia, niente GPS.', 5000); } }
  if (io.batteria > 0) io.morto = false;
  let k = io.torcia ? 0.35 + 0.65 * Math.min(1, io.batteria * 3) : 0;
  if (io.torcia && io.batteria < 0.15 && Math.sin(t * 23) * Math.sin(t * 7.3) > 0.55) k *= 0.15;   // tremolio a batteria scarica
  torcia.intensity = TORCIA_MAX * k; alone.intensity = 1.2 * k + 0.1;
  ui.fiato.style.width = (io.fiato * 100) + '%';
  ui.fiato.classList.toggle('basso', io.sfinito);
}

/* ── fogli ── */
let foglioVicino = null;
function cercaFoglio() {
  foglioVicino = null;
  const av = avanti();
  for (const f of FOGLI) {
    if (f.preso) continue;
    const dx = f.x - io.x, dz = f.z - io.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && (dx * av.x + dz * av.z) / d > 0.55) { foglioVicino = f; break; }
  }
  powerVicino = null;
  if (!foglioVicino) for (const pu of POWER) {
    if (pu.preso) continue;
    const dx = pu.x - io.x, dz = pu.z - io.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && (dx * av.x + dz * av.z) / d > 0.3) { powerVicino = pu; break; }
  }
  const cosa = foglioVicino ? 'il foglio' : powerVicino ? POWER_NOMI[powerVicino.tipo] : null;
  if (cosa && ui.prendi.dataset.cosa !== cosa) { ui.prendi.dataset.cosa = cosa; ui.prendi.innerHTML = `Prendi ${cosa} <kbd>${tasto('prendi')}</kbd>`; }
  mostra('prendi', !!cosa && INGRESSO !== 'tocco');
  const colpire = io.roncola && !cosa;
  mostra('t-prendi', (!!cosa || colpire) && TOCCO);
  $('t-prendi').textContent = colpire ? 'COLPISCI' : 'PRENDI';
}
let powerVicino = null;
function provaPrendere() {
  if (!foglioVicino) {
    if (powerVicino) { prendiPowerUp(powerVicino); powerVicino = null; }
    else if (io.roncola) colpisci();
    return;
  }
  const f = foglioVicino; f.preso = true; f.m.visible = false; foglioVicino = null;
  io.fogli++;
  suono('foglio', 0.9, 1, 'foglio');
  ui.fogli.innerHTML = `Fogli <b>${io.fogli}</b>/10`;
  ui.foglioGrande.classList.remove('nascosto');
  const carta = ui.foglioGrande.firstElementChild; carta.style.animation = 'none'; void carta.offsetWidth; carta.style.animation = '';
  setTimeout(() => ui.foglioGrande.classList.add('nascosto'), 1700);
  if (storia === 'solo') attesa -= 30;    // ogni foglio preso lo fa tornare prima
  if (storia === 'caccia' && Math.random() < 0.5) setTimeout(() => dici(pesca(BATTUTE.caccia), 3200), 900);
  if (io.fogli >= 10) { io.tuttiFogli = true; didascalia(BATTUTE.dieci[0], 6000); }
}

/* ── dialoghi ── */
const coda = []; let parlando = null, tParla = 0, tScrivi = 0, tBlip = 0;
// Guerrino da lontano non lo senti, tranne quando urla dell'altra bestia
const UDITO = 22;
// forte = si sente da lontano (le urla dell'altra bestia, il "vabbè" quando te ne vai)
function dici(testo, durata, forte) { coda.push({ testo, durata: durata || 2600 + testo.length * 45, urla: forte || /altra bestia/i.test(testo) }); }
let dialogoSu = false;
function aggiornaDialogo(dt) {
  while (!parlando && coda.length && !coda[0].urla && storia !== 'casa' && Math.hypot(io.x - guerrino.x, io.z - guerrino.z) > UDITO) coda.shift();
  if (!parlando && coda.length) { parlando = coda.shift(); tParla = 0; tScrivi = 0; tBlip = -2; ui.battuta.textContent = ''; mostra('dialogo', true); dialogoSu = true; }
  if (!parlando) { if (dialogoSu) { dialogoSu = false; mostra('dialogo', false); } return; }
  tParla += dt * 1000;
  const n = Math.min(parlando.testo.length, Math.floor(tParla / 28));
  if (n !== tScrivi) {
    tScrivi = n; ui.battuta.textContent = parlando.testo.slice(0, n);
    if (n - tBlip >= 2 && /[a-zàèéìòù]/i.test(parlando.testo[n - 1] || '')) { tBlip = n; blip(); }
  }
  if (tParla > parlando.durata) parlando = null;
}
let tDid = null;
function didascalia(testo, ms = 4500) {
  ui.didascalia.textContent = testo; mostra('didascalia', true); ui.didascalia.style.opacity = 1;
  clearTimeout(tDid); tDid = setTimeout(() => { ui.didascalia.style.opacity = 0; setTimeout(() => mostra('didascalia', false), 800); }, ms);
}
function pesca(l) { return l[Math.random() * l.length | 0]; }

/* ── percorso di Guerrino: dalla fine del paese, su per la carrareccia, fino alla Fonticella Petri ── */
const PERCORSO = [[-64, 190], [-58.5, 188.5], [-54, 183.5], [-37.5, 177], [-25, 168.5], [-17, 162.5], daFonte(0.9, 2.2)];
const SEDILE = daFonte(0.55, 0.7);   // il bordo davanti della vasca, dove Guerrino si siede
const SEDUTA = VELOCE ? 6 : 30;      // secondi seduto prima di menare
const TAPPE_FRASI = { 1: 0, 3: 1, 4: 2, 5: 3 };
const MOSSE = ['pugno', 'jab', 'calcio', 'combo', 'jab', 'calcioAlto', 'pugno', 'calcio2', 'affondo'];
// quando arriva il colpo, in frazione dell'animazione
const COLPI = { pugno: [0.32], jab: [0.3], calcio: [0.38], combo: [0.2, 0.42, 0.62], calcioAlto: [0.4], calcio2: [0.42], affondo: [0.45] };

function posa(p, x, z, rot) {
  p.x = x; p.z = z; p.rot = rot;
  p.g.position.set(x, quota(x, z), z);
  p.g.rotation.set(0, rot, 0);
}
function posaGuerrino(x, z, rot) { posa(guerrino, x, z, rot); }
function disegna(p) { p.g.position.set(p.x, quota(p.x, p.z), p.z); p.g.rotation.set(0, p.rot, 0); }
function guardaVerso(x, z, p = guerrino) { return Math.atan2(x - p.x, z - p.z); }
function giraVerso(target, dt, vel = 4, p = guerrino) {
  let d = target - p.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  p.rot += d * Math.min(1, dt * vel);
}

// preciso = quanto vicino all'ultimo punto deve arrivare (le tappe in mezzo le sfiora e basta)
function camminaSu(lista, dt, vel, preciso = 0.6) {
  if (guerrino.tappa >= lista.length) return true;   // già arrivato
  const [tx, tz] = lista[guerrino.tappa];
  const dx = tx - guerrino.x, dz = tz - guerrino.z, d = Math.hypot(dx, dz);
  if (d < (guerrino.tappa === lista.length - 1 ? preciso : 0.6)) { guerrino.tappa++; return guerrino.tappa >= lista.length; }
  const s = Math.min(d, vel * dt);
  guerrino.x += dx / d * s; guerrino.z += dz / d * s; guerrino.vel = vel;
  giraVerso(Math.atan2(dx, dz), dt, 5);
  return false;
}

// l'albero che Guerrino si mette a menare: il più vicino alla Fonticella
function alberoDiGuerrino() {
  let best = null, bd = Infinity;
  tronchiVicini(FONTE.x, FONTE.z, 14, tr => {
    if (!tr.mesh) return;
    const d = Math.hypot(tr.x - FONTE.x, tr.z - FONTE.z);
    if (d > 2.5 && d < bd) { bd = d; best = tr; }
  });
  return best;
}

// colpisce con la mano destra (quella della roncola)? La guardo nel momento del colpo
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function conLaRoncola(tr) {
  const m = guerrino.corpo; if (!tr || !m) return false;
  const dx = m.getObjectByName('RightHand'), sx = m.getObjectByName('LeftHand'), pd = m.getObjectByName('RightFoot'), ps = m.getObjectByName('LeftFoot');
  if (!dx) return false;
  m.updateMatrixWorld(true);
  const d = o => o ? Math.hypot(o.getWorldPosition(_a).x - tr.x, _a.z - tr.z) : Infinity;
  return d(dx) < Math.min(d(sx), d(pd), d(ps));
}
// i colpi da lontano: −10 dB ogni 100 metri, senza scalini (Leo, 16/11)
const colpiLontano = d => Math.pow(10, -10 * d / 100 / 20);
// Guerrino mena l'albero, per sempre: una mossa dopo l'altra, col botto a tempo
function aggiornaMena(dt, t) {
  const tr = guerrino.albero;
  if (guerrino.riposo) { riposoGuerrino(dt, t); return; }
  guerrino.tMena = (guerrino.tMena || 0) + dt;
  if (guerrino.tMena > 60 && guerrino.corrente && (finita(guerrino) || guerrino.colpiFatti >= (COLPI[guerrino.nomeAz] || []).length)) {
    guerrino.riposo = 1; guerrino.tappa = 0; guerrino.posto = [guerrino.x, guerrino.z];
    guerrino.giro = [daFonte(-1.7, 1.1), SEDILE];
    recita(guerrino, 'cammina', false, 0.4);
    return;
  }
  if (!guerrino.corrente || finita(guerrino) || guerrino.nomeAz === 'cammina') {
    guerrino.mossa = (guerrino.mossa + 1) % MOSSE.length;
    const nome = MOSSE[guerrino.mossa];
    recita(guerrino, nome, true, 0.2);
    guerrino.colpiFatti = 0;
  }
  const a = guerrino.corrente, nome = guerrino.nomeAz, fr = a.time / a.getClip().duration, lista = COLPI[nome] || [];
  while (guerrino.colpiFatti < lista.length && fr >= lista[guerrino.colpiFatti]) {
    guerrino.colpiFatti++;
    scuoti(tr, 0.6);
    if (pugnoAudio && buf.ron0) {
      // round robin: mai lo stesso colpo due volte di fila
      const tipo = !io.roncola && conLaRoncola(tr) ? 'ron' : 'pug';   // la roncola, dopo, ce l'hai tu
      if (pugnoUmido) { const dG = Math.hypot(io.x - guerrino.x, io.z - guerrino.z); pugnoUmido.gain.value = Math.min(0.75, 0.2 + dG / 120); }   // da lontano l'eco pesa di più
      let k; do { k = Math.random() * 12 | 0; } while (k === guerrino.ultimoColpo);
      guerrino.ultimoColpo = k;
      pugnoAudio.setBuffer(buf[tipo + k]);
      pugnoAudio.setPlaybackRate(0.96 + Math.random() * 0.08); pugnoAudio.setVolume(0.9 * mixG('colpi') * colpiLontano(Math.hypot(io.x - guerrino.x, io.z - guerrino.z)));
      if (pugnoAudio.isPlaying) pugnoAudio.stop();
      pugnoAudio.play();
    }
  }
  if (tr) { giraVerso(Math.atan2(tr.x - guerrino.x, tr.z - guerrino.z), dt, 3); disegna(guerrino); }
  // se gli passi vicino, ti dice qualcosa
  const d = Math.hypot(io.x - guerrino.x, io.z - guerrino.z);
  if (d < 7 && t > guerrino.prossimo && storia !== 'caccia') { guerrino.prossimo = t + 14; dici(pesca(BATTUTE.mena), 2600); }
}

// la pausa: va alla vasca, si siede trenta secondi, torna all'albero
function riposoGuerrino(dt, t) {
  const r = guerrino.riposo;
  if (r === 1) { if (camminaSu(guerrino.giro, dt, 0.9, 0.08)) guerrino.riposo = 2; }
  else if (r === 2) {
    giraVerso(FONTE.rot, dt, 5);
    if (Math.abs(Math.sin((FONTE.rot - guerrino.rot) / 2)) < 0.04) {
      guerrino.riposo = 3; guerrino.tRiposo = 0;
      guerrino.x = SEDILE[0]; guerrino.z = SEDILE[1]; guerrino.rot = FONTE.rot;
      recita(guerrino, 'stanco', false, 0.5);
      if (storia !== 'caccia') dici(pesca(BATTUTE.pausa), 2600);
    }
  } else if (r === 3) {
    if ((guerrino.tRiposo += dt) > (VELOCE ? 8 : 30)) {
      guerrino.riposo = 4; guerrino.tappa = 0; guerrino.giro = [daFonte(-1.7, 1.1), guerrino.posto];
      recita(guerrino, 'cammina', false, 0.5);
    }
  } else if (camminaSu(guerrino.giro, dt, 0.9, 0.08)) {
    guerrino.riposo = 0; guerrino.tMena = 0; guerrino.mossa = -1; guerrino.prossimo = t + 10;
  }
  disegna(guerrino);
  if (guerrino.riposo === 3) guerrino.g.position.y = quota(FONTE.x, FONTE.z);   // seduto sulla vasca
}

function aggiornaStoria(dt, t) {
  tStoria += dt;
  guerrino.vel = 0;
  if (guerrino.mena) aggiornaMena(dt, t);
  const dGioc = Math.hypot(io.x - guerrino.x, io.z - guerrino.z);
  if ((storia === 'solo' || storia === 'caccia') && dGioc < 4 && io.fogli > io.scambiati) scambiaConGuerrino();
  // te ne vai mentre ti spiega le cose (oltre 50 m): "vabbè, fa' come te pare", e va a menare l'albero in silenzio
  if (!guerrino.zitto && dGioc > 50 && (storia === 'intro' || storia === 'strada' || (storia === 'fonte' && guerrino.fase < 5))) {
    guerrino.zitto = true; coda.length = 0; parlando = null;
    dici("Vabbè, fa' come te pare.", 2800, true);
    if (storia === 'intro') { storia = 'strada'; tStoria = 0; guerrino.tappa = 0; }
    else if (storia === 'fonte') { guerrino.fase = 5; recita(guerrino, 'cammina', false, 0.5); }
  }
  if (storia === 'intro') {
    giraVerso(guardaVerso(io.x, io.z), dt, 3);
    disegna(guerrino);
    if (tStoria > 0.8 && !guerrino.detto) { guerrino.detto = true; BATTUTE.intro.forEach(b => dici(b)); }
    if (guerrino.detto && !coda.length && !parlando) { storia = 'strada'; tStoria = 0; guerrino.tappa = 0; }
    return;
  }
  if (storia === 'strada') {
    // non ti aspetta: va alla Fonticella per conto suo
    const prima = guerrino.tappa;
    const arrivato = camminaSu(PERCORSO, dt, 1.25);
    if (guerrino.tappa !== prima && !guerrino.zitto && TAPPE_FRASI[guerrino.tappa] !== undefined) dici(BATTUTE.strada[TAPPE_FRASI[guerrino.tappa]]);
    if (arrivato) { storia = 'fonte'; tStoria = 0; guerrino.fase = guerrino.zitto ? 5 : 0; }
    disegna(guerrino);
    return;
  }
  if (storia === 'fonte') {
    // arriva e ha il fiatone; si siede sulla Fonticella per mezzo minuto; poi se la prende con l'albero
    if (guerrino.fase === 0) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3); disegna(guerrino);
      if (tStoria > 0.6) { guerrino.fase = 1; BATTUTE.fonte.forEach(b => dici(b)); }
    } else if (guerrino.fase === 1) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3); disegna(guerrino);
      if (!coda.length && !parlando) { guerrino.fase = 2; guerrino.tappa = 0; }
    } else if (guerrino.fase === 2) {
      // va al bordo della vasca
      if (camminaSu([SEDILE], dt, 0.9, 0.08)) guerrino.fase = 3;
      disegna(guerrino);
    } else if (guerrino.fase === 3) {
      // si gira con la schiena alla fonte e si siede
      giraVerso(FONTE.rot, dt, 5); disegna(guerrino);
      if (Math.abs(Math.sin((FONTE.rot - guerrino.rot) / 2)) < 0.04) {
        guerrino.fase = 4; tStoria = 0;
        guerrino.x = SEDILE[0]; guerrino.z = SEDILE[1]; guerrino.rot = FONTE.rot;
        recita(guerrino, 'stanco', false, 0.5);
        BATTUTE.seduto.forEach(b => dici(b));
      }
    } else if (guerrino.fase === 4) {
      disegna(guerrino);
      guerrino.g.position.y = quota(FONTE.x, FONTE.z);   // seduto sulla vasca, non sul pendio
      if (tStoria > SEDUTA) { guerrino.fase = 5; recita(guerrino, 'cammina', false, 0.5); BATTUTE.sfogo.forEach(b => dici(b)); }
    } else if (guerrino.fase === 5) {
      // si alza e, mentre dice le sue, s'avvia già verso l'albero
      disegna(guerrino);
      {
        guerrino.fase = 6;
        const tr = alberoDiGuerrino(); guerrino.albero = tr;
        // gira intorno alla vasca e si pianta a un braccio dal tronco
        const giro = daFonte(-1.7, 1.1);
        if (tr) { const dx = giro[0] - tr.x, dz = giro[1] - tr.z, d = Math.hypot(dx, dz) || 1, r = tr.r + 0.55; guerrino.verso = [giro, [tr.x + dx / d * r, tr.z + dz / d * r]]; }
        else guerrino.verso = [[guerrino.x, guerrino.z]];
        guerrino.tappa = 0;
      }
    } else if (guerrino.fase === 6) {
      if (camminaSu(guerrino.verso, dt, 0.9, 0.08) && !coda.length && !parlando) {
        guerrino.mena = true; guerrino.mossa = -1; guerrino.corrente = guerrino.az.cammina; guerrino.prossimo = t + 10;
        storia = 'solo'; tStoria = 0;
        checkpoint();   // il primo: Guerrino s'è messo a menare
        attesa = VELOCE ? 25 : 240;
        cinghiale.prossimo = t + (VELOCE ? 8 : 50 + Math.random() * 70);
      }
      disegna(guerrino);
    }
    return;
  }
  if (storia === 'solo') {
    attesa -= dt;
    if (attesa <= 0) iniziaCaccia(t);
    return;
  }
  if (storia === 'caccia') aggiornaCaccia(dt, t);
  if (storia === 'casa') aggiornaBoss(dt, t);
  aggiornaFinale(dt, t);
}

/* ── alberi che tremano (i pugni di Guerrino, Papi che passa) ── */
const SCOSSI = [];
function scuoti(tr, forza = 1) {
  if (!tr || !tr.mesh) return;
  const s = SCOSSI.find(x => x.tr === tr);
  if (s) { s.t = 0; s.k = forza; } else SCOSSI.push({ tr, t: 0, k: forza });
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function aggiornaScossi(dt) {
  for (let n = SCOSSI.length - 1; n >= 0; n--) {
    const s = SCOSSI[n], tr = s.tr;
    s.t += dt;
    const k = Math.max(0, 1 - s.t / 1.6) * s.k;
    const f = Math.sin(s.t * 16) * 0.03 * k;
    _e.set(f, tr.rot, f * 0.6); _q.setFromEuler(_e);
    _s.set(tr.s, tr.sy || tr.s, tr.s); _p.set(tr.x, tr.y, tr.z);
    _m4.compose(_p, _q, _s);
    for (const im of tr.mesh) { im.setMatrixAt(tr.i, _m4); im.instanceMatrix.needsUpdate = true; }
    if (k <= 0) SCOSSI.splice(n, 1);
  }
}

/* ════════ LA CACCIA: PAPI ════════
   Nasce dove non lo vedi e ti raggiunge camminando sul serio: strisciando, poi in piedi, poi di corsa,
   e alla fine si lancia. Niente teletrasporti. Lo semini solo scappando lontano. Alla Fonticella Petri
   e vicino alle statuette di Guerrino si arrende: si ferma, sbuffa e se ne va saltando (Leo, 17/11). */
let papiVoce = null, papiPassi = null, pugnoAudio = null, pugnoUmido = null;
const SICURO = 14;   // metri intorno alla Fonticella dove Papi non mette piede
function alSicuro(x = io.x, z = io.z) { return Math.hypot(x - FONTE.x, z - FONTE.z) < SICURO || vicinoStatua(x, z); }
function iniziaCaccia(t) {
  storia = 'caccia'; tCaccia = 0;
  didascalia('Tra gli alberi si muove qualcosa. Qualcosa di molto alto.', 5500);
  setTimeout(() => { if (storia === 'caccia' && fase === 'gioco') dici(BATTUTE.caccia[0], 3000); }, 6000);
  viaPapi(true); papi.stato = 'assente'; papi.prossimo = t + (VELOCE ? 4 : 10);
  versoPapi('frasche', 1, 0.8);
}
function versoPapi(nome, vol = 1, rate = 1) {
  if (!papiVoce || !buf[nome]) return;
  if (papiVoce.isPlaying) papiVoce.stop();
  papiVoce.setBuffer(buf[nome]); papiVoce.setVolume(vol * mixG('papiVersi')); papiVoce.setPlaybackRate(rate); papiVoce.play();
}

const _v = new THREE.Vector3();
// c'è un tronco fra me e quel punto?
function coperto(x, z) {
  const dx = x - io.x, dz = z - io.z, d = Math.hypot(dx, dz);
  let si = false;
  const passi = Math.ceil(d / 3);
  for (let i = 1; i < passi && !si; i++) {
    const px = io.x + dx * i / passi, pz = io.z + dz * i / passi;
    tronchiVicini(px, pz, 1, tr => {
      if (si || tr.basso) return;   // le pietre sono basse: non coprono
      const t2 = ((tr.x - io.x) * dx + (tr.z - io.z) * dz) / (d * d);
      if (t2 <= 0.05 || t2 >= 0.95) return;
      const cx = io.x + dx * t2, cz = io.z + dz * t2;
      if (Math.hypot(tr.x - cx, tr.z - cz) < tr.r * 0.9) si = true;
    });
  }
  return si;
}
// quanto vedo un personaggio (0 = per niente): nell'inquadratura e senza tronchi in mezzo
function visibileDaMe(p, maxD, altezza = 1.3) {
  const d = Math.hypot(p.x - io.x, p.z - io.z);
  if (!p.g.visible || d > maxD) return 0;
  _v.set(p.x, quota(p.x, p.z) + altezza, p.z).project(camera);
  if (_v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) return 0;
  return coperto(p.x, p.z) ? 0 : 1 - Math.abs(_v.x) * 0.5;
}

// È nella mia inquadratura (a prescindere dai tronchi)?
function inVista(x, z, h = 1.5) { _v.set(x, suoloIo(x, z) + h, z).project(camera); return _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1; }
// un posto da cui partire senza farsi vedere: dietro di te o coperto da un tronco, a quella distanza
function postoNascosto(dmin, dmax) {
  const av = avanti(), base = Math.atan2(av.x, av.z);
  for (let k = 0; k < 48; k++) {
    const a = base + Math.PI + (Math.random() - 0.5) * (k < 24 ? 2.4 : 4.8), d = dmin + Math.random() * (dmax - dmin);
    const x = io.x + Math.sin(a) * d, z = io.z + Math.cos(a) * d;
    if (Math.abs(x) > LIMITE - 3 || Math.abs(z) > LIMITE - 3) continue;
    if (Math.hypot(x - FONTE.x, z - FONTE.z) < SICURO + 8 || vicinoStatua(x, z, 8) || distFosso(x, z) < 2 || vicinoCasa(x, z)) continue;
    if (inVista(x, z, 2) && !coperto(x, z)) continue;
    return { x, z };
  }
  return null;
}
// Papi nasce dove non lo vedi, già tutto lì (niente dissolvenze), e da lì ti viene incontro
function nascePapi(posto, t, andatura) {
  posa(papi, posto.x, posto.z, 0); papi.rot = guardaVerso(io.x, io.z, papi); disegna(papi);
  papi.g.visible = true; papi.pres = papi.presV = 1;
  papi.stato = 'arriva'; papi.andatura = ''; papi.agganciato = false; papi.arrabbiato = false; papi.tPerso = 0; papi.nervoso = 0;
  andaturaPapi(andatura);
}
function andaturaPapi(a) {
  if (papi.andatura === a) return;
  papi.andatura = a;
  recita(papi, a === 'striscia' ? 'striscia' : 'corsa', false, a === 'striscia' ? 0.01 : 0.6);   // in piedi: non ha una camminata, è la corsa rallentata
}
function sparisce(t, pausa) {
  viaPapi(true); papi.stato = 'assente';
  papi.prossimo = t + pausa * (0.75 + Math.random() * 0.5);
}
// Caro è scappato a chiamarlo: Papi arriva arrabbiato, già di corsa
function papiArrabbiato(t) {
  if (storia === 'solo') iniziaCaccia(t);
  if (storia !== 'caccia' || alSicuro()) return;
  if (papi.stato === 'assente') { const p = postoNascosto(24, 34); if (!p) { papi.prossimo = t; return; } nascePapi(p, t, 'corsa'); }
  papi.arrabbiato = true; papi.nervoso = 0.6;
  if (papi.stato === 'arriva') andaturaPapi('corsa');
  versoPapi('frasche', 1, 0.55);
  if (Math.random() < 0.6) dici(pesca(BATTUTE.caccia), 2800);
}

// alla Fonticella o vicino a una statuetta: lascia perdere
function arrendePapi() {
  papi.stato = 'arrende'; papi.tArr = 0; papi.saltoVia = false; papi.andatura = ''; papi.nervoso = 0;
  papiGiu(0.3); versoPapi('frasche', 0.8, 0.6);
  if (!dettoSicuro) { dettoSicuro = true; didascalia(vicinoStatua() ? 'Vicino alla statuetta di Guerrino, Papi lascia perdere.' : 'Alla Fonticella Petri, Papi lascia perdere.', 5000); }
}
// muove Papi verso di te schivando i tronchi; ogni tanto fa tremare l'albero che sfiora
function avanzaPapi(dt, v, via = false) {
  let dx = (io.x - papi.x) * (via ? -1 : 1), dz = (io.z - papi.z) * (via ? -1 : 1); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  tronchiVicini(papi.x + dx * 1.4, papi.z + dz * 1.4, 1.6, tr => {
    const ox = papi.x + dx * 1.4 - tr.x, oz = papi.z + dz * 1.4 - tr.z, od = Math.hypot(ox, oz) || 1;
    if (od < tr.r + 0.8) { dx += ox / od * 0.8; dz += oz / od * 0.8; if (Math.random() < dt * 2) scuoti(tr, 0.5); }
  });
  const l2 = Math.hypot(dx, dz) || 1;
  papi.x += dx / l2 * v * dt; papi.z += dz / l2 * v * dt; papi.vel = v;
  giraVerso(Math.atan2(dx, dz), dt, 6, papi);
  papi.passo = (papi.passo || 0) + v * dt;
}
function passoPapi(ogni, vol) {
  if (papi.passo < ogni || !papiPassi) return;
  papi.passo = 0;
  papiPassi.setBuffer(buf['sc' + (1 + (Math.random() * 5 | 0))]);
  papiPassi.setPlaybackRate(0.5 + Math.random() * 0.08); papiPassi.setVolume(vol * mixG('papiPassi'));
  if (papiPassi.isPlaying) papiPassi.stop();
  papiPassi.play();
}

let staticoOb = 0, dettoSicuro = false;
// scappato davvero: lontano, e da un po' non lo vedi più
const FUGA = 32;
function scappato(d, vis) { return vis === 0 && (d > 46 || (d > FUGA && papi.tPerso > 2.5)); }
// se lo guardi dritto in faccia si innervosisce: trema, sbuffa, e va più svelto
function nervosoPapi(dt, vis) {
  const dritto = vis > 0 && Math.abs(_v.x) < 0.3 && Math.abs(_v.y) < 0.45;
  papi.nervoso = Math.max(0, Math.min(1, (papi.nervoso || 0) + (dritto ? dt * 0.55 : -dt * 0.25)));
  if (papi.nervoso > 0.45 && !papi.sbuffato) { papi.sbuffato = true; versoPapi('frasche', 0.9, 1.35); }
  if (papi.nervoso < 0.15) papi.sbuffato = false;
  if (papi.stato !== 'assente' && papi.nervoso > 0.05) {
    const n = papi.nervoso;
    papi.g.rotation.y = papi.rot + (Math.random() - 0.5) * 0.2 * n;
    papi.g.rotation.z = (Math.random() - 0.5) * 0.07 * n;
  }
}
// La caccia (Leo, 16/11): Papi non si teletrasporta e non compare in dissolvenza. Nasce dove non lo vedi
// e ti raggiunge: strisciando per terra, poi si alza e viene a passo lungo, poi corre, e se ti arriva
// abbastanza vicino si lancia. Non molla finché non scappi lontano.
function aggiornaCaccia(dt, t) {
  tCaccia += dt;
  livello = io.fogli + tCaccia / 120;
  papi.vel = 0;
  const d = Math.hypot(io.x - papi.x, io.z - papi.z);
  const vis = papi.vis = papi.stato === 'assente' ? 0 : visibileDaMe(papi, 45, papi.andatura === 'striscia' || papi.stato === 'osserva' ? 1.1 : 3.2);
  const sicuro = alSicuro();
  papi.tPerso = vis > 0 ? 0 : (papi.tPerso || 0) + dt;
  const ner = 1 + (papi.nervoso || 0) * 0.2;
  const pausa = Math.max(8, 26 - livello * 1.6);     // quanto ti lascia in pace quando lo semini

  if (sicuro && papi.stato !== 'assente' && papi.stato !== 'arrende') arrendePapi();

  if (papi.stato === 'assente') {
    if (t > papi.prossimo && !sicuro) {
      const posto = postoNascosto(36, 50);
      if (posto) nascePapi(posto, t, 'striscia'); else papi.prossimo = t + 3;
    }
  } else if (papi.stato === 'arriva') {
    {
      // una volta in piedi resta in piedi
      const vuole = papi.arrabbiato ? 'corsa' : d > 26 ? 'striscia' : d > 15 ? 'cammina' : 'corsa';
      const ordine = { striscia: 0, cammina: 1, corsa: 2 };
      if ((ordine[vuole] ?? 0) > (ordine[papi.andatura] ?? -1)) andaturaPapi(vuole);
      const a = papi.andatura;
      const v = (a === 'striscia' ? 2.0 + livello * 0.04 : a === 'cammina' ? 2.3 + livello * 0.03 : Math.min(4.0, 3.3 + livello * 0.06)) * ner;
      avanzaPapi(dt, v);
      passoPapi(a === 'corsa' ? 1.9 : 2.4, a === 'corsa' ? 1 : a === 'cammina' ? 0.6 : 0.3);
      disegna(papi);
      if (d < 22) papi.agganciato = true;
      if (a === 'corsa' && d < 8.5 && t > (papi.tSaltoOk || 0)) {
        papi.stato = 'salta'; papi.tSalto = 0; const s = recita(papi, 'salto', true, 0.12); if (s) s.timeScale = 1.25; versoPapi('frasche', 1, 0.6);
      } else if (papi.agganciato && scappato(d, vis)) sparisce(t, pausa);
      else if (!papi.agganciato && d > 75 && vis === 0) sparisce(t, 4);   // t'ha perso di vista prima di arrivare
    }
  } else if (papi.stato === 'salta') {
    // il balzo: nella parte in volo dell'animazione ti viene addosso
    papi.tSalto += dt;
    const fr = papi.corrente.time / papi.corrente.getClip().duration;
    if (fr > 0.12 && fr < 0.42 && d > 2.5) avanzaPapi(dt, 9);
    else giraVerso(guardaVerso(io.x, io.z, papi), dt, 4, papi);
    disegna(papi);
    if (fr > 0.62 || finita(papi)) { papi.stato = 'arriva'; papi.andatura = ''; andaturaPapi('corsa'); papi.tSaltoOk = t + 3; }
  } else if (papi.stato === 'arrende') {
    // si arrende: un attimo fermo a guardarti, poi si gira e se ne va saltando
    papi.tArr += dt;
    if (papi.tArr < 0.9) giraVerso(guardaVerso(io.x, io.z, papi), dt, 4, papi);
    else {
      if (!papi.saltoVia) { papi.saltoVia = true; const s = recita(papi, 'salto', true, 0.15); if (s) s.timeScale = 1.1; versoPapi('frasche', 0.9, 0.75); }
      if (papi.nomeAz === 'salto') {
        const fr = papi.corrente.time / papi.corrente.getClip().duration;
        if (fr < 0.12) giraVerso(Math.atan2(papi.x - io.x, papi.z - io.z), dt, 9, papi);
        else if (fr < 0.5) avanzaPapi(dt, 8, true);
        if (fr > 0.62 || finita(papi)) { papi.andatura = ''; andaturaPapi('corsa'); }
      } else { avanzaPapi(dt, 4.6, true); passoPapi(1.9, 0.7); }
    }
    disegna(papi);
    if (papi.tArr > 2 && ((vis === 0 && d > 22) || d > 45) || papi.tArr > 14) sparisce(t, sicuro ? 16 : pausa);
  }

  nervosoPapi(dt, vis);
  // lo statico: poco, e solo quando ce l'hai addosso. Ti prende se ti tocca.
  const c = papi.stato !== 'assente' && !sicuro ? Math.max(0, 1 - d / 18) : 0;
  staticoOb = c * c * (vis > 0 ? 0.9 : 0.5) * papi.pres;
  if ((papi.stato === 'arriva' || papi.stato === 'salta') && !sicuro && Math.hypot(io.x - papi.x, io.z - papi.z) < 3.2) preso();
}

/* ════════ I FIGLI DI PAPI: CARO E BIMBA ════════
   Caro (innocuo) balla da solo in giro, ogni volta con una mossa diversa. Se gli vai troppo vicino
   si gira e scappa guardandosi indietro, e poco dopo arriva Papi arrabbiato, già di corsa.
   Bimba a volte sta seduta sul parapetto di un ponte e muove il piede; oppure gioca in giro. Appena
   ti vede ti viene incontro a calci: se ti prende ti stende, e ti risvegli col 15% di batteria in meno.
   I modelli di Leo (modelli/caro.glb, bimba.glb) sono alleggeriti, con le texture di Leo. Caro è alto 1,40 m, Bimba 2 m. */
const caro = { g: new THREE.Group(), x: 0, z: 0, rot: 0, vel: 0, tinta: 0x77716a, altezza: 1.4, scala: 1, stato: 'assente', prossimo: 0, ballo: 0 };
const bimba = { g: new THREE.Group(), x: 0, z: 0, rot: 0, vel: 0, tinta: 0x77716a, altezza: 2.0, scala: 1, stato: 'assente', prossimo: 0 };
const BALLI = ['balla1', 'balla2', 'windmill', 'balla3'];
const CALCI = ['calcioVolante', 'calcioAlto', 'calcioLato', 'calcio'];
const GIOCHI_BIMBA = ['saltella', 'fermo', 'saltoBraccia', 'gironzola'];
const COLPO_CALCIO = { calcioVolante: 0.32, calcioAlto: 0.4, calcioLato: 0.42, calcio: 0.4 };   // quando il piede arriva
function creaFiglio(p, modello) {
  const bb = new THREE.Box3().setFromObject(modello.scene);
  p.scala = p.altezza / Math.max(0.5, bb.max.y - bb.min.y);
  preparaPersonaggio(p, modello);
  p.g.visible = false;
  const anca = p.corpo.getObjectByName('Hips');
  // seduta: quanto stanno alte le anche sopra i piedi, per poggiarla sul parapetto
  if (p.az.seduta && anca) {
    recita(p, 'seduta', true, 0); p.mixer.update(0.001); p.g.updateMatrixWorld(true);
    p.hSeduta = anca.getWorldPosition(new THREE.Vector3()).y - p.g.position.y - 0.07;
    p.mixer.stopAllAction(); p.corrente = null; p.nomeAz = '';
  }
}
function disegnaF(p) { p.g.position.set(p.x, p.ySeduta ?? suoloIo(p.x, p.z), p.z); p.g.rotation.set(0, p.rot, 0); }
function viaFiglio(p, t, pausa) { p.g.visible = false; p.stato = 'assente'; p.ySeduta = undefined; p.prossimo = t + pausa * (0.7 + Math.random() * 0.6); }
// muove un figlio nella direzione (dx, dz) schivando i tronchi
function muoviF(p, dx, dz, dt, v) {
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  tronchiVicini(p.x + dx * 1.2, p.z + dz * 1.2, 1.4, tr => {
    const ox = p.x + dx * 1.2 - tr.x, oz = p.z + dz * 1.2 - tr.z, od = Math.hypot(ox, oz) || 1;
    if (od < tr.r + 0.6) { dx += ox / od * 0.9; dz += oz / od * 0.9; }
  });
  const l2 = Math.hypot(dx, dz) || 1;
  p.x = Math.max(-LIMITE, Math.min(LIMITE, p.x + dx / l2 * v * dt)); p.z = Math.max(-LIMITE, Math.min(LIMITE, p.z + dz / l2 * v * dt));
  p.vel = v;
  return Math.atan2(dx, dz);
}
const figliInGioco = () => (storia === 'solo' || storia === 'caccia') && fase === 'gioco';

function aggiornaCaro(dt, t) {
  const p = caro; if (!p.mixer) return;
  p.vel = 0;
  const d = Math.hypot(io.x - p.x, io.z - p.z);
  if (p.stato === 'assente') {
    if (figliInGioco() && !p.prossimo) p.prossimo = t + (VELOCE ? 10 : 50 + Math.random() * 80);
    if (p.prossimo && t > p.prossimo && figliInGioco() && papi.stato === 'assente') {
      const q = postoNascosto(28, 48);
      if (!q) { p.prossimo = t + 5; return; }
      p.x = q.x; p.z = q.z; p.rot = Math.random() * 6.28; disegnaF(p);
      p.ballo = (p.ballo + 1 + (Math.random() * (BALLI.length - 1) | 0)) % BALLI.length;   // mai la stessa mossa della volta prima
      recita(p, BALLI[p.ballo], false, 0.01);
      p.g.visible = true; p.stato = 'balla'; p.fine = t + 120;
    }
    return;
  }
  if (p.stato === 'balla') {
    disegnaF(p);
    if (d < 7 && fase === 'gioco') {
      // t'ha visto: si gira e scappa, e va a chiamare Papi
      p.stato = 'girati'; p.rot = guardaVerso(io.x, io.z, p); recita(p, 'girati', true, 0.2); p.tPapi = t + 4 + Math.random() * 3;
    } else if ((t > p.fine || !figliInGioco()) && d > 25 && !inVista(p.x, p.z)) viaFiglio(p, t, 90);
  } else if (p.stato === 'girati') {
    const a = p.corrente, fr = a.time / a.getClip().duration;
    if (fr > 0.3) muoviF(p, p.x - io.x, p.z - io.z, dt, 2.6);   // nell'animazione si gira e parte all'indietro
    disegnaF(p);
    if (finita(p)) { p.stato = 'scappa'; p.rot += Math.PI; recita(p, 'guardaDietro', false, 0.15); }
  } else if (p.stato === 'scappa') {
    const verso = muoviF(p, p.x - io.x + Math.sin(p.rot) * 6, p.z - io.z + Math.cos(p.rot) * 6, dt, 3.6);
    giraVerso(verso, dt, 3, p); disegnaF(p);
    if (d > 40 && !inVista(p.x, p.z)) viaFiglio(p, t, 150);
  }
  if (p.tPapi && t > p.tPapi && fase === 'gioco') { p.tPapi = 0; papiArrabbiato(t); }
}

function siediSulPonte(p, ponte, t) {
  const s = Math.random() < 0.5 ? 1 : -1, lat = ponte.W / 2 - 0.13 + 0.1, t0 = 0.35 + Math.random() * 0.3, a = (t0 - 0.5) * ponte.L;
  p.x = ponte.x + ponte.rx * a - ponte.rz * s * lat; p.z = ponte.z + ponte.rz * a + ponte.rx * s * lat;
  p.rot = Math.atan2(-ponte.rz * s, ponte.rx * s);   // guarda fuori, coi piedi sull'acqua
  p.ySeduta = pianoPonte(ponte, t0) + 0.51 - (p.hSeduta || 0.6);
  p.ponte = { ponte, s, a };
  recita(p, 'seduta', false, 0.01);
  p.stato = 'seduta';
}
function aggiornaBimba(dt, t) {
  const p = bimba; if (!p.mixer) return;
  p.vel = 0;
  const d = Math.hypot(io.x - p.x, io.z - p.z);
  if (p.stato === 'assente') {
    if (figliInGioco() && !p.prossimo) p.prossimo = t + (VELOCE ? 20 : 80 + Math.random() * 100);
    if (p.prossimo && t > p.prossimo && figliInGioco()) {
      const ponti = PONTI.filter(q => { const dd = Math.hypot(q.x - io.x, q.z - io.z); return dd > 25 && dd < 110 && !(inVista(q.x, q.z, 1) && !coperto(q.x, q.z)); });
      if (ponti.length && Math.random() < 0.6) siediSulPonte(p, pesca(ponti), t);
      else {
        const q = postoNascosto(26, 46);
        if (!q) { p.prossimo = t + 5; return; }
        p.x = q.x; p.z = q.z; p.rot = Math.random() * 6.28; p.ySeduta = undefined;
        p.stato = 'gioca'; p.tCambio = 0;
      }
      p.g.visible = true; p.fine = t + 150; disegnaF(p);
    }
    return;
  }
  if (p.stato === 'seduta' || p.stato === 'gioca') {
    if (p.stato === 'gioca' && t > p.tCambio) { recita(p, pesca(GIOCHI_BIMBA), false, 0.4); p.tCambio = t + 3 + Math.random() * 4; }
    if (p.stato === 'gioca' && p.nomeAz === 'gironzola') { p.rot += dt * 0.25; }
    disegnaF(p);
    // ti vede: vicina e senza tronchi in mezzo
    if (fase === 'gioco' && !alSicuro() && d < 16 && !coperto(p.x, p.z)) {
      if (p.stato === 'seduta') {
        // scende dal parapetto sul ponte
        const { ponte, s, a } = p.ponte, lat = ponte.W / 2 - 0.7;
        p.x = ponte.x + ponte.rx * a - ponte.rz * s * lat; p.z = ponte.z + ponte.rz * a + ponte.rx * s * lat;
      }
      p.ySeduta = undefined; p.stato = 'calci'; p.calcio = -1; p.corrente = null;
    } else if ((t > p.fine || !figliInGioco()) && d > 30 && !inVista(p.x, p.z)) viaFiglio(p, t, 120);
  } else if (p.stato === 'calci') {
    // una mossa di calcio dopo l'altra, sempre verso di te
    if (!p.corrente || finita(p) || !CALCI.includes(p.nomeAz)) { p.calcio = (p.calcio + 1) % CALCI.length; recita(p, CALCI[p.calcio], true, 0.15); p.colpito = false; }
    const a = p.corrente, nome = p.nomeAz, fr = a.time / a.getClip().duration;
    giraVerso(guardaVerso(io.x, io.z, p), dt, 6, p);
    if (d > 0.9) { const r = p.rot; muoviF(p, io.x - p.x, io.z - p.z, dt, nome === 'calcioVolante' && fr < 0.6 ? 3 : 1.9); p.rot = r; p.vel = 0; }
    disegnaF(p);
    if (!p.colpito && fr >= COLPO_CALCIO[nome]) { p.colpito = true; if (d < 1.5 && fase === 'gioco') stendimi(t); }
    if (d > 26 || alSicuro()) { p.stato = 'gioca'; p.tCambio = 0; }
  }
}
// il calcio della Bimba: vai giù, buio, ti risvegli con meno batteria
const STESO = { t: -1 };
function stendimi(t) {
  fase = 'steso'; STESO.t = 0; STESO.yaw = io.yaw; STESO.pitch = io.pitch; apriTelefono(false);
  suono('colpo', 0.7, 0.85, 'papiVersi');
  io.fiato = Math.min(io.fiato, 0.3);
}
function animaSteso(dt) {
  if (STESO.t < 0) return;
  const T = STESO.t += dt, k = Math.min(1, T / 0.55), e = k * k * (3 - 2 * k);
  camera.position.set(io.x, suoloIo(io.x, io.z) + 1.65 - 1.42 * e, io.z);
  camera.rotation.set(STESO.pitch + (0.5 - STESO.pitch) * e, STESO.yaw, 1.15 * e, 'YXZ');
  if (T > 0.8 && !STESO.buio) { STESO.buio = true; ui.buio.style.opacity = 1; }
  if (T > 3.2) {
    STESO.t = -1; STESO.buio = false;
    io.batteria = Math.max(0, io.batteria - 0.15);
    viaFiglio(bimba, tGioco, 200);
    io.pitch = -0.05; ui.buio.style.opacity = 0; fase = 'gioco';
    didascalia('Ti risvegli per terra. Il telefono ha perso il 15% di batteria.', 5000);
  }
}
function animaFigli(dt) {
  for (const p of [caro, bimba]) {
    if (!p.mixer || !p.g.visible) continue;
    if (Math.hypot(p.x - io.x, p.z - io.z) > 70) continue;
    const a = p.corrente;
    if (a && (p.nomeAz === 'guardaDietro')) a.timeScale = Math.min(2.2, Math.max(0.5, p.vel / (p.v0.guardaDietro || 1.3)));
    p.mixer.update(dt);
  }
}

/* ── statico a schermo: sale svelto, scende in dissolvenza; al centro resta una finestra (vedi stile.css) ── */
const sg = ui.statico.getContext('2d');
const sImg = sg.createImageData(160, 90);
function disegnaStatico(dt) {
  const ob = fase === 'morto' ? (PRESA.t >= 0 && !PRESA.fatto ? 0.35 : 1) : storia === 'caccia' ? staticoOb : 0;
  staticoV += Math.max(-dt * 0.55, Math.min(dt * 3, ob - staticoV));
  const k = staticoV;
  ui.statico.style.opacity = (k * k * 0.85).toFixed(3);
  if (rumore) rumore.setVolume(k * k * 0.2 * mixG('statico'));   // −8 dB (Leo)
  if (k < 0.02) return;
  const d = sImg.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  sg.putImageData(sImg, 0, 0);
}

/* ── fosso: il rumore dell'acqua vicino ai fossi ── */
let FOSSI = [];
function distFosso(x, z) {
  let best = Infinity;
  for (const p of FOSSI) for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

// verso dove scorre l'acqua lì vicino (vettore unitario), o null se non sei in un fosso
function corrente(x, z) {
  let best = 1.8, dir = null;
  for (const { pts, verso } of PROFILI) for (let k = 0; k < pts.length; k++) {
    const dx = pts[k][0] - x, dz = pts[k][1] - z; if (Math.abs(dx) > best || Math.abs(dz) > best) continue;
    const d = Math.hypot(dx, dz); if (d >= best) continue;
    const a = pts[Math.max(0, Math.min(pts.length - 1, k - verso))], b = pts[Math.max(0, Math.min(pts.length - 1, k + verso))];
    const vx = b[0] - a[0], vz = b[1] - a[1], l = Math.hypot(vx, vz); if (!l) continue;
    best = d; dir = [vx / l, vz / l];
  }
  return dir;
}

/* ════════ TELEFONO: APP MAPPA ════════ */
// Sul telefono c'è la mappa della zona, ma il GPS aggancia i satelliti solo in quota:
// sotto GPS_QUOTA vedi la carta e l'ultima posizione nota, non dove sei adesso.
const GPS_QUOTA = 1170;   // metri veri sul mare (il paese sta a 1126)
const tel = { aperto: false, fix: false, tFix: 0, tacche: 0, ux: io.x, uz: io.z, tUltimo: 0, zoom: 0, mappa: null, tDis: 0, paese: [0, 0] };
// Il telefono in mano: un parallelepipedo nero con lo schermo acceso e la mano destra che lo tiene.
// Lo schermo fa un filo di luce: con il telefono aperto Papi ti vede meglio.
const TEL3D = { g: new THREE.Group(), su: 0, cv: document.createElement('canvas'), gesto: -1, scossi: 0 };
TEL3D.cv.width = 384; TEL3D.cv.height = 688;   // il doppio: si disegna in coordinate 192 x 344 (setTransform 2)
TEL3D.tex = new THREE.CanvasTexture(TEL3D.cv);
TEL3D.tex.colorSpace = THREE.SRGBColorSpace; TEL3D.tex.minFilter = THREE.LinearMipmapLinearFilter; TEL3D.tex.magFilter = THREE.LinearFilter;
{
  // la mano e il telefono non prendono le luci della scena (a un palmo dalla torcia verrebbero bianchi):
  // ogni faccia ha la sua ombra fissa, e il colore si scurisce col buio (animaTelefono)
  const ombre = geo => { const n = geo.attributes.normal, col = []; for (let i = 0; i < n.count; i++) { const y = n.getY(i), z = n.getZ(i), x = n.getX(i); const k = y > 0.5 ? 1 : y < -0.5 ? 0.45 : z > 0.5 ? 0.82 : x > 0.5 ? 0.62 : 0.55; col.push(k, k, k); } geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo; };
  // le texture (Leo, 16/11): plastica nera graffiata col bordo lucido, e pelle a chiazze con le pieghe; a pixel, da PS1
  const texTel = (w, h, f) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; f(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const plastica = texTel(32, 64, (c, w, h) => {
    c.fillStyle = '#9a9ca0'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = 130 + rnd() * 50 | 0; c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(rnd() * w | 0, rnd() * h | 0, 1, 1); }
    c.strokeStyle = 'rgba(230,232,236,.55)'; c.strokeRect(0.5, 0.5, w - 1, h - 1);              // il bordo che prende luce
    c.strokeStyle = 'rgba(210,212,216,.35)'; for (let i = 0; i < 5; i++) { c.beginPath(); const x = rnd() * w, y = rnd() * h; c.moveTo(x, y); c.lineTo(x + rnd() * 8 - 4, y + rnd() * 10 - 5); c.stroke(); }   // graffi
    c.fillStyle = '#50525a'; c.fillRect(w / 2 - 5, 3, 10, 1);                                       // l'altoparlante
    c.fillStyle = '#3a3c44'; c.beginPath(); c.arc(w / 2, 9, 1.6, 0, 6.3); c.fill();                  // la fotocamera
  });
  const cute = texTel(32, 32, (c, w, h) => {
    c.fillStyle = '#e8ddd6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) { const r = 205 + rnd() * 50 | 0, gg = r - 18 - rnd() * 14 | 0; c.fillStyle = `rgb(${r},${gg},${gg - 6})`; c.fillRect(rnd() * w | 0, rnd() * h | 0, 1 + (rnd() * 2 | 0), 1); }
    c.strokeStyle = 'rgba(150,100,90,.45)'; for (let i = 0; i < 4; i++) { c.beginPath(); const y = 6 + i * 7 + rnd() * 2; c.moveTo(2, y); c.quadraticCurveTo(w / 2, y + 2, w - 2, y - 1); c.stroke(); }   // pieghe
  });
  const g = TEL3D.g, nero = new THREE.MeshBasicMaterial({ color: 0x2a2b2e, map: plastica, vertexColors: true }), pelle = new THREE.MeshBasicMaterial({ color: 0x9a7058, map: cute, vertexColors: true });
  TEL3D.pelle = pelle;
  const box = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const b = new THREE.Mesh(ombre(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.rotation.set(rx, ry, rz); g.add(b); return b; };
  box(0.074, 0.15, 0.009, nero, 0, 0, 0);
  const schermo = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.118), new THREE.MeshBasicMaterial({ map: TEL3D.tex, fog: false }));
  schermo.position.set(0, 0.004, 0.0047); g.add(schermo);
  // il palmo dietro, il pollice sul bordo destro, le dita che spuntano a sinistra, il polso che scende
  // (è la mano di riserva: appena arriva modelli/mano-telefono.glb la sostituisce, vedi creaManoTelefono)
  const prima = g.children.length;
  box(0.07, 0.08, 0.022, pelle, 0.008, -0.04, -0.016);
  // pollice e dita: salsicciotti (cilindri con le punte tonde)
  const dito = (r, l, x, y, z, rz) => { const d = new THREE.Mesh(ombre(new THREE.CapsuleGeometry(r, l, 3, 7)), pelle); d.position.set(x, y, z); d.rotation.z = rz; g.add(d); return d; };
  dito(0.0085, 0.04, 0.041, -0.036, 0.004, 0.32);
  for (let i = 0; i < 4; i++) dito(0.0078, 0.011 - (i === 3 ? 0.003 : 0), -0.04, 0.006 - i * 0.0168, -0.005, Math.PI / 2 + 0.08 * (i - 1.5));
  box(0.058, 0.13, 0.05, pelle, 0.022, -0.125, -0.03, 0.35, 0, -0.18);
  TEL3D.riserva = g.children.slice(prima);
  TEL3D.cute = cute;
  TEL3D.luce = new THREE.PointLight(0x9cc0ff, 0, 2.5, 2); TEL3D.luce.position.set(0.09, -0.04, -0.12); camera.add(TEL3D.luce);   // il filo di luce dello schermo resta nel bosco
  g.visible = false; scenaTel.add(g);
}
/* La mano col telefono di Leo (17/11): modelli/mano-telefono.glb, low poly a colori sui vertici, già in presa.
   Arriva dopo il resto: finché non c'è resta la mano di riserva fatta qui sopra. Sullo schermo del suo telefono
   (PHONE_screen_inner) ci metto la stessa canvas di prima, con le UV fatte qui in piano. */
function creaManoTelefono(m) {
  // il modello non ha le normali: facce piatte, da low poly
  const pelle = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), plastica = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.scene.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    if (o.name === 'PHONE_screen_inner') {
      const g = o.geometry, p = g.attributes.position; g.computeBoundingBox();
      const bb = g.boundingBox, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x); uv[i * 2 + 1] = (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y); }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      o.material = new THREE.MeshBasicMaterial({ map: TEL3D.tex, fog: false });
      o.position.z += 0.004;   // un filo sopra il vetro
    } else o.material = /^HAND/.test(o.name) ? pelle : plastica;
  });
  for (const o of TEL3D.g.children) o.visible = false;
  m.scene.scale.setScalar(0.045);   // il suo telefono è largo 1,75: così fa 8 cm
  TEL3D.g.add(m.scene);
  TEL3D.pelle = pelle; TEL3D.plastica = plastica; TEL3D.leo = true;
  scenaTel.add(new THREE.HemisphereLight(0xffffff, 0x50443c, 1.3));
  const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(0.4, 1, 0.8); scenaTel.add(d);
}
function schermoNero() { const g = TEL3D.cv.getContext('2d'); g.fillStyle = '#030404'; g.fillRect(0, 0, TEL3D.cv.width, TEL3D.cv.height); TEL3D.tex.needsUpdate = true; }
const _qTel = new THREE.Quaternion(), _qOcchio = new THREE.Quaternion();
function animaTelefono(dt) {
  let ob = (tel.aperto || io.torcia || chiamaPapi()) && fase !== 'menu' && fase !== 'morto' ? 1 : 0, scossa = 0;   // con la torcia accesa il telefono resta in mano; quando chiama Papi lo tiri su
  if (TEL3D.gesto >= 0) {
    const k = TEL3D.gesto += dt;
    ob = 1;
    if (k > 0.3 && k < 1.2) {
      const n = Math.floor((k - 0.3) / 0.3), f = (k - 0.3) / 0.3 - n;
      scossa = Math.sin(f * Math.PI * 2);   // di lato, avanti e indietro, come il gesto del Motorola
      if (n >= TEL3D.scossi) { TEL3D.scossi = n + 1; suono('frasche', 0.05, 2.4, 'interfaccia'); }
    }
    if (k >= 1.2 && !io.torcia && TEL3D.scossi < 9) { TEL3D.scossi = 9; if (io.batteria > 0 && fase === 'gioco') { io.torcia = true; suono('colpo', 0.08, 2.6, 'interfaccia'); } }
    if (k > 1.5) TEL3D.gesto = -1;
  }
  TEL3D.su += (ob - TEL3D.su) * Math.min(1, dt * 9);
  const s = TEL3D.su, g = TEL3D.g;
  g.visible = s > 0.01;
  TEL3D.luce.intensity = 0.7 * s * s;
  if (!g.visible) return;
  // la mano: la luce dello schermo, più la torcia se è accesa, meno il buio della notte; stringe un po' mentre scuoti
  const luceMano = 0.55 + (io.torcia ? 0.35 : 0) - BUIO.k * 0.2;
  if (TEL3D.leo) { TEL3D.pelle.color.setScalar(luceMano * 0.95); TEL3D.plastica.color.setScalar(0.3 + luceMano * 0.5); }
  else TEL3D.pelle.color.setHex(0xb08068).multiplyScalar(luceMano);
  const bob = Math.sin(io.dondolo) * 0.004 * Math.min(1, io.vel);
  // in basso a destra; sullo schermo stretto (telefono in verticale) si avvicina al centro
  const mezzoL = 0.2 * Math.tan(camTel.fov * Math.PI / 360) * camera.aspect, px = Math.max(0.015, Math.min(0.15, mezzoL - 0.06));
  const verso = tel.aperto && !io.torcia && TEL3D.gesto < 0 ? 1 : 0;
  TEL3D.verso = (TEL3D.verso || 0) + (verso - (TEL3D.verso || 0)) * Math.min(1, dt * 7);
  const v = TEL3D.verso;
  g.position.set(px + scossa * 0.035, -0.27 + s * 0.18 + bob + 0.025 * v, -0.2);   // dritto è più alto: lo alzo un filo
  g.rotation.set(-0.12 - (1 - s) * 0.6, 0.22 + scossa * 0.55, 0.06 + Math.sin(io.dondolo * 0.5) * 0.01 - scossa * 0.3);
  if (v > 0.001) {
    // girato verso l'occhio: lo schermo guarda dritto la camera, senza storcersi
    _qTel.copy(g.quaternion); g.lookAt(0, 0, 0); g.rotateX(-(1 - s) * 0.6);
    _qOcchio.copy(g.quaternion); g.quaternion.slerpQuaternions(_qTel, _qOcchio, v);
  }
}
// dove sta lo schermo del telefono sullo schermo vero (per lo zoom col dito)
function toccaSchermo(x, y) {
  if (TEL3D.su < 0.8) return false;
  const v = new THREE.Vector3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  TEL3D.g.updateMatrixWorld(true);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    v.set(a * 0.04, b * 0.08, 0); TEL3D.g.localToWorld(v); v.project(camTel);
    const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
function quotaVera() { return quota(io.x, io.z) / SCALA; }

// la carta, disegnata una volta sola dal terreno vero: ombre, curve di livello, bosco, fossi, strade, case
function creaMappaTelefono(bosco, osm) {
  const L = 1024, c = document.createElement('canvas'); c.width = c.height = L;   // 1,6 px al metro: si legge anche zoomata
  const g = c.getContext('2d'), img = g.createImageData(L, L), d = img.data;
  const H = new Float32Array(L * L), m = HALF * 2 / L, passo = m / SCALA * 2;
  for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) H[j * L + i] = quota((i + 0.5) * m - HALF, (j + 0.5) * m - HALF) / SCALA;
  for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    const k = j * L + i, h = H[k];
    const est = H[j * L + Math.min(L - 1, i + 1)], ovest = H[j * L + Math.max(0, i - 1)], sud = H[Math.min(L - 1, j + 1) * L + i], nord = H[Math.max(0, j - 1) * L + i];
    const luce = Math.max(0.4, Math.min(1.55, 1 + ((est - ovest) + (sud - nord)) / passo * 0.55));   // sole finto da nord-ovest
    const b = bosco.d[((j * bosco.h / L | 0) * bosco.w + (i * bosco.w / L | 0)) * 4] / 255;
    let r = (50 - 24 * b) * luce, v = (56 - 10 * b) * luce, bl = (50 - 20 * b) * luce;
    // curve di livello ogni 10 m, più marcate ogni 50
    if ((h / 10 | 0) !== (est / 10 | 0) || (h / 10 | 0) !== (sud / 10 | 0)) {
      const a = (h / 50 | 0) !== (est / 50 | 0) || (h / 50 | 0) !== (sud / 50 | 0) ? 58 : 24;
      r += a; v += a; bl += a * 0.85;
    }
    d[k * 4] = r; d[k * 4 + 1] = v; d[k * 4 + 2] = bl; d[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const px = q => (q + HALF) / m;
  const linea = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(px(p[0]), px(p[1])) : g.moveTo(px(p[0]), px(p[1]))); };
  g.lineJoin = g.lineCap = 'round';
  g.strokeStyle = '#4a8fba'; g.lineWidth = 3.4; for (const f of osm.fossi) { linea(f); g.stroke(); }
  for (const [tipo, pts] of osm.strade) {
    const sentiero = tipo === 't' || tipo === 'p';
    g.setLineDash(sentiero ? [9, 7] : []); g.lineWidth = sentiero ? 2.4 : 4; g.strokeStyle = sentiero ? '#c2b592' : '#e0dac8';
    linea(pts); g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = '#a89c86'; let sx = 0, sz = 0, n = 0;
  for (const pts of osm.case) { if (pts.length < 3) continue; linea(pts); g.closePath(); g.fill(); for (const p of pts) { sx += p[0]; sz += p[1]; n++; } }
  if (n) tel.paese = [sx / n, sz / n];
  tel.mappa = c;
}

function apriTelefono(si = !tel.aperto) {
  if (si === tel.aperto) return;
  tel.aperto = si; tel.tDis = 0;
  if (si) disegnaTelefono(tGioco, quotaVera());
  suono('colpo', 0.05, 3.4, 'interfaccia');
}
function zoomTelefono() { tel.zoom ^= 1; tel.tDis = 0; }

// Il GPS non è preciso: in quota ogni tanto si perde; in basso certi punti prendono e ogni tanto
// aggancia a caso; e a volte sbaglia e ti mette da un'altra parte (più fogli hai, più succede).
// Quando aggancia, i fogli dentro il cerchio tratteggiato compaiono sulla mappa per 15 secondi.
const GPS = { buchi: [], tCaduta: 0, tLampo: 0, tFinto: 0, fx: 0, fz: 0, rivelati: [] };
function preparaGps() {
  const r = rand(909);
  for (let k = 0; GPS.buchi.length < 7 && k < 400; k++) {
    const x = (r() - 0.5) * LIMITE * 1.8, z = (r() - 0.5) * LIMITE * 1.8;
    if (quota(x, z) / SCALA < GPS_QUOTA - 15) GPS.buchi.push({ x, z, r: 9 + r() * 8 });
  }
}
function aggiornaGps(dt, t) {
  const q = quotaVera();
  let segnale = q >= GPS_QUOTA;
  if (segnale) { if (GPS.tCaduta <= 0 && Math.random() < dt / 30) GPS.tCaduta = 4 + Math.random() * 10; if (GPS.tCaduta > 0) segnale = false; }
  else {
    if (GPS.tLampo <= 0 && Math.random() < dt / 60) GPS.tLampo = 3 + Math.random() * 3;
    if (GPS.tLampo > 0 || GPS.buchi.some(b => Math.hypot(io.x - b.x, io.z - b.z) < b.r)) segnale = true;
  }
  if (io.aggeggio) segnale = true;            // l'aggeggio de Vito: prende sempre e ovunque
  const statua = vicinoStatua();
  if (statua) { segnale = true; GPS.tFinto = 0; }   // vicino a una statuetta: prende, e giusto
  if (io.batteria <= 0) segnale = false;      // telefono morto
  GPS.tCaduta = Math.max(0, GPS.tCaduta - dt); GPS.tLampo = Math.max(0, GPS.tLampo - dt);
  tel.tacche = segnale ? (q >= GPS_QUOTA + 25 ? 4 : 3) : q >= GPS_QUOTA - 15 ? 2 : q >= GPS_QUOTA - 35 ? 1 : 0;
  // ci mette un paio di secondi ad agganciare, e lo perde appena il segnale va via
  tel.tFix = Math.max(0, Math.min(3, tel.tFix + (segnale ? dt : -dt * 1.5)));
  if (!tel.fix && tel.tFix >= 2.5) {
    tel.fix = true;
    const raggio = Math.min(80, 8 + (t - tel.tUltimo) * 1.4);   // il cerchio tratteggiato di adesso
    for (const f of FOGLI) if (!f.preso && Math.hypot(f.x - io.x, f.z - io.z) < raggio && !GPS.rivelati.some(v => v.f === f)) GPS.rivelati.push({ f, fino: t + 15 });
    if (!statua && Math.random() < Math.min(0.6, io.fogli * 0.06)) sbagliaGps();
  }
  if (tel.fix && tel.tFix <= 1) tel.fix = false;
  if (tel.fix && !statua && GPS.tFinto <= 0 && Math.random() < dt / 50 * io.fogli / 10) sbagliaGps();
  GPS.tFinto = Math.max(0, GPS.tFinto - dt);
  GPS.rivelati = GPS.rivelati.filter(v => v.fino > t && !v.f.preso);
  if (tel.fix) { tel.ux = io.x + (GPS.tFinto > 0 ? GPS.fx : 0); tel.uz = io.z + (GPS.tFinto > 0 ? GPS.fz : 0); tel.tUltimo = t; }
  if (tel.aperto && (tel.tDis -= dt) <= 0) { tel.tDis = 0.1; disegnaTelefono(t, q); }
  else if (!tel.aperto && (io.torcia || chiamaPapi()) && TEL3D.gesto < 0 && (tel.tDis -= dt) <= 0) { tel.tDis = chiamaPapi() ? 0.2 : 1; disegnaBlocco(t); }
}
// con la torcia accesa e la mappa chiusa: lo schermo di blocco, l'unico posto dove vedi la batteria
// Papi che ti chiama: la sua foto a tutto schermo
const FOTO_PAPI = new Image(); FOTO_PAPI.src = 'texture/papi-chiama.jpg';
function chiamaPapi() { return EV.attivo === 'telefono' && tGioco < EV.fine && io.batteria > 0 && !tel.aperto && fase === 'gioco'; }
function disegnaChiamata(t) {
  const cv = TEL3D.cv, W = 192, H = 344, g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
  const font = (px, peso = 500) => { g.font = `${peso} ${px}px "DM Mono", monospace`; };
  g.fillStyle = '#050607'; g.fillRect(0, 0, W, H);
  if (FOTO_PAPI.complete && FOTO_PAPI.naturalWidth) g.drawImage(FOTO_PAPI, 0, 0, W, 269);
  const sf = g.createLinearGradient(0, 190, 0, 280); sf.addColorStop(0, 'rgba(5,6,7,0)'); sf.addColorStop(1, 'rgba(5,6,7,1)');
  g.fillStyle = sf; g.fillRect(0, 190, W, 90);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(5,6,7,.55)'; g.fillRect(0, 0, W, 26);
  font(13); g.fillStyle = Math.sin(t * 6) > -0.3 ? '#e9e4d6' : 'rgba(233,228,214,.35)'; g.fillText('chiamata in arrivo', W / 2, 13);
  font(34, 500); g.fillStyle = '#e9e4d6'; g.fillText('Papi', W / 2, 252);
  font(12); g.fillStyle = '#9a968b'; g.fillText('cellulare', W / 2, 276);
  // rispondi (verde) e rifiuta (rosso): si risponde solo a Papi, e a Papi non si risponde
  const tondo = (x, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, 312, 15, 0, Math.PI * 2); g.fill(); };
  tondo(52, '#3e9a5c'); tondo(140, '#c2443a');
  g.strokeStyle = '#e9e4d6'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(52, 315, 7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.beginPath(); g.arc(140, 309, 7, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  TEL3D.tex.needsUpdate = true;
}
function disegnaBlocco(t) {
  if (io.batteria <= 0) { schermoNero(); return; }
  if (chiamaPapi()) { disegnaChiamata(t); return; }
  const cv = TEL3D.cv, W = 192, H = 344, g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
  const font = (px, peso = 500) => { g.font = `${peso} ${px}px "DM Mono", monospace`; };
  g.fillStyle = '#050607'; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  const min = 187 + Math.floor(t / 60), ora = String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  for (let i = 0; i < 4; i++) { g.fillStyle = i < tel.tacche ? '#e9e4d6' : 'rgba(233,228,214,.2)'; g.fillRect(9 + i * 8, 23 - (i + 1) * 4, 6, (i + 1) * 4); }
  font(19); g.textAlign = 'right'; g.fillStyle = io.batteria < 0.2 ? '#e2574a' : '#e9e4d6'; g.fillText(Math.ceil(io.batteria * 100) + '%', W - 8, 15);
  g.textAlign = 'center'; font(54, 400); g.fillStyle = '#e9e4d6'; g.fillText(ora, W / 2, 105);
  font(15); g.fillStyle = '#9a968b'; g.fillText('lunedì 16 novembre', W / 2, 145);
  // la pila grande
  const bw = 96, bh = 40, bx = (W - bw) / 2, by = 196;
  g.strokeStyle = '#e9e4d6'; g.lineWidth = 3; g.strokeRect(bx, by, bw, bh); g.fillStyle = '#e9e4d6'; g.fillRect(bx + bw + 2, by + 12, 6, 16);
  g.fillStyle = io.batteria < 0.2 ? '#e2574a' : '#72d590'; g.fillRect(bx + 5, by + 5, (bw - 10) * Math.max(0.02, io.batteria), bh - 10);
  font(17); g.fillStyle = '#e9e4d6'; g.fillText('torcia accesa', W / 2, 270);
  TEL3D.tex.needsUpdate = true;
}

function sbagliaGps() {
  if (io.aggeggio) return;
  const a = Math.random() * 6.28, d = 40 + Math.random() * 100;
  GPS.fx = Math.sin(a) * d; GPS.fz = Math.cos(a) * d; GPS.tFinto = 6 + Math.random() * 10;
}
function disegnaTelefono(t, q) {
  if (!tel.mappa) return;
  if (io.batteria <= 0) { schermoNero(); return; }   // scarico: schermo nero
  const cv = TEL3D.cv, W = 192, H = 344, g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
  const font = (px, peso = 500) => { g.font = `${peso} ${px}px "DM Mono", monospace`; };
  g.fillStyle = '#07090a'; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle'; g.lineJoin = 'round';
  // barra di stato: ora, tacche, batteria
  const min = 187 + Math.floor(t / 60);
  font(19); g.textAlign = 'left'; g.fillStyle = '#e9e4d6';
  g.fillText(String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'), 9, 15);
  for (let i = 0; i < 4; i++) { g.fillStyle = i < tel.tacche ? '#e9e4d6' : 'rgba(233,228,214,.2)'; g.fillRect(W - 96 + i * 8, 23 - (i + 1) * 4, 6, (i + 1) * 4); }
  g.textAlign = 'right'; g.fillStyle = io.batteria < 0.2 ? '#e2574a' : '#e9e4d6'; g.fillText(Math.round(io.batteria * 100) + '%', W - 8, 15);
  // l'app: il nome e lo stato del GPS
  g.textAlign = 'left'; font(23); g.fillStyle = '#e9e4d6'; g.fillText('Mappe', 9, 45);
  const cerca = !tel.fix && tel.tFix > 0.3;
  const [scr, col] = tel.fix ? ['GPS', '#72d590'] : cerca ? ['cerco', '#e6b450'] : ['no GPS', '#e2574a'];
  font(17); const lw = g.measureText(scr).width + 14;
  g.fillStyle = col; g.globalAlpha = 0.2; g.fillRect(W - 8 - lw, 33, lw, 24); g.globalAlpha = 1;
  g.textAlign = 'right'; g.fillText(scr, W - 15, 45);
  // la carta
  const M0 = 64, S = W, u = S / 150;
  const campo = tel.zoom ? HALF * 2 : 170;      // metri di mappa nel riquadro
  const cx = tel.zoom ? 0 : tel.ux, cz = tel.zoom ? 0 : tel.uz;
  const sx = x => ((x - cx) / campo + 0.5) * S, sy = z => ((z - cz) / campo + 0.5) * S;
  g.save(); g.beginPath(); g.rect(0, M0, S, S); g.clip(); g.translate(0, M0);
  g.fillStyle = '#0c0f0e'; g.fillRect(0, 0, S, S);
  const k = tel.mappa.width / (HALF * 2);
  const x0 = Math.max(-HALF, cx - campo / 2), x1 = Math.min(HALF, cx + campo / 2), z0 = Math.max(-HALF, cz - campo / 2), z1 = Math.min(HALF, cz + campo / 2);
  if (x1 > x0 && z1 > z0) g.drawImage(tel.mappa, (x0 + HALF) * k, (z0 + HALF) * k, (x1 - x0) * k, (z1 - z0) * k, sx(x0), sy(z0), sx(x1) - sx(x0), sy(z1) - sy(z0));
  const scritta = (testo, x, y, colore = '#e9e4d6', corpo = 16) => {
    font(corpo); g.textAlign = 'left';
    g.lineWidth = 4; g.strokeStyle = 'rgba(8,10,9,.9)'; g.strokeText(testo, x, y); g.fillStyle = colore; g.fillText(testo, x, y);
  };
  scritta('Capricchia', sx(tel.paese[0]) - 40, sy(tel.paese[1]) + 22, '#d8d2c0');
  g.fillStyle = '#5fb7ea'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(sx(FONTE.x), sy(FONTE.z), 3.5 * u, 0, 6.3); g.fill(); g.stroke();
  scritta('Fonticella', sx(FONTE.x) + 7 * u, sy(FONTE.z), '#bfe2f7');
  if (io.roncola) {
    g.fillStyle = '#e2574a'; g.beginPath(); g.moveTo(sx(CASA.x), sy(CASA.z) - 6 * u); g.lineTo(sx(CASA.x) + 4 * u, sy(CASA.z) + 3 * u); g.lineTo(sx(CASA.x) - 4 * u, sy(CASA.z) + 3 * u); g.closePath(); g.fill();
    scritta('Casa di Papi', sx(CASA.x) - 70, sy(CASA.z) + 16, '#f0a39a');
  }
  const foglio = (x, y, bordo) => { g.fillStyle = '#efeadb'; g.strokeStyle = bordo; g.lineWidth = 1.5; g.beginPath(); g.rect(x - 3 * u, y - 4 * u, 6 * u, 8 * u); g.fill(); g.stroke(); };
  for (const f of FOGLI) if (f.preso) foglio(sx(f.x), sy(f.z), '#1a1812');
  // i fogli che il GPS ha visto nel cerchio: restano segnati per 15 secondi
  const batti = 0.5 + 0.5 * Math.sin(t * 6);
  for (const v of GPS.rivelati) {
    const x = sx(v.f.x), y = sy(v.f.z);
    g.strokeStyle = `rgba(226,87,74,${0.35 + batti * 0.65})`; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, (7 + batti * 5) * u, 0, 6.3); g.stroke();
    foglio(x, y, '#e2574a');
  }
  // tu: se il GPS prende, pallino e direzione; se no, l'ultima posizione e un cerchio che si allarga
  const px = sx(tel.ux), py = sy(tel.uz);
  if (tel.fix) {
    const av = avanti(), ang = Math.atan2(av.z, av.x);
    g.fillStyle = 'rgba(86,160,255,.3)'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, 26 * u, ang - 0.5, ang + 0.5); g.closePath(); g.fill();
    g.fillStyle = '#4c9bff'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, 4.5 * u, 0, 6.3); g.fill(); g.stroke();
  } else {
    const inc = Math.min(HALF, 8 + (t - tel.tUltimo) * 1.4) / campo * S;
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(233,228,214,.65)'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, inc, 0, 6.3); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#8b8f88'; g.strokeStyle = '#e9e4d6'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 4 * u, 0, 6.3); g.fill(); g.stroke();
  }
  // il nord e la scala
  g.fillStyle = 'rgba(8,10,9,.75)'; g.beginPath(); g.arc(S - 18, 18, 13, 0, 6.3); g.fill();
  g.fillStyle = '#e9e4d6'; g.beginPath(); g.moveTo(S - 18, 7); g.lineTo(S - 12, 20); g.lineTo(S - 24, 20); g.closePath(); g.fill();
  const metri = tel.zoom ? 200 : 50, lung = metri / campo * S;
  g.strokeStyle = '#e9e4d6'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 9); g.lineTo(8, 15); g.lineTo(8 + lung, 15); g.lineTo(8 + lung, 9); g.stroke();
  scritta(metri + ' m', 13 + lung, 12, '#e9e4d6', 15);
  g.restore();
  // sotto la carta: la quota, e da quanto non sa dove sei
  g.textAlign = 'left'; font(19); g.fillStyle = '#e9e4d6'; g.fillText(`Quota ${Math.round(q)} m`, 9, M0 + S + 24);
  const fa = Math.floor((t - tel.tUltimo) / 60);
  if (!tel.fix) { font(15); g.fillStyle = '#9a968b'; g.fillText('Ultima posizione:', 9, M0 + S + 52); g.fillText(fa < 1 ? 'meno di 1 min fa' : fa === 1 ? '1 minuto fa' : fa + ' minuti fa', 9, M0 + S + 72); }
  TEL3D.tex.needsUpdate = true;
}
$('t-mappa').addEventListener('touchstart', e => { e.preventDefault(); apriTelefono(); });

/* ════════ POWER-UP (i punti li ha messi Leo sulla mappa disegnabile) ════════
   power bank +15% al telefono; l'aggeggio de Vito: GPS sempre; corndog: due minuti di fiato che dura
   il doppio; drummini: due minuti di passi più leggeri, Papi ti nota meno. */
const POWER_POS = {
  powerbank: [[-257, 249], [-117, 195], [-204, 32], [-253, 24], [78, 224], [272, -1], [9, 84], [214, 165], [-120, -152], [69, -108]],
  aggeggio: [[321, -223]],
  corndog: [[-167, 144], [243, -71]],
  drummini: [[-189, 219], [153, 16], [-230, -79], [-44, -43]],
};
const POWER_NOMI = { powerbank: 'il power bank', aggeggio: "l'aggeggio de Vito", corndog: 'il corndog', drummini: 'le pantofole' };
const POWER = [];
const COLORE_POWER = { powerbank: 0x5a8cff, aggeggio: 0xff6050, corndog: 0xffb050, drummini: 0x6a8cff };
let _texAlone = null;
function texAlone() {
  if (_texAlone) return _texAlone;
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c2.fillStyle = gr; c2.fillRect(0, 0, 32, 32);
  _texAlone = new THREE.CanvasTexture(cv); _texAlone.generateMipmaps = false; _texAlone.minFilter = THREE.LinearFilter;
  return _texAlone;
}
function creaPowerUp() {
  const mat = (c, e = 0x000000) => ps1(new THREE.MeshLambertMaterial({ color: c, emissive: e }));
  const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const modelli = {
    powerbank: () => { const g = new THREE.Group(); box(g, 0.13, 0.035, 0.24, mat(0x161718, 0x070707)); box(g, 0.02, 0.012, 0.012, mat(0x2a6cff, 0x2a6cff), 0.04, 0.02, 0.1); return g; },
    aggeggio: () => {
      const g = new THREE.Group(); box(g, 0.3, 0.14, 0.22, mat(0x464843, 0x080808));
      const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), mat(0xb0b0a8)); asta.position.set(0.08, 0.42, 0); g.add(asta);
      const piatto = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.06, 8, 1, true), ps1(new THREE.MeshLambertMaterial({ color: 0xc8c8c0, emissive: 0x111111, side: THREE.DoubleSide })));
      piatto.position.set(-0.06, 0.2, 0); piatto.rotation.z = 0.9; g.add(piatto);
      g.userData.led = box(g, 0.03, 0.03, 0.03, new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0.08, 0.79, 0);
      return g;
    },
    corndog: () => {
      const g = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4), mat(0xc9a66b)); st.position.y = -0.06; g.add(st);
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.15, 3, 6), mat(0xb8742c, 0x140a02)); c.position.y = 0.1; g.add(c);
      box(g, 0.012, 0.15, 0.03, mat(0xe8c020, 0x302400), 0.043, 0.1, 0);   // la senape
      return g;
    },
    drummini: () => {
      const g = new THREE.Group();
      for (const x of [-0.07, 0.07]) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 3, 6), mat(0x2a4c9a, 0x050a18)); s.rotation.x = Math.PI / 2; s.scale.set(1, 1, 0.55); s.position.x = x; g.add(s); }
      return g;
    },
  };
  for (const [tipo, lista] of Object.entries(POWER_POS)) for (const [x0, z0] of lista) {
    let x = Math.max(-LIMITE + 2, Math.min(LIMITE - 2, x0)), z = Math.max(-LIMITE + 2, Math.min(LIMITE - 2, z0));
    tronchiVicini(x, z, 2, tr => { const d = Math.hypot(x - tr.x, z - tr.z), m = tr.r + 0.7; if (d < m) { const k = m / (d || 1); x = tr.x + (x - tr.x) * k; z = tr.z + (z - tr.z) * k; } });
    const g = modelli[tipo](); g.scale.setScalar(1.5);
    // un filo di luce: un alone appena accennato e i colori che si accendono un poco
    g.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.lerp(o.material.color, 0.18); });
    const alone = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAlone(), color: COLORE_POWER[tipo], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.22 }));
    alone.scale.setScalar(0.75); g.add(alone);
    g.position.set(x, quota(x, z) + 0.55, z); scena.add(g);
    POWER.push({ tipo, g, x, z, preso: false, fase: Math.random() * 6 });
  }
}
function animaPowerUp(t) {
  for (const pu of POWER) if (!pu.preso && Math.abs(pu.x - io.x) < 40 && Math.abs(pu.z - io.z) < 40) {
    pu.g.rotation.y = t * 1.2 + pu.fase; pu.g.position.y = quota(pu.x, pu.z) + 0.55 + Math.sin(t * 2 + pu.fase) * 0.06;
    if (pu.g.userData.led) pu.g.userData.led.visible = (t * 1.5 + pu.fase) % 1 < 0.5;
  }
}
function prendiPowerUp(pu) {
  pu.preso = true; pu.g.visible = false;
  suono('colpo', 0.12, 1.8, 'foglio');
  if (pu.tipo === 'powerbank') { io.batteria = Math.min(1, io.batteria + 0.15); didascalia(`Power bank: telefono al ${Math.ceil(io.batteria * 100)}%.`, 3500); }
  if (pu.tipo === 'aggeggio') { io.aggeggio = true; GPS.tFinto = 0; didascalia("L'aggeggio de Vito: il GPS adesso prende dappertutto.", 4500); }
  if (pu.tipo === 'corndog') { io.tCorndog = 120; didascalia('Corndog: per due minuti il fiato dura il doppio.', 4000); }
  if (pu.tipo === 'drummini') { io.tDrummini = 120; didascalia('Pantofole: per due minuti fai meno rumore.', 4000); }
}

/* ════════ LE STATUETTE DI GUERRINO ════════
   (Leo, 17/11) Ogni foglio che prendi lo puoi scambiare con Guerrino per una statuetta sua: lui in A-pose,
   di metallo, su un piedistallo. La pianti a terra una volta sola e lì resta: fa un po' di luce e Papi non
   s'avvicina, come alla Fonticella. Vicino alla statuetta il GPS prende sempre e il telefono non si scarica.
   Lo scambio e la statuetta piantata sono i checkpoint (e il salvataggio). */
const STATUA_R = 10;   // metri: la zona che protegge
const STATUE = { modello: null, mat: null, piantate: [], luci: [], alone: null };
function vicinoStatua(x = io.x, z = io.z, extra = 0) { return STATUE.piantate.some(s => Math.hypot(x - s.x, z - s.z) < STATUA_R + extra); }
// due luci in tutto, che stanno sulle due statuette più vicine (così gli shader non cambiano mai)
function creaLuciStatue() {
  for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffc27a, 0, 9, 1.4); scena.add(l); STATUE.luci.push(l); }
}
// il riflesso del metallo: un cielo finto di notte con un paio di lumi caldi
function texRiflesso() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#1c2433'); gr.addColorStop(0.45, '#56607a'); gr.addColorStop(0.52, '#2a2a24'); gr.addColorStop(1, '#0c0a08');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
  for (const [x, y, r, c] of [[30, 22, 7, '#ffd9a0'], [92, 26, 5, '#ffe8c0'], [64, 12, 9, '#9fb4d8']]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function creaStatuette(m) {
  STATUE.modello = m.scene;
  STATUE.mat = ps1(new THREE.MeshStandardMaterial({ color: 0xc9a066, metalness: 1, roughness: 0.3, envMap: texRiflesso(), envMapIntensity: 1.1, emissive: 0x1e1406 }));
  m.scene.traverse(o => { if (o.isMesh) { o.material = STATUE.mat; o.frustumCulled = true; } });
  STATUE.alone = new THREE.SpriteMaterial({ map: texAlone(), color: 0xffc27a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
}
function mettiStatua(x, z, rot) {
  const g = new THREE.Group();
  if (STATUE.modello) g.add(STATUE.modello.clone());
  const al = new THREE.Sprite(STATUE.alone); al.scale.setScalar(1.1); al.position.y = 0.4; g.add(al);
  g.position.set(x, quota(x, z), z); g.rotation.y = rot; g.scale.setScalar(1.4); scena.add(g);   // 80 cm col piedistallo
  STATUE.piantate.push({ x, z, rot, g });
}
function togliStatue() { for (const s of STATUE.piantate) scena.remove(s.g); STATUE.piantate.length = 0; }
function aggiornaStatue(t) {
  // le luci sulle due più vicine, con un respiro lento
  const vicine = STATUE.piantate.map(s => [Math.hypot(s.x - io.x, s.z - io.z), s]).sort((a, b) => a[0] - b[0]);
  STATUE.luci.forEach((l, i) => {
    const v = vicine[i];
    if (!v || v[0] > 70) { l.intensity = 0; return; }
    l.position.set(v[1].x, quota(v[1].x, v[1].z) + 1.3, v[1].z);
    l.intensity = 2.2 + Math.sin(t * 1.3 + i) * 0.25;
  });
}
function mostraStatuette() {
  const el = $('statuette'); if (!el) return;
  el.innerHTML = `Statuette <b>${io.statuette}</b>`;
  mostra('statuette', io.statuette > 0);
  mostra('t-statua', io.statuette > 0 && TOCCO && fase === 'gioco');
}
// Guerrino: ogni foglio che non gli hai ancora dato diventa una statuetta
function scambiaConGuerrino() {
  const da = io.fogli - io.scambiati;
  if (da <= 0 || !guerrino.mena || storia === 'casa') return;
  io.scambiati += da; io.statuette += da;
  suono('colpo', 0.14, 1.5, 'foglio');
  dici(da > 1 ? pesca(BATTUTE.statuette) : pesca(BATTUTE.statuetta));
  setTimeout(() => didascalia(`${da > 1 ? da + ' statuette' : 'Una statuetta'} de Guerrino. ${tasto('statuetta')} per piantarla: lì Papi nun s'avvicina.`, 5000), 1200);
  mostraStatuette();
  checkpoint();
}
function piantaStatuetta() {
  if (fase !== 'gioco' || io.statuette <= 0 || storia === 'casa' || dentroCasa()) return;
  const av = avanti(), x = io.x + av.x * 1.3, z = io.z + av.z * 1.3;
  if (distFosso(x, z) < 1.6 || sulPonte(x, z) !== null || Math.abs(x) > LIMITE - 2 || Math.abs(z) > LIMITE - 2) { didascalia('Qui no: cerca un pezzo di terra.', 2500); return; }
  if (STATUE.piantate.some(s => Math.hypot(s.x - x, s.z - z) < 2)) { didascalia("Ce n'è già una qui.", 2500); return; }
  io.statuette--;
  mettiStatua(x, z, Math.atan2(io.x - x, io.z - z));
  suono('colpo', 0.35, 0.7, 'foglio'); suono('frasche', 0.2, 1.4, 'foglio');
  didascalia('Statuetta piantata. Qui Papi lascia perdere, il GPS prende e il telefono non si scarica.', 5000);
  mostraStatuette();
  checkpoint();
}

/* ════════ CHECKPOINT E SALVATAGGIO ════════
   Il checkpoint è una foto della partita: se muori ricominci da lì, se chiudi e rientri riparti da lì
   ("Continua" nel menu). Il tempo della run invece corre sempre: è il record. In Incubo chi muore
   ricomincia da capo, ma se chiudi e rientri riparti dal checkpoint. */
const SALVA = 'residentcrevil.partita';
let CHECK = null;
function leggiSalvataggio() { try { const s = JSON.parse(localStorage.getItem(SALVA) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
function scriviSalvataggio() { if (!CHECK) return; try { localStorage.setItem(SALVA, JSON.stringify({ ...CHECK, tempo: io.tempo, morti: io.morti })); } catch (e) {} }
function cancellaSalvataggio() { CHECK = null; try { localStorage.removeItem(SALVA); } catch (e) {} }
function checkpoint(x = io.x, z = io.z) {
  CHECK = {
    v: 1, modo: MODO, storia: storia === 'solo' ? 'solo' : 'caccia', attesa, tCaccia, x, z, yaw: io.yaw,
    batteria: io.batteria, fogli: io.fogli, tuttiFogli: !!io.tuttiFogli, roncola: !!io.roncola, aggeggio: !!io.aggeggio,
    statuette: io.statuette, scambiati: io.scambiati,
    fogliPresi: FOGLI.map((f, i) => f.preso ? i : -1).filter(i => i >= 0),
    powerPresi: POWER.map((p, i) => p.preso ? i : -1).filter(i => i >= 0),
    piantate: STATUE.piantate.map(s => [+s.x.toFixed(2), +s.z.toFixed(2), +s.rot.toFixed(2)]),
    casa: CASA.aperta, bossVita: BOSS.vita,
  };
  io.check = { x, z };
  scriviSalvataggio();
}
// Guerrino già all'albero, a menare (per chi riparte da un checkpoint)
function guerrinoAllAlbero(t) {
  const tr = alberoDiGuerrino(); guerrino.albero = tr;
  if (tr) { const giro = daFonte(-1.7, 1.1), dx = giro[0] - tr.x, dz = giro[1] - tr.z, d = Math.hypot(dx, dz) || 1, rr = tr.r + 0.55; guerrino.x = tr.x + dx / d * rr; guerrino.z = tr.z + dz / d * rr; }
  guerrino.fase = 6; guerrino.riposo = 0; guerrino.tMena = 0; guerrino.zitto = false; guerrino.detto = true;
  guerrino.mena = true; guerrino.mossa = -1; guerrino.corrente = null; guerrino.prossimo = t + 10;
  if (guerrino.roncola) guerrino.roncola.visible = !io.roncola;
  disegna(guerrino);
}
function ripristina(S, t) {
  MODO = S.modo === 'incubo' ? 'incubo' : 'normale';
  Object.assign(io, { x: S.x, z: S.z, yaw: S.yaw, pitch: -0.05, batteria: S.batteria, fogli: S.fogli, tuttiFogli: S.tuttiFogli, roncola: S.roncola, aggeggio: S.aggeggio,
    statuette: S.statuette, scambiati: S.scambiati, fiato: 1, sfinito: false, alto: 0, vy: 0, giu: false, tCorndog: 0, tDrummini: 0, check: { x: S.x, z: S.z } });
  FOGLI.forEach((f, i) => { f.preso = S.fogliPresi.includes(i); f.m.visible = !f.preso; });
  POWER.forEach((p, i) => { p.preso = S.powerPresi.includes(i); p.g.visible = !p.preso; });
  GPS.rivelati = []; GPS.tFinto = 0;
  togliStatue(); for (const [x, z, rot] of S.piantate) mettiStatua(x, z, rot);
  ui.fogli.innerHTML = `Fogli <b>${io.fogli}</b>/10`;
  mostraStatuette();
  storia = S.storia; tStoria = 0; attesa = S.attesa; tCaccia = S.tCaccia;
  guerrinoAllAlbero(t);
  coda.length = 0; parlando = null;
  viaPapi(true); papi.stato = 'assente'; papi.prossimo = t + 30;
  for (const p of [caro, bimba]) if (p.mixer) viaFiglio(p, t, 40);
  if (S.casa) apriPorta(true);
  BOSS.vita = Math.min(BOSS.vita, S.bossVita ?? 5);
  CHECK = S;
}
let tEffetti = 0;
function aggiornaEffetti(dt) {
  io.tCorndog = Math.max(0, (io.tCorndog || 0) - dt); io.tDrummini = Math.max(0, (io.tDrummini || 0) - dt);
  if ((tEffetti -= dt) > 0) return;
  tEffetti = 0.5;
  const parti = [];
  if (io.tCorndog > 0) parti.push('Corndog ' + mmss(Math.ceil(io.tCorndog)));
  if (io.tDrummini > 0) parti.push('Pantofole ' + mmss(Math.ceil(io.tDrummini)));
  if (io.aggeggio) parti.push('GPS de Vito');
  if (io.roncola) parti.push('Roncola');
  ui.effetti.textContent = parti.join(' · ');
}

/* ════════ LA CASA DI PAPI ════════
   Gotica, coi tetti a punta e le guglie, in cima verso levante (Leo l'ha messa a 310, −22: la sposto
   un po' a ponente perché il bordo della mappa è a 307). Chiusa finché non hai i dieci fogli e non li hai
   dati a Guerrino in cambio della roncola. Dentro, una sala sola: i lettini dei "fiji", e Papi. */
const CASA = { x: 294, z: -22, aperta: false, tDetto: 0 };
CASA.porta = [CASA.x - 7.6, CASA.z]; CASA.fuori = [CASA.x - 9.5, CASA.z]; CASA.dentro = [CASA.x - 4.5, CASA.z];
function vicinoCasa(x, z) { return Math.abs(x - CASA.x) < 15 && Math.abs(z - CASA.z) < 18; }
function dentroCasa(x = io.x, z = io.z) { return x > CASA.x - 5.6 && x < CASA.x + 6 && Math.abs(z - CASA.z) < 8; }
function dentroSala(p) { p.x = Math.max(CASA.x - 5, Math.min(CASA.x + 5, p.x)); p.z = Math.max(CASA.z - 7, Math.min(CASA.z + 7, p.z)); }
function muroCasa(x0, z0, x1, z1) {
  const c = { pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], minx: Math.min(x0, x1), maxx: Math.max(x0, x1), minz: Math.min(z0, z1), maxz: Math.max(z0, z1) };
  CASE.push(c); return c;
}
function creaCasa() {
  const y0 = quota(CASA.x, CASA.z), X = CASA.x, Z = CASA.z, H = 6.5;
  const rip = (t, sx, sy) => { const c = t.clone(); c.repeat.set(sx, sy); c.needsUpdate = true; return c; };
  const pietra = ps1(new THREE.MeshLambertMaterial({ map: rip(TEX.muro, 4, 2), color: 0x7d776d }));
  const ardesia = ps1(new THREE.MeshLambertMaterial({ map: rip(TEX.tetto, 5, 4), color: 0x3a3b40 }));
  const legno = ps1(new THREE.MeshLambertMaterial({ color: 0x2b1e15 }));
  const pavimento = ps1(new THREE.MeshLambertMaterial({ map: rip(TEX.ciottoli, 6, 8), color: 0x4a4038 }));
  const lenzuola = ps1(new THREE.MeshLambertMaterial({ color: 0x8c8676 }));
  const tappeto = ps1(new THREE.MeshLambertMaterial({ color: 0x3a0d0c }));
  const carta = ps1(new THREE.MeshLambertMaterial({ map: texFoglio(), color: 0x9a968c, emissive: 0x141210, side: THREE.DoubleSide }));
  const cera = ps1(new THREE.MeshLambertMaterial({ color: 0xd8d0b8, emissive: 0x2a2418 }));
  const fiamma = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const vetro = new THREE.MeshBasicMaterial({ color: 0x6a200e, side: THREE.DoubleSide });   // luce di candela dalle finestre
  const g = new THREE.Group(); g.position.set(X, y0, Z); scena.add(g);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  // basamento, pavimento e muri; la porta a ponente, verso il bosco
  box(13.6, 1.4, 17.6, pietra, 0, -0.6, 0);
  box(12, 0.12, 16, pavimento, 0, 0.12, 0);
  box(0.4, H, 16.8, pietra, 6.2, H / 2, 0);
  box(12.8, H, 0.4, pietra, 0, H / 2, -8.2); box(12.8, H, 0.4, pietra, 0, H / 2, 8.2);
  box(0.4, H, 7.2, pietra, -6.2, H / 2, -4.8); box(0.4, H, 7.2, pietra, -6.2, H / 2, 4.8);
  box(0.4, H - 3.4, 2.4, pietra, -6.2, 3.4 + (H - 3.4) / 2, 0);
  // il tetto ripidissimo; i frontoni a punta davanti (sopra la porta) e dietro
  const Lt = Math.hypot(8.6, 7), at = Math.atan2(7, 8.6);
  for (const s of [-1, 1]) { const b = box(13.6, 0.3, Lt + 0.4, ardesia, 0, H + 3.5, s * 4.3); b.rotation.x = s * at; }
  const tri = new THREE.Shape([new THREE.Vector2(-8.6, 0), new THREE.Vector2(8.6, 0), new THREE.Vector2(0, 7)]);
  const geoTri = new THREE.ExtrudeGeometry(tri, { depth: 0.4, bevelEnabled: false });
  for (const x of [-6.4, 6.0]) { const m = new THREE.Mesh(geoTri, pietra); m.position.set(x, H, 0); m.rotation.y = Math.PI / 2; g.add(m); }
  // le guglie: due torri tonde ai lati della porta, una in mezzo al tetto, i pinnacoli sui frontoni
  const cono = (r, h, seg, m, x, y, z, ry = 0) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); c.position.set(x, y, z); c.rotation.y = ry; g.add(c); return c; };
  for (const z of [-8.8, 8.8]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 11.5, 8), pietra); t.position.set(-6.8, 5.1, z); g.add(t);
    cono(2, 8, 8, ardesia, -6.8, 14.85, z);
    cono(0.12, 1.8, 4, legno, -6.8, 19.7, z);
    muroCasa(X - 8.5, Z + z - 1.7, X - 5.1, Z + z + 1.7);
  }
  box(1.6, 3, 1.6, ardesia, 1.6, H + 6.2, 0);
  cono(1.25, 7, 4, ardesia, 1.6, H + 11.2, 0, Math.PI / 4);
  cono(0.1, 1.6, 4, legno, 1.6, H + 15.4, 0);
  for (const x of [-6.2, 6.2]) cono(0.35, 2.6, 4, ardesia, x, H + 8.1, 0, Math.PI / 4);
  // finestre a sesto acuto, accese da dentro
  const arco = new THREE.Shape(); arco.moveTo(-0.45, 0); arco.lineTo(0.45, 0); arco.lineTo(0.45, 1.3);
  arco.quadraticCurveTo(0.45, 1.85, 0, 2.2); arco.quadraticCurveTo(-0.45, 1.85, -0.45, 1.3); arco.closePath();
  const geoArco = new THREE.ShapeGeometry(arco, 4);
  const finestra = (x, y, z, ry) => { const m = new THREE.Mesh(geoArco, vetro); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
  for (const x of [-3.2, 0, 3.2]) { finestra(x, 2, 8.41, 0); finestra(x, 2, 7.99, 0); finestra(x, 2, -8.41, Math.PI); finestra(x, 2, -7.99, Math.PI); }
  for (const z of [-3.5, 3.5]) { finestra(6.41, 2, z, Math.PI / 2); finestra(5.99, 2, z, Math.PI / 2); }
  for (const z of [-4.6, 4.6]) { finestra(-6.41, 2, z, -Math.PI / 2); finestra(-5.99, 2, z, -Math.PI / 2); }
  for (const z of [-8.8, 8.8]) finestra(-8.35, 6.5, z, -Math.PI / 2);
  for (const x of [-6.42, 6.42]) { const m = new THREE.Mesh(geoArco, vetro); m.scale.set(1.4, 1.4, 1); m.position.set(x, H + 1.3, 0); m.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(m); }   // le finestre grandi sui frontoni
  // dentro: quattro colonne, il tappeto, i lettini dei "fiji" in fondo, candele, disegni attaccati ai muri
  for (const px of [-2.5, 1.5]) for (const pz of [-3.6, 3.6]) { box(0.7, H, 0.7, pietra, px, H / 2, pz); muroCasa(X + px - 0.35, Z + pz - 0.35, X + px + 0.35, Z + pz + 0.35); }
  box(9, 0.02, 3, tappeto, -0.5, 0.19, 0);
  for (const bz of [-6, -3.6, 3.6, 6]) {
    box(1.7, 0.4, 0.9, legno, 4.9, 0.38, bz); box(1.5, 0.1, 0.8, lenzuola, 4.9, 0.63, bz); box(0.3, 0.12, 0.6, lenzuola, 5.5, 0.72, bz);
    muroCasa(X + 4.05, Z + bz - 0.45, X + 5.75, Z + bz + 0.45);
  }
  const candele = [[3.6, -7.5], [3.6, 7.5], [5.8, -4.8], [5.8, 4.8], [5.8, 0.9], [5.8, -0.9], [-5.6, -7.5], [-5.6, 7.5], [0, -7.6], [0, 7.6]];
  for (const [cx, cz] of candele) { box(0.07, 0.22, 0.07, cera, cx, 0.29, cz); box(0.045, 0.07, 0.045, fiamma, cx, 0.44, cz); }
  const r = rand(616);
  for (let i = 0; i < 14; i++) {
    const lato = i % 2 ? 1 : -1, m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), carta);
    m.position.set(-4.5 + r() * 9.5, 1.2 + r() * 1.3, lato * 7.98); m.rotation.set(0, lato > 0 ? Math.PI : 0, (r() - 0.5) * 0.4); g.add(m);
  }
  // la porta, sul cardine
  const perno = new THREE.Group(); perno.position.set(-6.2, 0.18, -1.2); g.add(perno);
  const anta = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 2.4), legno); anta.position.set(0, 1.7, 1.2); perno.add(anta);
  CASA.porta3d = perno;
  // muri per chi cammina
  muroCasa(X + 6.0, Z - 8.4, X + 6.4, Z + 8.4);
  muroCasa(X - 6.4, Z - 8.4, X + 6.4, Z - 8.0); muroCasa(X - 6.4, Z + 8.0, X + 6.4, Z + 8.4);
  muroCasa(X - 6.4, Z - 8.4, X - 6.0, Z - 1.2); muroCasa(X - 6.4, Z + 1.2, X - 6.0, Z + 8.4);
  CASA.muroPorta = muroCasa(X - 6.4, Z - 1.2, X - 6.0, Z + 1.2);
  // la luce delle candele (accesa solo quando sei nei paraggi)
  CASA.lume = new THREE.PointLight(0xff7a3a, 0, 16, 1.6); CASA.lume.position.set(X + 3, y0 + 2.4, Z); scena.add(CASA.lume);
}
function apriPorta(zitto) {
  if (CASA.aperta) return;
  CASA.aperta = true;
  const i = CASE.indexOf(CASA.muroPorta); if (i >= 0) CASE.splice(i, 1);
  if (!zitto) { suono('scricchiolio', 0.5, 0.6, 'papiVersi'); didascalia('La porta si apre da sola.', 3500); }
}
function chiudiPorta() {
  if (!CASA.aperta) return;
  CASA.aperta = false; CASE.push(CASA.muroPorta);
  suono('colpo', 0.5, 0.5, 'papiVersi');
}

/* ── la roncola: Guerrino te la dà in cambio dei dieci fogli ── */
const RONCOLA = { g: null, t: -1, colpito: false, y0: 0 };
function creaRoncolaMia(r) {
  const c = r.clone(true);
  c.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: 0x77736b }); o.frustumCulled = false; } });
  c.position.set(0, -1.65, 0);
  const giro = new THREE.Group(); giro.add(c); giro.rotation.set(Math.PI, Math.PI / 2, 0); giro.scale.setScalar(0.16);
  const g = new THREE.Group(); g.add(giro);
  g.position.set(0.3, -0.3, -0.46); g.rotation.set(0, 0, -0.35); g.visible = false; camera.add(g);
  RONCOLA.g = g; RONCOLA.y0 = g.position.y;
}
function dammiRoncola() {
  io.roncola = true;
  if (guerrino.roncola) guerrino.roncola.visible = false;
  setTimeout(() => didascalia(`Hai la roncola: ${tasto('mena')} per menare.`, 4500), 7000);
}
function colpisci() {
  if (!io.roncola || RONCOLA.t >= 0 || tel.aperto || fase !== 'gioco') return;
  RONCOLA.t = 0; RONCOLA.colpito = false;
  suono('frasche', 0.16, 2.0, 'colpi');
}
function animaRoncola(dt) {
  const r = RONCOLA.g; if (!r) return;
  r.visible = !!io.roncola && !tel.aperto;
  // il telefono sta nella destra: con la torcia accesa la roncola passa alla sinistra
  const sx = TEL3D.su > 0.3 ? -1 : 1;
  r.position.x += (0.3 * sx - r.position.x) * Math.min(1, dt * 8); r.rotation.z = -0.35 * sx; r.scale.x = sx;
  let a = 0;
  if (RONCOLA.t >= 0) {
    const k = RONCOLA.t += dt;
    a = k < 0.12 ? -k / 0.12 * 0.6 : k < 0.28 ? -0.6 + (k - 0.12) / 0.16 * 2.2 : Math.max(0, 1.6 - (k - 0.28) / 0.32 * 1.6);
    if (k > 0.2 && !RONCOLA.colpito) { RONCOLA.colpito = true; colpoAndato(); }
    if (k > 0.6) RONCOLA.t = -1;
  }
  r.rotation.x = -a;
  r.position.y = RONCOLA.y0 + Math.sin(io.dondolo) * 0.012 * Math.min(1, io.vel);
}
function colpoAndato() {
  const dx = papi.x - io.x, dz = papi.z - io.z, d = Math.hypot(dx, dz), av = avanti();
  if (!papi.g.visible || d > 3.9 || (dx * av.x + dz * av.z) / (d || 1) < 0.45) return;
  suono('ron' + (Math.random() * 12 | 0), 0.9, 0.85, 'colpi');
  if (storia === 'casa') {
    if (BOSS.stato === 'morto') return;
    BOSS.vita--; BOSS.t = 0; staticoOb = 0.8;
    versoPapi('scricchiolio', 1, 0.5 + Math.random() * 0.2);
    if (BOSS.vita <= 0) { BOSS.stato = 'morto'; papi.presV = 0; didascalia('Papi crolla. La ninna nanna si ferma.', 5000); }
    else { BOSS.stato = 'colpito'; papiInPiedi(0.1); didascalia(['Ancora.', "Non s'arrende.", 'Barcolla.', 'Un altro.'][4 - BOSS.vita] || '', 1800); }
  } else if (papi.stato !== 'assente') sparisce(tGioco, 20);   // fuori: lo scacci per un po'
}

/* ── il boss: Papi in fondo alla sala. Ti guarda, poi ti viene addosso a quattro zampe, sempre più
   svelto; la torcia addosso lo rallenta. Cinque colpi di roncola e crolla. Se ti prende, riparti fuori
   dalla porta (i colpi dati restano). */
const BOSS = { vita: 5, stato: 'fermo', t: 0 };
function entraCasa(t) {
  storia = 'casa'; checkpoint(CASA.fuori[0], CASA.fuori[1]);
  BOSS.stato = 'fermo'; BOSS.t = 0;
  posa(papi, CASA.x + 4.2, CASA.z, -Math.PI / 2);
  papiInPiedi(0.05); mostraPapi(); papi.stato = 'boss'; papi.visto = true; papi.giu = false;
  staticoOb = 0;
  didascalia('«Sei venuto a giocà coi fiji mia?»', 4500);
  versoPapi('scricchiolio', 1, 0.55);
}
function aggiornaBoss(dt, t) {
  BOSS.t += dt;
  if (CASA.aperta && io.x > CASA.x - 4.4) chiudiPorta();   // la porta ti si chiude alle spalle
  const dx = io.x - papi.x, dz = io.z - papi.z, d = Math.hypot(dx, dz) || 0.01, verso = Math.atan2(dx, dz);
  papi.vis = visibileDaMe(papi, 30, 2);
  papi.vel = 0;
  staticoOb = BOSS.stato === 'carica' ? Math.max(0, 1 - d / 9) * 0.3 : 0;
  if (BOSS.stato === 'fermo') {
    giraVerso(verso, dt, 3, papi); disegna(papi);
    if (BOSS.t > (BOSS.vita === 5 ? 3.5 : 1.6)) { BOSS.stato = 'carica'; BOSS.t = 0; recita(papi, 'gattona', true, 0.3); versoPapi('frasche', 1, 0.7); }
  } else if (BOSS.stato === 'carica') {
    const v = (2.3 + (5 - BOSS.vita) * 0.45) * (io.torcia && papi.vis > 0 ? 0.7 : 1);
    papi.x += dx / d * v * dt; papi.z += dz / d * v * dt; papi.vel = v;
    dentroSala(papi);
    giraVerso(verso, dt, 6, papi); disegna(papi);
    if (d < 2.1) preso();
  } else if (BOSS.stato === 'colpito') {
    if (BOSS.t > 0.5 && d < 9) { papi.x -= dx / d * 3.5 * dt; papi.z -= dz / d * 3.5 * dt; dentroSala(papi); }
    giraVerso(verso, dt, 3, papi); disegna(papi);
    if (BOSS.t > 2) { BOSS.stato = 'fermo'; BOSS.t = 0; }
  } else if (BOSS.stato === 'morto') {
    disegna(papi);
    if (BOSS.t > 3 && fase === 'gioco') vittoria();
  }
}
// la fine: dieci fogli a Guerrino, la roncola, la porta, la sala
function aggiornaFinale(dt, t) {
  if (io.tuttiFogli && !io.roncola && Math.hypot(io.x - guerrino.x, io.z - guerrino.z) < 4) { dammiRoncola(); BATTUTE.roncola.forEach(b => dici(b)); }
  if (!CASA.aperta && storia !== 'casa' && Math.hypot(io.x - CASA.porta[0], io.z - CASA.porta[1]) < 4) {
    if (io.roncola) apriPorta();
    else if (t > CASA.tDetto) { CASA.tDetto = t + 8; didascalia(io.tuttiFogli ? 'Chiusa. Prima porta i fogli a Guerrino.' : 'La porta è chiusa. Da dentro si sente una ninna nanna.', 4000); }
  }
  if (storia === 'caccia' && CASA.aperta && dentroCasa()) entraCasa(t);
  CASA.porta3d.rotation.y += ((CASA.aperta ? 1.65 : 0) - CASA.porta3d.rotation.y) * Math.min(1, dt * 3);
  CASA.lume.intensity = Math.abs(io.x - CASA.x) < 40 && Math.abs(io.z - CASA.z) < 40 ? 3 + Math.sin(t * 11) * 0.3 + Math.sin(t * 3.7) * 0.2 : 0;
}

/* ════════ GIÙ DAL GREPPO ════════ */
function cadi() {
  if (fase !== 'gioco') return;
  fase = 'morto'; io.morti++; apriTelefono(false);
  io.pitch = -0.9;
  const parti = performance.now();
  // la caduta: lo sguardo va giù e il buio arriva
  (function giu() {
    const k = Math.min(1, (performance.now() - parti) / 700);
    camera.position.y -= 0.35 * k; camera.rotation.set(-0.9 - k * 0.5, io.yaw, k * 0.3, 'YXZ');
    if (k < 1) requestAnimationFrame(giu);
  })();
  suono('frasche', 0.6, 0.7, 'salto');
  setTimeout(() => { suono('giuS', 0.9, 0.6, 'salto'); ui.buio.style.opacity = 1; }, 650);
  setTimeout(() => mostraMorte('Sei cascato dal Greppo', pesca(BATTUTE.cascato)), 1300);
}
// lo schermo della morte, per Papi e per il Greppo; in Incubo si ricomincia da capo
function mostraMorte(titolo, frase) {
  $('morte-titolo').textContent = titolo;
  $('morte-frase').textContent = '«' + frase + '»';
  $('riprova').textContent = MODO === 'incubo' ? 'Ricomincia da capo' : "Riprova dall'ultimo checkpoint";
  document.body.classList.add('fuori'); mostra('morte', true);
  if (document.pointerLockElement) document.exitPointerLock();
}

/* ════════ NORMALE / INCUBO ════════ */
// In Incubo chi muore ricomincia da zero, e la classifica è un'altra
let MODO = 'normale';
try { if (localStorage.getItem('residentcrevil.modo') === 'incubo') MODO = 'incubo'; } catch (e) {}
function mostraModo() {
  const b = $('modo'); if (!b) return;
  b.innerHTML = `Difficoltà: <b>${MODO === 'incubo' ? 'Incubo' : 'Normale'}</b>`;
  b.classList.toggle('incubo', MODO === 'incubo');
  disegnaClassifica($('classifica-menu'));
}
$('modo').addEventListener('click', () => {
  MODO = MODO === 'incubo' ? 'normale' : 'incubo';
  try { localStorage.setItem('residentcrevil.modo', MODO); } catch (e) {}
  mostraModo();
});
mostraModo();

/* ════════ EVENTI A CASO: NEBBIA FITTA, TEMPORALE, IL TELEFONO CHE SQUILLA ════════ */
// Uno alla volta, ogni due o quattro minuti, solo nel bosco (non nella casa di Papi)
const EV = { prossimo: Infinity, attivo: null, t: 0, fine: 0, nebbia: 0, lampo: 0, tLampo: 0, tuoni: [], pioggia: null, squillo: null, tSquillo: 0 };
function programmaEvento(t) { EV.prossimo = t + (VELOCE ? 25 : 110) + Math.random() * (VELOCE ? 20 : 130); }
function aggiornaEventi(dt, t) {
  if ((storia === 'solo' || storia === 'caccia') && EV.prossimo === Infinity) programmaEvento(t);
  if (!EV.attivo && t > EV.prossimo && (storia === 'solo' || storia === 'caccia') && fase === 'gioco') {
    const scelte = ['nebbia', 'temporale'];
    if (io.batteria > 0 && !tel.aperto) scelte.push('telefono');
    lanciaEvento(scelte[Math.random() * scelte.length | 0], t);
  }
  // nebbia: sale in otto secondi, resta, se ne va
  const vuoleNebbia = EV.attivo === 'nebbia' && t < EV.fine ? 1 : 0;
  EV.nebbia += (vuoleNebbia - EV.nebbia) * Math.min(1, dt / 6);
  if (EV.attivo === 'temporale') aggiornaTemporale(dt, t);
  if (EV.attivo === 'telefono') aggiornaSquillo(dt, t);
  // il lampo: un colpo di luce che si spegne in fretta
  EV.lampo = Math.max(0, EV.lampo - dt * 6);
  if (EV.attivo && t > EV.fine && EV.nebbia < 0.02 && (EV.attivo !== 'temporale' || !EV.tuoni.length)) { EV.attivo = null; fermaPioggia(); programmaEvento(t); }
}
function lanciaEvento(cosa, t) {
  EV.attivo = cosa; EV.t = t;
  if (cosa === 'nebbia') { EV.fine = t + 60 + Math.random() * 40; didascalia('Sale una nebbia fitta.', 3500); }
  if (cosa === 'temporale') { EV.fine = t + 70 + Math.random() * 40; EV.tLampo = t + 4; avviaPioggia(); didascalia('Si mette a piovere.', 3500); }
  if (cosa === 'telefono') { EV.fine = t + 12; EV.tSquillo = 0; EV.persa = false; tel.tDis = 0; didascalia(INGRESSO === 'tocco' ? 'Ti chiama Papi. Tocca GPS per rifiutare.' : `Ti chiama Papi. ${tasto('telefono')} per rifiutare.`, 4500); }
}
// il temporale: pioggia (rumore filtrato) e lampi con il tuono che arriva dopo
function avviaPioggia() {
  const ctx = ascolto.context, len = ctx.sampleRate * 3, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let u = 0; for (let i = 0; i < len; i++) { u = u * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = u; } }
  const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.4;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.32 * mixG('temporale'), ctx.currentTime, 2.5);
  s.connect(f).connect(g).connect(ascolto.getInput()); s.start();
  EV.pioggia = { s, g };
}
function fermaPioggia() {
  if (!EV.pioggia) return;
  const { s, g } = EV.pioggia, ctx = ascolto.context;
  g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 2);
  setTimeout(() => { try { s.stop(); } catch (e) {} }, 9000);
  EV.pioggia = null;
}
function aggiornaTemporale(dt, t) {
  if (t > EV.fine && EV.pioggia) fermaPioggia();
  if (t < EV.fine && t > EV.tLampo) {
    EV.tLampo = t + 6 + Math.random() * 10;
    EV.lampo = 1; setTimeout(() => { EV.lampo = Math.max(EV.lampo, 0.7); }, 140);
    EV.tuoni.push(t + 0.6 + Math.random() * 2.6);
  }
  EV.tuoni = EV.tuoni.filter(q => { if (t < q) return true; tuono(); return false; });
}
function tuono() {
  const ctx = ascolto.context, n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / ctx.sampleRate, inv = Math.min(1, tt / 0.04) * Math.exp(-tt * 1.1) * (1 + 0.6 * Math.sin(tt * 7) * Math.sin(tt * 2.3));
    u += ((Math.random() * 2 - 1) - u) * 0.035; d[i] = u * 9 * inv;
  }
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = 0.8 + Math.random() * 0.3;
  const g = ctx.createGain(); g.gain.value = 0.9 * mixG('temporale');
  s.connect(g).connect(ascolto.getInput()); s.start();
}
// il telefono squilla: si sente da lontano (Papi arriva prima); aprendolo lo zittisci
function aggiornaSquillo(dt, t) {
  if (t > EV.fine || tel.aperto || io.batteria <= 0) {
    if (!EV.persa && io.batteria > 0) { EV.persa = true; didascalia('Chiamata persa: Papi.', 3000); }
    EV.fine = Math.min(EV.fine, t); if (!tel.aperto) tel.tDis = 0; return;
  }
  if ((EV.tSquillo -= dt) <= 0) { EV.tSquillo = 2.2; squilla(); }
  if (storia === 'caccia' && papi.stato === 'assente') papi.prossimo = Math.min(papi.prossimo, t + 4);
}
function squilla() {
  const ctx = ascolto.context, ora = ctx.currentTime;
  for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ora + k * 0.5 + i * 0.07;
    o.type = 'square'; o.frequency.value = i % 2 ? 1180 : 880;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05 * mixG('squillo'), t0 + 0.005); g.gain.setValueAtTime(0.05 * mixG('squillo'), t0 + 0.06); g.gain.linearRampToValueAtTime(0, t0 + 0.068);
    o.connect(g).connect(ascolto.getInput()); o.start(t0); o.stop(t0 + 0.08);
  }
}

/* ════════ STATI DEL GIOCO ════════ */
const PRESA = { t: -1, luce: new THREE.PointLight(0xc8d8b0, 0, 2.5, 2) };
PRESA.luce.position.set(0, -0.15, -0.05); camera.add(PRESA.luce);
function preso() {
  if (fase !== 'gioco') return;
  fase = 'morto'; io.morti++; apriTelefono(false);
  // dove sta lui: se sei di spalle (o di lato) la visuale ti viene girata a forza
  const a = Math.atan2(-(papi.x - io.x), -(papi.z - io.z));
  let dy = a - io.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  Object.assign(PRESA, { t: 0, yaw0: io.yaw, dy, pitch0: io.pitch, dietro: Math.abs(dy) > 1.1, fatto: false });
  PRESA.giro = PRESA.dietro ? 0.5 : 0.2;
  papi.g.visible = true; papi.pres = papi.presV = 1; papi.vel = 0; papi.stato = 'preso'; papi.nervoso = 0;
  papiGiu(0.12);   // si china su di te
  PRESA.d0 = Math.max(1.4, Math.min(3, Math.hypot(papi.x - io.x, papi.z - io.z)));
  suono('colpo', 0.6, 1, 'papiVersi'); suono('scricchiolio', 0.4, 1, 'papiVersi');
}
const _testa = new THREE.Vector3();
function animaPresa(dt) {
  if (PRESA.t < 0) return;
  const T = PRESA.t += dt, liscio = x => x * x * (3 - 2 * x);
  const kG = liscio(Math.min(1, T / PRESA.giro));
  // la testa girata a forza: svelta, con uno strattone
  const strappo = PRESA.dietro ? Math.sin(Math.min(1, T / PRESA.giro) * Math.PI) * 0.06 : 0;
  io.yaw = PRESA.yaw0 + PRESA.dy * kG;
  io.pitch = PRESA.pitch0 + (0.04 - PRESA.pitch0) * kG;
  camera.rotation.set(io.pitch + (Math.random() - 0.5) * strappo, io.yaw, (Math.random() - 0.5) * strappo * 2, 'YXZ');
  // lui: la faccia viene avanti fino a un palmo dalla tua
  const kV = liscio(Math.max(0, Math.min(1, (T - PRESA.giro * 0.4) / 0.9)));
  const dist = PRESA.d0 + (0.3 - PRESA.d0) * kV;   // a un palmo
  const fx = -Math.sin(PRESA.yaw0 + PRESA.dy), fz = -Math.cos(PRESA.yaw0 + PRESA.dy);
  papi.rot = Math.atan2(-fx, -fz);
  papi.g.rotation.set(0, papi.rot, 0);
  papi.g.updateMatrixWorld(true);
  if (papi.testa) {
    papi.testa.localToWorld(_testa.set(0, OCCHI[1], OCCHI[2] - 0.05));   // in mezzo agli occhi
    papi.g.position.x += camera.position.x + fx * dist - _testa.x;
    papi.g.position.z += camera.position.z + fz * dist - _testa.z;
    papi.g.position.y += camera.position.y - _testa.y;
  }
  papi.x = papi.g.position.x; papi.z = papi.g.position.z;
  // un filo di luce sul viso, man mano che si avvicina
  PRESA.luce.intensity = 1.1 * kV;
  if (T > PRESA.giro + 1.5 && !PRESA.fatto) {
    PRESA.fatto = true; ui.buio.style.opacity = 1;
    setTimeout(() => { PRESA.t = -1; PRESA.luce.intensity = 0; mostraMorte("Papi t'ha preso", pesca(BATTUTE.preso)); }, 700);
  }
}
function riprova() {
  if (MODO === 'incubo') { cancellaSalvataggio(); ui.buio.style.opacity = 1; location.reload(); return; }   // Incubo: da capo
  mostra('morte', false); document.body.classList.remove('fuori');
  // si riparte dall'ultimo checkpoint (lo scambio con Guerrino o l'ultima statuetta piantata)
  if (CHECK) ripristina(CHECK, tGioco);
  else { io.x = io.check.x; io.z = io.check.z; }
  io.fiato = 1; io.sfinito = false; io.pitch = -0.05;
  io.batteria = Math.max(io.batteria, 0.25); if (io.batteria > 0) io.torcia = true;
  viaPapi(true); papi.stato = 'assente';   // lo statico se ne va da solo, in dissolvenza
  papi.prossimo = tGioco + 60;   // un minuto senza mostro
  if (storia === 'casa') { io.x = CASA.fuori[0]; io.z = CASA.fuori[1]; io.yaw = -Math.PI / 2; BOSS.stato = 'fermo'; apriPorta(); }
  if (storia !== 'caccia' && storia !== 'solo') { storia = 'caccia'; tCaccia = 0; }
  scriviSalvataggio();
  ui.buio.style.opacity = 0;
  fase = 'gioco';
  if (!TOCCO) canvas.requestPointerLock?.();
}
function vittoria() {
  fase = 'vinto'; storia = 'fine'; apriTelefono(false);
  cancellaSalvataggio();   // la run è finita
  viaPapi(false); papi.stato = 'assente';
  const s = Math.round(io.tempo);
  setTimeout(() => {
    ui.buio.style.opacity = 1;
    setTimeout(() => {
      $('vittoria-testo').textContent = `Papi è crollato tra i lettini dei fiji sua. Er bosco tace; alla Fonticella, Guerrino mena ancora, a mani nude. Tempo: ${mmss(s)}${io.morti ? ` · prese: ${io.morti}` : ''}.`;
      document.body.classList.add('fuori'); mostra('vittoria', true);
      if (document.pointerLockElement) document.exitPointerLock();
      preparaSalvataggio(s);
      if (window.GoGoldBar && GoGoldBar.trofeo) try { GoGoldBar.trofeo('rc_fogli'); } catch (e) {}
    }, 800);
  }, 1200);
}
function mmss(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function pausa(si) {
  if (fase !== 'gioco' && fase !== 'pausa') return;
  fase = si ? 'pausa' : 'gioco';
  mostra('pausa', si); document.body.classList.toggle('fuori', si);
  // in pausa la notte resta (l'ambiente, il fosso, la pioggia); si zittiscono la colonna e lo statico
  if (MUS.bus) MUS.bus.gain.setTargetAtTime(si ? 0 : mixG('musica') * IMPOSTA.musica, ascolto.context.currentTime, 0.15);
  if (si && rumore) rumore.setVolume(0);
  if (si) { if (document.pointerLockElement) document.exitPointerLock(); if (pad.attivo) fuocoPad(vociMenu()[0]); }
  else { mostra('pannello', false); ascolto.context.resume?.(); if (!TOCCO) canvas.requestPointerLock?.()?.catch?.(() => {}); }
}
$('pausa-btn').addEventListener('click', () => pausa(true));
$('riprendi').addEventListener('click', () => pausa(false));
$('riprova').addEventListener('click', riprova);
$('ancora').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && fase === 'gioco') pausa(true);
  // scheda nascosta: zitto tutto; tornando, in pausa riparte l'ambiente
  if (document.hidden) ascolto.context.suspend?.(); else if (fase !== 'menu') ascolto.context.resume?.();
});
addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (!$('pannello').classList.contains('nascosto')) chiudiPannello();
  else if (fase === 'pausa') pausa(false);
});

/* ── i pannelli del menu: controlli, impostazioni, crediti ── */
let pannelloDa = 'menu';
function apriPannello(nome) {
  pannelloDa = fase === 'pausa' ? 'pausa' : 'menu';
  for (const pg of document.querySelectorAll('#pannello .pagina')) pg.classList.toggle('su', pg.id === 'p-' + nome);
  $('pannello-titolo').textContent = { controlli: 'Controlli', impostazioni: 'Impostazioni', crediti: 'Crediti' }[nome];
  mostra(pannelloDa, false); mostra('pannello', true);
  if (pad.attivo) fuocoPad(vociMenu()[0]);
}
function chiudiPannello() {
  mostra('pannello', false); mostra(pannelloDa, true);
  if (pad.attivo) fuocoPad(vociMenu()[0]);
}
for (const b of document.querySelectorAll('[data-pannello]')) b.addEventListener('click', () => apriPannello(b.dataset.pannello));
$('pannello-chiudi').addEventListener('click', chiudiPannello);
{
  const iSens = $('i-sens'), iVol = $('i-volume'), iMus = $('i-musica'), iInv = $('i-inverti');
  iSens.value = IMPOSTA.sens; iVol.value = IMPOSTA.volume; iMus.value = IMPOSTA.musica; iInv.checked = IMPOSTA.invertiY;
  const leggi = () => {
    IMPOSTA.sens = +iSens.value; IMPOSTA.volume = +iVol.value; IMPOSTA.musica = +iMus.value; IMPOSTA.invertiY = iInv.checked;
    salvaImpostazioni(); applicaMix();
  };
  for (const el of [iSens, iVol, iMus, iInv]) { el.addEventListener('input', leggi); el.addEventListener('change', leggi); }
}

/* ── controller (Xbox 360 e simili, mappatura standard) ──
   A salta, B accovacciati, X (o RT) prendi, Y (o Back) telefono, LB zoom, RB torcia, LT o levetta premuta
   corri, Start pausa. Nei menu: croce o levetta per scegliere, A conferma, B indietro. */
pad.tieni = -1;
const asse = v => { const a = Math.abs(v); return a < 0.2 ? 0 : Math.sign(v) * (a - 0.2) / 0.8; };
function vociMenu() {
  const s = [...document.querySelectorAll('.schermo:not(.nascosto)')].filter(e => e.id !== 'caricamento' && e.id !== 'ruota').pop();
  return s ? [...s.querySelectorAll('button, a.voce, input')].filter(e => e.offsetParent !== null && !e.disabled) : [];
}
function fuocoPad(el) {
  for (const e of document.querySelectorAll('.fuoco')) e.classList.remove('fuoco');
  if (!el) return;
  el.classList.add('fuoco'); el.focus({ preventScroll: false });
}
function leggiPad(dt) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected && g.buttons.length >= 10) : null;
  if (!gp) { pad.x = pad.y = 0; pad.corri = false; return; }
  const giu = gp.buttons.map(b => b.pressed || b.value > 0.5);
  const nuovo = i => giu[i] && !pad.prima[i];
  const lx = asse(gp.axes[0] || 0), ly = asse(gp.axes[1] || 0), rx = asse(gp.axes[2] || 0), ry = asse(gp.axes[3] || 0);
  if (!pad.attivo && (giu.some(Boolean) || lx || ly || rx || ry)) pad.attivo = true;
  if (giu.some(Boolean) || lx || ly || rx || ry) usaIngresso('pad');
  try {
    if (fase === 'gioco') {
      pad.x = lx; pad.y = ly;
      if (nuovo(10)) pad.l3 = true;
      if (Math.hypot(lx, ly) < 0.3) pad.l3 = false;
      pad.corri = giu[6] || !!pad.l3;
      const k = IMPOSTA.sens * dt;
      io.yaw -= Math.sign(rx) * rx * rx * 2.8 * k;
      io.pitch -= Math.sign(ry) * ry * ry * 2.0 * k * (IMPOSTA.invertiY ? -1 : 1);
      io.pitch = Math.max(-1.3, Math.min(1.3, io.pitch));
      if (nuovo(0)) salta();
      if (nuovo(1)) accovacciati();
      if (nuovo(2) || nuovo(7)) provaPrendere();
      if (nuovo(3) || nuovo(8)) apriTelefono();
      if (nuovo(4) && tel.aperto) zoomTelefono();
      if (nuovo(13) || (nuovo(4) && !tel.aperto)) piantaStatuetta();
      if (nuovo(5)) cambiaTorcia();
      if (nuovo(9)) pausa(true);
      return;
    }
    pad.x = pad.y = 0; pad.corri = false;
    const voci = vociMenu(); if (!voci.length) return;
    const qui = voci.indexOf(document.activeElement);
    const vy = ly || (giu[12] ? -1 : giu[13] ? 1 : 0), vx = lx || (giu[14] ? -1 : giu[15] ? 1 : 0);
    const spinta = Math.abs(vy) > 0.5 ? ['y', Math.sign(vy)] : Math.abs(vx) > 0.5 ? ['x', Math.sign(vx)] : null;
    let muovi = false;
    if (!spinta) pad.tieni = -1;
    else if (pad.tieni < 0) { pad.tieni = 0.35; muovi = true; }
    else if ((pad.tieni -= dt) <= 0) { pad.tieni = 0.12; muovi = true; }
    if (muovi) {
      const el = voci[qui];
      if (spinta[0] === 'x' && el && el.type === 'range') {
        el.value = +el.value + spinta[1] * (el.max - el.min) / 20; el.dispatchEvent(new Event('input'));
      } else if (spinta[0] === 'y') fuocoPad(qui < 0 ? voci[0] : voci[(qui + spinta[1] + voci.length) % voci.length]);
    }
    if (nuovo(0)) { const el = voci[qui]; if (!el) fuocoPad(voci[0]); else if (el.type !== 'range') el.click(); }
    if (nuovo(1)) { if (!$('pannello').classList.contains('nascosto')) chiudiPannello(); else if (fase === 'pausa') pausa(false); }
    if (nuovo(9)) { if (fase === 'pausa') pausa(false); else if (fase === 'menu' && !$('menu').classList.contains('nascosto')) ($('continua').classList.contains('nascosto') ? $('gioca') : $('continua')).click(); }
  } finally { pad.prima = giu; }
}

/* ── lo sfondo del menu: le montagne della mappa viste da alto, di profilo ──
   Un raggio per colonna come nei vecchi simulatori di volo: le creste più lontane sbiadiscono nella
   nebbia, il bosco fa la cresta seghettata. Il disegno si fa una volta; si muove solo la foschia. */
const SFONDO = { base: null, foschia: null };
function preparaSfondo(bosco, o = {}) {
  const W = 480, H = 270, c = SFONDO.base || document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  SFONDO.bosco = bosco;
  let qmin = 1e9, qmax = -1e9; for (let i = 0; i < Q.length; i++) { qmin = Math.min(qmin, Q[i]); qmax = Math.max(qmax, Q[i]); }
  // fuori dalla mappa le montagne continuano a specchio, e la nebbia se le mangia
  const spec = v => { const L = HALF * 2; let u = ((v + HALF) % (2 * L) + 2 * L) % (2 * L); if (u > L) u = 2 * L - u; return u - HALF; };
  const E = o.E ?? 2.2, alt = o.alt ?? 30, dist = o.dist ?? 40, oriz = H * (o.oriz ?? 0.42), scala = H * (o.scala ?? 1.4), fov = o.fov ?? 1.1;
  const lato = o.lato ?? 2, yaw = [Math.PI, 0, Math.PI / 2, -Math.PI / 2][lato] + (o.yaw ?? 0.3);
  const cx = [0, 0, -1, 1][lato] * (HALF + dist), cz = [1, -1, 0, 0][lato] * (HALF + dist);
  const ch = (qmax - qmin) * E + alt;
  const dens = (x, z) => { const i = Math.floor((x + HALF) / (2 * HALF) * bosco.w), j = Math.floor((z + HALF) / (2 * HALF) * bosco.h); return i < 0 || j < 0 || i >= bosco.w || j >= bosco.h ? 0 : bosco.d[(j * bosco.w + i) * 4] / 255; };
  const nebbia = [46, 53, 59], cresta = [5, 6, 7], fondo = o.fondo ?? 650;
  // il cielo: dal buio in alto alla nebbia sull'orizzonte, e la luna
  const lx = W * 0.84, ly = H * 0.16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = Math.min(1, Math.max(0, y / oriz)), o4 = (y * W + x) * 4, dl = Math.hypot(x - lx, y - ly);
    const alone = Math.max(0, 1 - dl / 80) ** 2 * 24 + (dl < 8 ? 150 : dl < 9.5 ? 70 : 0);
    for (let c3 = 0; c3 < 3; c3++) d[o4 + c3] = [5, 7, 10][c3] + (nebbia[c3] - [5, 7, 10][c3]) * k * k + alone;
    d[o4 + 3] = 255;
  }
  for (let x = 0; x < W; x++) {
    const a = yaw + (x / W - 0.5) * fov, dx = Math.sin(a), dz = Math.cos(a);
    let ymin = H, dietro = true;
    for (let z = 4; z < 2200; z += 0.6 + z * 0.006) {
      const px = spec(cx + dx * z), pz = spec(cz + dz * z);
      const cella = Math.sin(Math.floor(px / 2.5) * 12.9898 + Math.floor(pz / 2.5) * 78.233) * 43758.5;
      const h = (quota(px, pz) - qmin) * E + dens(px, pz) * (8 + (cella - Math.floor(cella)) * 8);
      const y = Math.floor(oriz + (ch - h) / z * scala);
      if (y >= ymin) { dietro = true; continue; }
      const f = 1 - Math.exp(-z / fondo), filo = dietro && ymin - y > 4;
      dietro = false;
      for (let yy = Math.max(0, y); yy < ymin; yy++) {
        const bordo = !filo ? 1 : yy - y < 1 ? 1.8 : yy - y < 2 ? 1.3 : 1;   // la luna sul filo delle creste
        const o4 = (yy * W + x) * 4;
        for (let c3 = 0; c3 < 3; c3++) d[o4 + c3] = (cresta[c3] + (nebbia[c3] - cresta[c3]) * f) * bordo;
      }
      ymin = Math.max(0, y);
      if (ymin === 0) break;
    }
  }
  g.putImageData(img, 0, 0);
  SFONDO.base = c; SFONDO.oriz = oriz;
  if (SFONDO.foschia) return;
  // la foschia: macchie morbide che scorrono piano fra le creste
  const f = document.createElement('canvas'); f.width = W * 2; f.height = 120;
  const gf = f.getContext('2d'), r = rand(77);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = 45 + r() * 30, rr = 16 + r() * 28;
    for (const ox of [0, W]) { const gr = gf.createRadialGradient(x + ox, y, 0, x + ox, y, rr); gr.addColorStop(0, 'rgba(70,78,84,.2)'); gr.addColorStop(1, 'rgba(70,78,84,0)'); gf.fillStyle = gr; gf.fillRect(x + ox - rr, y - rr, rr * 2, rr * 2); }
  }
  SFONDO.foschia = f;
}
function disegnaSfondo(t) {
  if (!SFONDO.base) return;
  const g = $('sfondo').getContext('2d'), W = 480;
  g.drawImage(SFONDO.base, 0, 0);
  for (let i = 0; i < 3; i++) {
    const o = ((t * (3 + i * 2.5) + i * 150) % W);
    g.globalAlpha = 0.9 - i * 0.2;
    g.drawImage(SFONDO.foschia, -o, SFONDO.oriz - 40 + i * 30);
  }
  g.globalAlpha = 1;
}

function controllaOrizzontale() {
  mostra('ruota', TOCCO && innerHeight > innerWidth && (fase === 'gioco'));
}

/* ════════ CLASSIFICA ════════ */
function nomeAccount() { const A = window.GoGoAccount, s = A && A.stato && A.stato(); return s && s.account ? s.account.nome : ''; }
function disegnaClassifica(el) {
  const C = window.ResidentCrevilClassifica;
  if (!C || !C.attiva) { el.innerHTML = ''; return; }
  const titolo = MODO === 'incubo' ? 'Chi è uscito dall’incubo' : 'Chi è uscito dal bosco';
  C.carica(8, MODO).then(righe => {
    if (!righe.length) { el.innerHTML = `<h3>${titolo}</h3><p class="piccolo">Ancora nessuno.</p>`; return; }
    el.innerHTML = `<h3>${titolo}</h3><ol>` + righe.map(r => `<li><span>${r.nome.replace(/</g, '&lt;')}</span><span>${mmss(r.punti)}</span></li>`).join('') + '</ol>';
  });
}
function preparaSalvataggio(sec) {
  const C = window.ResidentCrevilClassifica, box = $('salva-box'), inp = $('nome'), esito = $('salva-esito');
  disegnaClassifica($('classifica-fine'));
  if (!C || !C.attiva) { box.classList.add('nascosto'); return; }
  const acc = nomeAccount();
  if (acc) { inp.value = acc; inp.disabled = true; } else inp.value = localStorage.getItem('residentcrevil.nome') || '';
  $('salva').onclick = () => {
    const nome = inp.value.trim().slice(0, 20); if (!nome) { inp.focus(); return; }
    try { localStorage.setItem('residentcrevil.nome', nome); } catch (e) {}
    esito.textContent = 'Salvo...';
    C.salva(nome, sec, MODO).then(() => { esito.textContent = 'Fatto.'; disegnaClassifica($('classifica-fine')); }, e => { esito.textContent = e.message; });
  };
}

/* ════════ COSTRUZIONE E CICLO ════════ */
const orologio = new THREE.Clock();
let tGioco = 0;
function costruisci(bin, bosco, colori, osm, modello, roncola, modelloPapi, texAlberi) {
  const u16 = new Uint16Array(bin);
  Q = new Float32Array(N * N);
  for (let i = 0; i < Q.length; i++) Q[i] = (1000 + u16[i] / 20) * SCALA;
  // osm.json è in metri veri: lo porto in metri di gioco
  for (const poligono of [...osm.case, ...osm.fossi, ...osm.strade.map(s => s[1])]) for (const p of poligono) { p[0] *= SCALA; p[1] *= SCALA; }
  FOSSI = osm.fossi;
  // il sentiero viola di Leo (16/11): dal Greppo di prima, su fino al Greppo in quota (già in metri di gioco)
  osm.strade.push(['p', SENTIERO_GREPPO]);
  // il letto dei fossi: scavo mezzo metro di terreno lungo l'acqua
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = distFosso(i * CELLA - HALF, j * CELLA - HALF);
    if (d < 3.4) { const k = Math.min(1, (3.4 - d) / 2.4); Q[j * N + i] -= 0.5 * k * k * (3 - 2 * k); }
  }
  preparaFossiEPonti(osm);
  spianaSentiero(SENTIERO_GREPPO);
  scavaGreppo();
  // lo spiazzo della casa di Papi: terreno in piano sotto la casa, raccordato intorno
  {
    const h0 = quota(CASA.x - 15, CASA.z);   // alla quota di chi arriva da ponente: la casa si incassa nel pendio, a monte
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i * CELLA - HALF, z = j * CELLA - HALF, d = Math.max(Math.abs(x - CASA.x) / 1.2, Math.abs(z - CASA.z));
      if (d < 22) { const k = d < 12 ? 1 : 1 - (d - 12) / 10, s = k * k * (3 - 2 * k); Q[j * N + i] += (h0 - Q[j * N + i]) * s; }
    }
  }
  creaTerreno(colori, bosco, osm);
  creaBosco(bosco, osm, FOGLI_POS, texAlberi);
  creaPaese(osm);
  creaFonte();
  creaCasa();
  creaSottobosco(bosco);
  creaAcqua();
  creaPonti();
  creaLuciStatue();
  creaCinghiale();
  creaFogli();
  creaPowerUp();
  creaMappaTelefono(bosco, osm);
  preparaGps();
  preparaSfondo(bosco);
  creaGuerrino(modello, roncola);
  creaPapi(modelloPapi);
  preparaAudio();
  posaGuerrino(-69.5, 191.5, 0);
  guerrino.rot = guardaVerso(io.x, io.z); disegna(guerrino); animaGuerrino(0);
  camera.position.set(io.x, quota(io.x, io.z) + 1.65, io.z);
  camera.rotation.set(io.pitch, io.yaw, 0, 'YXZ');
  // primo render per compilare gli shader mentre c'è ancora il caricamento
  renderer.compile(scena, camera);
  renderer.render(scena, camera);
  mostra('caricamento', false); mostra('menu', true);
  document.body.classList.remove('carica'); document.body.classList.add('fuori', 'lobby');
  disegnaClassifica($('classifica-menu'));
  window.__crevil = { caro, bimba, siedi: i => { siediSulPonte(bimba, PONTI[i], tGioco); bimba.g.visible = true; bimba.fine = tGioco + 999; }, stendimi: () => stendimi(tGioco), corrente: (x, z) => corrente(x, z), OCCHI, PRESA, PROVA, quota, EV, lanciaEvento: c => lanciaEvento(c, tGioco), GREPPO, cadi, suoloIo, MODO: () => MODO, PONTI, FOGLI_ANCORE, PROFILI, sulPonte, RONCOLA, guarda: (x, z) => { io.yaw = Math.atan2(-(x - io.x), -(z - io.z)); }, info: () => renderer.info.render, io, guerrino, papi, recita, posa, disegna, scena, camera, renderer, salta: s => { storia = s; tStoria = 0; }, caccia: () => { iniziaCaccia(tGioco); papi.prossimo = 0; }, tel, apriTelefono, quotaVera, TEL3D, CASA, BOSS, POWER, cambiaTorcia, colpisci, entraCasa: () => entraCasa(tGioco), dammiRoncola, GPS, BUIO, pad, apriPannello, chiudiPannello, toccaSchermo, disegnaSfondo, MIX, sfondo: o => { preparaSfondo(SFONDO.bosco, o); return SFONDO.base.toDataURL(); }, FONTE, FOGLI, MUS, cinghiale, tronchiVicini, statico: v => { staticoOb = v; }, lanciaCinghiale: () => lanciaCinghiale(tGioco), papiInPiedi, mostraPapi, PAPI_FERMO, papiArrabbiato: () => papiArrabbiato(tGioco), suSentiero, distFosso, alSicuro, FOSSI, stato: () => ({ storia, boss: BOSS.stato, vita: BOSS.vita, roncola: !!io.roncola, fase, attesa, livello, staticoV, faseG: guerrino.fase, az: guerrino.nomeAz, papi: papi.stato, vis: papi.vis, pres: papi.pres, visto: papi.visto, dPapi: Math.round(Math.hypot(io.x - papi.x, io.z - papi.z)), mus: Object.fromEntries(Object.entries(MUS.pezzi).map(([n, z]) => [n, z.pronto ? +z.ob.toFixed(2) : 'carico'])) }) };
}
pronto.catch(e => { console.error(e); $('prog-testo').textContent = 'Il bosco non si carica: ricarica la pagina.'; });

/* ── la lobby: la mappa vista dall'alto a 45°, con la camera che va piano (Leo, 17/11).
   Quando premi Gioca la camera cade in picchiata dentro la mappa, fino agli occhi di Crivo, e sfuma a nero. */
const LOBBY = { tuffo: -1, fine: null, da: null, q: new THREE.Quaternion(), m: new THREE.Matrix4(), su: new THREE.Vector3(0, 1, 0), p1: new THREE.Vector3(), mira: new THREE.Vector3(), cx: 0, cz: 0 };
function posaLobby(t) {
  // il punto guardato gira lento sulla mappa, e la camera gli gira intorno, sempre a 45°
  const cx = Math.sin(t * 0.021) * 110 - 10, cz = Math.sin(t * 0.013 + 1.3) * 120 + 10, yaw = t * 0.03 + 0.6, D = 185;
  const ty = quota(cx, cz);
  camLobby.position.set(cx + Math.sin(yaw) * D * Math.SQRT1_2, ty + D * Math.SQRT1_2, cz + Math.cos(yaw) * D * Math.SQRT1_2);
  camLobby.lookAt(cx, ty, cz);
  LOBBY.cx = cx; LOBBY.cz = cz;
}
function tuffo(fine) {
  LOBBY.tuffo = 0; LOBBY.fine = fine; LOBBY.da = { p: camLobby.position.clone(), q: camLobby.quaternion.clone() };
  ui.buio.style.transition = 'none';
}
function animaTuffo(dt) {
  const T = (LOBBY.tuffo += dt), k = Math.min(1, T / 2.1), e = k * k * k;   // in picchiata: sempre più svelto
  LOBBY.p1.set(io.x, suoloIo(io.x, io.z) + 1.65, io.z);
  camLobby.position.lerpVectors(LOBBY.da.p, LOBBY.p1, e);
  // si gira a guardare giù, verso il punto dove cade
  LOBBY.mira.set(io.x, LOBBY.p1.y - 3, io.z);
  LOBBY.m.lookAt(camLobby.position, LOBBY.mira, LOBBY.su); LOBBY.q.setFromRotationMatrix(LOBBY.m);
  camLobby.quaternion.slerpQuaternions(LOBBY.da.q, LOBBY.q, Math.min(1, k * 1.8));
  LOBBY.cx = io.x; LOBBY.cz = io.z;
  ui.buio.style.opacity = Math.max(0, Math.min(1, (k - 0.55) / 0.35)).toFixed(3);
  if (k >= 1 && LOBBY.fine) { const f = LOBBY.fine; LOBBY.fine = null; LOBBY.tuffo = -1; f(); }
}
function disegnaLobby(dt, t) {
  scena.fog.color.copy(BUIO.chiaro); scena.fog.density = LOBBY.tuffo >= 0 ? 0.0042 + Math.pow(Math.min(1, LOBBY.tuffo / 2.1), 3) * 0.03 : 0.0042;
  cielo.intensity = 1.8; luna.intensity = 0.55; torcia.intensity = 0; alone.intensity = 0;   // dall'alto un filo più chiaro
  if (LOBBY.tuffo >= 0) animaTuffo(dt); else posaLobby(t);
  const LB = HALF / NB, R = (LOBBY.tuffo >= 0 ? 160 : 190) * (TOCCO ? 0.75 : 1);   // sul telefono un po' meno bosco
  for (const b of BLOCCHI) b.visible = Math.hypot(Math.max(0, Math.abs(b.userData.cx - LOBBY.cx) - LB), Math.max(0, Math.abs(b.userData.cz - LOBBY.cz) - LB)) < R;
  if (FONTE.acqua) FONTE.acqua.offset.y = -t * 0.12;
  if (acquaFossi) acquaFossi.offset.y = -t * 0.55;
  animaGuerrino(dt);
  renderer.render(scena, camLobby);
}

// Gioca (da capo) o Continua (dal checkpoint salvato)
function avviaPartita(salvato) {
  if (LOBBY.tuffo >= 0 || fase !== 'menu') return;
  mostra('menu', false); mostra('pannello', false); fuocoPad(null);
  ascolto.context.resume?.(); if (!ambiente || !ambiente.isPlaying) sfumaDentro(); avviaLoop();
  if (salvato) { ripristina(salvato, tGioco); io.tempo = salvato.tempo || 0; io.morti = salvato.morti || 0; mostraModo(); }
  else cancellaSalvataggio();
  // schermo intero e mouse vanno chiesti subito, dentro al clic
  if (TOCCO) document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  else canvas.requestPointerLock?.()?.catch?.(() => {});
  tuffo(() => {
    document.body.classList.remove('fuori', 'lobby');
    fase = 'gioco'; tStoria = 0; tel.tUltimo = tGioco;
    avviaMusica();
    if (TOCCO) mostra('touch', true);
    mostraStatuette();
    if (salvato) setTimeout(() => didascalia(`Si riparte dall'ultimo checkpoint. Tempo: ${mmss(Math.round(io.tempo))}.`, 4500), 800);
    else setTimeout(() => { if (!io.torcia && fase === 'gioco') didascalia(INGRESSO === 'tocco' ? 'Il tasto 🔦 accende la torcia.' : `Premi ${tasto('torcia')} per accendere la torcia.`, 6000); }, 9000);
    controllaOrizzontale();
    ui.buio.style.transition = 'opacity .9s'; requestAnimationFrame(() => { ui.buio.style.opacity = 0; setTimeout(() => { ui.buio.style.transition = ''; }, 1000); });
  });
}
$('gioca').addEventListener('click', () => avviaPartita(null));
$('continua').addEventListener('click', () => avviaPartita(leggiSalvataggio()));
pronto.then(() => {
  const s = leggiSalvataggio();
  if (s) { mostra('continua', true); $('gioca').textContent = 'Nuovo gioco'; $('continua').innerHTML = `Continua <small>${mmss(Math.round(s.tempo || 0))} · ${s.fogli}/10</small>`; }
});

// schermo intero (dove il browser lo lascia fare: non sull'iPhone)
function aggiornaSchermoIntero() {
  for (const b of document.querySelectorAll('.schermo-intero')) {
    b.hidden = !document.fullscreenEnabled;
    b.textContent = document.fullscreenElement ? 'Esci dallo schermo intero' : 'Schermo intero';
  }
}
for (const b of document.querySelectorAll('.schermo-intero')) b.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', aggiornaSchermoIntero);
aggiornaSchermoIntero();

let tFosso = 0, tSalva = 5;
function ciclo() {
  requestAnimationFrame(ciclo);
  const dt = Math.min(0.05, orologio.getDelta()) * PROVA.tempo, t = (tGioco += dt);
  if (!Q) return;
  leggiPad(dt / PROVA.tempo);
  if (document.body.classList.contains('lobby')) { disegnaLobby(dt, t); return; }   // nel menu: la mappa dall'alto
  if (fase === 'gioco') {
    aggiornaBuio(dt);
    if (storia === 'solo' || storia === 'caccia' || storia === 'casa') io.tempo += dt;   // il tempo della run parte quando Guerrino se ne va
    if (CHECK && (tSalva -= dt) < 0) { tSalva = 5; scriviSalvataggio(); }   // il tempo corre anche se chiudi
    aggiornaStatue(t);
    muoviGiocatore(dt);
    aggiornaTorcia(dt, t);
    aggiornaGps(dt, t);
    if (!PROVA.congela) { aggiornaStoria(dt, t); aggiornaCaro(dt, t); aggiornaBimba(dt, t); }
    aggiornaCinghiale(dt, t);
    if (storia !== 'casa') aggiornaEventi(dt, t);
    aggiornaDialogo(dt);
    cercaFoglio();
    if ((tFosso -= dt) < 0) { tFosso = 0.5; if (fosso) fosso.setVolume(Math.max(0, 1 - distFosso(io.x, io.z) / 45) * 0.6 * mixG('fosso')); }
  }
  if (FONTE.acqua) FONTE.acqua.offset.y = -t * 0.12;
  if (fase === 'gioco') { animaPowerUp(t); animaRoncola(dt); aggiornaEffetti(dt); }
  if (acquaFossi) acquaFossi.offset.y = -t * 0.55;
  if (fase === 'steso') animaSteso(dt);
  if (fase === 'gioco' || fase === 'morto' || fase === 'steso') { disegnaStatico(dt); animaGuerrino(dt); animaPapi(dt); animaFigli(dt); if (fase === 'morto') animaPresa(dt); aspettoPapi(dt); aggiornaScossi(dt); }
  if (fase !== 'menu') aggiornaMusica(dt);
  animaTelefono(dt);
  // accendi solo i pezzi di bosco vicini
  // oltre gli 80 m la nebbia copre tutto: conta il punto del blocco più vicino a me
  const LB = HALF / NB;
  for (const b of BLOCCHI) b.visible = Math.hypot(Math.max(0, Math.abs(b.userData.cx - io.x) - LB), Math.max(0, Math.abs(b.userData.cz - io.z) - LB)) < (TOCCO ? 70 : 80);
  renderer.render(scena, camera);
  if (TEL3D.g.visible) { rendTel.render(scenaTel, camTel); telDisegnato = true; }
  else if (telDisegnato) { rendTel.clear(); telDisegnato = false; }
}
ciclo();
