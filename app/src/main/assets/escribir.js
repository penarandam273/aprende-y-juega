// ===== v2.2: ✍️ Escribir mejor — corrector, ensayos, paráfrasis y diccionario =====
// Cada herramienta se adapta al perfil: niño/a (explicaciones sencillas y guía para escribir) o adulto.

SECCIONES.splice(2, 0, {id: 'escribir', t: 'Escribir mejor', e: '✍️', c: '#DDF5E8', d: 'Corrector, ensayos, paráfrasis y diccionario'});

const escVolver = () => `<button class="sec sm" onclick="go('escribir')">← Escribir</button>`;
const nivelTxt = () => PERFIL.esNino() ? `para un niño o niña de ${PERFIL.edad()} años (palabras sencillas)` : 'para un adulto';

R.escribir = function () {
  view.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#DDF5E8,#fff)">${owlBox('Aquí te ayudo a escribir mejor en español: corrijo la ortografía, te guío con ensayos, digo lo mismo con otras palabras y te explico lo que significa cada palabra.')}</div>
    <div class="grid">
      <button class="tile" onclick="escCorrector()"><span class="em" style="background:#E3F8EE">🔍</span>Corrector ortográfico<small>Tildes, letras y puntuación</small></button>
      <button class="tile" onclick="escEnsayo()"><span class="em" style="background:#FFF1CC">📝</span>Creador de ensayos<small>${PERFIL.esNino() ? 'Te guío para escribirlo tú' : 'Esquema y ensayo completo'}</small></button>
      <button class="tile" onclick="escParafraseo()"><span class="em" style="background:#E9E1FF">🔁</span>Parafraseo<small>Dilo con otras palabras</small></button>
      <button class="tile" onclick="escDiccionario()"><span class="em" style="background:#DCEFFF">📖</span>Diccionario<small>Con enlace a la Real Academia</small></button>
    </div>`;
};

// Copiar al portapapeles
async function copiarTxt(t) { try { await navigator.clipboard.writeText(t); toast('Copiado 📋'); } catch (e) { toast('Mantén presionado el texto para copiarlo'); } }

// ---------- 🔍 Corrector ortográfico ----------
function escCorrector() {
  limpiar(); titulo('Corrector ortográfico');
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🔍 Corrector ortográfico</h2>${escVolver()}</div>
    <p class="muted">Escribe o pega tu texto en español. Owl corrige la ortografía, las tildes y la puntuación, y te explica cada regla.</p>
    <textarea id="coTxt" rows="7" placeholder="Ej: ayer fuimos al parke y bimos un arbol muy grande"></textarea>
    <div class="row" style="margin-top:8px"><button id="coGo">🔍 Corregir</button><button class="sec" id="coFoto">📸 Desde una foto</button></div>
    <input type="file" id="coIn" accept="image/*" capture="environment" hidden><div id="coRes"></div></div>`;
  const corregir = async (texto, img) => {
    const r = await pensando($('#coGo'), () => IA.json(`${img ? 'Lee el texto en español de la foto y corrígelo.' : 'Corrige este texto en español:\n"""' + texto.slice(0, 6000) + '"""'}
Corrige ortografía, tildes, mayúsculas, puntuación y concordancia, sin cambiar el estilo ni las ideas. Explica las reglas ${nivelTxt()}.
Responde SOLO JSON: {"original": texto original, "corregido": texto corregido, "errores": [ {"antes": palabra o trozo con error, "despues": cómo queda, "regla": explicación corta de la regla} ], "consejo": un consejo para la próxima vez}`, img ? {imagenes: [img]} : {}));
    if (!r) return;
    const errores = Array.isArray(r.errores) ? r.errores : [];
    let marcado = txtSeguro(r.corregido || '');
    for (const e of errores) if (e.despues) marcado = marcado.split(txtSeguro(e.despues)).join(`<mark style="background:#E3F8EE;border-radius:4px;padding:0 2px">${txtSeguro(e.despues)}</mark>`);
    $('#coRes').innerHTML = `<h3 style="margin-top:12px">${errores.length ? `✅ Texto corregido · ${errores.length} cambio${errores.length === 1 ? '' : 's'}` : '🎉 ¡No encontré errores!'}</h3>
      <div class="owlm" style="white-space:pre-wrap">${marcado}</div>
      <div class="row" style="margin-top:6px"><button class="sec sm" id="coCop">📋 Copiar</button><button class="sec sm" id="coOir">🔊 Escuchar</button></div>
      ${errores.map(e => `<div class="lib" style="align-items:flex-start"><div><s style="color:var(--bad)">${txtSeguro(e.antes)}</s> → <b style="color:var(--ok)">${txtSeguro(e.despues)}</b><br><small class="muted">${txtSeguro(e.regla)}</small></div></div>`).join('')}
      ${r.consejo ? owlBox('💡 ' + txtSeguro(r.consejo)).replace('id="owl"', '') : ''}`;
    $('#coCop').onclick = () => copiarTxt(r.corregido || '');
    $('#coOir').onclick = () => speak(r.corregido || '');
    if (!$('#coTxt').value.trim() && r.original) $('#coTxt').value = r.original;
    stars(1);
  };
  $('#coGo').onclick = () => conIA(() => { const t = $('#coTxt').value.trim(); if (!t) return toast('Escribe un texto'); corregir(t); });
  $('#coFoto').onclick = () => conIA(() => $('#coIn').click());
  $('#coIn').onchange = async () => { const f = $('#coIn').files[0]; $('#coIn').value = ''; if (f) corregir('', await fotoA64(f)); };
}

