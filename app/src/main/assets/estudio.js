// ===== v2.2: 🖌️ Estudio de ilustración (como el de las tabletas de dibujo) =====
// Capas, pinceles con presión del lápiz, zoom con dos dedos, simetría, cuentagotas, relleno,
// deshacer/rehacer, guardar en la galería y seguir el proyecto después.

{
  const i = SECCIONES.findIndex(s => s.id === 'dibujo');
  SECCIONES.splice(i + 1, 0, {id: 'estudio', t: 'Estudio de ilustración', e: '🖌️', c: '#FFE3D8', d: 'Capas, pinceles y lápiz digital'});
}

const EST = {W: 960, H: 1280, MAX_CAPAS: 6, MAX_DESHACER: 25};
const PINCELES = {
  lapiz:     {t: '✏️ Lápiz',     duro: true,  paso: .12, minP: .35, flujo: 1},
  pluma:     {t: '🖊️ Pluma',     duro: true,  paso: .08, minP: .1,  flujo: 1},
  pincel:    {t: '🖌️ Pincel',    duro: false, paso: .15, minP: .4,  flujo: .45},
  acuarela:  {t: '💧 Acuarela',  duro: false, paso: .2,  minP: .6,  flujo: .12},
  aerografo: {t: '💨 Aerógrafo', spray: true, paso: .25, minP: .6,  flujo: .5},
  marcador:  {t: '🖍️ Marcador',  duro: true,  paso: .1,  minP: .9,  flujo: 1},
  borrador:  {t: '🧽 Borrador',  duro: true,  paso: .1,  minP: .5,  flujo: 1, borra: true},
  relleno:   {t: '🪣 Relleno',   accion: true},
  gotero:    {t: '🎯 Gotero',    accion: true}
};
const PALETA = ['#1F1B3A', '#FFFFFF', '#E5484D', '#FF7A59', '#FFB020', '#FFE45C', '#2BB673', '#14B8A6', '#1E9BF0', '#3B5BDB', '#8B5CF6', '#EC4899', '#8D5B3C', '#F2C7A5', '#9CA3AF', '#000000'];

