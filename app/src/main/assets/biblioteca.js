// ===== v2.4: 📚 Biblioteca de inglés (sin internet) + Owl responde con ella =====
// Diccionario libre (Wiktionary, FreeDict, Tatoeba, ipa-dict) en biblioteca-ingles.js, que se carga solo al necesitarlo.

const BIB = {
  _p: null,
  listo: () => !!window.BIBLIO,
  cargar() {
    if (window.BIBLIO) return Promise.resolve(window.BIBLIO);
    if (!this._p) this._p = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = 'biblioteca-ingles.js';
      s.onload = () => { try { BIB._indices(); ok(window.BIBLIO); } catch (e) { mal(e); } };
      s.onerror = () => { BIB._p = null; mal(new Error('No pude abrir la biblioteca')); };
      document.head.appendChild(s);
    });
    return this._p;
  },
  _indices() {
    const B = window.BIBLIO; if (!B || B._listo) return;
    const limpio = o => Object.assign(Object.create(null), o); // sin claves heredadas como «constructor»
    B.en = limpio(B.en); B.es = limpio(B.es);
    B._lista = Object.keys(B.en);                       // ordenadas de más a menos usada
    B._esN = Object.create(null); for (const k in B.es) { const n = norm(k); if (!(n in B._esN)) B._esN[n] = k; } // sin tildes → con tildes (la más usada)
    B._inv = Object.create(null);                       // traducción española → palabras inglesas
    for (const w of B._lista) for (const t of B.en[w][1].split('|')) { const n = norm(t); (B._inv[n] = B._inv[n] || []).push(w); }
    B._listo = true;
  }
};

