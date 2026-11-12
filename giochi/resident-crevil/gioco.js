/* ════════════════════════════════════════════════════════════════
   RESIDENT CREVIL: MORTE SUL GREPPO — prototipo
   Notte nei boschi di Capricchia (Amatrice). Guerrino ti porta alla
   Fonticella, ti dice di aspettarlo e se ne va. Dopo qualche minuto
   si sentono le roncolate... Raccogli i 10 fogli prima che ti prenda.

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
const PROVA = { congela: false };   // per i test: ferma la logica di Guerrino
const HALF = 650, N = 261, CELLA = 5, LIMITE = 615;
const TOCCO = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOCCO) document.body.classList.add('tocco');

/* ── testi (Leo li cambierà: sono tutti qui) ── */
const BATTUTE = {
  intro: [
    "Oh, eccote. Tu sei Crivo, giusto? Er fijo de... vabbè, nun importa.",
    "Io so' Guerrino. Stanotte te porto ner bosco, che te devo fa' vede' 'na cosa.",
    "Accendi 'sta torcia, va'. Io ar buio ce vedo uguale. Abitudine.",
    "Statte dietro e nun te perde. Qua se so' persi pure i cani da tartufo.",
  ],
  strada: [
    "Da regazzino qua ce venivo a fa' la legna co' mi' padre. Co' la roncola, mica co' 'ste motoseghe.",
    "Senti che silenzio? D'estate ce stanno i grilli. D'inverno... d'inverno ce sto io.",
    "Là sotto c'è er Fosso de Selva Grande. Dice che la notte se sentono le voci. È er vento. Quasi sempre.",
    "Quell'albero lì l'ho piantato io. Ner cinquantotto. O ner sessantotto. Comunque è venuto storto.",
    "Ah, 'na cosa: si trovi dei fogli attaccati agli alberi, nun li toccà. Nun so' roba tua.",
  ],
  fonte: [
    "Ecco, questa è la Fonticella. Fermate qua.",
    "Aspettame. Vado a pijà 'na cosa e torno subito.",
    "Nun te move. E nun toccà gnente.",
  ],
  indietro: ["Daje, che c'hai le gambe de ricotta?", "Ahò, de qua!", "Nun me fa' tornà indietro.", "Sbrighete, che fa freddo."],
  caccia: ["T'avevo detto de nun toccalli!", "Crivo... Criiivo...", "Er bosco è mio.", "Vie' qua, che te faccio vede' la roncola de mi' padre.", "Nun te move. Te l'avevo detto."],
  preso: ["Che t'avevo detto?", "Mo' te riporto a casa. A pezzi.", "Gnente, nun ascorta più nessuno.", "Dovevi aspettà alla Fonticella.", "La roncola nun sbaja mai."],
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

const SUONI = ['notte', 'fosso', 'roncolate', 'colpo', 'foglio', 'fiatone', 'scricchiolio', 'frasche', 'passo1', 'passo2', 'passo3', 'passo4', 'passo5'];
const buf = {};

const pronto = Promise.all([
  promessa(caricaFile, 'mappa/terreno.bin'),
  immagineDati('mappa/bosco.png'),
  promessa(caricaTex, 'mappa/colori.jpg'),
  fetch('mappa/osm.json').then(r => r.json()),
  promessa(gltf, 'modelli/guerrino.glb'),
  promessa(gltf, 'modelli/roncola.glb').catch(() => null),
  ...SUONI.map(s => promessa(caricaAudio, 'sfx/' + s + '.mp3').then(b => { buf[s] = b; }, () => {})),
]).then(([bin, bosco, colori, osm, modello, roncola]) => costruisci(bin, bosco, colori, osm, modello, roncola));

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
function colora(geo, col) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  const cc = new THREE.Color(col);
  for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
function bitorzola(geo, r, quanto) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * quanto;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * (1 + (r() - 0.5) * quanto * 0.6), p.getZ(i) * k);
  }
  return geo;
}
function pulisci(g) { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'color') g.deleteAttribute(k); return g; }
function modelliAlberi() {
  const r = rand(5), T = 0x3b2f25;
  // A: latifoglia (cerro, faggio)
  const a = [colora(new THREE.CylinderGeometry(0.16, 0.3, 5, 6, 1, true).translate(0, 2.5, 0), T)];
  for (let i = 0; i < 4; i++) {
    const s = 1.6 + r() * 1.1;
    a.push(colora(bitorzola(new THREE.IcosahedronGeometry(s, 1), r, 0.3).translate((r() - 0.5) * 2.2, 5.6 + r() * 2.2, (r() - 0.5) * 2.2), i % 2 ? 0x1f3018 : 0x26391c));
  }
  // B: faggio alto e sottile
  const b = [colora(new THREE.CylinderGeometry(0.12, 0.24, 8.5, 6, 1, true).translate(0, 4.25, 0), 0x4a443c)];
  for (let i = 0; i < 3; i++) b.push(colora(bitorzola(new THREE.IcosahedronGeometry(1.3 + r() * 0.8, 1), r, 0.3).translate((r() - 0.5) * 1.6, 8 + r() * 2.5, (r() - 0.5) * 1.6), 0x223419));
  // C: abete / pino nero
  const c = [colora(new THREE.CylinderGeometry(0.1, 0.25, 4, 5, 1, true).translate(0, 2, 0), T)];
  for (let i = 0; i < 4; i++) c.push(colora(new THREE.ConeGeometry(2.6 - i * 0.55, 3.2, 7, 1, true).translate(0, 3 + i * 1.9, 0), 0x16261a));
  // D: cespuglio
  const d = [colora(bitorzola(new THREE.IcosahedronGeometry(0.9, 0), r, 0.5).scale(1.3, 0.75, 1.3).translate(0, 0.4, 0), 0x1d2c15),
             colora(bitorzola(new THREE.IcosahedronGeometry(0.6, 0), r, 0.5).translate(0.7, 0.35, 0.3), 0x22331a)];
  return [a, b, c, d].map(l => mergeGeometries(l.map(pulisci)));
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
function creaBosco(bosco, osm, fogliPos) {
  const geos = modelliAlberi();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const r = rand(1234);
  const dens = (x, z) => {
    const i = Math.min(bosco.w - 1, Math.max(0, Math.round((x + HALF) / (HALF * 2) * (bosco.w - 1))));
    const j = Math.min(bosco.h - 1, Math.max(0, Math.round((z + HALF) / (HALF * 2) * (bosco.h - 1))));
    return bosco.d[(j * bosco.w + i) * 4] / 255;
  };
  const libero = (x, z) => !fogliPos.some(f => Math.hypot(f[0] - x, f[1] - z) < 3.5);
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

  const NB = 13, LATO = HALF * 2 / NB;
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
      const im = new THREE.InstancedMesh(geos[tipo], mat, l.length);
      l.forEach((t, i) => {
        qq.setFromAxisAngle(su, t[4]); sc.set(t[3], t[3] * (0.9 + (i % 5) * 0.06), t[3]);
        v.set(t[0], quota(t[0], t[1]) - 0.15, t[1]);
        m4.compose(v, qq, sc); im.setMatrixAt(i, m4);
        if (tipo < 3) aggiungiTronco({ x: t[0], z: t[1], r: (tipo === 1 ? 0.22 : 0.28) * t[3] + 0.05, mesh: im, i, s: t[3], rot: t[4], y: v.y });
      });
      im.computeBoundingSphere();
      g.add(im);
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
const FONTE = { x: 233, z: 263 };
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

/* ════════ GUERRINO ════════ */
const guerrino = { g: new THREE.Group(), stato: 'guida', x: 0, z: 0, rot: 0, t: 0, passo: 0, tappa: 0, inclina: 0, vel: 0, colpo: 0, prossimo: 0, fine: 0, bersaglio: null };
let roncolaAudio = null, colpoAudio = null;
function creaGuerrino(modello, roncola) {
  const m = modello.scene;
  // Lambert come il resto della scena: col PBR la torcia lo sbianca
  m.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const v = o.material;
    o.material = new THREE.MeshLambertMaterial({ map: v.map, normalMap: v.normalMap || null, color: 0x77716a });
  });
  guerrino.corpo = m;
  guerrino.g.add(m);
  const osso = n => m.getObjectByName(n);
  guerrino.braccio = osso('RightArm'); guerrino.avambraccio = osso('RightForeArm');
  // camminata (unica animazione del modello): tolgo lo spostamento in avanti delle anche,
  // così la velocità la decide il gioco; v0 = metri al secondo della camminata originale
  const clip = modello.animations[0];
  guerrino.v0 = 1.2;
  if (clip) {
    const tr = clip.tracks.find(t => /Hips\.position$/.test(t.name));
    if (tr) {
      const v = tr.values, n = v.length / 3;
      guerrino.v0 = Math.max(0.4, Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]) / clip.duration);
      for (let i = 0; i < n; i++) { v[i * 3] = v[0]; v[i * 3 + 2] = v[2]; }
    }
    guerrino.mixer = new THREE.AnimationMixer(m);
    guerrino.passo1 = guerrino.mixer.clipAction(clip); guerrino.passo1.play();
    // posa da fermo: il fotogramma con i piedi più vicini
    const piedeS = osso('LeftFoot'), piedeD = osso('RightFoot'), a = new THREE.Vector3(), b = new THREE.Vector3();
    let best = 0, bd = Infinity;
    for (let t = 0; t < clip.duration; t += clip.duration / 32) {
      guerrino.mixer.setTime(t); m.updateMatrixWorld(true);
      const d = piedeS.getWorldPosition(a).distanceTo(piedeD.getWorldPosition(b));
      if (d < bd) { bd = d; best = t; }
    }
    guerrino.tFermo = best;
  }
  // la roncola di Leo in mano destra (il modello è alto 1,9 "unità": la porto a 50 cm)
  const mano = osso('RightHand');
  if (roncola && mano) {
    const r = roncola.scene;
    r.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    r.position.set(0, -1.65, 0);
    const perno = new THREE.Group(); perno.add(r);
    perno.scale.setScalar(0.27); perno.position.set(0, 0.085, 0); perno.rotation.set(0, 0, Math.PI / 2 + 0.6);
    mano.add(perno);
  }
  scena.add(guerrino.g);
}