// Proyecto guardado en el teléfono (IndexedDB, porque las capas pesan)
const ESTDB = {
  abrir() { return new Promise((ok, no) => { const r = indexedDB.open('aj_estudio', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); },
  async get(k) { const db = await this.abrir(); return new Promise(ok => { const q = db.transaction('p').objectStore('p').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); },
  async set(k, v) { const db = await this.abrir(); return new Promise(ok => { const t = db.transaction('p', 'readwrite'); t.objectStore('p').put(v, k); t.oncomplete = () => ok(true); t.onerror = () => ok(false); }); }
};

R.estudio = function () {
  const W = EST.W, H = EST.H;
  const st = Object.assign({pincel: 'pluma', color: '#1F1B3A', tam: 12, opac: 1, simetria: false, soloLapiz: false, recientes: []}, store.get('estudio_cfg', {}));
  let capas = [], activa = 0, deshacer = [], rehacer = [], sucio = false;
  let esc = 1, tx = 0, ty = 0;

  view.innerHTML = `
  <div class="est">
    <div class="estbar" id="herr">${Object.entries(PINCELES).map(([k, p]) => `<button data-p="${k}">${p.t}</button>`).join('')}</div>
    <div class="estbar">
      <button id="eUndo" title="Deshacer">↩️</button><button id="eRedo" title="Rehacer">↪️</button>
      <button id="eMas" title="Acercar">➕</button><button id="eMenos" title="Alejar">➖</button><button id="eFit" title="Ajustar">⤢</button>
      <button id="eSim" title="Simetría">🪞 Espejo</button><button id="eLap" title="Con el dedo solo se mueve la hoja">✋ Solo lápiz</button>
    </div>
    <div class="estlienzo" id="lz"><div id="escena" style="width:${W}px;height:${H}px"><div class="estfondo"></div><canvas id="trazo" width="${W}" height="${H}"></canvas></div></div>
    <div class="estpanel">
      <div class="row" style="flex-wrap:nowrap"><span style="width:62px">Tamaño</span><input type="range" id="eTam" min="1" max="120" value="${st.tam}" style="flex:1;padding:0"><b id="eTamV" style="width:34px;text-align:right">${st.tam}</b></div>
      <div class="row" style="flex-wrap:nowrap"><span style="width:62px">Opacidad</span><input type="range" id="eOpa" min="5" max="100" value="${Math.round(st.opac * 100)}" style="flex:1;padding:0"><b id="eOpaV" style="width:34px;text-align:right">${Math.round(st.opac * 100)}</b></div>
      <div class="row" style="margin-top:4px"><input type="color" id="eCol" value="${st.color}" style="width:52px;height:44px;padding:2px"><div class="estpal" id="ePal"></div></div>
      <div class="row" style="justify-content:space-between;margin-top:8px"><b>🗂️ Capas</b><span class="row"><button class="sec sm" id="eCapa">+ Capa</button></span></div>
      <div id="eCapas"></div>
      <div class="row" style="margin-top:10px"><button id="eGuardar">💾 Guardar en la galería</button><button class="sec" id="eProy">📁 Guardar proyecto</button><button class="sec" id="eNuevo">🗑️ Nuevo</button></div>
      <p class="muted" style="font-size:12px;margin:6px 0 0">Con lápiz óptico la línea cambia según la fuerza. Dos dedos: mover y hacer zoom.</p>
    </div>
  </div>`;

  const lz = $('#lz'), escena = $('#escena'), trazo = $('#trazo'), tctx = trazo.getContext('2d');
  const pre = document.createElement('canvas'); pre.width = W; pre.height = H; const pctx = pre.getContext('2d');

  // ---------- Capas ----------
  function nuevaCapa(nombre, datos) {
    if (capas.length >= EST.MAX_CAPAS) { toast('Máximo ' + EST.MAX_CAPAS + ' capas'); return null; }
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.className = 'estcapa';
    const capa = {nombre: nombre || 'Capa ' + (capas.length + 1), canvas: c, ctx: c.getContext('2d', {willReadFrequently: true}), visible: true, opac: 1};
    escena.insertBefore(c, trazo);
    capas.push(capa);
    if (datos) { const img = new Image(); img.onload = () => capa.ctx.drawImage(img, 0, 0); img.src = datos; }
    return capa;
  }
  function ordenar() {
    capas.forEach((c, i) => { c.canvas.style.zIndex = i * 2 + 1; c.canvas.style.opacity = c.visible ? c.opac : 0; });
    trazo.style.zIndex = activa * 2 + 2;
  }
  function pintarCapas() {
    ordenar();
    $('#eCapas').innerHTML = capas.map((c, i) => ({c, i})).reverse().map(({c, i}) => `
      <div class="estcap${i === activa ? ' on' : ''}" data-ci="${i}">
        <button class="sec sm" data-vis="${i}">${c.visible ? '👁️' : '🚫'}</button>
        <b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-sel="${i}">${esc2(c.nombre)}</b>
        <input type="range" min="0" max="100" value="${Math.round(c.opac * 100)}" data-op="${i}" style="width:70px;padding:0">
        <button class="sec sm" data-up="${i}" ${i === capas.length - 1 ? 'disabled' : ''}>▲</button><button class="sec sm" data-dn="${i}" ${i === 0 ? 'disabled' : ''}>▼</button>
        <button class="sec sm" data-del="${i}" ${capas.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('');
    const box = $('#eCapas');
    box.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { activa = +b.dataset.sel; pintarCapas(); });
    box.querySelectorAll('.estcap').forEach(b => b.onclick = e => { if (e.target === b) { activa = +b.dataset.ci; pintarCapas(); } });
    box.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => { const c = capas[+b.dataset.vis]; c.visible = !c.visible; sucio = true; pintarCapas(); });
    box.querySelectorAll('[data-op]').forEach(r => r.oninput = () => { capas[+r.dataset.op].opac = r.value / 100; sucio = true; ordenar(); });
    const mover = (i, d) => { const j = i + d; [capas[i], capas[j]] = [capas[j], capas[i]]; if (activa === i) activa = j; else if (activa === j) activa = i; capas.forEach(c => escena.insertBefore(c.canvas, trazo)); deshacer = []; rehacer = []; sucio = true; pintarCapas(); };
    box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => mover(+b.dataset.up, 1));
    box.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => mover(+b.dataset.dn, -1));
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const i = +b.dataset.del; if (!confirm('¿Borrar la capa «' + capas[i].nombre + '»?')) return;
      capas[i].canvas.remove(); capas.splice(i, 1); activa = Math.min(activa, capas.length - 1); deshacer = []; rehacer = []; sucio = true; pintarCapas();
    });
  }
  const esc2 = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  // ---------- Vista: zoom y movimiento ----------
  function aplicarVista() { escena.style.transform = `translate(${tx}px,${ty}px) scale(${esc})`; }
  function ajustar() {
    const r = lz.getBoundingClientRect();
    esc = Math.min(r.width / W, r.height / H) * .96; tx = (r.width - W * esc) / 2; ty = (r.height - H * esc) / 2; aplicarVista();
  }
  function zoomEn(f, cx, cy) {
    const r = lz.getBoundingClientRect(); cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    const n = Math.max(.1, Math.min(8, esc * f)); tx = cx - (cx - tx) * n / esc; ty = cy - (cy - ty) * n / esc; esc = n; aplicarVista();
  }
  const aLienzo = e => { const r = lz.getBoundingClientRect(); return {x: (e.clientX - r.left - tx) / esc, y: (e.clientY - r.top - ty) / esc}; };

  // ---------- Pinceles ----------
  let punta = null;
  function hacerPunta() {
    punta = document.createElement('canvas'); punta.width = punta.height = 128;
    const g = punta.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, st.color); grad.addColorStop(.5, hexA(st.color, .55)); grad.addColorStop(1, hexA(st.color, 0));
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  }
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function sello(ctx, x, y, d, P) {
    if (d < .3) return;
    if (P.spray) {
      ctx.fillStyle = st.color; const n = Math.max(3, Math.round(d / 2));
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * d / 2; ctx.globalAlpha = P.flujo * Math.random(); ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.2, 1.2); }
      ctx.globalAlpha = 1; return;
    }
    if (P.duro) { ctx.globalAlpha = P.borra ? st.opac : P.flujo; ctx.fillStyle = P.borra ? '#000' : st.color; ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
    ctx.globalAlpha = P.flujo; ctx.drawImage(punta, x - d, y - d, d * 2, d * 2); ctx.globalAlpha = 1;
  }
  let pinta = null; // trazo en curso
  function presion(e) { return e.pointerType === 'pen' ? Math.max(.05, e.pressure || .5) : 1; }
  function iniciar(e) {
    const P = PINCELES[st.pincel], p = aLienzo(e);
    if (P.accion) { st.pincel === 'relleno' ? rellenar(p) : gotero(p); return; }
    const capa = capas[activa]; if (!capa) return;
    if (!capa.visible) { toast('Esa capa está oculta 🚫'); return; }
    pctx.clearRect(0, 0, W, H); pctx.drawImage(capa.canvas, 0, 0);
    tctx.clearRect(0, 0, W, H);
    trazo.style.opacity = P.borra ? 0 : st.opac;
    pinta = {P, x: p.x, y: p.y, pr: presion(e), caja: [p.x, p.y, p.x, p.y], id: e.pointerId, resto: 0};
    estampar(p.x, p.y, pinta.pr, true);
  }
  function estampar(x, y, pr, primero) {
    const P = pinta.P, d = st.tam * (P.minP + (1 - P.minP) * pr);
    const ctx = P.borra ? capas[activa].ctx : tctx;
    if (P.borra) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; }
    const sellar = (sx, sy) => { sello(ctx, sx, sy, d, P); if (st.simetria) sello(ctx, W - sx, sy, d, P); };
    if (primero) sellar(x, y);
    else {
      const dx = x - pinta.x, dy = y - pinta.y, dist = Math.hypot(dx, dy), paso = Math.max(.5, d * P.paso);
      let t = pinta.resto;
      while (t <= dist) { const k = dist ? t / dist : 0; sellar(pinta.x + dx * k, pinta.y + dy * k); t += paso; }
      pinta.resto = t - dist;
    }
    if (P.borra) ctx.restore();
    const m = d + 2, c = pinta.caja;
    c[0] = Math.min(c[0], x - m); c[1] = Math.min(c[1], y - m); c[2] = Math.max(c[2], x + m); c[3] = Math.max(c[3], y + m);
    if (st.simetria) { c[0] = Math.min(c[0], W - x - m); c[2] = Math.max(c[2], W - x + m); }
    pinta.x = x; pinta.y = y; pinta.pr = pr;
  }
  function seguir(e) {
    if (!pinta || e.pointerId !== pinta.id) return;
    const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (lista.length ? lista : [e])) { const p = aLienzo(ev); estampar(p.x, p.y, presion(ev), false); }
  }
  function terminar(cancelar) {
    if (!pinta) return;
    const capa = capas[activa], P = pinta.P;
    if (cancelar) { if (P.borra) { capa.ctx.clearRect(0, 0, W, H); capa.ctx.drawImage(pre, 0, 0); } tctx.clearRect(0, 0, W, H); pinta = null; return; }
    if (!P.borra) { capa.ctx.save(); capa.ctx.globalAlpha = st.opac; capa.ctx.drawImage(trazo, 0, 0); capa.ctx.restore(); tctx.clearRect(0, 0, W, H); }
    guardarPaso(activa, pinta.caja); pinta = null;
  }
  function guardarPaso(ci, caja) {
    const x = Math.max(0, Math.floor(caja[0])), y = Math.max(0, Math.floor(caja[1]));
    const w = Math.min(W, Math.ceil(caja[2])) - x, h = Math.min(H, Math.ceil(caja[3])) - y;
    if (w <= 0 || h <= 0) return;
    deshacer.push({ci, x, y, antes: pctx.getImageData(x, y, w, h), despues: capas[ci].ctx.getImageData(x, y, w, h)});
    if (deshacer.length > EST.MAX_DESHACER) deshacer.shift();
    rehacer = []; sucio = true;
  }
  function deshacerPaso(de, a, campo) {
    const p = de.pop(); if (!p) return toast(campo === 'antes' ? 'Nada para deshacer' : 'Nada para rehacer');
    if (!capas[p.ci]) return; capas[p.ci].ctx.putImageData(p[campo], p.x, p.y); a.push(p); sucio = true;
  }

  // ---------- Relleno y gotero ----------
  function rellenar(p) {
    const capa = capas[activa]; const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    pctx.clearRect(0, 0, W, H); pctx.drawImage(capa.canvas, 0, 0);
    const img = capa.ctx.getImageData(0, 0, W, H), d = img.data, i0 = (y0 * W + x0) * 4;
    const obj = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]], n = parseInt(st.color.slice(1), 16);
    const nuevo = [n >> 16 & 255, n >> 8 & 255, n & 255, Math.round(st.opac * 255)];
    if (obj.every((v, k) => v === nuevo[k])) return;
    const tol = 40, igual = i => Math.abs(d[i] - obj[0]) + Math.abs(d[i + 1] - obj[1]) + Math.abs(d[i + 2] - obj[2]) + Math.abs(d[i + 3] - obj[3]) <= tol;
    const visto = new Uint8Array(W * H), pila = [x0, y0];
    while (pila.length) {
      const y = pila.pop(); let x = pila.pop();
      while (x >= 0 && igual((y * W + x) * 4) && !visto[y * W + x]) x--;
      x++; let arriba = false, abajo = false;
      while (x < W && !visto[y * W + x] && igual((y * W + x) * 4)) {
        const j = y * W + x, i = j * 4; visto[j] = 1; d[i] = nuevo[0]; d[i + 1] = nuevo[1]; d[i + 2] = nuevo[2]; d[i + 3] = nuevo[3];
        if (y > 0) { const u = j - W; if (!visto[u] && igual(u * 4)) { if (!arriba) { pila.push(x, y - 1); arriba = true; } } else arriba = false; }
        if (y < H - 1) { const b = j + W; if (!visto[b] && igual(b * 4)) { if (!abajo) { pila.push(x, y + 1); abajo = true; } } else abajo = false; }
        x++;
      }
    }
    capa.ctx.putImageData(img, 0, 0); guardarPaso(activa, [0, 0, W, H]); SFX.pop && SFX.pop();
  }
  function gotero(p) {
    const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
    for (const capa of capas) if (capa.visible) { g.globalAlpha = capa.opac; g.drawImage(capa.canvas, Math.floor(p.x), Math.floor(p.y), 1, 1, 0, 0, 1, 1); }
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
    ponerColor('#' + [r, gg, b].map(v => v.toString(16).padStart(2, '0')).join(''));
    toast('Color tomado 🎯'); elegirPincel(st.recientePincel || 'pluma');
  }

  // ---------- Controles ----------
  function elegirPincel(k) {
    if (!PINCELES[k].accion) st.recientePincel = k;
    st.pincel = k; $('#herr').querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === k)); guardarCfg();
  }
  function ponerColor(c) {
    st.color = c; $('#eCol').value = c; st.recientes = [c, ...st.recientes.filter(x => x !== c)].slice(0, 8); hacerPunta(); pintarPaleta(); guardarCfg();
  }
  function pintarPaleta() {
    const lista = [...new Set([...st.recientes, ...PALETA])].slice(0, 20);
    $('#ePal').innerHTML = lista.map(c => `<button class="sw${c === st.color ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('');
    $('#ePal').querySelectorAll('[data-c]').forEach(b => b.onclick = () => ponerColor(b.dataset.c));
  }
  const guardarCfg = () => store.set('estudio_cfg', {pincel: st.pincel, recientePincel: st.recientePincel, color: st.color, tam: st.tam, opac: st.opac, simetria: st.simetria, soloLapiz: st.soloLapiz, recientes: st.recientes});
  $('#herr').querySelectorAll('[data-p]').forEach(b => b.onclick = () => elegirPincel(b.dataset.p));
  $('#eTam').oninput = () => { st.tam = +$('#eTam').value; $('#eTamV').textContent = st.tam; guardarCfg(); };
  $('#eOpa').oninput = () => { st.opac = $('#eOpa').value / 100; $('#eOpaV').textContent = $('#eOpa').value; guardarCfg(); };
  $('#eCol').oninput = () => ponerColor($('#eCol').value);
  $('#eUndo').onclick = () => deshacerPaso(deshacer, rehacer, 'antes');
  $('#eRedo').onclick = () => deshacerPaso(rehacer, deshacer, 'despues');
  $('#eMas').onclick = () => zoomEn(1.25); $('#eMenos').onclick = () => zoomEn(.8); $('#eFit').onclick = ajustar;
  const marcar = () => { $('#eSim').classList.toggle('on', st.simetria); $('#eLap').classList.toggle('on', st.soloLapiz); };
  $('#eSim').onclick = () => { st.simetria = !st.simetria; marcar(); guardarCfg(); toast(st.simetria ? 'Espejo encendido 🪞' : 'Espejo apagado'); };
  $('#eLap').onclick = () => { st.soloLapiz = !st.soloLapiz; marcar(); guardarCfg(); toast(st.soloLapiz ? 'Solo el lápiz dibuja; el dedo mueve la hoja' : 'El dedo también dibuja'); };
  $('#eCapa').onclick = () => { if (nuevaCapa()) { activa = capas.length - 1; sucio = true; pintarCapas(); } };
  function unir() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (const capa of capas) if (capa.visible) { g.globalAlpha = capa.opac; g.drawImage(capa.canvas, 0, 0); }
    return c;
  }
  $('#eGuardar').onclick = () => { saveDataUrl(unir().toDataURL('image/png'), 'ilustracion_' + stamp() + '.png'); stars(1); };
  async function guardarProyecto(aviso) {
    const ok = await ESTDB.set('actual', {capas: capas.map(c => ({nombre: c.nombre, visible: c.visible, opac: c.opac, datos: c.canvas.toDataURL('image/png')})), activa, fecha: Date.now()}).catch(() => false);
    sucio = false; if (aviso) toast(ok ? 'Proyecto guardado 📁' : 'No se pudo guardar el proyecto');
  }
  $('#eProy').onclick = () => guardarProyecto(true);
  $('#eNuevo').onclick = () => {
    if (!confirm('¿Empezar una hoja nueva? Lo que no guardaste en la galería se borra.')) return;
    capas.forEach(c => c.canvas.remove()); capas = []; deshacer = []; rehacer = [];
    nuevaCapa('Boceto'); nuevaCapa('Tinta'); activa = 1; pintarCapas(); guardarProyecto(false);
  };

  // ---------- Dedos, lápiz y ratón ----------
  const punteros = new Map(); let gesto = null;
  const dosDedos = () => { const [a, b] = [...punteros.values()]; return {cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y)}; };
  lz.addEventListener('pointerdown', e => {
    e.preventDefault(); lz.setPointerCapture(e.pointerId);
    const r = lz.getBoundingClientRect();
    punteros.set(e.pointerId, {x: e.clientX - r.left, y: e.clientY - r.top, tipo: e.pointerType});
    const dedos = [...punteros.values()].filter(p => p.tipo === 'touch').length;
    if (e.pointerType === 'touch' && dedos >= 2) { if (pinta && pinta.tipo === 'touch') terminar(true); gesto = {...dosDedos(), esc, tx, ty}; return; }
    if (e.pointerType === 'touch' && st.soloLapiz) { gesto = {pan: true, x: e.clientX, y: e.clientY, tx, ty}; return; }
    iniciar(e); if (pinta) pinta.tipo = e.pointerType;
  });
  lz.addEventListener('pointermove', e => {
    const r = lz.getBoundingClientRect(), p = punteros.get(e.pointerId); if (p) { p.x = e.clientX - r.left; p.y = e.clientY - r.top; }
    if (gesto && gesto.pan) { tx = gesto.tx + e.clientX - gesto.x; ty = gesto.ty + e.clientY - gesto.y; aplicarVista(); return; }
    if (gesto && punteros.size >= 2) {
      const g = dosDedos(), n = Math.max(.1, Math.min(8, gesto.esc * g.d / gesto.d));
      tx = g.cx - (gesto.cx - gesto.tx) * n / gesto.esc; ty = g.cy - (gesto.cy - gesto.ty) * n / gesto.esc; esc = n; aplicarVista(); return;
    }
    seguir(e);
  });
  const soltar = e => { punteros.delete(e.pointerId); if (pinta && e.pointerId === pinta.id) terminar(e.type === 'pointercancel'); if (punteros.size < 2) gesto = (gesto && gesto.pan && punteros.size) ? gesto : null; };
  lz.addEventListener('pointerup', soltar); lz.addEventListener('pointercancel', soltar);
  lz.addEventListener('wheel', e => { e.preventDefault(); const r = lz.getBoundingClientRect(); zoomEn(e.deltaY < 0 ? 1.1 : .9, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
  const alCambiarTam = () => ajustar(); window.addEventListener('resize', alCambiarTam);
  const auto = setInterval(() => { if (sucio && !pinta) guardarProyecto(false); }, 30000);
  cleanup = () => { window.removeEventListener('resize', alCambiarTam); clearInterval(auto); if (sucio) guardarProyecto(false); };

  // ---------- Arranque: abre el último proyecto ----------
  hacerPunta(); pintarPaleta(); elegirPincel(st.pincel); marcar();
  ajustar();
  ESTDB.get('actual').then(p => {
    if (p && Array.isArray(p.capas) && p.capas.length) { p.capas.slice(0, EST.MAX_CAPAS).forEach(c => { const k = nuevaCapa(c.nombre, c.datos); if (k) { k.visible = c.visible !== false; k.opac = c.opac ?? 1; } }); activa = Math.min(p.activa || 0, capas.length - 1); }
    else { nuevaCapa('Boceto'); nuevaCapa('Tinta'); activa = 1; }
    pintarCapas();
  }).catch(() => { nuevaCapa('Boceto'); nuevaCapa('Tinta'); activa = 1; pintarCapas(); });
};

