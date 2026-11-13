/*
 * Copertina di un album, quadrata.
 *
 *   GoGoCopertina({ album: 'OG Tracks', copertina: 'img/copertine/og.jpg' }, '../')
 *
 * Se l'album ha una copertina (in contenuti.js) mostra quell'immagine,
 * altrimenti disegna una copertina provvisoria col nome dell'album,
 * con un colore diverso per ogni album.
 * Il secondo parametro è la strada per tornare alla cartella principale
 * del sito ('' dalla home, '../' da musica/).
 */
(function () {
  const css = `
    .gg-cover { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; container-type: inline-size; background: #111; }
    .gg-cover > .gg-in { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 8cqw; }
    .gg-cover > img.gg-foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .gg-cover.provvisoria {
      background:
        radial-gradient(circle at 78% 22%, hsl(var(--h) 75% 58% / .9), transparent 55%),
        radial-gradient(circle at 15% 90%, hsl(calc(var(--h) + 40) 70% 40% / .8), transparent 60%),
        linear-gradient(160deg, hsl(var(--h) 35% 16%), #0d0d0c);
    }
    .gg-cover.provvisoria::before { /* solchi del vinile */
      content: ''; position: absolute; width: 120%; aspect-ratio: 1; right: -60%; top: -60%; border-radius: 50%;
      background: repeating-radial-gradient(circle, rgba(0,0,0,.25) 0 1px, transparent 1px 5px);
      opacity: .7;
    }
    .gg-cover .gg-in .gg-neko { position: absolute; left: 7cqw; top: 6cqw; width: 26cqw; height: auto; opacity: .9; filter: drop-shadow(0 4px 10px rgba(0,0,0,.5)); }
    .gg-cover .gg-titolo { position: relative; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 15cqw; line-height: .95; color: #f4efe2; text-shadow: 0 3px 18px rgba(0,0,0,.45); overflow-wrap: anywhere; }
    .gg-cover .gg-nota { position: relative; margin-top: 4cqw; font-family: 'DM Mono', monospace; font-size: 4.2cqw; letter-spacing: .14em; text-transform: uppercase; color: rgba(244,239,226,.65); }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  st.setAttribute('data-resta', '');
  document.head.appendChild(st);

  // stesso nome → stesso colore
  function tinta(nome) {
    let h = 0;
    for (const c of String(nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return [42, 350, 200, 280, 140, 20, 230][h % 7];
  }

  window.GoGoCopertina = function (a, base) {
    base = base || '';
    const box = document.createElement('div');
    box.className = 'gg-cover';
    if (a.copertina) {
      const img = document.createElement('img');
      img.className = 'gg-foto'; img.alt = 'Copertina di ' + a.album; img.loading = 'lazy';
      img.src = /^(https?:)?\/\//.test(a.copertina) ? a.copertina : base + a.copertina;
      box.append(img);
      return box;
    }
    box.classList.add('provvisoria');
    box.style.setProperty('--h', tinta(a.album));
    const neko = document.createElement('img');
    neko.className = 'gg-neko'; neko.alt = ''; neko.src = base + 'img/maneki-neko.webp';
    const t = document.createElement('span'); t.className = 'gg-titolo'; t.textContent = a.album || 'GoGoBar';
    const n = document.createElement('span'); n.className = 'gg-nota'; n.textContent = 'Copertina in arrivo';
    const dentro = document.createElement('div'); dentro.className = 'gg-in';
    dentro.append(neko, t, n);
    box.append(dentro);
    return box;
  };
})();
