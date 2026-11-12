/* ════════════════════════════════════════════════════════════════
   RESIDENT CREVIL: MORTE SUL GREPPO — prototipo
   Notte nei boschi di Capricchia (Amatrice). Guerrino ti porta alla
   Fonticella Petri, si stanca e si mette a prendere a pugni un albero.
   Tu cerchi i 10 fogli. Dopo qualche minuto nel bosco arriva Papi,
   alto tre metri: se ti prende, ricominci dall'ultimo foglio.

   Mappa: quadrato di 1300 m centrato su 42.6263 N, 13.3445 E.
   Coordinate di gioco: x = est (m), z = sud (m), y = quota (m s.l.m.).
   File in mappa/: terreno.bin (quote, griglia 261x261 ogni 5 m, uint16 in 5 cm sopra i 1000 m),
   bosco.png (densità alberi, 2,5 m/px), colori.jpg (colore del suolo), osm.json (case, strade, fossi).
   Prova veloce: ?veloce (attese corte).
════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from './lib/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './lib/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from './lib/addons/utils/BufferGeometryUtils.js';

const VELOCE = /veloce/.test(location.search);
const PROVA = { congela: false, tempo: 1 };   // per i test: ferma la storia (Guerrino e Papi), accelera il tempo
const HALF = 650, N = 261, CELLA = 5, LIMITE = 615;
const TOCCO = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOCCO) document.body.classList.add('tocco');

/* ── testi (Leo li cambierà: sono tutti qui) ── */
const BATTUTE = {
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
    "Ahò, piano. C'ho settantott'anni, mica venti.",
  ],
  fonte: [
    "Ecco la Fonticella Petri. Fermamose.",
    "Uff... aspetta... nun c'ho più er fiato.",
  ],
  sfogo: [
    "Mo' me so' stancato pure d'esse stanco.",
    "'St'albero me guarda storto da quarant'anni. Mo' je faccio vede' io.",
    "Tu va' a cercà i fogli attaccati agli alberi. So' dieci. Trovali tutti prima che arriva Papi.",
  ],
  mena: ["Pija questa!", "E questa è pe' mi' cognato!", "Nun me guardà, cerca i fogli!", "Quarant'anni che me guardi storto!", "Ahia. Vabbè, continuo.", "Er fiato nun ce l'ho, ma er pugno sì."],
  indietro: ["Daje, che c'hai le gambe de ricotta?", "Ahò, de qua!", "Nun me fa' tornà indietro.", "Sbrighete, che fa freddo."],
  caccia: ["CRIVO! È ARIVATO PAPI!", "Nun lo guardà fisso, che je piace!", "Corri, Crivo! Papi è arto tre metri, mica è scemo!", "Papi! Lassalo stà, che è er fijo de...!"],
  preso: ["Papi è arto tre metri. Tu no.", "Papi s'è ripreso i fogli.", "Guerrino nun ha manco smesso de menà l'albero.", "Te l'aveva detto: nun lo guardà.", "Papi nun corre. Papi arriva."],
};

/* ── DOM ── */
const $ = id => document.getElementById(id);
const ui = {
  fogli: $('fogli'), batteria: $('batteria'), fiato: $('fiato'), prendi: $('prendi'),
  dialogo: $('dialogo'), chi: $('chi'), battuta: $('battuta'), didascalia: $('didascalia'),
  foglioGrande: $('foglio-grande'), statico: $('statico'), buio: $('buio'),
};
function mostra(id, si) { $(id).classList.toggle('nascosto', !si); }

/* ════════ RENDERER E SCENA ════════ */
const canvas = $('scena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOCCO, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOCCO ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scena = new THREE.Scene();
const NEBBIA = new THREE.Color(0x07090b);
scena.background = NEBBIA;
scena.fog = new THREE.FogExp2(NEBBIA, 0.034);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 95);
scena.add(camera);
scena.add(new THREE.HemisphereLight(0x4a5a7a, 0x10120c, 1.1));
const luna = new THREE.DirectionalLight(0x8090b0, 0.25);
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
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
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

const SUONI = ['notte', 'fosso', 'colpo', 'foglio', 'fiatone', 'scricchiolio', 'frasche', 'passo1', 'passo2', 'passo3', 'passo4', 'passo5', 'pugno1', 'pugno2', 'pugno3'];
const buf = {};

const pronto = Promise.all([
  promessa(caricaFile, 'mappa/terreno.bin'),
  immagineDati('mappa/bosco.png'),
  promessa(caricaTex, 'mappa/colori.jpg'),
  fetch('mappa/osm.json').then(r => r.json()),
  promessa(gltf, 'modelli/guerrino.glb'),
  promessa(gltf, 'modelli/roncola.glb').catch(() => null),
  promessa(gltf, 'modelli/papi.glb'),
  promessa(caricaTex, 'texture/corteccia.jpg'),
  promessa(caricaTex, 'texture/fronde.webp'),
  ...SUONI.map(s => promessa(caricaAudio, 'sfx/' + s + '.mp3').then(b => { buf[s] = b; }, () => {})),
]).then(([bin, bosco, colori, osm, modello, roncola, modelloPapi, corteccia, fronde]) => costruisci(bin, bosco, colori, osm, modello, roncola, modelloPapi, [corteccia, fronde]));

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