// Formas irregulares → infinitivo (went → go)
const IRR_FORMA = {};
for (const v of IRREGULARES) {
  [[v[1], 'pasado'], [v[2], 'participio']].forEach(([f, tipo]) => f.split(' / ').forEach(x => { if (x !== v[0] && !IRR_FORMA[x]) IRR_FORMA[x] = {v, tipo}; }));
}
const POS_ES = {s: 'sustantivo', v: 'verbo', adj: 'adjetivo', adv: 'adverbio', pron: 'pronombre', prep: 'preposición', conj: 'conjunción', det: 'determinante', art: 'artículo', interj: 'interjección', num: 'número', frase: 'expresión'};
const q1 = s => esc(s).replace(/&#39;/g, "\\'");
const btnVoz = (t, lento) => `<button class="sm sec" onclick="speakEn('${q1(t)}'${lento ? ', true' : ''})" aria-label="Escuchar">🔊</button>`;

// Busca una palabra inglesa, entendiendo plurales, pasados, -ing y verbos irregulares
function bibBuscarEn(w0) {
  const B = window.BIBLIO; if (!B) return null;
  const w = normEn(w0); if (!w) return null;
  if (B.en[w]) return {w, d: B.en[w]};
  if (IRR_FORMA[w]) { const b = IRR_FORMA[w].v[0]; return {w: b, d: B.en[b] || ['', IRR_FORMA[w].v[3].replace(/, /g, '|'), 'v'], nota: `<b>${esc(w)}</b> es el ${IRR_FORMA[w].tipo} de <b>${esc(b)}</b> (${esc(IRR_FORMA[w].v[3])}).`}; }
  const reglas = [[/ies$/, 'y', 'plural'], [/(s|sh|ch|x|o)es$/, '$1', 'plural'], [/s$/, '', 'plural o forma con he/she/it'], [/ied$/, 'y', 'pasado'], [/([^aeiou])\1ed$/, '$1', 'pasado'], [/ed$/, '', 'pasado'], [/ed$/, 'e', 'pasado'], [/d$/, '', 'pasado'], [/([^aeiou])\1ing$/, '$1', 'forma -ing'], [/ing$/, '', 'forma -ing'], [/ing$/, 'e', 'forma -ing'], [/ier$/, 'y', 'comparativo'], [/iest$/, 'y', 'superlativo'], [/er$/, '', 'comparativo'], [/est$/, '', 'superlativo'], [/ly$/, '', 'adverbio']];
  for (const [re, rep, tipo] of reglas) {
    if (!re.test(w)) continue;
    const b = w.replace(re, rep);
    if (b.length >= 2 && B.en[b]) return {w: b, d: B.en[b], nota: `<b>${esc(w)}</b> viene de <b>${esc(b)}</b> (${tipo}).`};
  }
  return null;
}
// Busca una palabra española → inglés
function bibBuscarEs(w0) {
  const B = window.BIBLIO; if (!B) return null;
  let w = norm(w0).replace(/^(el|la|los|las|un|una|unos|unas) /, '').trim();
  // también entiende plurales, femeninos y verbos conjugados sencillos (come → comer, juego → jugar)
  const pruebas = [w, w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/as$/, 'o'), w.replace(/a$/, 'o'),
    w + 'r', w.replace(/o$/, 'ar'), w.replace(/o$/, 'er'), w.replace(/o$/, 'ir'), w.replace(/s$/, 'r'), w.replace(/e$/, 'ir'), w.replace(/es$/, 'ir'),
    w.replace(/(aba|ando|ado|amos)$/, 'ar'), w.replace(/(ia|iendo|ido|emos)$/, 'er'), w.replace(/(ia|iendo|ido|imos)$/, 'ir'), w.replace(/ue(\w+)o$/, 'o$1ar'), w.replace(/ue(\w+)o$/, 'u$1ar'), w.replace(/ie(\w+)o$/, 'e$1ar')]
    .filter((x, i, a) => x.length >= 2 && a.indexOf(x) === i);
  for (const p of pruebas) {
    const k = B._esN[p];
    if (k) return {es: k, en: B.es[k].split('|')};
    if (B._inv[p]) return {es: p, en: B._inv[p].slice(0, 3)};
  }
  return null;
}
function bibFicha(r, ejemplos = 2) {
  const B = window.BIBLIO, [ipa, tr, pos, fr] = r.d;
  const ej = (fr || []).slice(0, ejemplos).map(i => B.fr[i]).filter(Boolean)
    .map(f => `<div style="margin-top:4px">• <b>${esc(f[0])}</b> ${btnVoz(f[0], true)}<br><small class="muted">${esc(f[1])}</small></div>`).join('');
  return `${r.nota ? r.nota + '<br>' : ''}<b>${esc(r.w)}</b> ${ipa ? `<span class="muted">${esc(ipa)}</span> ` : ''}${btnVoz(r.w)}${pos && POS_ES[pos] ? ` <small class="muted">(${POS_ES[pos]})</small>` : ''}<br>= ${tr.split('|').map(esc).join(', ')}${ej ? `<div style="margin-top:6px"><small>Ejemplos:</small>${ej}</div>` : ''}`;
}
function bibTema(t, minimo = 3) {
  const n = ' ' + norm(t).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let mejor = null, pts = 0;
  for (const g of GRAMATICA) {
    let p = 0;
    for (const c of g.claves) { const k = norm(c).replace(/[^a-z0-9ñ ]/g, ' ').trim(); if (k && n.includes(' ' + k + ' ')) p += k.length; }
    if (n.includes(' ' + norm(g.t).split(' (')[0] + ' ')) p += 20;
    if (p > pts) { pts = p; mejor = g; }
  }
  return pts >= minimo ? mejor : null;
}
const bibResumenTema = g => `<b>${g.e} ${esc(g.t)}</b><br>${g.explica}<br>${g.ejemplos.slice(0, 3).map(e => `• <b>${esc(e[0])}</b> = ${esc(e[1])}`).join('<br>')}<br><button class="sm" onclick="go('bibingles');setTimeout(()=>bibGramTema('${g.id}'),60)">📖 Ver la lección completa</button>`;

