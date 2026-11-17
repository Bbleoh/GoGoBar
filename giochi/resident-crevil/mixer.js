/* Il mixer di Resident Crevil: un fader per canale (mix.js), anteprima dei suoni, mix salvato nel
   browser e mandato in diretta al gioco aperto in un'altra scheda. */
import { CANALI, PEZZI, GIRO, INIZIO_GIRO, CHIAVE, CANALE_DIRETTA, caricaMix, lineare } from './mix.js?v=4';

const $ = id => document.getElementById(id);
const MIN = -48, MAX = 12;           // in fondo al fader = spento
const mix = caricaMix();
const muto = {}, solo = {};
const DEF = Object.fromEntries(CANALI.map(c => [c.id, c.def]));
const BUS = new Set(['generale', 'musica']);
const fmt = db => db <= MIN ? '−∞' : (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db).toFixed(1) + ' dB';

/* ── il mix che conta: fader, muto e solo ── */
function efficace() {
  const soli = CANALI.filter(c => solo[c.id] && !BUS.has(c.id)).map(c => c.id);
  const out = {};
  for (const c of CANALI) {
    let db = mix[c.id] <= MIN ? -60 : mix[c.id];
    if (muto[c.id]) db = -60;
    if (soli.length && !BUS.has(c.id)) {
      const tieni = soli.includes(c.id) || (c.id.startsWith('mus-') && solo.musica);
      if (!tieni) db = -60;
    }
    if (solo.musica && !soli.length && !BUS.has(c.id) && !c.id.startsWith('mus-')) db = -60;
    out[c.id] = db;
  }
  return out;
}
function salva() {
  const diversi = {};
  for (const c of CANALI) if (mix[c.id] !== c.def) diversi[c.id] = mix[c.id] <= MIN ? -60 : mix[c.id];
  try { localStorage.setItem(CHIAVE, JSON.stringify(diversi)); } catch (e) {}
}

/* ── il collegamento col gioco ── */
let bc = null, tGioco = -1e9;
try { bc = new BroadcastChannel(CANALE_DIRETTA); } catch (e) {}
let daMandare = false;
function manda() {
  if (daMandare || !bc) return;
  daMandare = true;
  requestAnimationFrame(() => { daMandare = false; bc.postMessage({ mix: efficace() }); });
}
if (bc) {
  bc.onmessage = e => {
    if (e.data && e.data.gioco) {
      const nuovo = performance.now() - tGioco > 5000;
      tGioco = performance.now();
      if (nuovo) manda();
      stato();
    }
  };
  setInterval(() => { bc.postMessage({ chi: true }); stato(); }, 1500);
  bc.postMessage({ chi: true });
  // chiudendo il mixer, il gioco torna al mix salvato (senza muti e soli)
  addEventListener('pagehide', () => { const m = {}; for (const c of CANALI) m[c.id] = mix[c.id] <= MIN ? -60 : mix[c.id]; bc.postMessage({ mix: m }); });
}
function stato() {
  const si = performance.now() - tGioco < 4000;
  $('stato').classList.toggle('si', si);
  $('stato').lastElementChild.textContent = si ? 'Gioco collegato: senti in diretta' : 'Gioco non aperto';
}