function texDettaglio() {
  // foglie secche e terra, ripetuta: dà grana al suolo da vicino
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  const r = rand(11);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, s = 1 + r() * 4, l = 60 + r() * 110;
    g.fillStyle = `rgb(${l * 1.08 | 0},${l | 0},${l * 0.8 | 0})`;
    g.save(); g.translate(x, y); g.rotate(r() * 6.28);
    g.beginPath(); g.ellipse(0, 0, s, s * 0.5, 0, 0, 6.28); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function creaTerreno(colori) {
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Q[i]);
  geo.computeVertexNormals();
  colori.colorSpace = THREE.SRGBColorSpace;
  colori.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: colori });
  const det = texDettaglio();
  mat.onBeforeCompile = sh => {
    sh.uniforms.dettaglio = { value: det };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D dettaglio;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(dettaglio, vMapUv * 520.0).rgb * 1.9;');
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
  corteccia.wrapS = corteccia.wrapT = THREE.RepeatWrapping; corteccia.colorSpace = THREE.SRGBColorSpace; corteccia.anisotropy = 4;
  fronde.colorSpace = THREE.SRGBColorSpace; fronde.anisotropy = 2;
  const legno = new THREE.MeshLambertMaterial({ map: corteccia, color: 0x9a9088 });
  const foglie = new THREE.MeshLambertMaterial({ map: fronde, color: 0x7c8670, alphaTest: 0.42, side: THREE.DoubleSide });
  // il retro delle fronde non va al buio: tengo la normale "a palla" su tutti e due i lati
  foglie.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n\tnormal *= faceDirection;\n#endif');
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

const BLOCCHI = [];   // pezzi di bosco 100x100 m, accesi solo vicino al giocatore
function creaBosco(bosco, osm, fogliPos, texAlberi) {
  const geos = modelliAlberi();
  const mats = materialiAlberi(...texAlberi);
  const r = rand(1234);
  const dens = (x, z) => {
    const i = Math.min(bosco.w - 1, Math.max(0, Math.round((x + HALF) / (HALF * 2) * (bosco.w - 1))));
    const j = Math.min(bosco.h - 1, Math.max(0, Math.round((z + HALF) / (HALF * 2) * (bosco.h - 1))));
    return bosco.d[(j * bosco.w + i) * 4] / 255;
  };
  const libero = (x, z) => !fogliPos.some(f => Math.hypot(f[0] - x, f[1] - z) < 3.5) && Math.hypot(FONTE.x - x, FONTE.z - z) > 5;
  const lista = [];   // [x, z, tipo, scala, rot]
  const PASSO = 5.2;
  for (let z = -HALF + 2; z < HALF - 2; z += PASSO) for (let x = -HALF + 2; x < HALF - 2; x += PASSO) {
    const px = x + r() * PASSO, pz = z + r() * PASSO;
    const bordo = Math.max(Math.abs(px), Math.abs(pz)) > LIMITE - 10 ? 1 : 0;   // bordo della mappa: muro di alberi
    if (r() > Math.max(dens(px, pz), bordo) || !libero(px, pz)) continue;
    const q = r(); const tipo = q < 0.5 ? 0 : q < 0.72 ? 1 : 2;
    lista.push([px, pz, tipo, 0.75 + r() * 0.6, r() * 6.28]);
  }
  for (let z = -HALF + 2; z < HALF - 2; z += 7) for (let x = -HALF + 2; x < HALF - 2; x += 7) {
    const px = x + r() * 7, pz = z + r() * 7;
    if (r() > dens(px, pz) * 0.55 || !libero(px, pz)) continue;
    lista.push([px, pz, 3, 0.6 + r() * 0.9, r() * 6.28]);
  }
  // gli alberi dei fogli: tronchi grossi e sicuri
  for (const f of fogliPos) lista.push([f[0], f[1], 0, 1.35, f[2]]);
  // l'albero che Guerrino prende a pugni, accanto alla Fonticella
  lista.push([FONTE.x + 4.2, FONTE.z - 2.6, 0, 1.25, 1.1]);

  const NB = 26, LATO = HALF * 2 / NB;   // blocchi da 50 m
  const perBlocco = new Map();
  for (const t of lista) {
    const bi = Math.min(NB - 1, (t[0] + HALF) / LATO | 0), bj = Math.min(NB - 1, (t[1] + HALF) / LATO | 0);
    const k = bj * NB + bi; let b = perBlocco.get(k);
    if (!b) perBlocco.set(k, b = [[], [], [], []]);
    b[t[2]].push(t);
  }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), su = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [k, tipi] of perBlocco) {
    const g = new THREE.Group();
    g.userData.cx = ((k % NB) + 0.5) * LATO - HALF; g.userData.cz = ((k / NB | 0) + 0.5) * LATO - HALF;
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
    scena.add(g); BLOCCHI.push(g);
  }
}

/* ════════ PAESE ════════ */
const CASE = [];   // [{pts, minx, maxx, minz, maxz}]
function texMuro() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const r = rand(3);
  g.fillStyle = '#6d655a'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) for (let x = -(y / 16 % 2) * 14; x < 256; x += 28) {
    const l = 80 + r() * 50; g.fillStyle = `rgb(${l + 12 | 0},${l + 6 | 0},${l - 6 | 0})`;
    g.fillRect(x + 1, y + 1, 26, 14);
  }
  // finestre buie
  g.fillStyle = '#0d0c0b';
  g.fillRect(40, 90, 36, 52); g.fillRect(170, 90, 36, 52);
  g.fillStyle = '#3b2a1c'; g.fillRect(36, 86, 44, 4); g.fillRect(166, 86, 44, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / 5, 1 / 5);
  return t;
}
function creaPaese(osm) {
  const muri = [], tetti = [];
  const r = rand(77);
  for (const pts of osm.case) {
    if (pts.length < 3) continue;
    const forma = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    let qmin = Infinity, qmax = -Infinity;
    for (const p of pts) { const q = quota(p[0], p[1]); qmin = Math.min(qmin, q); qmax = Math.max(qmax, q); }
    const h = 5.5 + r() * 3.5 + (qmax - qmin);
    const g = new THREE.ExtrudeGeometry(forma, { depth: h, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, qmin - 0.8 + h, 0);
    muri.push(g);
    // tetto: una lastra scura che sporge un po'
    const tetto = new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.2, bevelSegments: 1 });
    tetto.rotateX(Math.PI / 2); tetto.translate(0, qmin - 0.8 + h + 0.35, 0);
    tetti.push(tetto);
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    CASE.push({ pts, minx, maxx, minz, maxz });
  }
  if (!muri.length) return;
  const unisci = l => { const g = mergeGeometries(l.map(x => x.index ? x.toNonIndexed() : x)); g.clearGroups(); return g; };
  scena.add(new THREE.Mesh(unisci(muri), new THREE.MeshLambertMaterial({ map: texMuro() })));
  scena.add(new THREE.Mesh(unisci(tetti), new THREE.MeshLambertMaterial({ color: 0x3a2a22 })));
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
const FONTE = { x: -27, z: 313 };   // a 130 m di strada dalla fine del paese
function creaFonte() {
  const pietra = new THREE.MeshLambertMaterial({ color: 0x7a746a });
  const g = new THREE.Group();
  const vasca = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1), pietra); vasca.position.y = 0.35; g.add(vasca);
  const muro = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.4), pietra); muro.position.set(0, 0.8, -0.6); g.add(muro);
  const acqua = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.8), new THREE.MeshLambertMaterial({ color: 0x0c1a22, emissive: 0x050a0d }));
  acqua.rotation.x = -Math.PI / 2; acqua.position.y = 0.62; g.add(acqua);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  tubo.rotation.x = Math.PI / 2; tubo.position.set(0, 1.1, -0.3); g.add(tubo);
  g.position.set(FONTE.x, quota(FONTE.x, FONTE.z), FONTE.z);
  g.rotation.y = 0.6;
  scena.add(g);
  aggiungiTronco({ x: FONTE.x, z: FONTE.z, r: 1.1, mesh: null });
}