// ---------- Owl responde con la biblioteca (antes de rendirse) ----------
const OWL_CHAT_BASE = OWL_CHAT;
OWL_CHAT = function (q) {
  const t = norm(q).replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  let m;
  // Verbos irregulares: «pasado de go», «participio de eat», «went»
  if ((m = t.match(/(?:pasado|participio|pasado simple|preterito)(?: del verbo| de)? ([a-z]+)/))) {
    const w = m[1], v = IRREGULARES.find(x => x[0] === w) || (IRR_FORMA[w] && IRR_FORMA[w].v);
    if (v) return {html: `<b>${esc(v[0])}</b> (${esc(v[3])}) → pasado <b>${esc(v[1])}</b> → participio <b>${esc(v[2])}</b> ${btnVoz(v[0] + ', ' + v[1].split(' / ')[0] + ', ' + v[2].split(' / ')[0], true)}`, voz: `${v[0]}, ${v[1].split(' / ')[0]}, ${v[2].split(' / ')[0]}`};
    if (window.BIBLIO && BIBLIO.en[w]) {
      const p = w.endsWith('e') ? w + 'd' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ied' : w + 'ed';
      return {html: `<b>${esc(w)}</b> es regular: pasado y participio <b>${esc(p)}</b> ${btnVoz(w + ', ' + p)}`, voz: `${w}, ${p}`};
    }
  }
  if (/verbos irregulares/.test(t)) return {html: `Tengo <b>${IRREGULARES.length}</b> verbos irregulares, por ejemplo <b>go, went, gone</b>. <button class="sm" onclick="go('bibingles');setTimeout(bibVerbos,60)">🔀 Ver la lista</button>`};
  // Gramática: «explícame el verbo to be», «¿qué es el presente simple?», «cómo uso can»
  if (/(explica|ensena|que es|como se usa|como uso|como funciona|gramatica|cuando se usa|como se forma|diferencia|leccion|tema|ayuda con|no entiendo)/.test(t) || /^(el |la )?(verbo )?to ?be$/.test(t)) {
    const g = bibTema(t);
    if (g) return {html: bibResumenTema(g)};
  }
  // Frases útiles
  for (const lista of Object.values(FRASES_UTILES)) for (const f of lista) {
    if (norm(f[1]).replace(/[¿?¡!.,]/g, '').trim() === t) return {html: `«${esc(f[1])}» se dice <b>${esc(f[0])}</b> ${btnVoz(f[0])}`, voz: f[0]};
  }
  const r = OWL_CHAT_BASE(q);
  const fallo = r.noEntiende || /Todavía no conozco|No encontré/.test(r.html);
  if (!fallo || !window.BIBLIO) return r;
  const B = window.BIBLIO;
  // «¿cómo se dice X?»
  if ((m = t.match(/(?:como se dice|como digo|como se escribe|traduce|traduceme|traducir) (?:en ingles )?(.+?)(?: en ingles| al ingles)?$/)) || (m = t.match(/^(.+) (?:en|al) ingles$/))) {
    const w = m[1].trim();
    const fr = B.fr.find(f => norm(f[1]).replace(/[¿?¡!.,]/g, '').trim() === w);
    if (fr) return {html: `«${esc(fr[1])}» = <b>${esc(fr[0])}</b> ${btnVoz(fr[0], true)}`, voz: fr[0]};
    const e = bibBuscarEs(w);
    if (e) { const en0 = e.en[0], d = bibBuscarEn(en0); return {html: `«${esc(w.includes(' ') || norm(e.es) !== w ? w : e.es)}» en inglés: <b>${e.en.map(esc).join('</b>, <b>')}</b> ${btnVoz(en0)}${d && d.d[3] && B.fr[d.d[3][0]] ? `<br>Ejemplo: <b>${esc(B.fr[d.d[3][0]][0])}</b> = ${esc(B.fr[d.d[3][0]][1])}` : ''}`, voz: en0}; }
    if (w.includes(' ')) return bibPalabraAPalabra(w, 'es');
    return {noEntiende: true, html: `Busqué «${esc(w)}» en mi biblioteca de ${B._lista.length} palabras y no la encontré. ¿La escribiste bien?`};
  }
  // «¿qué significa X?»
  if ((m = t.match(/(?:que significa|que es|que quiere decir|significado de|traduce) (.+)$/))) {
    const w = m[1].trim();
    const fr = B.fr.find(f => normEn(f[0]) === normEn(w));
    if (fr) return {html: `<b>${esc(fr[0])}</b> = «${esc(fr[1])}» ${btnVoz(fr[0], true)}`, voz: fr[0]};
    const d = bibBuscarEn(w);
    if (d) return {html: bibFicha(d), voz: d.w};
    if (w.includes(' ')) return bibPalabraAPalabra(w, 'en');
    return {noEntiende: true, html: `No encontré «${esc(w)}» en mi biblioteca. ¿La escribiste bien?`};
  }
  // Una palabra suelta en inglés o español
  if (!t.includes(' ')) {
    const d = bibBuscarEn(t); if (d) return {html: bibFicha(d), voz: d.w};
    const e = bibBuscarEs(t); if (e) return {html: `«${esc(norm(e.es) === t ? e.es : t)}» en inglés: <b>${e.en.map(esc).join('</b>, <b>')}</b> ${btnVoz(e.en[0])}`, voz: e.en[0]};
  }
  // Una frase en inglés que está en la biblioteca
  const fe = B.fr.find(f => normEn(f[0]) === normEn(q));
  if (fe) return {html: `<b>${esc(fe[0])}</b> = «${esc(fe[1])}»`, voz: fe[0]};
  const g = bibTema(t, 8);
  if (g) return {html: bibResumenTema(g)};
  return r;
};
function bibPalabraAPalabra(frase, de) {
  const partes = frase.split(/\s+/).slice(0, 8).map(p => {
    const d = bibBuscarEn(p), e = bibBuscarEs(p);
    if (d && (de === 'en' || !e)) return `<b>${esc(p)}</b> = ${esc(d.d[1].split('|')[0])}`;
    return e ? `${esc(p)} = <b>${esc(e.en[0])}</b>` : `${esc(p)} = ?`;
  });
  return {noEntiende: true, html: `No tengo esa frase completa, pero palabra por palabra:<br>${partes.join('<br>')}<br><small class="muted">Para traducir frases enteras usa 🦉✨ Owl Inteligente.</small>`};
}
// El chat abre la biblioteca antes de empezar, para que Owl sepa más
const enChatBase = enChat;
enChat = function () { BIB.cargar().catch(() => {}).finally(() => enChatBase()); };

