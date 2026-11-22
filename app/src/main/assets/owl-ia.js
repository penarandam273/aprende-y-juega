// ===== v2.2: Teacher Owl inteligente 🦉✨ =====
// Pregúntale lo que quieras, traduce fotos, crea oraciones, arma planes de estudio y mundos para aprender.

SECCIONES.splice(1, 0, {id: 'owlia', t: 'Owl Inteligente', e: '🦉', c: '#FFF1CC', d: 'Pregunta, fotos, planes y mundos'});

const owlVolver = () => `<button class="sec sm" onclick="go('owlia')">← Owl</button>`;
const titulo = t => { $('#title').textContent = t; };

R.owlia = function () {
  const p = PERFIL.actual();
  view.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#FFF1CC,#fff)">
      ${owlBox(`<b>Hello${p ? ', ' + esc(p.nombre) : ''}!</b> Soy Teacher Owl. Ahora puedo explicarte lo que quieras, leer tus fotos, inventar oraciones, armarte un plan y crear mundos para aprender jugando.`)}
      ${IA.lista() ? '' : '<p class="muted" style="margin-top:8px">⚠️ Para pensar necesito la clave de Gemini.</p><button style="width:100%" onclick="ajustesPapa()">🔑 Poner la clave de Gemini</button>'}
    </div>
    <div class="grid">
      <button class="tile" onclick="owlPregunta()"><span class="em" style="background:#E3F8EE">💬</span>Pregúntame lo que quieras<small>Ej: ¿cómo funciona el verbo to be?</small></button>
      <button class="tile" onclick="owlFoto()"><span class="em" style="background:#DCEFFF">📷</span>Traducir una foto<small>Libros, letreros, tareas</small></button>
      <button class="tile" onclick="owlOraciones()"><span class="em" style="background:#FFE3D8">✏️</span>Hacer oraciones<small>Con la palabra o tiempo que quieras</small></button>
      <button class="tile" onclick="owlPlan()"><span class="em" style="background:#E9E1FF">🗓️</span>Mi plan de estudios<small>Hecho para ${p ? esc(p.nombre) : 'cada usuario'}</small></button>
      <button class="tile" onclick="owlMundos()"><span class="em" style="background:#FFDDEE">🌍</span>Mundos para aprender<small>Aventuras con lecciones</small></button>
      <button class="tile" onclick="go('escribir')"><span class="em" style="background:#DDF5E8">✍️</span>Escribir mejor<small>Corrector, ensayos y más</small></button>
    </div>`;
  if (!window.__owlIaSaludo) { window.__owlIaSaludo = 1; owlHabla(`<b>Hello!</b> ¿Qué aprendemos hoy?`); }
};

// ---------- 💬 Pregúntame lo que quieras ----------
function owlPregunta() {
  limpiar(); titulo('Pregúntale a Owl');
  const hist = PERFIL.get('owl_chat', []).filter(m => m && m.parts && String(m.parts[0]?.text || '').trim()).slice(-16);
  PERFIL.set('owl_chat', hist);
  const ideas = PERFIL.esNino()
    ? ['¿Cómo funciona el verbo to be?', '¿Cuándo se usa do y does?', 'Enséñame los colores en inglés', '¿Qué es un sustantivo?']
    : ['Explícame el present perfect', 'Diferencia entre make y do', '¿Cuándo se usa la tilde diacrítica?', 'Dame 5 phrasal verbs útiles'];
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">💬 Pregúntale a Owl</h2>${owlVolver()}</div>
    <div id="chat" class="chatbox" style="height:380px;margin-top:10px"></div>
    <div class="row" style="margin-top:8px">${ideas.map(x => `<button class="sec sm" data-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="preg" placeholder="Escribe tu pregunta…" style="flex:1;min-width:0">
      ${puedeEscuchar() ? '<button class="sec" id="micP" title="Preguntar con la voz">🎤</button>' : ''}<button id="envP">Enviar</button></div>
    <div class="row" style="margin-top:6px"><button class="sec sm" id="borrarP">🧹 Empezar de nuevo</button></div></div>`;
  const caja = $('#chat');
  const pintar = () => {
    caja.innerHTML = (hist.length ? '' : `<div class="msg owl">🦉 Pregúntame lo que quieras de inglés, de español o de tus tareas. Te lo explico con ejemplos.</div>`)
      + hist.map(m => m.role === 'user' ? `<div class="msg yo">${txtSeguro(m.parts[0].text)}</div>` : `<div class="msg owl">🦉 ${limpiarHtml(m.parts[0].text)} <button class="sec sm" data-oir>🔊</button></div>`).join('');
    caja.querySelectorAll('[data-oir]').forEach(b => b.onclick = () => owlHabla(b.parentElement.innerHTML));
    caja.scrollTop = caja.scrollHeight;
  };
  pintar();
  const enviar = async (q) => {
    q = (q || $('#preg').value).trim(); if (!q) return;
    conIA(async () => {
      $('#preg').value = '';
      const antes = hist.slice(-12);
      hist.push({role: 'user', parts: [{text: q}]}); pintar();
      caja.insertAdjacentHTML('beforeend', '<div class="msg owl" id="pens">🦉 Pensando…</div>'); caja.scrollTop = caja.scrollHeight;
      $('#envP').disabled = true;
      try {
        // La respuesta se va viendo mientras Owl la escribe
        const r = await IA.flujo(q + '\n\nExplícalo paso a paso, con 2 o 3 ejemplos y, si sirve, una mini práctica al final. Sé breve: máximo 180 palabras.', {historial: antes, max: 1500},
          t => { const el = $('#pens'); if (el) { el.innerHTML = '🦉 ' + limpiarHtml(t); caja.scrollTop = caja.scrollHeight; } });
        hist.push({role: 'model', parts: [{text: r}]});
        PERFIL.set('owl_chat', hist.slice(-30)); pintar(); owlHabla(r);
      } catch (e) {
        hist.pop(); pintar();
        // El error se queda en el chat con un botón para reintentar (no solo un aviso que se va)
        caja.insertAdjacentHTML('beforeend', `<div class="msg owl" style="background:#FFF4E0">😕 ${txtSeguro(e.message)}<br><button class="sm" id="reintP">🔄 Reintentar</button></div>`);
        caja.scrollTop = caja.scrollHeight;
        $('#reintP').onclick = () => enviar(q);
      } finally { if ($('#envP')) $('#envP').disabled = false; }
    });
  };
  $('#envP').onclick = () => enviar();
  $('#preg').onkeydown = e => { if (e.key === 'Enter') enviar(); };
  view.querySelectorAll('[data-idea]').forEach(b => b.onclick = () => enviar(b.dataset.idea));
  $('#borrarP').onclick = () => { hist.length = 0; PERFIL.set('owl_chat', []); pintar(); };
  if ($('#micP')) $('#micP').onclick = () => { const mb = $('#micP'); mb.classList.add('rec-on'); mb.textContent = '👂'; const fin = () => { mb.classList.remove('rec-on'); mb.textContent = '🎤'; }; escucharEn(l => { fin(); const t = Array.isArray(l) ? (l[0] || '') : String(l || ''); if (!t) return toast('No te escuché'); $('#preg').value = t; enviar(t); }, m => { fin(); toast(m || 'No te escuché. Intenta otra vez.'); }, 'es-CO'); };
}

// ---------- 📷 Traducir una foto ----------
function owlFoto() {
  limpiar(); titulo('Traducir una foto');
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">📷 Traducir una foto</h2>${owlVolver()}</div>
    <p class="muted">Toma una foto de un libro, una tarea o un letrero. Owl lee el texto, lo traduce y te explica las palabras difíciles.</p>
    <div class="row"><select id="dir" style="flex:1"><option value="auto">Detectar idioma y traducir</option><option value="es">Traducir al español</option><option value="en">Traducir al inglés</option></select></div>
    <div class="row" style="margin-top:8px"><button id="tomar">📸 Tomar o elegir foto</button></div>
    <input type="file" id="fotoIn" accept="image/*" capture="environment" hidden>
    <img id="prev" style="display:none;width:100%;max-height:260px;object-fit:contain;margin-top:10px;border-radius:12px;background:#fff">
    <div id="res"></div></div>`;
  $('#tomar').onclick = () => conIA(() => $('#fotoIn').click());
  $('#fotoIn').onchange = async () => {
    const f = $('#fotoIn').files[0]; $('#fotoIn').value = ''; if (!f) return;
    $('#prev').src = URL.createObjectURL(f); $('#prev').style.display = 'block';
    const dir = $('#dir').value;
    const r = await pensando($('#tomar'), async () => IA.json(`Lee todo el texto de la foto. ${dir === 'es' ? 'Tradúcelo al español.' : dir === 'en' ? 'Tradúcelo al inglés.' : 'Si está en inglés tradúcelo al español; si está en español, tradúcelo al inglés.'}
Responde SOLO JSON: {"original": texto leído tal cual, "idioma_original": "inglés" o "español" u otro, "traduccion": la traducción, "palabras": [ {"palabra": palabra difícil, "significado": significado simple} ] (máximo 8), "explicacion": 1 o 2 frases sobre de qué trata, adaptadas a la edad}. Si no hay texto legible, pon original vacío y explícalo en explicacion.`, {imagenes: [await fotoA64(f)]}));
    if (!r) return;
    const enIngles = /ingl/i.test(r.idioma_original || '');
    $('#res').innerHTML = `
      <h3 style="margin-top:12px">📝 Texto de la foto</h3><div class="owlm" style="white-space:pre-wrap">${txtSeguro(r.original || '(no encontré texto)')}</div>
      <div class="row" style="margin-top:6px"><button class="sec sm" id="oirOrig">🔊 Escuchar original</button></div>
      <h3 style="margin-top:12px">🌎 Traducción</h3><div class="owlm" style="white-space:pre-wrap">${txtSeguro(r.traduccion || '')}</div>
      <div class="row" style="margin-top:6px"><button class="sec sm" id="oirTrad">🔊 Escuchar traducción</button></div>
      ${(r.palabras || []).length ? `<h3 style="margin-top:12px">📚 Palabras nuevas</h3>${r.palabras.map(w => `<div class="lib"><b>${txtSeguro(w.palabra)}</b><span class="muted" style="text-align:right">${txtSeguro(w.significado)}</span></div>`).join('')}` : ''}
      ${r.explicacion ? owlBox(txtSeguro(r.explicacion)).replace('id="owl"', '') : ''}`;
    const oir = (t, en) => en ? speakEn(t) : speak(t);
    $('#oirOrig').onclick = () => oir(r.original || '', enIngles);
    $('#oirTrad').onclick = () => oir(r.traduccion || '', !enIngles);
    stars(1);
  };
}