// ---------- 📝 Creador de ensayos ----------
function escEnsayo() {
  limpiar(); titulo('Creador de ensayos');
  const nino = PERFIL.esNino();
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">📝 Creador de ensayos</h2>${escVolver()}</div>
    <p class="muted">${nino ? 'Owl te da las ideas, el orden y frases para empezar. ¡Tú lo escribes y luego Owl te lo revisa!' : 'Owl arma el esquema y redacta el ensayo con la extensión y el tipo que elijas.'}</p>
    <input id="enTema" placeholder="Tema (ej: el cuidado del agua, la tecnología en el colegio)">
    <div class="row" style="margin-top:8px"><select id="enTipo" style="flex:1"><option value="argumentativo">Argumentativo (doy mi opinión)</option><option value="expositivo">Expositivo (explico un tema)</option><option value="narrativo">Narrativo (cuento algo)</option><option value="descriptivo">Descriptivo (describo)</option></select>
      <select id="enLargo" style="flex:1"><option value="corto">Corto (3 párrafos)</option><option value="medio" selected>Medio (5 párrafos)</option><option value="largo">Largo (7 párrafos)</option></select></div>
    ${nino ? '' : '<div class="row" style="margin-top:8px"><select id="enModo" style="flex:1"><option value="completo">Ensayo completo</option><option value="guia">Solo esquema y guía</option></select></div>'}
    <div class="row" style="margin-top:8px"><button id="enGo">✨ ${nino ? 'Ayúdame a planearlo' : 'Crear'}</button></div><div id="enRes"></div></div>`;
  $('#enGo').onclick = () => conIA(async () => {
    const tema = $('#enTema').value.trim(); if (!tema) return toast('Escribe el tema');
    const tipo = $('#enTipo').value, largo = $('#enLargo').value, modo = nino ? 'guia' : $('#enModo').value;
    const r = await pensando($('#enGo'), () => IA.json(`Tema: "${tema}". Ensayo ${tipo}, ${largo} (${largo === 'corto' ? 3 : largo === 'medio' ? 5 : 7} párrafos), ${nivelTxt()}, en español.
${modo === 'guia' ? 'NO escribas el ensayo completo: da la guía para que la persona lo escriba. Incluye un ejemplo SOLO del primer párrafo.' : 'Escribe el ensayo completo, original, con título, introducción con tesis, desarrollo y conclusión.'}
Responde SOLO JSON: {"titulo": string, "tesis": idea principal en una frase, "esquema": [ {"parte": "Introducción"…, "que_poner": qué va en esa parte, "frase_inicio": una frase para empezar ese párrafo} ], ${modo === 'guia' ? '"ejemplo_intro": ejemplo del primer párrafo,' : '"ensayo": el ensayo completo con párrafos separados por \\n\\n,'} "consejos": [3 consejos cortos]}`, {max: 6000}));
    if (!r) return;
    const esq = Array.isArray(r.esquema) ? r.esquema : [];
    $('#enRes').innerHTML = `<h3 style="margin-top:12px">${txtSeguro(r.titulo)}</h3><p><b>Idea principal:</b> ${txtSeguro(r.tesis)}</p>
      <h3>🧭 Esquema</h3>${esq.map((p, i) => `<div class="card" style="margin:6px 0;background:#FAF9FF"><b>${i + 1}. ${txtSeguro(p.parte)}</b><div>${txtSeguro(p.que_poner)}</div><small class="muted">Empieza así: «${txtSeguro(p.frase_inicio)}»</small></div>`).join('')}
      ${r.ensayo ? `<h3>📄 Ensayo</h3><div class="owlm story">${String(r.ensayo).split(/\n{2,}/).map(x => `<p>${txtSeguro(x)}</p>`).join('')}</div><div class="row" style="margin-top:6px"><button class="sec sm" id="enCop">📋 Copiar ensayo</button></div>` : ''}
      ${r.ejemplo_intro ? `<h3>✨ Ejemplo de inicio</h3><div class="owlm">${txtSeguro(r.ejemplo_intro)}</div>` : ''}
      ${(r.consejos || []).length ? `<h3>💡 Consejos</h3><ul>${r.consejos.map(c => `<li>${txtSeguro(c)}</li>`).join('')}</ul>` : ''}
      ${modo === 'guia' ? `<h3>✍️ Ahora escríbelo tú</h3><textarea id="enMio" rows="8" placeholder="Escribe tu ensayo aquí siguiendo el esquema…">${esc(PERFIL.get('ensayo_borrador', ''))}</textarea>
        <div class="row" style="margin-top:6px"><button id="enRev">🦉 Revisar mi ensayo</button></div><div id="enRevRes"></div>` : ''}`;
    if ($('#enCop')) $('#enCop').onclick = () => copiarTxt(`${r.titulo}\n\n${r.ensayo}`);
    if ($('#enMio')) {
      $('#enMio').oninput = () => PERFIL.set('ensayo_borrador', $('#enMio').value);
      $('#enRev').onclick = async () => {
        const mio = $('#enMio').value.trim(); if (mio.length < 40) return toast('Escribe un poco más primero');
        const rv = await pensando($('#enRev'), () => IA.json(`Revisa este ensayo ${tipo} sobre "${tema}" escrito ${nivelTxt()}:\n"""${mio.slice(0, 6000)}"""\nNo lo reescribas entero. Responde SOLO JSON: {"estrellas": 1 a 5, "bien": [2 cosas que hizo bien], "mejorar": [2 o 3 cosas para mejorar, concretas], "ortografia": [ {"antes": string, "despues": string} ] (máximo 8)}`));
        if (!rv) return;
        $('#enRevRes').innerHTML = `<div class="card" style="margin-top:8px;background:#FAF9FF"><div class="big">${'⭐'.repeat(Math.max(1, Math.min(5, Number(rv.estrellas) || 3)))}</div>
          <b>👍 Lo que hiciste bien</b><ul>${(rv.bien || []).map(x => `<li>${txtSeguro(x)}</li>`).join('')}</ul>
          <b>🚀 Para mejorar</b><ul>${(rv.mejorar || []).map(x => `<li>${txtSeguro(x)}</li>`).join('')}</ul>
          ${(rv.ortografia || []).length ? `<b>🔍 Ortografía</b>${rv.ortografia.map(e => `<div><s style="color:var(--bad)">${txtSeguro(e.antes)}</s> → <b style="color:var(--ok)">${txtSeguro(e.despues)}</b></div>`).join('')}` : ''}</div>`;
        stars(Math.max(1, Math.min(3, Math.round((Number(rv.estrellas) || 3) / 2))));
      };
    }
  });
}

// ---------- 🔁 Parafraseo ----------
function escParafraseo() {
  limpiar(); titulo('Parafraseo');
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🔁 Parafraseo</h2>${escVolver()}</div>
    <p class="muted">Escribe una frase o un párrafo y Owl lo dice con otras palabras, sin cambiar la idea.</p>
    <textarea id="paTxt" rows="6" placeholder="Pega aquí el texto"></textarea>
    <div class="row" style="margin-top:8px"><button id="paGo">🔁 Parafrasear</button></div><div id="paRes"></div></div>`;
  $('#paGo').onclick = () => conIA(async () => {
    const t = $('#paTxt').value.trim(); if (!t) return toast('Escribe un texto');
    const r = await pensando($('#paGo'), () => IA.json(`Parafrasea en español este texto sin cambiar su significado, ${nivelTxt()}:\n"""${t.slice(0, 5000)}"""\nResponde SOLO JSON: {"versiones": [ {"estilo": "Más sencillo", "texto": string}, {"estilo": "Más formal", "texto": string}, {"estilo": "Más creativo", "texto": string} ], "sinonimos": [ {"palabra": palabra del original, "opciones": [2 o 3 sinónimos]} ] (máximo 6)}`));
    if (!r) return;
    $('#paRes').innerHTML = (r.versiones || []).map((v, i) => `<div class="card" style="margin:8px 0;background:#FAF9FF"><span class="pill">${txtSeguro(v.estilo)}</span><p style="white-space:pre-wrap">${txtSeguro(v.texto)}</p><button class="sec sm" data-pc="${i}">📋 Copiar</button></div>`).join('')
      + ((r.sinonimos || []).length ? `<h3>🔤 Sinónimos útiles</h3>${r.sinonimos.map(s => `<div class="lib"><b>${txtSeguro(s.palabra)}</b><span class="muted">${(s.opciones || []).map(txtSeguro).join(', ')}</span></div>`).join('')}` : '');
    $('#paRes').querySelectorAll('[data-pc]').forEach(b => b.onclick = () => copiarTxt(r.versiones[+b.dataset.pc].texto));
    stars(1);
  });
}