// ---------- Pantallas de la biblioteca ----------
SECCIONES.splice(SECCIONES.findIndex(s => s.id === 'ingles') + 1, 0, {id: 'bibingles', t: 'Biblioteca de inglés', e: '📚', c: '#DCEFFF', d: 'Gramática, verbos, diccionario y frases'});
const bibVolver = () => `<button class="sec" onclick="R.bibingles()">← Biblioteca</button>`;

R.bibingles = function () {
  limpiar();
  view.innerHTML = `<div class="card" style="background:linear-gradient(135deg,#DCEFFF,#fff)">
      ${owlBox('<b>Welcome to the library!</b><br>Aquí está todo lo que sé de inglés, y funciona sin internet. Pregúntame en 💬 y busco aquí la respuesta.')}
    </div>
    <div class="grid">
      <button class="tile" onclick="bibGramatica()"><span class="em" style="background:#E3F8EE">📖</span>Gramática<small>${GRAMATICA.length} lecciones con práctica</small></button>
      <button class="tile" onclick="bibVerbos()"><span class="em" style="background:#FFF1CC">🔀</span>Verbos irregulares<small>${IRREGULARES.length} verbos con voz</small></button>
      <button class="tile" onclick="bibDiccionario()"><span class="em" style="background:#DCEFFF">🔎</span>Diccionario<small>8.000 palabras con ejemplos</small></button>
      <button class="tile" onclick="bibFrases()"><span class="em" style="background:#FFE3D8">💬</span>Frases útiles<small>Saludos, clase, comida…</small></button>
      <button class="tile" onclick="bibPalabraDia()"><span class="em" style="background:#E9E1FF">🎲</span>Palabra al azar<small>Aprende una nueva</small></button>
      <button class="tile" onclick="enChat()"><span class="em" style="background:#FFDDEE">🦉</span>Pregúntale a Owl<small>Responde con la biblioteca</small></button>
    </div>
    <p><button class="sec" onclick="go('ingles')">🦉 Ir a Inglés</button> <button class="sec" onclick="bibCreditos()">©️ Créditos</button></p>`;
  BIB.cargar().catch(() => {});
};