// velocità (m/s) e colpo (0 = braccio giù, 1 = roncola alzata, <0 = colpo affondato) decisi dalla logica
const _qc = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
function animaGuerrino(dt) {
  if (!guerrino.mixer || !guerrino.g.visible) return;
  const v = guerrino.vel || 0, az = guerrino.passo1;
  if (v > 0.05) { az.paused = false; az.timeScale = v / guerrino.v0; }
  else { az.paused = true; az.time += (guerrino.tFermo - az.time) * Math.min(1, dt * 6); }
  guerrino.mixer.update(dt);
  const c = guerrino.colpo || 0;
  if (c !== 0 && guerrino.braccio) {
    guerrino.braccio.quaternion.multiply(_qc.setFromAxisAngle(_ax, c * 2.2));
    guerrino.avambraccio.quaternion.multiply(_qc.setFromAxisAngle(_ax, Math.max(0, c) * 0.9));
  }
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
  if (buf.roncolate) {
    roncolaAudio = new THREE.PositionalAudio(ascolto); roncolaAudio.setBuffer(buf.roncolate);
    roncolaAudio.setRefDistance(10); roncolaAudio.setRolloffFactor(0.8); roncolaAudio.setDistanceModel('inverse');
    roncolaAudio.position.set(0, 1.2, 0);
    guerrino.g.add(roncolaAudio);
  }
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

/* ── percorso di Guerrino: dalla fine del paese, su per la carrareccia, fino alla Fonticella ── */
const PERCORSO = [[-138, 388], [-117, 377], [-108, 367], [-75, 354], [-34, 325], [-13, 320], [17, 321], [58, 338], [80, 342], [120, 339], [151, 327], [177, 326], [184, 321], [196, 273], [203, 267], [222, 266], [229, 262]];
const VIA = [[240, 250], [266, 236], [273, 232], [305, 239], [322, 232], [320, 196], [329, 195], [331, 172]];
const TAPPE_FRASI = { 3: 0, 6: 1, 9: 2, 12: 3, 14: 4 };

function posaGuerrino(x, z, rot, vola = 0) {
  guerrino.x = x; guerrino.z = z; guerrino.rot = rot;
  guerrino.g.position.set(x, quota(x, z) + vola, z);
  guerrino.g.rotation.set(0, rot, 0);
}
function guardaVerso(x, z) { return Math.atan2(x - guerrino.x, z - guerrino.z); }
function giraVerso(target, dt, vel = 4) {
  let d = target - guerrino.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  guerrino.rot += d * Math.min(1, dt * vel);
}

function camminaSu(lista, dt, vel) {
  const [tx, tz] = lista[guerrino.tappa];
  const dx = tx - guerrino.x, dz = tz - guerrino.z, d = Math.hypot(dx, dz);
  if (d < 0.6) { guerrino.tappa++; return guerrino.tappa >= lista.length; }
  const s = Math.min(d, vel * dt);
  guerrino.x += dx / d * s; guerrino.z += dz / d * s; guerrino.vel = vel;
  giraVerso(Math.atan2(dx, dz), dt, 5);
  guerrino.passo += s;
  return false;
}
function disegnaGuerrino() {
  guerrino.g.position.set(guerrino.x, quota(guerrino.x, guerrino.z), guerrino.z);
  guerrino.g.rotation.set(guerrino.inclina || 0, guerrino.rot, 0);
}

function aggiornaStoria(dt, t) {
  tStoria += dt;
  guerrino.vel = 0;
  const dGioc = Math.hypot(io.x - guerrino.x, io.z - guerrino.z);
  if (storia === 'intro') {
    giraVerso(guardaVerso(io.x, io.z), dt, 3);
    disegnaGuerrino(t, 0);
    if (tStoria > 0.8 && !guerrino.detto) { guerrino.detto = true; BATTUTE.intro.forEach(b => dici(b)); }
    if (guerrino.detto && !coda.length && !parlando) { storia = 'strada'; tStoria = 0; guerrino.tappa = 0; guerrino.passo = 0; }
    return;
  }
  if (storia === 'strada') {
    if (dGioc > 11) {
      giraVerso(guardaVerso(io.x, io.z), dt, 3);
      if (t > guerrino.prossimo) { guerrino.prossimo = t + 9; dici(pesca(BATTUTE.indietro), 2400); }
    } else if (dGioc < 8 || guerrino.tappa === 0) {
      const prima = guerrino.tappa;
      const arrivato = camminaSu(PERCORSO, dt, 1.35);
      if (guerrino.tappa !== prima && TAPPE_FRASI[guerrino.tappa] !== undefined) dici(BATTUTE.strada[TAPPE_FRASI[guerrino.tappa]]);
      if (arrivato) { storia = 'fonte'; tStoria = 0; }
    }
    disegnaGuerrino(t);
    return;
  }
  if (storia === 'fonte') {
    giraVerso(guardaVerso(io.x, io.z), dt, 3);
    disegnaGuerrino(t, 0);
    if (dGioc < 9 && !guerrino.fonteDetta) { guerrino.fonteDetta = true; BATTUTE.fonte.forEach(b => dici(b)); }
    if (guerrino.fonteDetta && !coda.length && !parlando) { storia = 'via'; guerrino.tappa = 0; io.check = { x: io.x, z: io.z }; }
    return;
  }
  if (storia === 'via') {
    const finito = guerrino.tappa >= VIA.length || camminaSu(VIA, dt, 1.5);
    if (finito) {
      // arrivato: sparisce appena non lo guardi
      giraVerso(guardaVerso(io.x, io.z), dt, 2);
      if (dGioc < 14 && !guerrino.sgridato) { guerrino.sgridato = true; dici("T'ho detto d'aspettà alla Fonticella!", 2600); }
    }
    disegnaGuerrino(t, finito ? 0 : 1);
    if ((finito && visibileDaMe(60) === 0) || dGioc > 34) {
      guerrino.g.visible = false; storia = 'solo'; tStoria = 0;
      attesa = VELOCE ? 25 : 240;
    }
    return;
  }
  if (storia === 'solo') {
    attesa -= dt;
    if (attesa <= 0) iniziaCaccia(t);
    return;
  }
  if (storia === 'caccia') aggiornaCaccia(dt, t, dGioc);
}

/* ════════ LA CACCIA ════════ */
function iniziaCaccia(t) {
  storia = 'caccia'; tCaccia = 0;
  didascalia('Da qualche parte nel bosco, qualcuno sta menando un albero.', 5500);
  // le prime roncolate, lontane
  const a = Math.random() * 6.28;
  posaGuerrino(io.x + Math.sin(a) * 60, io.z + Math.cos(a) * 60, 0);
  guerrino.g.visible = false;
  if (roncolaAudio) { roncolaAudio.setVolume(1); roncolaAudio.play(); }
  guerrino.stato = 'assente'; guerrino.prossimo = t + 12;
}

const _v = new THREE.Vector3();
function visibileDaMe(maxD) {
  const dx = guerrino.x - io.x, dz = guerrino.z - io.z, d = Math.hypot(dx, dz);
  if (!guerrino.g.visible || d > maxD) return 0;
  _v.set(guerrino.x, quota(guerrino.x, guerrino.z) + 1.3, guerrino.z).project(camera);
  if (_v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) return 0;
  // alberi in mezzo?
  let coperto = false;
  const passi = Math.ceil(d / 3);
  for (let i = 1; i < passi && !coperto; i++) {
    const px = io.x + dx * i / passi, pz = io.z + dz * i / passi;
    tronchiVicini(px, pz, 1, tr => {
      if (coperto) return;
      // distanza del tronco dal segmento
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

function scuotiAlbero(tr) {
  if (!tr || !tr.mesh) return;
  guerrino.albero = tr; guerrino.tScuoti = 0;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function aggiornaScuoti(dt) {
  const tr = guerrino.albero; if (!tr) return;
  guerrino.tScuoti += dt;
  const k = Math.max(0, 1 - guerrino.tScuoti / 3);
  const fase = Math.sin(guerrino.tScuoti * 14) * 0.035 * k;
  _e.set(fase, tr.rot, fase * 0.6); _q.setFromEuler(_e);
  _s.set(tr.s, tr.s, tr.s); _p.set(tr.x, tr.y, tr.z);
  _m4.compose(_p, _q, _s); tr.mesh.setMatrixAt(tr.i, _m4); tr.mesh.instanceMatrix.needsUpdate = true;
  if (k <= 0) guerrino.albero = null;
}

function aggiornaCaccia(dt, t, d) {
  tCaccia += dt;
  livello = io.fogli + tCaccia / 120;
  const vis = visibileDaMe(io.torcia ? 45 : 15);
  aggiornaScuoti(dt);

  if (guerrino.stato === 'assente') {
    if (t > guerrino.prossimo) {
      // inseguimento vero o apparizione davanti a un albero
      const pInsegue = io.fogli >= 2 ? Math.min(0.5, 0.15 + livello * 0.04) : 0;
      if (Math.random() < pInsegue) {
        const av = avanti(), a = Math.atan2(av.x, av.z) + Math.PI + (Math.random() - 0.5) * 1.2;
        posaGuerrino(io.x + Math.sin(a) * 32, io.z + Math.cos(a) * 32, 0);
        guerrino.stato = 'insegue'; guerrino.fine = t + 12 + Math.random() * 8; guerrino.passo = 0; guerrino.colpo = 0;
        guerrino.g.visible = true; guerrino.inclina = 0.14;
        if (roncolaAudio) { roncolaAudio.setPlaybackRate(1.15); roncolaAudio.play(); }
        if (Math.random() < 0.6) dici(pesca(BATTUTE.caccia), 2600);
      } else {
        const dist = Math.max(10, 27 - livello * 2) + Math.random() * 6;
        const tr = alberoPerApparire(dist, Math.random() < 0.55);
        if (tr) {
          const a = Math.atan2(io.x - tr.x, io.z - tr.z);
          posaGuerrino(tr.x + Math.sin(a) * (tr.r + 0.55), tr.z + Math.cos(a) * (tr.r + 0.55), a + Math.PI * 0.85);
          guerrino.stato = 'apposta'; guerrino.fine = t + 7 + Math.random() * 5; guerrino.passo = 0; guerrino.inclina = 0;
          guerrino.g.visible = true; guerrino.tColpo = 0;
          scuotiAlbero(tr);
          if (roncolaAudio) { roncolaAudio.setPlaybackRate(0.95 + Math.random() * 0.1); if (roncolaAudio.isPlaying) roncolaAudio.stop(); roncolaAudio.play(); }
        } else guerrino.prossimo = t + 2;
      }
    }
  } else if (guerrino.stato === 'apposta') {
    // mena l'albero: piccoli scatti a tempo con le roncolate, poi si gira verso di te
    guerrino.tColpo += dt;
    // un colpo ogni 0,45 s come nel suono: alza (1) e cala di scatto (-0.15)
    const ph = (guerrino.tColpo % 0.45) / 0.45;
    const colpo = guerrino.tColpo < 2.7 ? (ph < 0.7 ? ph / 0.7 : 1 - (ph - 0.7) / 0.3 * 1.15) : 0;
    if (guerrino.tColpo > 2.7) giraVerso(guardaVerso(io.x, io.z), dt, 1.2);
    guerrino.colpo = colpo;
    guerrino.g.position.set(guerrino.x, quota(guerrino.x, guerrino.z), guerrino.z);
    guerrino.g.rotation.set(Math.max(0, -colpo) * 0.2, guerrino.rot, 0);
    // se ti avvicini troppo, ti viene addosso
    if (d < 7 + livello * 0.4) { guerrino.stato = 'insegue'; guerrino.fine = t + 8; guerrino.inclina = 0.14; }
    if (t > guerrino.fine && vis === 0) { guerrino.g.visible = false; guerrino.stato = 'assente'; guerrino.prossimo = t + Math.max(6, 20 - livello * 1.4) * (0.7 + Math.random() * 0.6); }
  } else if (guerrino.stato === 'insegue') {
    const v = 3.1 + livello * 0.14;
    let dx = io.x - guerrino.x, dz = io.z - guerrino.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // schiva i tronchi
    tronchiVicini(guerrino.x + dx * 1.2, guerrino.z + dz * 1.2, 1.5, tr => {
      const ox = guerrino.x + dx * 1.2 - tr.x, oz = guerrino.z + dz * 1.2 - tr.z, od = Math.hypot(ox, oz);
      if (od < tr.r + 0.6) { dx += ox / od * 0.8; dz += oz / od * 0.8; }
    });
    const l2 = Math.hypot(dx, dz) || 1;
    guerrino.x += dx / l2 * v * dt; guerrino.z += dz / l2 * v * dt; guerrino.vel = v;
    giraVerso(Math.atan2(dx, dz), dt, 6);
    guerrino.colpo = 0.55 + Math.sin(t * 3) * 0.1;   // corre con la roncola alzata
    disegnaGuerrino();
    if (t > guerrino.fine && vis === 0) { guerrino.g.visible = false; guerrino.stato = 'assente'; guerrino.inclina = 0; guerrino.prossimo = t + Math.max(6, 18 - livello * 1.2); }
  }

  // guardarlo fa salire lo statico; troppo vicino = preso
  if (guerrino.g.visible && vis > 0) {
    const dd = Math.max(0, 1 - d / 45);
    staticoV += dt * vis * (0.08 + dd * dd * 0.5) * (1 + livello * 0.06);
  } else staticoV -= dt * 0.3;
  if (guerrino.g.visible && d < 2 + (guerrino.stato === 'insegue' ? 0.4 : 0)) staticoV = 1;
  staticoV = Math.max(0, Math.min(1, staticoV));
  if (staticoV >= 1) preso();
}

/* ── statico a schermo ── */
const sg = ui.statico.getContext('2d');
const sImg = sg.createImageData(160, 90);
function disegnaStatico(t) {
  const vicino = guerrino.g.visible ? Math.max(0, 1 - Math.hypot(io.x - guerrino.x, io.z - guerrino.z) / 40) * 0.25 : 0;
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
  // ultimo sguardo: girati verso di lui
  const a = Math.atan2(-(guerrino.x - io.x), -(guerrino.z - io.z));
  io.yaw = a; io.pitch = 0.05;
  posaGuerrino(io.x - Math.sin(a) * 1.4, io.z - Math.cos(a) * 1.4, a);
  guerrino.g.visible = true; guerrino.vel = 0; guerrino.colpo = 1; guerrino.inclina = 0; disegnaGuerrino();
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
  staticoV = 0; guerrino.g.visible = false; guerrino.stato = 'assente'; guerrino.albero = null; guerrino.colpo = 0;
  guerrino.prossimo = orologio.elapsedTime + 15;
  if (storia !== 'caccia') { storia = 'caccia'; tCaccia = 0; }
  ui.buio.style.opacity = 0;
  fase = 'gioco';
  if (!TOCCO) canvas.requestPointerLock?.();
}
function vittoria() {
  fase = 'vinto'; storia = 'fine';
  guerrino.g.visible = false;
  if (roncolaAudio && roncolaAudio.isPlaying) roncolaAudio.stop();
  const s = Math.round(io.tempo);
  setTimeout(() => {
    ui.buio.style.opacity = 1;
    setTimeout(() => {
      $('vittoria-testo').textContent = `Er bosco tace. Da qualche parte, Guerrino posa la roncola. Tempo: ${mmss(s)}${io.morti ? ` · prese: ${io.morti}` : ''}.`;
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
function costruisci(bin, bosco, colori, osm, modello, roncola) {
  const u16 = new Uint16Array(bin);
  Q = new Float32Array(N * N);
  for (let i = 0; i < Q.length; i++) Q[i] = 1000 + u16[i] / 20;
  FOSSI = osm.fossi;
  creaTerreno(colori);
  creaBosco(bosco, osm, FOGLI_POS);
  creaPaese(osm);
  creaFonte();
  creaFogli();
  creaGuerrino(modello, roncola);
  preparaAudio();
  posaGuerrino(-143.5, 383, 0);
  guerrino.rot = guardaVerso(io.x, io.z); disegnaGuerrino(); animaGuerrino(0);
  camera.position.set(io.x, quota(io.x, io.z) + 1.65, io.z);
  camera.rotation.set(io.pitch, io.yaw, 0, 'YXZ');
  // primo render per compilare gli shader mentre c'è ancora il caricamento
  renderer.compile(scena, camera);
  renderer.render(scena, camera);
  mostra('caricamento', false); mostra('menu', true);
  document.body.classList.remove('carica'); document.body.classList.add('fuori');
  disegnaClassifica($('classifica-menu'));
  window.__crevil = { PROVA, quota, guarda: (x, z) => { io.yaw = Math.atan2(-(x - io.x), -(z - io.z)); }, info: () => renderer.info.render, io, guerrino, scena, camera, renderer, salta: s => { storia = s; tStoria = 0; }, caccia: () => { iniziaCaccia(orologio.elapsedTime); guerrino.prossimo = 0; }, stato: () => ({ storia, fase, attesa, livello, staticoV }) };
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
  const dt = Math.min(0.05, orologio.getDelta()), t = orologio.elapsedTime;
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
  if (fase === 'gioco' || fase === 'morto') { disegnaStatico(t); animaGuerrino(dt); }
  // accendi solo i pezzi di bosco vicini
  for (const b of BLOCCHI) b.visible = Math.hypot(b.userData.cx - io.x, b.userData.cz - io.z) < (TOCCO ? 105 : 125);
  renderer.render(scena, camera);
}
ciclo();