/* ════════ FOGLI ════════ */
// [x, z, direzione del foglio sul tronco] — posti fissi, nella zona dello screenshot di Leo e intorno
const FOGLI_POS = [
  [150, 172, 2.2], [42, 58, 0.4], [-62, 18, 4.1], [205, -118, 1.2], [62, -296, 5.4],
  [252, -384, 3.0], [-148, -246, 0.9], [418, 98, 4.6], [378, -222, 2.6], [-246, 148, 1.8],
];
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
  const geo = new THREE.PlaneGeometry(0.21, 0.297);
  const mat = new THREE.MeshLambertMaterial({ map: texFoglio(), color: 0x9a968c, emissive: 0x1a1812, side: THREE.DoubleSide });
  for (const [x, z, dir] of FOGLI_POS) {
    const m = new THREE.Mesh(geo, mat);
    const r = 0.43;   // appena fuori dal tronco (largo 0,37 m a quell'altezza)
    const px = x + Math.sin(dir) * r, pz = z + Math.cos(dir) * r;
    m.position.set(px, quota(x, z) + 1.45, pz);
    m.rotation.y = dir;
    m.rotation.z = (Math.random() - 0.5) * 0.2;
    scena.add(m);
    FOGLI.push({ m, x: px, z: pz, preso: false });
  }
}

/* ════════ PERSONAGGI: GUERRINO E PAPI ════════ */
// Guerrino: il modello vecchio di Leo con le 9 animazioni del suo scheletro nuovo
// (jab, combo, affondo, stanco, calcioAlto, pugno, calcio, calcio2, cammina).
// Papi: alto 3 metri, animazioni gattona, salto, corsa, striscia.
const guerrino = { g: new THREE.Group(), x: 0, z: 0, rot: 0, tappa: 0, vel: 0, prossimo: 0, mena: false, tinta: 0x77716a, scala: 1 };
const papi = { g: new THREE.Group(), x: 0, z: 0, rot: 0, vel: 0, stato: 'assente', prossimo: 0, fine: 0, tinta: 0x5c5a58, scala: 3 / 1.89 };
function preparaPersonaggio(p, modello) {
  const m = modello.scene;
  // Lambert come il resto della scena: col PBR la torcia li sbianca
  m.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const v = o.material;
    o.material = new THREE.MeshLambertMaterial({ map: v.map, normalMap: v.normalMap || null, color: p.tinta });
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
    r.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = new THREE.MeshLambertMaterial({ map: o.material.map, color: 0x9c9890 }); } });
    r.position.set(0, -1.65, 0);            // il punto del manico che sta nel palmo (modello alto 1,9)
    const giro = new THREE.Group(); giro.add(r); giro.rotation.y = -Math.PI / 2;
    const perno = new THREE.Group(); perno.add(giro);
    perno.scale.setScalar(0.27); perno.position.set(0, 0.13, 0.03); perno.rotation.set(0, 0, Math.PI / 2);
    mano.add(perno);
  }
}
function creaPapi(modello) {
  preparaPersonaggio(papi, modello);
  papi.g.visible = false;
  recita(papi, 'gattona');
}

function animaGuerrino(dt) {
  if (!guerrino.mixer) return;
  guerrino.g.visible = Math.hypot(guerrino.x - io.x, guerrino.z - io.z) < 75;
  if (!guerrino.g.visible) return;
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
function suono(nome, vol = 1, rate = 1) {
  if (!buf[nome]) return;
  const a = new THREE.Audio(ascolto); a.setBuffer(buf[nome]); a.setVolume(vol); a.setPlaybackRate(rate); a.play();
}
function preparaAudio() {
  const loop = (nome, vol) => { if (!buf[nome]) return null; const a = new THREE.Audio(ascolto); a.setBuffer(buf[nome]); a.setLoop(true); a.setVolume(vol); return a; };
  ambiente = loop('notte', 0.55);
  fosso = loop('fosso', 0);
  fiatone = loop('fiatone', 0);
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
  pugnoAudio = posizionale(guerrino.g, 5, 1.2);     // i pugni sull'albero si sentono da lontano
  papiVoce = posizionale(papi.g, 8, 2);
  papiPassi = posizionale(papi.g, 7, 0.2);
}
function avviaLoop() {
  for (const a of [ambiente, fosso, fiatone, rumore]) if (a && !a.isPlaying) a.play();
}

/* ════════ GIOCATORE ════════ */
const io = {
  x: -150, z: 384, yaw: -Math.PI / 2, pitch: -0.05, fiato: 1, sfinito: false, batteria: 1, torcia: true,
  passi: 0, dondolo: 0, fogli: 0, check: { x: -150, z: 384 }, morti: 0, tempo: 0, vel: 0,
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
  if (e.code === 'KeyF') cambiaTorcia();
  if (e.code === 'KeyE') provaPrendere();
});
addEventListener('keyup', e => { tasti[e.code] = false; });
function cambiaTorcia() { if (io.batteria > 0) { io.torcia = !io.torcia; suono('colpo', 0.08, 2.6); } }

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
  io.yaw -= e.movementX * 0.0022; io.pitch -= e.movementY * 0.0022;
  io.pitch = Math.max(-1.3, Math.min(1.3, io.pitch));
});