function bibGramatica() {
  limpiar();
  view.innerHTML = `<div class="card"><h2>📖 Gramática</h2><p class="muted">Toca una lección. Cada una trae explicación, tabla, ejemplos con voz y práctica.</p></div>
    <div class="grid">${GRAMATICA.map(g => `<button class="tile" onclick="bibGramTema('${g.id}')"><span class="em" style="background:#E3F8EE">${g.e}</span>${esc(g.t)}</button>`).join('')}</div><p>${bibVolver()}</p>`;
}
function bibGramTema(id) {
  limpiar();
  const g = GRAMATICA.find(x => x.id === id); if (!g) return bibGramatica();
  const i = GRAMATICA.indexOf(g), sig = GRAMATICA[i + 1];
  view.innerHTML = `<div class="card"><h2>${g.e} ${esc(g.t)}</h2>${owlBox(g.explica)}
      <div class="row" style="margin-top:8px"><button class="sm" onclick="owlHabla(GRAMATICA[${i}].explica)">🔊 Que Owl me lo explique</button><button class="sm sec" onclick="stopSpeak()">⏹️</button></div></div>
    <div class="card"><h3>📋 Tabla</h3>${g.tabla.map(r => `<div class="lib"><span><b>${esc(r[0])}</b></span><span class="muted" style="text-align:right">${esc(r[1])} ${btnVoz(r[0].split(' → ').join(', '))}</span></div>`).join('')}
      <p style="margin-top:10px">💡 ${g.extra}</p></div>
    <div class="card"><h3>🗣️ Ejemplos</h3>${g.ejemplos.map(e => `<div class="lib"><span><b>${esc(e[0])}</b><br><small class="muted">${esc(e[1])}</small></span>${btnVoz(e[0], true)}</div>`).join('')}</div>
    <div class="card"><h3>🎯 Practica</h3><div id="prac"></div></div>
    <p>${bibVolver()} <button class="sec" onclick="bibGramatica()">📖 Lecciones</button>${sig ? ` <button onclick="bibGramTema('${sig.id}')">Siguiente: ${sig.e} ${esc(sig.t.split(' (')[0])} →</button>` : ''}</p>`;
  let n = 0, bien = 0;
  const caja = $('#prac');
  const pintar = () => {
    if (n >= g.practica.length) {
      caja.innerHTML = `<p class="big" style="text-align:center">${bien === g.practica.length ? '🏆' : '🌟'} ${bien} de ${g.practica.length}</p><button onclick="bibGramTema('${g.id}')">🔁 Otra vez</button>`;
      if (bien === g.practica.length) { SFX.win && SFX.win(); const hechas = store.get('bib_gram', {}); hechas[g.id] = 1; store.set('bib_gram', hechas); }
      return;
    }
    const p = g.practica[n];
    caja.innerHTML = `<p><b>${n + 1}.</b> ${esc(p.q)}</p><div class="row">${p.op.map((o, k) => `<button class="sec" data-k="${k}">${esc(o)}</button>`).join('')}</div><p id="pres"></p>`;
    caja.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const ok = +b.dataset.k === p.ok;
      caja.querySelectorAll('[data-k]').forEach(x => x.disabled = true);
      b.style.background = ok ? 'var(--ok)' : 'var(--bad)'; b.style.color = '#fff';
      if (ok) { bien++; SFX.ok && SFX.ok(); } else { SFX.bad && SFX.bad(); }
      $('#pres').innerHTML = `${ok ? '✅ ¡Muy bien!' : '❌ La correcta es <b>' + esc(p.op[p.ok]) + '</b>.'} ${esc(p.ex)} <button class="sm" id="psig">Siguiente →</button>`;
      $('#psig').onclick = () => { n++; pintar(); };
    });
  };
  pintar();
}