// ---------- ✏️ Hacer oraciones ----------
function owlOraciones() {
  limpiar(); titulo('Hacer oraciones');
  const tiempos = PERFIL.esNino()
    ? ['to be (am, is, are)', 'presente simple', 'can (poder)', 'presente continuo (-ing)', 'pasado simple', 'there is / there are']
    : ['present simple', 'present continuous', 'past simple', 'present perfect', 'future (will / going to)', 'conditionals', 'passive voice', 'modal verbs'];
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">✏️ Hacer oraciones</h2>${owlVolver()}</div>
    <p class="muted">Escribe una palabra o un tema y elige el tiempo. Owl inventa oraciones en inglés con su traducción.</p>
    <input id="orPal" placeholder="Palabra o tema (ej: dog, mi casa, fútbol)">
    <div class="row" style="margin-top:8px"><select id="orTiempo" style="flex:2">${tiempos.map(t => `<option>${t}</option>`).join('')}</select>
      <select id="orTipo" style="flex:1"><option value="afirmativas">Afirmativas</option><option value="negativas">Negativas</option><option value="preguntas">Preguntas</option><option value="mezcla">Mezcla</option></select></div>
    <div class="row" style="margin-top:8px"><button id="orGo">✨ Crear oraciones</button></div><div id="orRes"></div></div>`;
  $('#orGo').onclick = () => conIA(async () => {
    const pal = $('#orPal').value.trim() || 'cosas de todos los días', tiempo = $('#orTiempo').value, tipo = $('#orTipo').value;
    const r = await pensando($('#orGo'), () => IA.json(`Crea 6 oraciones ${tipo} en inglés usando "${pal}" con el tiempo/estructura "${tiempo}". Nivel adecuado para la edad. Responde SOLO JSON: {"regla": explicación corta de cómo se forma ese tiempo (máximo 3 frases, en español; lo que esté en inglés va entre <b></b>), "oraciones": [ {"en": oración en inglés, "es": traducción, "nota": por qué se escribe así (corto)} ]}`));
    if (!r) return;
    $('#orRes').innerHTML = `${owlBox(limpiarHtml(r.regla || '')).replace('id="owl"', 'id="owlRegla"')}
      ${(r.oraciones || []).map((o, i) => `<div class="card" style="margin:8px 0;background:#FAF9FF"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b style="font-size:18px">${txtSeguro(o.en)}</b><button class="sec sm" data-en="${i}">🔊</button></div>
        <div>${txtSeguro(o.es)}</div><small class="muted">${txtSeguro(o.nota || '')}</small></div>`).join('')}
      <div class="row"><button class="sec" id="orTodas">🔊 Escuchar todas</button><button class="sec" id="orPract">🎯 Practicar armándolas</button></div>`;
    $('#orRes').querySelectorAll('[data-en]').forEach(b => b.onclick = () => speakEn(r.oraciones[+b.dataset.en].en));
    $('#orTodas').onclick = () => hablarSecuencia(r.oraciones.flatMap(o => [{t: o.en, l: 'en-US', v: .85}, {t: o.es, l: 'es-CO', v: 1}]));
    $('#orPract').onclick = () => armarOraciones(r.oraciones);
    stars(1);
  });
}
// Mini juego: arma la oración con fichas
function armarOraciones(lista) {
  let i = 0, ok = 0;
  const pintar = () => {
    if (i >= lista.length) { view.innerHTML = `<div class="card" style="text-align:center"><div class="big">🎉</div><h2>¡Armaste ${ok} de ${lista.length}!</h2><button onclick="owlOraciones()">Hacer más oraciones</button></div>`; stars(ok); return; }
    const o = lista[i], palabras = o.en.replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean);
    let armada = [];
    view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🎯 Arma la oración ${i + 1}/${lista.length}</h2>${owlVolver()}</div>
      <p>${txtSeguro(o.es)}</p><div class="armada" id="arm"></div><div class="fichas" id="fic">${shuffle(palabras.map((w, k) => ({w, k}))).map(x => `<button class="ficha" data-k="${x.k}">${txtSeguro(x.w)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button id="chk">Revisar</button><button class="sec" id="rst">Borrar</button><button class="sec" id="oirA">🔊</button></div></div>`;
    const arm = $('#arm');
    view.querySelectorAll('.ficha').forEach(b => b.onclick = () => { armada.push(palabras[+b.dataset.k]); b.disabled = true; arm.textContent = armada.join(' '); });
    $('#rst').onclick = pintar;
    $('#oirA').onclick = () => speakEn(o.en);
    $('#chk').onclick = () => {
      if (norm(armada.join(' ')) === norm(palabras.join(' '))) { ok++; SFX.ok && SFX.ok(); toast('¡Perfecto! ✅'); speakEn(o.en); i++; setTimeout(pintar, 1200); }
      else { SFX.bad && SFX.bad(); toast('Casi… intenta otra vez'); }
    };
  };
  pintar();
}

// ---------- 🗓️ Mi plan de estudios (uno por usuario) ----------
const ACTIVIDADES_APP = () => [
  ...INGLES.map(u => ({id: 'en:' + u.id, t: 'Inglés: ' + u.t})),
  {id: 'owl:pregunta', t: 'Preguntarle a Owl un tema'}, {id: 'owl:oraciones', t: 'Hacer oraciones con Owl'}, {id: 'owl:mundos', t: 'Mundos para aprender'},
  {id: 'escribir', t: 'Escribir mejor (corrector, ensayos)'}, ...SECCIONES.filter(s => !['owlia', 'ingles', 'escribir'].includes(s.id)).map(s => ({id: s.id, t: s.t}))
];
function irActividad(id) {
  if (id.startsWith('en:')) { go('ingles'); setTimeout(() => enTema(id.slice(3)), 50); return; }
  if (id === 'owl:pregunta') { go('owlia'); setTimeout(owlPregunta, 50); return; }
  if (id === 'owl:oraciones') { go('owlia'); setTimeout(owlOraciones, 50); return; }
  if (id === 'owl:mundos') { go('owlia'); setTimeout(owlMundos, 50); return; }
  go(R[id] ? id : 'home');
}
function owlPlan() {
  limpiar(); titulo('Mi plan de estudios');
  const p = PERFIL.actual();
  if (!p) { view.innerHTML = `<div class="card"><h2>🗓️ Mi plan de estudios</h2><p>Primero elige quién eres en 👤 (arriba). Papá crea los perfiles en ⚙️ Ajustes.</p><div class="row"><button onclick="elegirPerfil()">👤 Elegir perfil</button>${owlVolver()}</div></div>`; return; }
  const plan = PERFIL.get('plan', null), hechos = PERFIL.get('plan_hechos', {});
  const total = plan ? plan.dias.reduce((s, d) => s + d.tareas.length, 0) : 0, listos = Object.keys(hechos).length;
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🗓️ Plan de ${esc(p.nombre)}</h2>${owlVolver()}</div>
    ${plan ? `<p class="muted">${txtSeguro(plan.objetivo)} · ${listos}/${total} hechas</p><div class="bar"><i style="width:${total ? Math.round(listos * 100 / total) : 0}%;background:var(--ok)"></i></div>` : '<p class="muted">Owl arma un plan semanal según la edad, lo que quieres aprender y el tiempo que tienes. Usa las actividades de la app.</p>'}
    <details ${plan ? '' : 'open'} style="margin-top:10px"><summary><b>${plan ? '🔄 Hacer un plan nuevo' : '✨ Crear mi plan'}</b></summary>
      <div style="display:grid;gap:8px;margin-top:8px">
        <input id="plObj" placeholder="¿Qué quieres aprender? (ej: inglés para el colegio, multiplicar, escribir sin errores)" value="${plan ? esc(plan.meta || '') : ''}">
        <div class="row"><select id="plMin" style="flex:1"><option value="15">15 min al día</option><option value="20" selected>20 min al día</option><option value="30">30 min al día</option><option value="45">45 min al día</option></select>
        <select id="plDias" style="flex:1"><option value="3">3 días por semana</option><option value="5" selected>5 días por semana</option><option value="7">Todos los días</option></select></div>
        <button id="plGo">✨ Armar plan con Owl</button></div></details></div>
    ${plan ? plan.dias.map((d, di) => `<div class="card"><h3>${txtSeguro(d.dia)} · ${txtSeguro(d.tema)}</h3>${d.tareas.map((t, ti) => {
      const k = di + '-' + ti, h = hechos[k];
      return `<div class="lib"><label style="display:flex;gap:8px;align-items:center;flex:1"><input type="checkbox" data-k="${k}" ${h ? 'checked' : ''} style="width:22px;height:22px;flex:none"><span style="${h ? 'text-decoration:line-through;opacity:.6' : ''}">${txtSeguro(t.texto)} <small class="muted">· ${Number(t.minutos) || 10} min</small></span></label>${t.actividad ? `<button class="sm" data-ir="${esc(t.actividad)}">Ir ▶</button>` : ''}</div>`;
    }).join('')}</div>`).join('') : ''}`;
  if (plan) {
    view.querySelectorAll('[data-k]').forEach(c => c.onchange = () => { const hh = PERFIL.get('plan_hechos', {}); if (c.checked) { hh[c.dataset.k] = 1; stars(1); } else delete hh[c.dataset.k]; PERFIL.set('plan_hechos', hh); owlPlan(); });
    view.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irActividad(b.dataset.ir));
  }
  $('#plGo').onclick = () => conIA(async () => {
    const meta = $('#plObj').value.trim() || 'repasar inglés y matemáticas', min = $('#plMin').value, dias = $('#plDias').value;
    const acts = ACTIVIDADES_APP();
    const r = await pensando($('#plGo'), () => IA.json(`Arma un plan de estudios de 1 semana para ${p.nombre} (${p.nivel === 'adulto' ? 'adulto' : (p.edad || 9) + ' años'}). Meta: "${meta}". Tiempo: ${min} minutos al día, ${dias} días por semana.
Usa sobre todo estas actividades de la app (pon su id en "actividad" cuando aplique, o "" si es algo fuera de la app):
${acts.map(a => a.id + ' = ' + a.t).join('\n')}
Responde SOLO JSON: {"objetivo": una frase motivadora que resuma el plan, "dias": [ {"dia": "Lunes"…, "tema": tema del día, "tareas": [ {"texto": qué hacer, concreto, "minutos": número, "actividad": id de la lista o ""} ] } ]} con ${dias} días y 2 a 4 tareas por día que sumen unos ${min} minutos.`));
    if (!r || !Array.isArray(r.dias)) return;
    const ids = new Set(acts.map(a => a.id));
    r.dias = r.dias.slice(0, 7).map(d => ({dia: String(d.dia || ''), tema: String(d.tema || ''), tareas: (d.tareas || []).slice(0, 5).map(t => ({texto: String(t.texto || ''), minutos: Number(t.minutos) || 10, actividad: ids.has(t.actividad) ? t.actividad : ''}))}));
    PERFIL.set('plan', {objetivo: String(r.objetivo || meta), meta, dias: r.dias, creado: Date.now()}); PERFIL.set('plan_hechos', {});
    owlHabla('¡Listo! Tu plan está armado. Vamos paso a paso. <b>You can do it!</b>'); owlPlan();
  });
}