/* ── l'anteprima ── */
let ctx = null, uscita = null, busMusica = null, eco = null, rumoreBuf = null, blipBuf = null, t0Musica = null;
const buffer = {}, nodi = {}, attivi = {};
function audio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  uscita = ctx.createGain(); uscita.connect(ctx.destination);
  busMusica = ctx.createGain(); busMusica.connect(uscita);
  for (const c of CANALI) {
    if (BUS.has(c.id)) continue;
    const g = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 512;
    g.connect(an); g.connect(c.id.startsWith('mus-') ? busMusica : uscita);
    nodi[c.id] = { g, an, dati: new Float32Array(512) };
  }
  // l'eco del bosco, come nel gioco (vedi eco() in gioco.js)
  const R = ctx.sampleRate, n = R * 2.6 | 0, ir = ctx.createBuffer(2, n, R);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let basso = 0;
    for (let i = 0; i < n; i++) {
      const t = i / R, k = Math.min(1, t / 0.05);
      basso += (Math.random() * 2 - 1 - basso) * (0.5 - 0.42 * t / 2.6);
      d[i] = basso * k * Math.exp(-t * 2.4) * (i < R * 0.012 ? 0 : 1);
    }
  }
  eco = ir;
  rumoreBuf = ctx.createBuffer(1, R * 2, R);
  const r = rumoreBuf.getChannelData(0); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
  const nb = R * 0.05 | 0; blipBuf = ctx.createBuffer(1, nb, R);
  const b = blipBuf.getChannelData(0);
  for (let i = 0; i < nb; i++) b[i] = ((i / R * 132) % 1 < 0.5 ? 1 : -1) * Math.min(1, i / 30) * Math.pow(1 - i / nb, 1.6);
  aggiornaGuadagni();
  return ctx;
}
function aggiornaGuadagni() {
  if (!ctx) return;
  const m = efficace();
  uscita.gain.value = lineare(m.generale);
  busMusica.gain.value = lineare(m.musica);
  for (const id in nodi) nodi[id].g.gain.value = lineare(m[id]) * (id.startsWith('mus-') ? PEZZI[id.slice(4)] : 1);
}
async function carica(file) {
  if (!buffer[file]) buffer[file] = fetch(file).then(r => { if (!r.ok) throw new Error(file); return r.arrayBuffer(); }).then(a => ctx.decodeAudioData(a));
  return buffer[file];
}
// un suono nel canale: vol e velocità come nel gioco, con l'eco se serve
function sorgente(id, buf, { vol = 1, rate = 1, eco: conEco = false, loop = false, da = 0, lung, quando = 0 } = {}) {
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf; s.playbackRate.value = rate; s.loop = loop; g.gain.value = vol;
  s.connect(g); g.connect(nodi[id].g);
  if (conEco) { const cv = ctx.createConvolver(), u = ctx.createGain(); cv.buffer = eco; u.gain.value = 0.5; g.connect(cv); cv.connect(u); u.connect(nodi[id].g); }
  if (lung) s.start(ctx.currentTime + quando, da, lung); else s.start(ctx.currentTime + quando, da);
  return s;
}
async function suona(c) {
  audio(); ctx.resume();
  const p = c.prova, stop = [];
  const a = attivi[c.id] = { stop, timer: null };
  const vivo = () => attivi[c.id] === a;
  try {
    if (p.pezzo) {
      const buf = await carica(`musica/${p.pezzo}.mp3`); if (!vivo()) return;
      if (t0Musica === null) t0Musica = ctx.currentTime;
      const off = INIZIO_GIRO + ((ctx.currentTime - t0Musica) % GIRO);
      const s = sorgente(c.id, buf, { loop: true, da: off });
      s.loopStart = INIZIO_GIRO; s.loopEnd = INIZIO_GIRO + GIRO; stop.push(s);
    } else if (p.file && p.loop) {
      const buf = await carica(p.file); if (!vivo()) return;
      stop.push(sorgente(c.id, buf, { vol: p.vol, rate: p.rate || 1, loop: true }));
    } else if (p.rumore) {
      stop.push(sorgente(c.id, rumoreBuf, { vol: p.vol, loop: true }));
    } else if (p.blip) {
      // una battuta finta: lettere a gruppi, come quando parla Guerrino
      let k = 0;
      const giro = () => { if (!vivo()) return; const parola = 3 + Math.random() * 5 | 0; for (let i = 0; i < parola; i++) sorgente(c.id, blipBuf, { vol: 0.085, rate: 0.86 + Math.random() * 0.3, quando: i * 0.075 }); a.timer = setTimeout(giro, parola * 75 + 120 + (++k % 5 === 0 ? 600 : 0)); };
      giro();
    } else if (p.nastro) {
      const buf = await carica(`sfx/${p.nastro}.mp3`); if (!vivo()) return;
      const [casella, lung] = p.nastro === 'colpi' ? [1.7, 1.66] : [1.2, 1.16];
      const ogni = p.ogni || (p.nastro === 'colpi' ? 1.1 : 0.55 / (p.rate || 1) * 0.6);
      const inOrdine = p.ogni && p.ogni < 0.3;
      let ultimo = -1, i = 0;
      const giro = () => {
        if (!vivo()) return;
        let n;
        if (inOrdine) n = p.caselle[i++ % p.caselle.length];
        else { do n = p.caselle[Math.random() * p.caselle.length | 0]; while (p.caselle.length > 1 && n === ultimo); }
        ultimo = n;
        sorgente(c.id, buf, { vol: p.vol, rate: (p.rate || 1) * (0.94 + Math.random() * 0.12), eco: p.eco, da: n * casella, lung });
        a.timer = setTimeout(giro, (inOrdine && i % p.caselle.length === 0 ? 0.9 : ogni) * 1000);
      };
      giro();
    } else if (p.file) {
      const files = [].concat(p.file), bufs = await Promise.all(files.map(carica)); if (!vivo()) return;
      let k = 0;
      const giro = () => { if (!vivo()) return; const buf = bufs[k++ % bufs.length]; sorgente(c.id, buf, { vol: p.vol, rate: p.rate || 1 }); a.timer = setTimeout(giro, (buf.duration / (p.rate || 1) + 0.8) * 1000); };
      giro();
    }
  } catch (e) { console.warn('anteprima', c.id, e); ferma(c.id); }
}
function ferma(id) {
  const a = attivi[id]; if (!a) return;
  delete attivi[id]; clearTimeout(a.timer);
  for (const s of a.stop) try { s.stop(); } catch (e) {}
  const b = document.querySelector(`[data-id="${id}"] .suona`); if (b) b.classList.remove('on');
}
function cambiaSuono(c) {
  if (c.id === 'musica') {   // il ▶ della colonna fa partire o fermare tutti i pezzi insieme
    const pezzi = CANALI.filter(x => x.id.startsWith('mus-'));
    const accendi = !pezzi.some(x => attivi[x.id]);
    for (const x of pezzi) { if (accendi && !attivi[x.id]) { suona(x); bottone(x.id, true); } else if (!accendi) ferma(x.id); }
    bottone('musica', accendi);
    return;
  }
  if (attivi[c.id]) ferma(c.id); else { suona(c); bottone(c.id, true); }
  bottone('musica', CANALI.some(x => x.id.startsWith('mus-') && attivi[x.id]));
}
function bottone(id, on) { const b = document.querySelector(`[data-id="${id}"] .suona`); if (b) b.classList.toggle('on', on); }