function bibVerbos() {
  limpiar();
  view.innerHTML = `<div class="card"><h2>🔀 Verbos irregulares</h2><p class="muted">Infinitivo · pasado · participio. Toca 🔊 para oír los tres.</p>
      <div class="row" style="flex-wrap:nowrap"><input id="vbus" placeholder="Busca: go, comer, went…" autocomplete="off"><button onclick="bibVerbosJuego()">🎯 Practicar</button></div></div>
    <div class="card" id="vlis"></div><p>${bibVolver()}</p>`;
  const pintar = f => {
    const n = norm(f || '').trim();
    const l = IRREGULARES.filter(v => !n || v.some(x => norm(x).split(/[ ,/]+/).some(y => y.startsWith(n))));
    $('#vlis').innerHTML = l.length ? l.map(v => `<div class="lib"><span><b>${esc(v[0])}</b> · ${esc(v[1])} · ${esc(v[2])}<br><small class="muted">${esc(v[3])}</small></span>${btnVoz(v[0] + ', ' + v[1].split(' / ')[0] + ', ' + v[2].split(' / ')[0], true)}</div>`).join('') : '<p class="muted">No está en la lista. Si es regular, su pasado termina en <b>-ed</b>.</p>';
  };
  $('#vbus').oninput = e => pintar(e.target.value);
  pintar('');
}
function bibVerbosJuego() {
  limpiar();
  const ronda = shuffle(IRREGULARES).slice(0, 8); let n = 0, bien = 0;
  view.innerHTML = `<div class="card"><h2>🎯 ¿Cuál es el pasado?</h2><div id="vj"></div></div><p><button class="sec" onclick="bibVerbos()">← Verbos</button></p>`;
  const caja = $('#vj');
  const pintar = () => {
    if (n >= ronda.length) { caja.innerHTML = `<p class="big" style="text-align:center">${bien >= 7 ? '🏆' : '🌟'} ${bien} de ${ronda.length}</p><button onclick="bibVerbosJuego()">🔁 Jugar otra vez</button>`; return; }
    const v = ronda[n], malas = shuffle(IRREGULARES.filter(x => x !== v)).slice(0, 2).map(x => x[1]);
    const ops = shuffle([v[1], ...malas, v[0] + 'ed'].filter((x, i, a) => a.indexOf(x) === i)).slice(0, 4);
    if (!ops.includes(v[1])) ops[0] = v[1];
    caja.innerHTML = `<p class="muted">${n + 1} de ${ronda.length}</p><p class="big"><b>${esc(v[0])}</b> <small class="muted">(${esc(v[3])})</small> ${btnVoz(v[0])}</p><div class="row">${shuffle(ops).map(o => `<button class="sec" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><p id="vres"></p>`;
    caja.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const ok = b.dataset.o === v[1];
      caja.querySelectorAll('[data-o]').forEach(x => x.disabled = true);
      b.style.background = ok ? 'var(--ok)' : 'var(--bad)'; b.style.color = '#fff';
      if (ok) { bien++; SFX.ok && SFX.ok(); } else { SFX.bad && SFX.bad(); }
      speakEn(`${v[0]}, ${v[1].split(' / ')[0]}, ${v[2].split(' / ')[0]}`, true);
      $('#vres').innerHTML = `${ok ? '✅ ¡Correcto!' : '❌ Es <b>' + esc(v[1]) + '</b>.'} ${esc(v[0])} · ${esc(v[1])} · ${esc(v[2])} <button class="sm" id="vsig">Siguiente →</button>`;
      $('#vsig').onclick = () => { n++; pintar(); };
    });
  };
  pintar();
}

function bibDiccionario(inicial) {
  limpiar();
  view.innerHTML = `<div class="card"><h2>🔎 Diccionario inglés ⇄ español</h2>
      <div class="row" style="flex-wrap:nowrap"><input id="dbus" placeholder="Escribe en inglés o en español" autocomplete="off" value="${esc(inicial || '')}"><button id="dazar" class="sec" aria-label="Palabra al azar">🎲</button></div>
      <p class="muted" id="dest">Cargando la biblioteca…</p></div>
    <div id="dres"></div><p>${bibVolver()}</p>`;
  let tm = null;
  const buscar = () => {
    const B = window.BIBLIO, q = $('#dbus').value.trim(), res = $('#dres');
    if (!B) return;
    if (!q) { res.innerHTML = ''; return; }
    const out = [], vistos = new Set();
    const exacta = bibBuscarEn(q);
    if (exacta) { out.push(`<div class="card">${bibFicha(exacta, 3)}</div>`); vistos.add(exacta.w); }
    const e = bibBuscarEs(q);
    if (e) out.push(`<div class="card">«${esc(e.es)}» en inglés: ${e.en.map(x => `<b>${esc(x)}</b> ${btnVoz(x)}`).join(' · ')}${e.en.filter(x => B.en[x] && !vistos.has(x)).slice(0, 2).map(x => { vistos.add(x); return '<div style="margin-top:8px">' + bibFicha({w: x, d: B.en[x]}, 1) + '</div>'; }).join('')}</div>`);
    const n = normEn(q), ne = norm(q);
    const mas = [];
    if (n.length >= 2) for (const w of B._lista) { if (mas.length >= 12) break; if (w.startsWith(n) && !vistos.has(w)) mas.push(w); }
    if (mas.length) out.push(`<div class="card"><h3>Más palabras</h3>${mas.map(w => `<div class="lib"><span><b>${esc(w)}</b> <small class="muted">${esc(B.en[w][0])}</small><br><small>${esc(B.en[w][1].split('|').join(', '))}</small></span><button class="sm sec" onclick="bibDiccionario('${q1(w)}')">Ver</button></div>`).join('')}</div>`);
    if (!out.length) out.push(`<div class="card"><p>No encontré «${esc(q)}». Revisa cómo se escribe${ne.includes(' ') ? ' o busca una sola palabra' : ''}.</p></div>`);
    res.innerHTML = out.join('');
  };
  $('#dbus').oninput = () => { clearTimeout(tm); tm = setTimeout(buscar, 250); };
  $('#dazar').onclick = () => { const B = window.BIBLIO; if (!B) return; const w = B._lista[Math.floor(Math.random() * 2500)]; $('#dbus').value = w; buscar(); };
  BIB.cargar().then(B => { const d = $('#dest'); if (d) d.textContent = `${B._lista.length.toLocaleString('es')} palabras inglesas, ${Object.keys(B.es).length.toLocaleString('es')} españolas y ${B.fr.length.toLocaleString('es')} frases de ejemplo.`; buscar(); })
    .catch(e => { const d = $('#dest'); if (d) d.textContent = e.message; });
}
function bibPalabraDia() {
  BIB.cargar().then(B => {
    const sabidas = typeof todasPalabras === 'function' ? new Set(todasPalabras().map(p => normEn(p.en))) : new Set();
    const cand = B._lista.slice(0, 3000).filter(w => !sabidas.has(w) && B.en[w][3] && w.length > 2);
    bibDiccionario(cand[Math.floor(Math.random() * cand.length)]);
  }).catch(() => bibDiccionario());
}
function bibFrases() {
  limpiar();
  view.innerHTML = `<div class="card"><h2>💬 Frases útiles</h2><p class="muted">Toca 🔊 para oírlas despacio y repítelas en voz alta.</p></div>
    ${Object.entries(FRASES_UTILES).map(([tema, l]) => `<div class="card"><h3>${tema}</h3>${l.map(f => `<div class="lib"><span><b>${esc(f[0])}</b><br><small class="muted">${esc(f[1])}</small></span>${btnVoz(f[0].replace(/…/g, ''), true)}</div>`).join('')}</div>`).join('')}
    <p>${bibVolver()}</p>`;
}
function bibCreditos() {
  limpiar();
  BIB.cargar().catch(() => null).then(B => {
    view.innerHTML = `<div class="card"><h2>©️ Créditos de la biblioteca</h2>
      <p>La biblioteca usa datos libres y gratuitos. ¡Gracias a quienes los comparten!</p>
      ${(B ? B.creditos : []).map(c => `<div class="lib"><span>${esc(c)}</span></div>`).join('')}
      <div class="lib"><span>Gramática, verbos irregulares y frases útiles: escritos para Aprende y Juega.</span></div>
      <p class="muted">Las frases de ejemplo se filtraron para que sean aptas para niños.</p></div><p>${bibVolver()}</p>`;
  });
}

// Botones de acceso desde Inglés y desde Owl Inteligente
{
  const baseIngles = R.ingles;
  R.ingles = function () {
    baseIngles();
    const fila = view.querySelector('.card .row');
    if (fila && !fila.querySelector('.bibbtn')) fila.insertAdjacentHTML('afterbegin', `<button class="bibbtn" onclick="go('bibingles')">📚 Biblioteca</button>`);
    BIB.cargar().catch(() => {});
  };
  if (typeof R.owlia === 'function') {
    const baseOwl = R.owlia;
    R.owlia = function () {
      baseOwl();
      const g = view.querySelector('.grid');
      if (g && !g.querySelector('.bibtile')) g.insertAdjacentHTML('beforeend', `<button class="tile bibtile" onclick="go('bibingles')"><span class="em" style="background:#DCEFFF">📚</span>Biblioteca de inglés<small>Funciona sin internet</small></button>`);
    };
  }
}
