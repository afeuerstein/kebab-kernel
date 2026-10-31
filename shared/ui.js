// Tiny shared DOM helpers: nav back to gallery, sound toggle, boot screen.
export function galleryNav(label = 'all concepts') {
  const a = document.createElement('a');
  a.href = '/';
  a.className = 'gall-back';
  a.textContent = '◀ ' + label;
  a.style.cssText = `
    position:fixed; top:18px; left:20px; z-index:80;
    font:11px/1 'Share Tech Mono', monospace; letter-spacing:.18em;
    color:rgba(255,255,255,.55); text-decoration:none; text-transform:uppercase;
    padding:8px 12px; border:1px solid rgba(255,255,255,.14); border-radius:999px;
    background:rgba(0,0,0,.25); backdrop-filter:blur(6px); transition:.25s;`;
  a.onmouseenter = () => { a.style.color = '#fff'; a.style.borderColor = 'rgba(255,255,255,.5)'; };
  a.onmouseleave = () => { a.style.color = 'rgba(255,255,255,.55)'; a.style.borderColor = 'rgba(255,255,255,.14)'; };
  document.body.appendChild(a);
  return a;
}

export function soundToggle(getMuted, setMuted) {
  const b = document.createElement('button');
  b.className = 'sound-btn';
  b.style.cssText = `
    position:fixed; top:18px; right:20px; z-index:80; cursor:pointer;
    font:11px/1 'Share Tech Mono', monospace; letter-spacing:.18em; text-transform:uppercase;
    color:rgba(255,255,255,.55); padding:8px 12px; border-radius:999px;
    border:1px solid rgba(255,255,255,.14); background:rgba(0,0,0,.25); backdrop-filter:blur(6px); transition:.25s;`;
  const render = () => { b.textContent = getMuted() ? '♪ sound: off' : '♪ sound: on'; };
  b.onclick = () => { setMuted(!getMuted()); render(); };
  render();
  document.body.appendChild(b);
  return b;
}

export function hint(text, opts = {}) {
  const d = document.createElement('div');
  d.className = 'hint';
  d.innerHTML = text;
  d.style.cssText = `
    position:fixed; left:50%; bottom:${opts.bottom || '34px'}; transform:translateX(-50%);
    z-index:70; pointer-events:none; text-align:center;
    font:12px/1.7 'Share Tech Mono', monospace; letter-spacing:.22em; text-transform:uppercase;
    color:rgba(255,255,255,.6); text-shadow:0 1px 8px rgba(0,0,0,.8);
    animation:hintPulse 2.6s ease-in-out infinite; white-space:nowrap;`;
  const st = document.createElement('style');
  st.textContent = `@keyframes hintPulse{0%,100%{opacity:.45}50%{opacity:1}}`;
  document.head.appendChild(st);
  document.body.appendChild(d);
  return d;
}

export function bootScreen(lines, done) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; inset:0; z-index:100; background:#050505; color:#e8e6df;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px;
    font:13px/1.9 'Share Tech Mono', monospace; letter-spacing:.3em; text-transform:uppercase;
    transition:opacity .7s ease; cursor:pointer;`;
  el.innerHTML = lines.map((l, i) => `<div style="opacity:0; transition:opacity .4s" data-l="${i}">${l}</div>`).join('') +
    `<div style="margin-top:14px; font-size:10px; letter-spacing:.4em; opacity:.5" class="go">[ click to deploy ]</div>`;
  document.body.appendChild(el);
  let i = 0;
  const iv = setInterval(() => {
    const n = el.querySelector(`[data-l="${i}"]`);
    if (n) n.style.opacity = 1;
    i++;
    if (i >= lines.length) clearInterval(iv);
  }, 260);
  el.onclick = () => {
    clearInterval(iv);
    el.style.opacity = 0;
    setTimeout(() => { el.remove(); done && done(); }, 700);
  };
  return el;
}

export function setStats(stats) { window.__stats = stats; }