/* ── le strisce ── */
const gruppi = {};
for (const c of CANALI) (gruppi[c.gruppo] ||= []).push(c);
const contenitore = $('gruppi');
for (const [nome, canali] of Object.entries(gruppi)) {
  const box = document.createElement('section'); box.className = 'gruppo';
  box.innerHTML = `<h2>${nome}</h2><div class="strisce"></div>`;
  const strisce = box.lastElementChild;
  for (const c of canali) {
    const s = document.createElement('div'); s.className = 'striscia' + (BUS.has(c.id) ? ' bus' : ''); s.dataset.id = c.id;
    s.innerHTML = `<div class="nome"></div>
      <div class="corpo"><input class="fader" type="range" min="${MIN}" max="${MAX}" step="0.5"><div class="metro"><i></i></div></div>
      <div class="db"></div>
      <div class="tasti">${c.prova || c.id === 'musica' ? '<button class="suona" title="Ascolta">▶</button>' : ''}<button class="muto" title="Spegni">M</button>${c.id === 'generale' ? '' : '<button class="solo" title="Solo">S</button>'}</div>`;
    s.querySelector('.nome').textContent = c.nome;
    const f = s.querySelector('.fader'), db = s.querySelector('.db');
    const mostraDb = () => { f.value = Math.max(MIN, mix[c.id]); db.textContent = fmt(mix[c.id]); db.classList.toggle('cambiato', mix[c.id] !== c.def); };
    const metti = v => { mix[c.id] = Math.max(MIN, Math.min(MAX, Math.round(v * 2) / 2)); mostraDb(); salva(); aggiornaGuadagni(); manda(); };
    s.metti = metti; s.mostraDb = mostraDb;
    f.addEventListener('input', () => metti(+f.value));
    f.addEventListener('dblclick', () => metti(c.def));
    f.addEventListener('wheel', e => { e.preventDefault(); metti(Math.max(MIN, mix[c.id]) + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 3 : 0.5)); }, { passive: false });
    db.addEventListener('click', () => {
      if (db.querySelector('input')) return;
      const inp = document.createElement('input'); inp.value = mix[c.id] <= MIN ? '' : mix[c.id];
      db.textContent = ''; db.append(inp); inp.focus(); inp.select();
      const fatto = ok => { const v = parseFloat(inp.value.replace(',', '.').replace('−', '-')); if (ok && !isNaN(v)) metti(v); else mostraDb(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') fatto(true); if (e.key === 'Escape') fatto(false); });
      inp.addEventListener('blur', () => fatto(true));
    });
    s.querySelector('.suona')?.addEventListener('click', () => cambiaSuono(c));
    s.querySelector('.muto').addEventListener('click', e => { muto[c.id] = !muto[c.id]; e.target.classList.toggle('on', muto[c.id]); aggiornaGuadagni(); manda(); });
    s.querySelector('.solo')?.addEventListener('click', e => { solo[c.id] = !solo[c.id]; e.target.classList.toggle('on', solo[c.id]); aggiornaGuadagni(); manda(); });
    mostraDb();
    strisce.append(s);
  }
  contenitore.append(box);
}

/* ── i meter: picco di quello che esce da ogni canale ── */
function meter() {
  requestAnimationFrame(meter);
  for (const s of document.querySelectorAll('.striscia')) {
    const id = s.dataset.id, barra = s.querySelector('.metro i');
    let picco = 0;
    if (ctx && nodi[id]) { const n = nodi[id]; n.an.getFloatTimeDomainData(n.dati); for (const v of n.dati) picco = Math.max(picco, Math.abs(v)); }
    else if (ctx && BUS.has(id)) { const ids = id === 'musica' ? Object.keys(nodi).filter(k => k.startsWith('mus-')) : Object.keys(nodi); for (const k of ids) { const n = nodi[k]; n.an.getFloatTimeDomainData(n.dati); for (const v of n.dati) picco = Math.max(picco, Math.abs(v)); } if (id === 'musica') picco *= busMusica.gain.value; picco *= uscita.gain.value; }
    const dbfs = picco > 0 ? 20 * Math.log10(picco) : -90;
    const h = Math.max(0, Math.min(100, (dbfs + 54) / 54 * 100));
    const prima = +(barra.dataset.h || 0), ora = h > prima ? h : prima - 1.6;
    barra.dataset.h = ora; barra.style.height = ora + '%';
  }
}
meter();

/* ── i tasti in alto ── */
$('ferma').addEventListener('click', () => { for (const id of Object.keys(attivi)) ferma(id); bottone('musica', false); t0Musica = null; });
$('azzera').addEventListener('click', () => {
  for (const c of CANALI) mix[c.id] = c.def;
  try { localStorage.removeItem(CHIAVE); } catch (e) {}
  for (const s of document.querySelectorAll('.striscia')) s.mostraDb();
  aggiornaGuadagni(); manda();
});
$('copia').addEventListener('click', () => {
  const m = {}; for (const c of CANALI) m[c.id] = mix[c.id] <= MIN ? -60 : mix[c.id];
  const testo = 'Mix di Resident Crevil: ' + JSON.stringify(m);
  $('copia-testo').value = testo; $('copia-box').classList.add('su');
  const ok = () => { $('esito').textContent = 'copiato'; setTimeout(() => { $('esito').textContent = ''; }, 2500); };
  if (navigator.clipboard) navigator.clipboard.writeText(testo).then(ok, () => $('copia-testo').select()); else $('copia-testo').select();
});
// il mix salvato da un'altra scheda del mixer
addEventListener('storage', e => {
  if (e.key !== CHIAVE) return;
  Object.assign(mix, DEF, JSON.parse(e.newValue || '{}'));
  for (const s of document.querySelectorAll('.striscia')) s.mostraDb();
  aggiornaGuadagni();
});