// ---------- 🌍 Mundos para aprender ----------
function owlMundos() {
  limpiar(); titulo('Mundos para aprender');
  const mundos = PERFIL.get('mundos', []);
  const ideas = ['Isla de los animales en inglés', 'Castillo de las tablas de multiplicar', 'Selva de los verbos en inglés', 'Espacio de las palabras con tilde', 'Océano de los planetas'];
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🌍 Mundos para aprender</h2>${owlVolver()}</div>
    <p class="muted">Owl crea un mundo de aventura con 5 lugares. En cada lugar hay una lección corta y un reto. ¡Gana estrellas y desbloquea el siguiente!</p>
    <input id="muTema" placeholder="¿Sobre qué quieres tu mundo? (ej: dinosaurios en inglés)">
    <div class="row" style="margin-top:6px">${ideas.map(x => `<button class="sec sm" data-mi="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button id="muGo">✨ Crear mundo</button></div></div>
    <div class="grid">${mundos.map((m, i) => {
      const hechas = (m.hechas || []).length;
      return `<button class="tile" data-mu="${i}" style="background:${esc(m.color || '#fff')}"><span class="em" style="background:#fff">${esc(m.emoji || '🌍')}</span>${esc(m.nombre)}<small>${hechas}/${m.estaciones.length} lugares ${hechas === m.estaciones.length ? '🏆' : ''}</small></button>`;
    }).join('')}</div>`;
  view.querySelectorAll('[data-mi]').forEach(b => b.onclick = () => { $('#muTema').value = b.dataset.mi; });
  view.querySelectorAll('[data-mu]').forEach(b => b.onclick = () => verMundo(+b.dataset.mu));
  $('#muGo').onclick = () => conIA(async () => {
    const tema = $('#muTema').value.trim(); if (!tema) return toast('Escribe sobre qué quieres tu mundo');
    const r = await pensando($('#muGo'), () => IA.json(`Crea un mundo de aventura educativo sobre "${tema}" para la edad del usuario. Responde SOLO JSON:
{"nombre": nombre del mundo, "emoji": un emoji, "color": color pastel en hex, "historia": 2 frases que presenten la aventura,
 "estaciones": [ {"nombre": nombre del lugar, "emoji": emoji, "leccion": lección corta y clara (3 a 5 frases; lo que esté en inglés va entre <b></b>), "vocabulario": [ {"palabra": string, "significado": string} ] (2 a 4),
   "preguntas": [ {"pregunta": string, "opciones": [3 opciones], "correcta": índice 0 a 2, "explicacion": por qué} ] (3 preguntas) } ] } con exactamente 5 estaciones que vayan de fácil a difícil.`, {max: 6000}));
    if (!r || !Array.isArray(r.estaciones) || !r.estaciones.length) return;
    const limpio = {nombre: String(r.nombre || tema).slice(0, 60), emoji: String(r.emoji || '🌍').slice(0, 4), color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : '#E9E1FF',
      historia: String(r.historia || ''), hechas: [], estaciones: r.estaciones.slice(0, 6).map(e => ({nombre: String(e.nombre || ''), emoji: String(e.emoji || '⭐').slice(0, 4), leccion: limpiarHtml(e.leccion || ''),
        vocabulario: (e.vocabulario || []).slice(0, 5).map(v => ({palabra: String(v.palabra || ''), significado: String(v.significado || '')})),
        preguntas: (e.preguntas || []).slice(0, 4).filter(q => Array.isArray(q.opciones) && q.opciones.length >= 2).map(q => ({pregunta: String(q.pregunta || ''), opciones: q.opciones.slice(0, 4).map(String), correcta: Math.max(0, Math.min(Number(q.correcta) || 0, q.opciones.length - 1)), explicacion: String(q.explicacion || '')}))}))};
    const l = PERFIL.get('mundos', []); l.unshift(limpio); PERFIL.set('mundos', l.slice(0, 20));
    verMundo(0);
  });
}
function verMundo(i) {
  limpiar();
  const l = PERFIL.get('mundos', []), m = l[i]; if (!m) return owlMundos();
  titulo(m.nombre);
  const hechas = new Set(m.hechas || []);
  view.innerHTML = `<div class="card" style="background:linear-gradient(135deg,${esc(m.color)},#fff)"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(m.emoji)} ${esc(m.nombre)}</h2><button class="sec sm" onclick="owlMundos()">← Mundos</button></div>
    ${owlBox(txtSeguro(m.historia))}</div>
    <div class="card" style="position:relative">${m.estaciones.map((e, j) => {
      const abierta = j === 0 || hechas.has(j - 1), hecha = hechas.has(j);
      return `<div style="display:flex;align-items:center;gap:12px;margin:${j ? '0' : '0'} 0 ${j < m.estaciones.length - 1 ? '0' : '0'};${j % 2 ? 'flex-direction:row-reverse;text-align:right' : ''}">
        <button class="tile" data-es="${j}" ${abierta ? '' : 'disabled'} style="width:110px;flex:none;${hecha ? 'background:#E3F8EE' : ''}"><span class="em" style="background:${hecha ? '#fff' : esc(m.color)}">${abierta ? esc(e.emoji) : '🔒'}</span><small>${hecha ? '⭐ Listo' : abierta ? '¡Entra!' : 'Bloqueado'}</small></button>
        <div><b>${j + 1}. ${esc(e.nombre)}</b></div></div>${j < m.estaciones.length - 1 ? `<div style="height:28px;border-left:4px dotted ${esc(m.color)};margin:0 ${j % 2 ? 'auto' : '0'} 0 ${j % 2 ? 'auto' : '53px'};width:0;${j % 2 ? 'margin-right:53px' : ''}"></div>` : ''}`;
    }).join('')}${hechas.size === m.estaciones.length ? '<div style="text-align:center;margin-top:10px" class="big">🏆 ¡Mundo completado!</div>' : ''}</div>`;
  view.querySelectorAll('[data-es]').forEach(b => b.onclick = () => estacion(i, +b.dataset.es));
  if (!hechas.size) owlHabla(m.historia);
}
function estacion(mi, ej) {
  limpiar();
  const m = PERFIL.get('mundos', [])[mi], e = m.estaciones[ej];
  titulo(e.nombre);
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(e.emoji)} ${esc(e.nombre)}</h2><button class="sec sm" id="volM">← ${esc(m.nombre)}</button></div>
    ${owlBox(e.leccion)}
    ${e.vocabulario.length ? `<h3 style="margin-top:12px">📚 Palabras</h3>${e.vocabulario.map((v, k) => `<div class="lib"><b>${txtSeguro(v.palabra)}</b><span class="muted">${txtSeguro(v.significado)} <button class="sec sm" data-vo="${k}">🔊</button></span></div>`).join('')}` : ''}
    <div class="row" style="margin-top:12px"><button id="reto">🎯 ¡Al reto!</button><button class="sec" id="oirL">🔊 Escuchar lección</button></div></div>`;
  $('#volM').onclick = () => verMundo(mi);
  $('#oirL').onclick = () => owlHabla(e.leccion);
  view.querySelectorAll('[data-vo]').forEach(b => b.onclick = () => { const v = e.vocabulario[+b.dataset.vo]; /^[\x00-\x7F]+$/.test(v.palabra) ? speakEn(v.palabra) : speak(v.palabra); });
  owlHabla(e.leccion);
  $('#reto').onclick = () => {
    let q = 0, ok = 0;
    const pintarQ = () => {
      if (q >= e.preguntas.length) {
        const gano = ok >= Math.ceil(e.preguntas.length * 2 / 3);
        if (gano) { const l = PERFIL.get('mundos', []); const h = new Set(l[mi].hechas || []); if (!h.has(ej)) { h.add(ej); l[mi].hechas = [...h]; PERFIL.set('mundos', l); stars(2); } }
        view.innerHTML = `<div class="card" style="text-align:center"><div class="big">${gano ? '🎉' : '💪'}</div><h2>${ok} de ${e.preguntas.length} correctas</h2><p>${gano ? '¡Desbloqueaste el siguiente lugar!' : 'Repasa la lección y vuelve a intentarlo.'}</p>
          <div class="row" style="justify-content:center"><button id="sig">${gano ? 'Seguir la aventura ▶' : 'Repasar'}</button></div></div>`;
        $('#sig').onclick = () => gano ? verMundo(mi) : estacion(mi, ej);
        owlHabla(gano ? '¡Muy bien! <b>Great job!</b>' : '¡Casi! Vamos a repasar.');
        return;
      }
      const P = e.preguntas[q];
      view.innerHTML = `<div class="card"><h3>Pregunta ${q + 1} de ${e.preguntas.length}</h3><p style="font-size:18px">${txtSeguro(P.pregunta)}</p>
        <div class="opts">${P.opciones.map((o, k) => `<button data-op="${k}">${txtSeguro(o)}</button>`).join('')}</div><div id="expl"></div></div>`;
      view.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
        const bien = +b.dataset.op === P.correcta; if (bien) ok++;
        view.querySelectorAll('[data-op]').forEach(x => { x.disabled = true; if (+x.dataset.op === P.correcta) x.classList.add('ok'); });
        if (!bien) b.classList.add('bad');
        bien ? SFX.ok && SFX.ok() : SFX.bad && SFX.bad();
        $('#expl').innerHTML = `${owlBox((bien ? '✅ ' : '💡 ') + txtSeguro(P.explicacion)).replace('id="owl"', '')}<div class="row" style="margin-top:8px"><button id="nx">Siguiente ▶</button></div>`;
        $('#nx').onclick = () => { q++; pintarQ(); };
      });
    };
    pintarQ();
  };
}