// touch: metà sinistra joystick, metà destra guardare
const sguardo = { id: null, x: 0, y: 0 };
addEventListener('touchstart', e => {
  if (fase !== 'gioco') return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('button')) continue;
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
      io.yaw -= (t.clientX - sguardo.x) * 0.0055; io.pitch -= (t.clientY - sguardo.y) * 0.0045;
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

function muoviGiocatore(dt) {
  let ax = 0, az = 0;
  if (tasti.KeyW || tasti.ArrowUp) az -= 1;
  if (tasti.KeyS || tasti.ArrowDown) az += 1;
  if (tasti.KeyA || tasti.ArrowLeft) ax -= 1;
  if (tasti.KeyD || tasti.ArrowRight) ax += 1;
  if (joy.id !== null) { ax += joy.x; az += joy.y; }
  let l = Math.hypot(ax, az); if (l > 1) { ax /= l; az /= l; l = 1; }
  const vuoleCorrere = (tasti.ShiftLeft || tasti.ShiftRight || corriTouch) && l > 0.3 && az < 0.2;
  const corre = vuoleCorrere && !io.sfinito && io.fiato > 0;
  if (corre) { io.fiato -= dt / 7.5; if (io.fiato <= 0) { io.fiato = 0; io.sfinito = true; } }
  else { io.fiato = Math.min(1, io.fiato + dt / (io.sfinito ? 14 : 10)); if (io.sfinito && io.fiato > 0.35) io.sfinito = false; }
  const vmax = corre ? 4.7 : 2.3;
  const s = Math.sin(io.yaw), c = Math.cos(io.yaw);
  let dx = (ax * c + az * s) * vmax * dt, dz = (-ax * s + az * c) * vmax * dt;
  // pendenza: in salita ripida si rallenta, oltre i 40° non si sale
  const q0 = quota(io.x, io.z), q1 = quota(io.x + dx, io.z + dz), passo = Math.hypot(dx, dz);
  if (passo > 0) {
    const pend = (q1 - q0) / passo;
    if (pend > 0.85) { dx *= 0.15; dz *= 0.15; } else if (pend > 0.3) { const k = 1 - (pend - 0.3) * 0.9; dx *= k; dz *= k; }
  }
  const p = { x: io.x + dx, z: io.z + dz };
  // tronchi
  tronchiVicini(p.x, p.z, 2, t => {
    const ddx = p.x - t.x, ddz = p.z - t.z, d = Math.hypot(ddx, ddz), m = t.r + 0.32;
    if (d < m && d > 0.0001) { p.x = t.x + ddx / d * m; p.z = t.z + ddz / d * m; }
  });
  spingiFuoriCase(p, 0.35);
  p.x = Math.max(-LIMITE, Math.min(LIMITE, p.x)); p.z = Math.max(-LIMITE, Math.min(LIMITE, p.z));
  const fatto = Math.hypot(p.x - io.x, p.z - io.z);
  io.vel = fatto / Math.max(dt, 1e-4);
  io.x = p.x; io.z = p.z;
  io.passi += fatto;
  const lungo = corre ? 1.25 : 0.8;
  if (io.passi > lungo) { io.passi = 0; suono('passo' + (corre ? 4 + (Math.random() * 2 | 0) : 1 + (Math.random() * 3 | 0)), corre ? 0.45 : 0.3, 0.9 + Math.random() * 0.2); }
  io.dondolo += fatto * (corre ? 5.2 : 6.5);
  const bob = Math.sin(io.dondolo) * (corre ? 0.07 : 0.035) * Math.min(1, io.vel);
  camera.position.set(io.x, quota(io.x, io.z) + 1.65 + bob, io.z);
  camera.rotation.set(io.pitch, io.yaw, Math.sin(io.dondolo * 0.5) * 0.006 * io.vel, 'YXZ');
  if (fiatone) fiatone.setVolume(io.fiato < 0.35 ? (0.35 - io.fiato) * 1.6 : Math.max(0, fiatone.getVolume() - dt * 0.2));
}

function aggiornaTorcia(dt, t) {
  if (io.torcia) io.batteria = Math.max(0, io.batteria - dt / (VELOCE ? 300 : 900));
  if (io.batteria <= 0) io.torcia = false;
  let k = io.torcia ? 0.35 + 0.65 * Math.min(1, io.batteria * 3) : 0;
  if (io.torcia && io.batteria < 0.15 && Math.sin(t * 23) * Math.sin(t * 7.3) > 0.55) k *= 0.15;   // tremolio a batteria scarica
  torcia.intensity = TORCIA_MAX * k; alone.intensity = 1.2 * k + 0.1;
  ui.batteria.style.width = (io.batteria * 100) + '%';
  ui.batteria.classList.toggle('basso', io.batteria < 0.2);
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
  mostra('prendi', !!foglioVicino && !TOCCO);
  mostra('t-prendi', !!foglioVicino && TOCCO);
}
function provaPrendere() {
  if (!foglioVicino) return;
  const f = foglioVicino; f.preso = true; f.m.visible = false; foglioVicino = null;
  io.fogli++; io.check = { x: io.x, z: io.z };
  suono('foglio', 0.9);
  ui.fogli.innerHTML = `Fogli <b>${io.fogli}</b>/10`;
  ui.foglioGrande.classList.remove('nascosto');
  const carta = ui.foglioGrande.firstElementChild; carta.style.animation = 'none'; void carta.offsetWidth; carta.style.animation = '';
  setTimeout(() => ui.foglioGrande.classList.add('nascosto'), 1700);
  if (storia === 'solo') attesa -= 30;    // ogni foglio preso lo fa tornare prima
  if (storia === 'caccia' && Math.random() < 0.5) setTimeout(() => dici(pesca(BATTUTE.caccia), 3200), 900);
  if (io.fogli >= 10) vittoria();
}

/* ── dialoghi ── */
const coda = []; let parlando = null, tParla = 0, tScrivi = 0;
function dici(testo, durata) { coda.push({ testo, durata: durata || 2600 + testo.length * 45 }); }
function aggiornaDialogo(dt) {
  if (!parlando && coda.length) { parlando = coda.shift(); tParla = 0; tScrivi = 0; ui.battuta.textContent = ''; mostra('dialogo', true); }
  if (!parlando) return;
  tParla += dt * 1000;
  const n = Math.min(parlando.testo.length, Math.floor(tParla / 28));
  if (n !== tScrivi) { tScrivi = n; ui.battuta.textContent = parlando.testo.slice(0, n); }
  if (tParla > parlando.durata) { parlando = null; if (!coda.length) mostra('dialogo', false); }
}
let tDid = null;
function didascalia(testo, ms = 4500) {
  ui.didascalia.textContent = testo; mostra('didascalia', true); ui.didascalia.style.opacity = 1;
  clearTimeout(tDid); tDid = setTimeout(() => { ui.didascalia.style.opacity = 0; setTimeout(() => mostra('didascalia', false), 800); }, ms);
}
function pesca(l) { return l[Math.random() * l.length | 0]; }

/* ── percorso di Guerrino: dalla fine del paese, su per la carrareccia, fino alla Fonticella Petri ── */
const PERCORSO = [[-138, 388], [-117, 377], [-108, 367], [-75, 354], [-50, 337], [-34, 325], [FONTE.x - 1.5, FONTE.z + 3.5]];
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

function camminaSu(lista, dt, vel) {
  const [tx, tz] = lista[guerrino.tappa];
  const dx = tx - guerrino.x, dz = tz - guerrino.z, d = Math.hypot(dx, dz);
  if (d < 0.6) { guerrino.tappa++; return guerrino.tappa >= lista.length; }
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

// Guerrino mena l'albero, per sempre: una mossa dopo l'altra, col botto a tempo
function aggiornaMena(dt, t) {
  const tr = guerrino.albero;
  if (!guerrino.corrente || finita(guerrino) || guerrino.nomeAz === 'cammina') {
    guerrino.mossa = (guerrino.mossa + 1) % MOSSE.length;
    const nome = MOSSE[guerrino.mossa];
    recita(guerrino, nome, true, 0.2);
    guerrino.colpiFatti = 0;
    // ogni tanto riprende fiato
    if (Math.random() < 0.12) { recita(guerrino, 'stanco', true, 0.3); guerrino.colpiFatti = 9; }
  }
  const a = guerrino.corrente, nome = guerrino.nomeAz, fr = a.time / a.getClip().duration, lista = COLPI[nome] || [];
  while (guerrino.colpiFatti < lista.length && fr >= lista[guerrino.colpiFatti]) {
    guerrino.colpiFatti++;
    scuoti(tr, 0.6);
    if (pugnoAudio && guerrino.g.visible) {
      pugnoAudio.setBuffer(buf['pugno' + (1 + (Math.random() * 3 | 0))]);
      pugnoAudio.setPlaybackRate(0.9 + Math.random() * 0.2);
      if (pugnoAudio.isPlaying) pugnoAudio.stop();
      pugnoAudio.play();
    }
  }
  if (tr) { giraVerso(Math.atan2(tr.x - guerrino.x, tr.z - guerrino.z), dt, 3); disegna(guerrino); }
  // se gli passi vicino, ti dice qualcosa
  const d = Math.hypot(io.x - guerrino.x, io.z - guerrino.z);
  if (d < 7 && t > guerrino.prossimo && storia !== 'caccia') { guerrino.prossimo = t + 14; dici(pesca(BATTUTE.mena), 2600); }
}

function aggiornaStoria(dt, t) {
  tStoria += dt;
  guerrino.vel = 0;
  if (guerrino.mena) aggiornaMena(dt, t);
  const dGioc = Math.hypot(io.x - guerrino.x, io.z - guerrino.z);
  if (storia === 'intro') {
    giraVerso(guardaVerso(io.x, io.z), dt, 3);
    disegna(guerrino);
    if (tStoria > 0.8 && !guerrino.detto) { guerrino.detto = true; BATTUTE.intro.forEach(b => dici(b)); }
    if (guerrino.detto && !coda.length && !parlando) { storia = 'strada'; tStoria = 0; guerrino.tappa = 0; }
    return;
  }
  if (storia === 'strada') {
    if (dGioc > 11) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3);
      if (t > guerrino.prossimo) { guerrino.prossimo = t + 9; dici(pesca(BATTUTE.indietro), 2400); }
    } else if (dGioc < 8 || guerrino.tappa === 0) {
      const prima = guerrino.tappa;
      const arrivato = camminaSu(PERCORSO, dt, 1.25);
      if (guerrino.tappa !== prima && TAPPE_FRASI[guerrino.tappa] !== undefined) dici(BATTUTE.strada[TAPPE_FRASI[guerrino.tappa]]);
      if (arrivato) { storia = 'fonte'; tStoria = 0; guerrino.fase = 0; }
    }
    disegna(guerrino);
    return;
  }
  if (storia === 'fonte') {
    // arriva, si gira, ha il fiatone; poi si piega stanco; poi se la prende con l'albero
    if (guerrino.fase === 0) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3); disegna(guerrino);
      if (dGioc < 10 || tStoria > 20) { guerrino.fase = 1; BATTUTE.fonte.forEach(b => dici(b)); }
    } else if (guerrino.fase === 1) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3); disegna(guerrino);
      if (!coda.length && !parlando) { guerrino.fase = 2; tStoria = 0; recita(guerrino, 'stanco', false, 0.4); }
    } else if (guerrino.fase === 2) {
      if (tStoria > 4.5) { guerrino.fase = 3; recita(guerrino, 'cammina', false, 0.4); BATTUTE.sfogo.forEach(b => dici(b)); }
    } else if (guerrino.fase === 3) {
      if (!coda.length && !parlando) {
        guerrino.fase = 4;
        const tr = alberoDiGuerrino(); guerrino.albero = tr;
        guerrino.verso = tr ? [tr.x + (FONTE.x - tr.x) / Math.hypot(FONTE.x - tr.x, FONTE.z - tr.z) * (tr.r + 0.75), tr.z + (FONTE.z - tr.z) / Math.hypot(FONTE.x - tr.x, FONTE.z - tr.z) * (tr.r + 0.75)] : [guerrino.x, guerrino.z];
        guerrino.tappa = 0;
      }
    } else if (guerrino.fase === 4) {
      if (camminaSu([guerrino.verso], dt, 1.1)) {
        guerrino.mena = true; guerrino.mossa = -1; guerrino.corrente = guerrino.az.cammina; guerrino.prossimo = t + 10;
        storia = 'solo'; tStoria = 0; io.check = { x: io.x, z: io.z };
        attesa = VELOCE ? 25 : 240;
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

/* ════════ LA CACCIA: PAPI ════════ */
let papiVoce = null, papiPassi = null, pugnoAudio = null;
function iniziaCaccia(t) {
  storia = 'caccia'; tCaccia = 0;
  didascalia('Tra gli alberi si muove qualcosa. Qualcosa di molto alto.', 5500);
  setTimeout(() => { if (storia === 'caccia' && fase === 'gioco') dici(BATTUTE.caccia[0], 3000); }, 6000);
  papi.g.visible = false; papi.stato = 'assente'; papi.prossimo = t + (VELOCE ? 4 : 10);
  const a = Math.random() * 6.28;
  posa(papi, io.x + Math.sin(a) * 50, io.z + Math.cos(a) * 50, 0);
  versoPapi('frasche', 1, 0.8);
}
function versoPapi(nome, vol = 1, rate = 1) {
  if (!papiVoce || !buf[nome]) return;
  if (papiVoce.isPlaying) papiVoce.stop();
  papiVoce.setBuffer(buf[nome]); papiVoce.setVolume(vol); papiVoce.setPlaybackRate(rate); papiVoce.play();
}

const _v = new THREE.Vector3();
// quanto vedo un personaggio (0 = per niente): nell'inquadratura e senza tronchi in mezzo
function visibileDaMe(p, maxD, altezza = 1.3) {
  const dx = p.x - io.x, dz = p.z - io.z, d = Math.hypot(dx, dz);
  if (!p.g.visible || d > maxD) return 0;
  _v.set(p.x, quota(p.x, p.z) + altezza, p.z).project(camera);
  if (_v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) return 0;
  let coperto = false;
  const passi = Math.ceil(d / 3);
  for (let i = 1; i < passi && !coperto; i++) {
    const px = io.x + dx * i / passi, pz = io.z + dz * i / passi;
    tronchiVicini(px, pz, 1, tr => {
      if (coperto) return;
      const t2 = ((tr.x - io.x) * dx + (tr.z - io.z) * dz) / (d * d);
      if (t2 <= 0.05 || t2 >= 0.95) return;
      const cx = io.x + dx * t2, cz = io.z + dz * t2;
      if (Math.hypot(tr.x - cx, tr.z - cz) < tr.r * 0.9) coperto = true;
    });
  }
  return coperto ? 0 : 1 - Math.abs(_v.x) * 0.5;
}

function alberoPerApparire(dist, davanti) {
  const av = avanti(); let best = null, bestS = Infinity;
  for (let k = 0; k < 40; k++) {
    let a = Math.random() * 6.28;
    if (davanti) a = Math.atan2(av.x, av.z) + (Math.random() - 0.5) * 1.6;
    const x = io.x + Math.sin(a) * dist, z = io.z + Math.cos(a) * dist;
    tronchiVicini(x, z, 6, tr => {
      if (!tr.mesh) return;
      const s = Math.abs(Math.hypot(tr.x - io.x, tr.z - io.z) - dist);
      if (s < bestS) { bestS = s; best = tr; }
    });
    if (best && bestS < 3) break;
  }
  return best;
}

// muove Papi verso di te schivando i tronchi; ogni tanto fa tremare l'albero che sfiora
function avanzaPapi(dt, v) {
  let dx = io.x - papi.x, dz = io.z - papi.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
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
  papiPassi.setBuffer(buf['passo' + (4 + (Math.random() * 2 | 0))]);
  papiPassi.setPlaybackRate(0.5 + Math.random() * 0.08); papiPassi.setVolume(vol);
  if (papiPassi.isPlaying) papiPassi.stop();
  papiPassi.play();
}

function aggiornaCaccia(dt, t) {
  tCaccia += dt;
  livello = io.fogli + tCaccia / 120;
  papi.vel = 0;
  const d = Math.hypot(io.x - papi.x, io.z - papi.z);
  const alto = papi.stato === 'insegue' || papi.stato === 'salta' ? 2.2 : 0.9;
  const vis = visibileDaMe(papi, io.torcia ? 45 : 15, alto);

  if (papi.stato === 'assente') {
    if (t > papi.prossimo) {
      const pInsegue = io.fogli >= 2 ? Math.min(0.5, 0.15 + livello * 0.04) : 0;
      if (Math.random() < pInsegue) {
        // ti arriva da dietro, di corsa
        const av = avanti(), a = Math.atan2(av.x, av.z) + Math.PI + (Math.random() - 0.5) * 1.2;
        posa(papi, io.x + Math.sin(a) * 32, io.z + Math.cos(a) * 32, 0);
        papi.stato = 'insegue'; papi.fine = t + 12 + Math.random() * 8; papi.g.visible = true;
        recita(papi, 'corsa', false, 0.05);
        versoPapi('frasche', 1, 0.7);
        if (Math.random() < 0.6) dici(pesca(BATTUTE.caccia), 2800);
      } else {
        // agguato: sbuca da dietro un albero, a quattro zampe
        const dist = Math.max(11, 27 - livello * 2) + Math.random() * 6;
        const tr = alberoPerApparire(dist, Math.random() < 0.55);
        if (tr) {
          const a = Math.atan2(io.x - tr.x, io.z - tr.z) + (Math.random() < 0.5 ? 1 : -1) * 0.9;
          posa(papi, tr.x + Math.sin(a) * (tr.r + 0.9), tr.z + Math.cos(a) * (tr.r + 0.9), 0);
          papi.rot = guardaVerso(io.x, io.z, papi); disegna(papi);
          papi.stato = 'agguato'; papi.fine = t + 9 + Math.random() * 6; papi.g.visible = true;
          recita(papi, Math.random() < 0.5 ? 'gattona' : 'striscia', false, 0.05);
          scuoti(tr, 1);
          versoPapi('scricchiolio', 0.9, 0.7 + Math.random() * 0.15);
        } else papi.prossimo = t + 2;
      }
    }
  } else if (papi.stato === 'agguato') {
    // se lo guardi si ferma; se ti giri, striscia verso di te
    if (vis === 0) { avanzaPapi(dt, (papi.nomeAz === 'gattona' ? 1.5 : 1.0) + livello * 0.06); passoPapi(2.2, 0.35); }
    else giraVerso(guardaVerso(io.x, io.z, papi), dt, 3, papi);
    disegna(papi);
    if (d < 8 + livello * 0.3) {
      papi.stato = 'salta'; papi.tSalto = 0; recita(papi, 'salto', true, 0.1);
      versoPapi('frasche', 1, 0.6);
    } else if (t > papi.fine && vis === 0) { papi.g.visible = false; papi.stato = 'assente'; papi.prossimo = t + Math.max(6, 20 - livello * 1.4) * (0.7 + Math.random() * 0.6); }
  } else if (papi.stato === 'salta') {
    // il balzo: nella parte in volo dell'animazione ti viene addosso
    papi.tSalto += dt;
    const fr = papi.corrente.time / papi.corrente.getClip().duration;
    if (fr > 0.12 && fr < 0.42 && d > 2) avanzaPapi(dt, 7);
    else giraVerso(guardaVerso(io.x, io.z, papi), dt, 4, papi);
    disegna(papi);
    if (fr > 0.62 || finita(papi)) { papi.stato = 'insegue'; papi.fine = t + 8 + Math.random() * 5; recita(papi, 'corsa', false, 0.3); }
  } else if (papi.stato === 'insegue') {
    avanzaPapi(dt, 3.1 + livello * 0.14);
    passoPapi(1.6, 1);
    disegna(papi);
    if (t > papi.fine && vis === 0) { papi.g.visible = false; papi.stato = 'assente'; papi.prossimo = t + Math.max(6, 18 - livello * 1.2); }
  }

  // guardarlo fa salire lo statico; troppo vicino = preso
  if (papi.g.visible && vis > 0) {
    const dd = Math.max(0, 1 - d / 45);
    staticoV += dt * vis * (0.08 + dd * dd * 0.5) * (1 + livello * 0.06);
  } else staticoV -= dt * 0.3;
  if (papi.g.visible && d < 2.3) staticoV = 1;
  staticoV = Math.max(0, Math.min(1, staticoV));
  if (staticoV >= 1) preso();
}

/* ── statico a schermo ── */
const sg = ui.statico.getContext('2d');
const sImg = sg.createImageData(160, 90);
function disegnaStatico(t) {
  const vicino = papi.g.visible ? Math.max(0, 1 - Math.hypot(io.x - papi.x, io.z - papi.z) / 40) * 0.25 : 0;
  const k = Math.min(1, staticoV + vicino);
  ui.statico.style.opacity = (k * k * 0.85).toFixed(3);
  if (rumore) rumore.setVolume(k * k * 0.5);
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

/* ════════ STATI DEL GIOCO ════════ */
function preso() {
  if (fase !== 'gioco') return;
  fase = 'morto'; io.morti++;
  // ultimo sguardo: girati verso di lui, e guarda in su (è alto tre metri)
  const a = Math.atan2(-(papi.x - io.x), -(papi.z - io.z));
  io.yaw = a; io.pitch = 0.5;
  posa(papi, io.x - Math.sin(a) * 2.1, io.z - Math.cos(a) * 2.1, a);
  papi.g.visible = true; papi.vel = 0; papi.stato = 'preso';
  const sl = recita(papi, 'salto', true, 0.05);
  if (sl) { sl.time = sl.getClip().duration * 0.4; sl.paused = true; }   // braccia alzate
  papi.mixer.update(0.3);
  camera.rotation.set(io.pitch, io.yaw, 0, 'YXZ');
  suono('colpo', 1); suono('scricchiolio', 0.6);
  ui.statico.style.opacity = 0.9;
  setTimeout(() => {
    ui.buio.style.opacity = 1;
    setTimeout(() => {
      $('morte-frase').textContent = '«' + pesca(BATTUTE.preso) + '»';
      document.body.classList.add('fuori'); mostra('morte', true);
      if (document.pointerLockElement) document.exitPointerLock();
    }, 700);
  }, 450);
}
function riprova() {
  mostra('morte', false); document.body.classList.remove('fuori');
  io.x = io.check.x; io.z = io.check.z; io.fiato = 1; io.sfinito = false;
  io.batteria = Math.max(io.batteria, 0.25); if (io.batteria > 0) io.torcia = true;
  staticoV = 0; papi.g.visible = false; papi.stato = 'assente';
  papi.prossimo = tGioco + 15;
  if (storia !== 'caccia') { storia = 'caccia'; tCaccia = 0; }
  ui.buio.style.opacity = 0;
  fase = 'gioco';
  if (!TOCCO) canvas.requestPointerLock?.();
}
function vittoria() {
  fase = 'vinto'; storia = 'fine';
  papi.g.visible = false; papi.stato = 'assente';
  const s = Math.round(io.tempo);
  setTimeout(() => {
    ui.buio.style.opacity = 1;
    setTimeout(() => {
      $('vittoria-testo').textContent = `Er bosco tace. Papi se ne torna tra gli alberi; alla Fonticella, Guerrino mena ancora. Tempo: ${mmss(s)}${io.morti ? ` · prese: ${io.morti}` : ''}.`;
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
  if (si) { ascolto.context.suspend?.(); if (document.pointerLockElement) document.exitPointerLock(); }
  else { ascolto.context.resume?.(); if (!TOCCO) canvas.requestPointerLock?.(); }
}
$('pausa-btn').addEventListener('click', () => pausa(true));
$('riprendi').addEventListener('click', () => pausa(false));
$('riprova').addEventListener('click', riprova);
$('ancora').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden && fase === 'gioco') pausa(true); });
addEventListener('keydown', e => { if (e.code === 'Escape' && fase === 'pausa') pausa(false); });

function controllaOrizzontale() {
  mostra('ruota', TOCCO && innerHeight > innerWidth && (fase === 'gioco'));
}

/* ════════ CLASSIFICA ════════ */
function nomeAccount() { const A = window.GoGoAccount, s = A && A.stato && A.stato(); return s && s.account ? s.account.nome : ''; }
function disegnaClassifica(el) {
  const C = window.ResidentCrevilClassifica;
  if (!C || !C.attiva) { el.innerHTML = ''; return; }
  C.carica(8).then(righe => {
    if (!righe.length) { el.innerHTML = '<h3>Chi è uscito dal bosco</h3><p class="piccolo">Ancora nessuno.</p>'; return; }
    el.innerHTML = '<h3>Chi è uscito dal bosco</h3><ol>' + righe.map(r => `<li><span>${r.nome.replace(/</g, '&lt;')}</span><span>${mmss(r.punti)}</span></li>`).join('') + '</ol>';
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
    C.salva(nome, sec).then(() => { esito.textContent = 'Fatto.'; disegnaClassifica($('classifica-fine')); }, e => { esito.textContent = e.message; });
  };
}

/* ════════ COSTRUZIONE E CICLO ════════ */
const orologio = new THREE.Clock();
let tGioco = 0;
function costruisci(bin, bosco, colori, osm, modello, roncola, modelloPapi, texAlberi) {
  const u16 = new Uint16Array(bin);
  Q = new Float32Array(N * N);
  for (let i = 0; i < Q.length; i++) Q[i] = 1000 + u16[i] / 20;
  FOSSI = osm.fossi;
  creaTerreno(colori);
  creaBosco(bosco, osm, FOGLI_POS, texAlberi);
  creaPaese(osm);
  creaFonte();
  creaFogli();
  creaGuerrino(modello, roncola);
  creaPapi(modelloPapi);
  preparaAudio();
  posaGuerrino(-143.5, 383, 0);
  guerrino.rot = guardaVerso(io.x, io.z); disegna(guerrino); animaGuerrino(0);
  camera.position.set(io.x, quota(io.x, io.z) + 1.65, io.z);
  camera.rotation.set(io.pitch, io.yaw, 0, 'YXZ');
  // primo render per compilare gli shader mentre c'è ancora il caricamento
  renderer.compile(scena, camera);
  renderer.render(scena, camera);
  mostra('caricamento', false); mostra('menu', true);
  document.body.classList.remove('carica'); document.body.classList.add('fuori');
  disegnaClassifica($('classifica-menu'));
  window.__crevil = { PROVA, quota, guarda: (x, z) => { io.yaw = Math.atan2(-(x - io.x), -(z - io.z)); }, info: () => renderer.info.render, io, guerrino, papi, recita, posa, disegna, scena, camera, renderer, salta: s => { storia = s; tStoria = 0; }, caccia: () => { iniziaCaccia(tGioco); papi.prossimo = 0; }, stato: () => ({ storia, fase, attesa, livello, staticoV }) };
}
pronto.catch(e => { console.error(e); $('prog-testo').textContent = 'Il bosco non si carica: ricarica la pagina.'; });

$('gioca').addEventListener('click', () => {
  mostra('menu', false); document.body.classList.remove('fuori');
  fase = 'gioco'; tStoria = 0;
  ascolto.context.resume?.(); avviaLoop();
  if (TOCCO) {
    mostra('touch', true);
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } else canvas.requestPointerLock?.();
  controllaOrizzontale();
});

let tFosso = 0;
function ciclo() {
  requestAnimationFrame(ciclo);
  const dt = Math.min(0.05, orologio.getDelta()) * PROVA.tempo, t = (tGioco += dt);
  if (!Q) return;
  if (fase === 'gioco') {
    if (storia === 'solo' || storia === 'caccia') io.tempo += dt;   // il tempo parte quando Guerrino se ne va
    muoviGiocatore(dt);
    aggiornaTorcia(dt, t);
    if (!PROVA.congela) aggiornaStoria(dt, t);
    aggiornaDialogo(dt);
    cercaFoglio();
    if ((tFosso -= dt) < 0) { tFosso = 0.5; if (fosso) fosso.setVolume(Math.max(0, 1 - distFosso(io.x, io.z) / 70) * 0.6); }
  }
  if (fase === 'gioco' || fase === 'morto') { disegnaStatico(t); animaGuerrino(dt); animaPapi(dt); aggiornaScossi(dt); }
  // accendi solo i pezzi di bosco vicini
  // oltre gli 80 m la nebbia copre tutto: conta il punto del blocco più vicino a me
  const LB = HALF / 26;
  for (const b of BLOCCHI) b.visible = Math.hypot(Math.max(0, Math.abs(b.userData.cx - io.x) - LB), Math.max(0, Math.abs(b.userData.cz - io.z) - LB)) < (TOCCO ? 70 : 80);
  renderer.render(scena, camera);
}
ciclo();