// ---------- 📖 Diccionario (explicación de Owl + enlace oficial a la RAE) ----------
function escDiccionario() {
  limpiar(); titulo('Diccionario');
  const recientes = PERFIL.get('dic_recientes', []);
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">📖 Diccionario</h2>${escVolver()}</div>
    <p class="muted">Busca una palabra en español. Owl te la explica fácil y puedes abrir la definición oficial en el Diccionario de la Real Academia Española.</p>
    <div class="row" style="flex-wrap:nowrap"><input id="diPal" placeholder="Escribe una palabra" style="flex:1;min-width:0" autocapitalize="none"><button id="diGo">Buscar</button></div>
    ${recientes.length ? `<div class="row" style="margin-top:8px">${recientes.map(w => `<button class="sec sm" data-dw="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : ''}
    <div id="diRes"></div></div>`;
  const buscar = (w) => {
    w = (w || $('#diPal').value).trim().toLowerCase().replace(/[^a-záéíóúüñ\s-]/gi, '').slice(0, 40); if (!w) return toast('Escribe una palabra');
    $('#diPal').value = w;
    const rae = 'https://dle.rae.es/' + encodeURIComponent(w);
    $('#diRes').innerHTML = `<div class="row" style="margin-top:12px"><a class="link" href="${rae}" target="_blank" rel="noopener"><button class="sm">📖 Ver «${esc(w)}» en la RAE (oficial)</button></a></div>`;
    const l = [w, ...PERFIL.get('dic_recientes', []).filter(x => x !== w)].slice(0, 8); PERFIL.set('dic_recientes', l);
    if (!IA.lista()) { $('#diRes').insertAdjacentHTML('beforeend', '<p class="muted">Con la inteligencia de Owl activada (⚙️ Ajustes) también te la explico aquí.</p>'); return; }
    pensando($('#diGo'), () => IA.json(`Explica la palabra en español "${w}" ${nivelTxt()}. Es una explicación propia, no copies el texto del diccionario de la RAE.
Responde SOLO JSON: {"palabra": la palabra bien escrita (con tilde si lleva), "existe": true o false, "tipo": sustantivo/verbo/adjetivo…, "silabas": separada en sílabas con guiones, "significados": [1 a 3 significados explicados con tus palabras], "ejemplos": [2 oraciones de ejemplo], "sinonimos": [hasta 4], "antonimos": [hasta 3], "en_ingles": traducción al inglés, "nota": dato curioso u ortográfico corto (opcional)}`)).then(r => {
      if (!r) return;
      // Si Owl corrige cómo se escribe (por ejemplo «arbol» → «árbol»), el enlace a la RAE usa la palabra correcta
      const bien = String(r.palabra || '').trim().toLowerCase();
      if (bien && bien !== w && /^[a-záéíóúüñ\s-]{1,40}$/i.test(bien)) { const a = $('#diRes a'); if (a) { a.href = 'https://dle.rae.es/' + encodeURIComponent(bien); a.querySelector('button').textContent = `📖 Ver «${bien}» en la RAE (oficial)`; } }
      $('#diRes').insertAdjacentHTML('afterbegin', `<div class="card" style="margin-top:12px;background:#FAF9FF">
        <div class="row" style="justify-content:space-between"><h2 style="margin:0">${txtSeguro(r.palabra || w)}</h2><button class="sec sm" id="diOir">🔊</button></div>
        <small class="muted">${txtSeguro(r.tipo || '')}${r.silabas ? ' · ' + txtSeguro(r.silabas) : ''}${r.en_ingles ? ' · 🇬🇧 <b>' + txtSeguro(r.en_ingles) + '</b>' : ''}</small>
        ${r.existe === false ? '<p>⚠️ Owl no reconoce esa palabra. Revisa cómo se escribe o búscala en la RAE.</p>' : ''}
        <ol>${(r.significados || []).map(x => `<li>${txtSeguro(x)}</li>`).join('')}</ol>
        ${(r.ejemplos || []).length ? `<b>Ejemplos</b><ul>${r.ejemplos.map(x => `<li><i>${txtSeguro(x)}</i></li>`).join('')}</ul>` : ''}
        ${(r.sinonimos || []).length ? `<div><b>Sinónimos:</b> ${r.sinonimos.map(txtSeguro).join(', ')}</div>` : ''}
        ${(r.antonimos || []).length ? `<div><b>Antónimos:</b> ${r.antonimos.map(txtSeguro).join(', ')}</div>` : ''}
        ${r.nota ? `<p class="muted">💡 ${txtSeguro(r.nota)}</p>` : ''}
        <p class="muted" style="font-size:12px">Explicación de Teacher Owl, no es la definición oficial. Para la oficial toca «Ver en la RAE».</p></div>`);
      $('#diOir').onclick = () => speak(`${r.palabra || w}. ${(r.significados || [])[0] || ''}`);
      stars(1);
    });
  };
  $('#diGo').onclick = () => buscar();
  $('#diPal').onkeydown = e => { if (e.key === 'Enter') buscar(); };
  view.querySelectorAll('[data-dw]').forEach(b => b.onclick = () => buscar(b.dataset.dw));
}
