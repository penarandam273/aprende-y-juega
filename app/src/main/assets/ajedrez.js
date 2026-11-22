// ===== v2.3: ♟️ Ajedrez =====
// Contra la computadora (3 niveles) o entre dos personas. Reglas completas: enroque, captura al paso,
// coronación, jaque, jaque mate, ahogado y tablas. Con pistas, deshacer y lecciones de Teacher Owl.

// MOTOR-INICIO (sin pantalla: se puede probar aparte)
const AJZ = (() => {
  // Tablero: 64 casillas; 0 = a8 (arriba a la izquierda), 63 = h1. Mayúsculas = blancas, minúsculas = negras.
  const INICIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const fila = s => s >> 3, col = s => s & 7;
  const blanca = p => p && p === p.toUpperCase();
  const colorDe = p => !p ? null : (blanca(p) ? 'w' : 'b');
  const NOMBRE = sq => 'abcdefgh'[col(sq)] + (8 - fila(sq));
  const CASILLA = n => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);

  function deFEN(fen) {
    const [pos, turno, enroque, ap, medio, total] = fen.trim().split(/\s+/);
    const b = []; for (const ch of pos.replace(/\//g, '')) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(''); else b.push(ch); }
    return {b, turno: turno || 'w', enroque: enroque && enroque !== '-' ? enroque : '', ap: ap && ap !== '-' ? CASILLA(ap) : -1, medio: +medio || 0, total: +total || 1};
  }
  function aFEN(e) {
    let s = '';
    for (let r = 0; r < 8; r++) { let v = 0; for (let c = 0; c < 8; c++) { const p = e.b[r * 8 + c]; if (!p) v++; else { if (v) s += v; v = 0; s += p; } } if (v) s += v; if (r < 7) s += '/'; }
    return `${s} ${e.turno} ${e.enroque || '-'} ${e.ap >= 0 ? NOMBRE(e.ap) : '-'} ${e.medio} ${e.total}`;
  }

  const N_SALTOS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const REY = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], RECTO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  // ¿La casilla sq está atacada por el color "por"?
  function atacada(b, sq, por) {
    const r = fila(sq), c = col(sq), w = por === 'w';
    const pe = w ? 'P' : 'p', ca = w ? 'N' : 'n', al = w ? 'B' : 'b', to = w ? 'R' : 'r', da = w ? 'Q' : 'q', re = w ? 'K' : 'k';
    const dr = w ? 1 : -1; // un peón blanco ataca hacia arriba: está una fila más abajo
    for (const dc of [-1, 1]) if (dentro(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === pe) return true;
    for (const [a, d] of N_SALTOS) if (dentro(r + a, c + d) && b[(r + a) * 8 + c + d] === ca) return true;
    for (const [a, d] of REY) if (dentro(r + a, c + d) && b[(r + a) * 8 + c + d] === re) return true;
    for (const [a, d] of DIAG) for (let k = 1; dentro(r + a * k, c + d * k); k++) { const p = b[(r + a * k) * 8 + c + d * k]; if (p) { if (p === al || p === da) return true; break; } }
    for (const [a, d] of RECTO) for (let k = 1; dentro(r + a * k, c + d * k); k++) { const p = b[(r + a * k) * 8 + c + d * k]; if (p) { if (p === to || p === da) return true; break; } }
    return false;
  }
  const reyDe = (b, color) => b.indexOf(color === 'w' ? 'K' : 'k');
  const enJaque = (e, color = e.turno) => atacada(e.b, reyDe(e.b, color), color === 'w' ? 'b' : 'w');

  function seudo(e) {
    const b = e.b, t = e.turno, out = [], w = t === 'w';
    const mio = p => p && colorDe(p) === t, suyo = p => p && colorDe(p) !== t;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!mio(p)) continue;
      const r = fila(sq), c = col(sq), tipo = p.toUpperCase();
      const add = (to, extra = {}) => out.push({de: sq, a: to, pieza: p, captura: b[to] || '', ...extra});
      if (tipo === 'P') {
        const dir = w ? -1 : 1, ini = w ? 6 : 1, ult = w ? 0 : 7;
        const avanzar = (to, extra) => { if (fila(to) === ult) for (const q of 'QRBN') add(to, {...extra, corona: w ? q : q.toLowerCase()}); else add(to, extra); };
        const f1 = (r + dir) * 8 + c;
        if (dentro(r + dir, c) && !b[f1]) {
          avanzar(f1);
          const f2 = (r + 2 * dir) * 8 + c;
          if (r === ini && !b[f2]) add(f2, {doble: true});
        }
        for (const dc of [-1, 1]) {
          if (!dentro(r + dir, c + dc)) continue;
          const to = (r + dir) * 8 + c + dc;
          if (suyo(b[to])) avanzar(to);
          else if (to === e.ap) add(to, {alPaso: true, captura: w ? 'p' : 'P'});
        }
      } else if (tipo === 'N' || tipo === 'K') {
        for (const [a, d] of (tipo === 'N' ? N_SALTOS : REY)) { if (!dentro(r + a, c + d)) continue; const to = (r + a) * 8 + c + d; if (!mio(b[to])) add(to); }
        if (tipo === 'K') {
          const otro = w ? 'b' : 'w', base = w ? 60 : 4;
          if (sq === base && !atacada(b, sq, otro)) {
            if (e.enroque.includes(w ? 'K' : 'k') && !b[base + 1] && !b[base + 2] && b[base + 3] === (w ? 'R' : 'r') && !atacada(b, base + 1, otro) && !atacada(b, base + 2, otro)) add(base + 2, {enroque: 'corto'});
            if (e.enroque.includes(w ? 'Q' : 'q') && !b[base - 1] && !b[base - 2] && !b[base - 3] && b[base - 4] === (w ? 'R' : 'r') && !atacada(b, base - 1, otro) && !atacada(b, base - 2, otro)) add(base - 2, {enroque: 'largo'});
          }
        }
      } else {
        const dirs = tipo === 'B' ? DIAG : tipo === 'R' ? RECTO : DIAG.concat(RECTO);
        for (const [a, d] of dirs) for (let k = 1; dentro(r + a * k, c + d * k); k++) {
          const to = (r + a * k) * 8 + c + d * k;
          if (!b[to]) add(to); else { if (suyo(b[to])) add(to); break; }
        }
      }
    }
    return out;
  }
  function mover(e, m) {
    const b = e.b.slice(), w = e.turno === 'w';
    b[m.a] = m.corona || m.pieza; b[m.de] = '';
    if (m.alPaso) b[m.a + (w ? 8 : -8)] = '';
    if (m.enroque === 'corto') { b[m.a - 1] = b[m.a + 1]; b[m.a + 1] = ''; }
    if (m.enroque === 'largo') { b[m.a + 1] = b[m.a - 2]; b[m.a - 2] = ''; }
    let en = e.enroque;
    const quitar = s => { en = en.replace(s, ''); };
    if (m.pieza === 'K') { quitar('K'); quitar('Q'); } if (m.pieza === 'k') { quitar('k'); quitar('q'); }
    for (const s of [m.de, m.a]) { if (s === 63) quitar('K'); if (s === 56) quitar('Q'); if (s === 7) quitar('k'); if (s === 0) quitar('q'); }
    return {b, turno: w ? 'b' : 'w', enroque: en, ap: m.doble ? (m.de + m.a) / 2 : -1,
      medio: (m.pieza.toUpperCase() === 'P' || m.captura) ? 0 : e.medio + 1, total: e.total + (w ? 0 : 1)};
  }
  function legales(e) { return seudo(e).filter(m => !enJaque(mover(e, m), e.turno)); }
  function perft(e, d) { if (!d) return 1; let n = 0; for (const m of legales(e)) n += perft(mover(e, m), d - 1); return n; }

  // Material insuficiente: rey contra rey, o rey con un alfil/caballo
  function sinMaterial(b) {
    const resto = b.filter(p => p && p.toUpperCase() !== 'K');
    return !resto.length || (resto.length === 1 && /[NBnb]/.test(resto[0]));
  }
  // Estado de la partida: null si sigue
  function fin(e, historialFEN = []) {
    const ms = legales(e);
    if (!ms.length) return enJaque(e) ? {tipo: 'mate', gana: e.turno === 'w' ? 'b' : 'w'} : {tipo: 'ahogado'};
    if (e.medio >= 100) return {tipo: 'cincuenta'};
    if (sinMaterial(e.b)) return {tipo: 'material'};
    const clave = aFEN(e).split(' ').slice(0, 4).join(' ');
    if (historialFEN.filter(f => f.split(' ').slice(0, 4).join(' ') === clave).length >= 3) return {tipo: 'repeticion'};
    return null;
  }

  // ---------- Computadora ----------
  const VAL = {P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0};
  // Tablas de posición (vista de las blancas; 0 = a8)
  const PST = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  function evaluar(e) { // puntos para quien mueve
    let s = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = e.b[sq]; if (!p) continue;
      const t = p.toUpperCase(), w = p === t;
      const v = VAL[t] + PST[t][w ? sq : (7 - fila(sq)) * 8 + col(sq)];
      s += w ? v : -v;
    }
    return e.turno === 'w' ? s : -s;
  }
  const orden = m => (m.captura ? 10 * VAL[m.captura.toUpperCase()] - VAL[m.pieza.toUpperCase()] / 10 : 0) + (m.corona ? 800 : 0);
  function negamax(e, prof, alfa, beta, ply) {
    const ms = legales(e);
    if (!ms.length) return enJaque(e) ? -100000 + ply : 0;
    if (prof === 0) return evaluar(e);
    ms.sort((x, y) => orden(y) - orden(x));
    let mejor = -Infinity;
    for (const m of ms) {
      const v = -negamax(mover(e, m), prof - 1, -beta, -alfa, ply + 1);
      if (v > mejor) mejor = v;
      if (v > alfa) alfa = v;
      if (alfa >= beta) break;
    }
    return mejor;
  }
  // nivel: 1 fácil, 2 medio, 3 difícil
  function mejorJugada(e, nivel = 2) {
    const ms = legales(e); if (!ms.length) return null;
    if (nivel === 1 && Math.random() < .45) return ms[Math.floor(Math.random() * ms.length)];
    const prof = nivel >= 3 ? 3 : nivel === 2 ? 2 : 1;
    ms.sort((x, y) => orden(y) - orden(x));
    let lista = [];
    for (const m of ms) lista.push({m, v: -negamax(mover(e, m), prof - 1, -Infinity, Infinity, 1)});
    lista.sort((x, y) => y.v - x.v);
    const tope = lista[0].v, margen = nivel === 1 ? 120 : nivel === 2 ? 25 : 0;
    const buenas = lista.filter(x => x.v >= tope - margen);
    return buenas[Math.floor(Math.random() * buenas.length)].m;
  }
  // Notación sencilla para mostrar (ej: Cf3, exd5, O-O, e8=D+)
  const LETRA = {N: 'C', B: 'A', R: 'T', Q: 'D', K: 'R'};
  function notacion(e, m) {
    if (m.enroque) return m.enroque === 'corto' ? 'O-O' : 'O-O-O';
    const t = m.pieza.toUpperCase();
    let s = t === 'P' ? (m.captura ? 'abcdefgh'[col(m.de)] + 'x' : '') : LETRA[t] + (m.captura ? 'x' : '');
    s += NOMBRE(m.a); if (m.corona) s += '=' + LETRA[m.corona.toUpperCase()];
    const sig = mover(e, m); if (enJaque(sig)) s += legales(sig).length ? '+' : '#';
    return s;
  }
  return {INICIO, deFEN, aFEN, legales, mover, enJaque, perft, fin, mejorJugada, notacion, NOMBRE, colorDe, fila, col};
})();
// MOTOR-FIN

if (typeof SECCIONES !== 'undefined') {
  const i = SECCIONES.findIndex(s => s.id === 'retos');
  SECCIONES.splice(i + 1, 0, {id: 'ajedrez', t: 'Ajedrez', e: '♟️', c: '#E9E1FF', d: 'Contra la máquina o con alguien'});
}

const PIEZA_GLIFO = {K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'};
const PIEZA_NOMBRE = {K: 'el rey', Q: 'la dama', R: 'la torre', B: 'el alfil', N: 'el caballo', P: 'el peón'};

R.ajedrez = function () {
  const guardada = store.get('ajedrez', null);
  view.innerHTML = `<div class="card" style="background:linear-gradient(135deg,#E9E1FF,#fff)">
      ${owlBox('¡Juguemos ajedrez! ♟️ Puedes jugar contra mí o con alguien en el mismo teléfono. Si no sabes cómo se mueven las piezas, mira las lecciones.')}
    </div>
    ${guardada && !guardada.terminada ? `<div class="card"><button style="width:100%" id="ajSeguir">▶ Seguir la partida guardada</button></div>` : ''}
    <div class="card"><h3>Nueva partida</h3>
      <div style="display:grid;gap:8px">
        <select id="ajModo"><option value="maquina">🤖 Contra la computadora</option><option value="dos">👫 Dos jugadores en este teléfono</option></select>
        <select id="ajNivel"><option value="1">🐣 Fácil</option><option value="2" selected>🦉 Medio</option><option value="3">🦅 Difícil</option></select>
        <select id="ajColor"><option value="w">Juego con blancas ♔ (empiezo yo)</option><option value="b">Juego con negras ♚</option><option value="azar">Que decida la suerte 🎲</option></select>
        <button id="ajNueva">♟️ ¡A jugar!</button>
      </div></div>
    <div class="card"><button class="sec" style="width:100%" id="ajLecc">📚 Cómo se mueven las piezas</button></div>`;
  $('#ajModo').onchange = () => { const m = $('#ajModo').value === 'maquina'; $('#ajNivel').style.display = $('#ajColor').style.display = m ? '' : 'none'; };
  $('#ajNueva').onclick = () => {
    const modo = $('#ajModo').value, nivel = +$('#ajNivel').value;
    let yo = $('#ajColor').value; if (yo === 'azar') yo = Math.random() < .5 ? 'w' : 'b';
    partida({modo, nivel, yo: modo === 'dos' ? 'w' : yo, fens: [AJZ.INICIO], jugadas: []});
  };
  if ($('#ajSeguir')) $('#ajSeguir').onclick = () => partida(guardada);
  $('#ajLecc').onclick = leccionesAjedrez;
};

function partida(P) {
  limpiar(); $('#title').textContent = 'Ajedrez';
  let e = AJZ.deFEN(P.fens[P.fens.length - 1]);
  let sel = -1, destinos = [], pista = null, girado = P.modo === 'maquina' ? P.yo === 'b' : false, pensandoIA = false;
  const guardar = (terminada) => store.set('ajedrez', {...P, terminada: !!terminada});

  view.innerHTML = `<div class="card ajcard">
      <div class="row" style="justify-content:space-between"><span class="pill" id="ajEstado"></span><span class="muted" id="ajNivelTxt">${P.modo === 'maquina' ? ['', '🐣 Fácil', '🦉 Medio', '🦅 Difícil'][P.nivel] : '👫 Dos jugadores'}</span></div>
      <div class="ajcap" id="capArriba"></div>
      <div class="ajtab" id="tab"></div>
      <div class="ajcap" id="capAbajo"></div>
      <div class="row" style="margin-top:8px"><button class="sec sm" id="ajDes">↩️ Deshacer</button><button class="sec sm" id="ajPista">💡 Pista</button><button class="sec sm" id="ajGirar">🔄 Girar</button><button class="sec sm" id="ajMenu">☰ Menú</button></div>
      <div id="ajMsg"></div>
      <details style="margin-top:8px"><summary class="muted">Jugadas</summary><div id="ajJug" class="muted" style="font-family:monospace;line-height:1.6"></div></details>
    </div>`;

  function pintar() {
    const tab = $('#tab'), ult = P.jugadas.length ? P.jugadas[P.jugadas.length - 1] : null;
    const jaque = AJZ.enJaque(e) ? e.b.indexOf(e.turno === 'w' ? 'K' : 'k') : -1;
    let h = '';
    for (let i = 0; i < 64; i++) {
      const sq = girado ? 63 - i : i, f = AJZ.fila(sq), c = AJZ.col(sq), p = e.b[sq];
      const cls = ['ajc', (f + c) % 2 ? 'osc' : 'cla'];
      if (sq === sel) cls.push('sel');
      if (ult && (sq === ult.de || sq === ult.a)) cls.push('ult');
      if (sq === jaque) cls.push('jaq');
      if (pista && (sq === pista.de || sq === pista.a)) cls.push('pis');
      const dest = destinos.find(m => m.a === sq);
      const etiqueta = (girado ? f === 0 : f === 7) ? `<i class="ajl">${'abcdefgh'[c]}</i>` : '';
      const num = (girado ? c === 7 : c === 0) ? `<i class="ajn">${8 - f}</i>` : '';
      h += `<button class="${cls.join(' ')}" data-sq="${sq}">${p ? `<span class="ajp ${AJZ.colorDe(p)}">${PIEZA_GLIFO[p]}</span>` : ''}${dest ? `<span class="${p || dest.alPaso ? 'ajx' : 'ajd'}"></span>` : ''}${etiqueta}${num}</button>`;
    }
    tab.innerHTML = h;
    tab.querySelectorAll('[data-sq]').forEach(b => b.onclick = () => tocar(+b.dataset.sq));
    // Piezas capturadas
    const cuenta = {}; for (const p of e.b) if (p) cuenta[p] = (cuenta[p] || 0) + 1;
    const ini = {P: 8, N: 2, B: 2, R: 2, Q: 1};
    const comidas = color => Object.entries(ini).map(([t, n]) => { const p = color === 'w' ? t : t.toLowerCase(); return PIEZA_GLIFO[p].repeat(Math.max(0, n - (cuenta[p] || 0))); }).join('');
    const abajo = girado ? 'b' : 'w';
    $('#capAbajo').textContent = comidas(abajo === 'w' ? 'b' : 'w'); $('#capArriba').textContent = comidas(abajo);
    $('#ajJug').innerHTML = P.jugadas.map((j, i) => (i % 2 === 0 ? `<b>${i / 2 + 1}.</b> ` : '') + esc(j.n)).join(' ');
    estado();
  }
  function estado() {
    const f = AJZ.fin(e, P.fens), quien = e.turno === 'w' ? 'blancas ♔' : 'negras ♚';
    let txt;
    if (f) {
      const msj = {mate: `¡Jaque mate! Ganan las ${f.gana === 'w' ? 'blancas' : 'negras'} 🏆`, ahogado: '¡Ahogado! Es empate 🤝', cincuenta: 'Empate por 50 jugadas sin capturas 🤝', material: 'Empate: no queda material para dar mate 🤝', repeticion: 'Empate por repetir 3 veces la posición 🤝'}[f.tipo];
      txt = msj;
      if (!P.terminada) {
        P.terminada = true; guardar(true);
        if (P.modo === 'maquina') {
          if (f.tipo === 'mate' && f.gana === P.yo) { stars(3 + P.nivel * 2); SFX.win && SFX.win(); owlHabla(`¡Felicitaciones! Me ganaste. <b>Checkmate!</b>`); }
          else if (f.tipo === 'mate') owlHabla('Esta vez gané yo. ¡Juguemos otra! Mira las pistas para aprender.');
          else { stars(2); owlHabla('¡Empate! Muy bien jugado.'); }
        } else { SFX.win && SFX.win(); owlHabla(msj.replace(/[🏆🤝]/g, '')); }
        $('#ajMsg').innerHTML = `<div class="row" style="margin-top:8px"><button id="ajOtra">🔁 Jugar otra</button></div>`;
        $('#ajOtra').onclick = () => go('ajedrez');
      }
    } else if (P.modo === 'maquina') txt = e.turno === P.yo ? (AJZ.enJaque(e) ? '⚠️ ¡Estás en jaque! Protege a tu rey' : 'Te toca 🙂') : '🤖 Pensando…';
    else txt = (AJZ.enJaque(e) ? '⚠️ ¡Jaque! ' : '') + 'Turno de las ' + quien;
    $('#ajEstado').textContent = txt;
  }
  function tocar(sq) {
    if (P.terminada || pensandoIA) return;
    if (P.modo === 'maquina' && e.turno !== P.yo) return;
    const p = e.b[sq];
    const jugada = destinos.filter(m => m.a === sq);
    if (sel >= 0 && jugada.length) {
      if (jugada.length > 1) return elegirCorona(jugada);
      return hacer(jugada[0]);
    }
    if (p && AJZ.colorDe(p) === e.turno) {
      sel = sq; destinos = AJZ.legales(e).filter(m => m.de === sq); pista = null; SFX.click && SFX.click();
      if (!destinos.length) toast(`${PIEZA_NOMBRE[p.toUpperCase()][0].toUpperCase() + PIEZA_NOMBRE[p.toUpperCase()].slice(1)} no se puede mover ahora`);
    } else { sel = -1; destinos = []; }
    pintar();
  }
  function elegirCorona(opciones) {
    modal(`<h2>👑 ¡Tu peón llegó al final!</h2><p>¿En qué pieza lo conviertes?</p>
      <div class="grid">${opciones.map((m, i) => `<button class="tile" data-co="${i}"><span class="em" style="background:#EEE9FF;font-size:44px">${PIEZA_GLIFO[m.corona]}</span>${PIEZA_NOMBRE[m.corona.toUpperCase()]}</button>`).join('')}</div>`, mo => {
      mo.querySelectorAll('[data-co]').forEach(b => b.onclick = () => { cerrarModal(); hacer(opciones[+b.dataset.co]); });
    });
  }
  function hacer(m) {
    const n = AJZ.notacion(e, m);
    e = AJZ.mover(e, m);
    P.fens.push(AJZ.aFEN(e)); P.jugadas.push({de: m.de, a: m.a, n});
    sel = -1; destinos = []; pista = null; $('#ajMsg').innerHTML = '';
    (m.captura ? (SFX.pop || SFX.click) : SFX.click)?.call(SFX);
    guardar(false); pintar();
    if (P.modo === 'maquina' && !P.terminada && e.turno !== P.yo) turnoMaquina();
  }
  function turnoMaquina() {
    pensandoIA = true; estado();
    setTimeout(() => {
      const m = AJZ.mejorJugada(e, P.nivel);
      pensandoIA = false;
      if (m) hacer(m); else pintar();
    }, 450);
  }
  $('#ajDes').onclick = () => {
    if (pensandoIA) return;
    const pasos = P.modo === 'maquina' ? (e.turno === P.yo ? 2 : 1) : 1;
    if (P.fens.length <= pasos) return toast('No hay jugadas para deshacer');
    for (let k = 0; k < pasos; k++) { P.fens.pop(); P.jugadas.pop(); }
    e = AJZ.deFEN(P.fens[P.fens.length - 1]); P.terminada = false; sel = -1; destinos = []; pista = null; $('#ajMsg').innerHTML = '';
    guardar(false); pintar();
  };
  $('#ajPista').onclick = () => {
    if (P.terminada || pensandoIA || (P.modo === 'maquina' && e.turno !== P.yo)) return;
    const m = AJZ.mejorJugada(e, 2); if (!m) return;
    pista = m; sel = -1; destinos = [];
    const nom = PIEZA_NOMBRE[m.pieza.toUpperCase()];
    const txt = `💡 Mueve ${nom} de <b>${AJZ.NOMBRE(m.de)}</b> a <b>${AJZ.NOMBRE(m.a)}</b>${m.captura ? ' y capturas ' + PIEZA_NOMBRE[m.captura.toUpperCase()] : ''}.`;
    $('#ajMsg').innerHTML = owlBox(txt).replace('id="owl"', ''); pintar();
  };
  $('#ajGirar').onclick = () => { girado = !girado; pintar(); };
  $('#ajMenu').onclick = () => go('ajedrez');
  pintar();
  if (P.modo === 'maquina' && !P.terminada && e.turno !== P.yo) turnoMaquina();
}

function leccionesAjedrez() {
  limpiar(); $('#title').textContent = 'Cómo se mueven';
  const L = [
    ['♙', 'El peón', 'Avanza una casilla hacia adelante. En su primera jugada puede avanzar dos. Captura en diagonal. Si llega al otro lado, se convierte en otra pieza: ¡casi siempre en dama!'],
    ['♖', 'La torre', 'Se mueve en línea recta: adelante, atrás o a los lados, todas las casillas que quiera, sin saltar piezas.'],
    ['♗', 'El alfil', 'Se mueve en diagonal todas las casillas que quiera. Cada alfil se queda siempre en casillas del mismo color.'],
    ['♘', 'El caballo', 'Salta en forma de L: dos casillas en una dirección y una hacia el lado. Es la única pieza que puede saltar sobre otras.'],
    ['♕', 'La dama', 'Es la pieza más poderosa: se mueve como la torre y como el alfil juntos, en cualquier dirección.'],
    ['♔', 'El rey', 'Se mueve una casilla en cualquier dirección. Nunca puede quedar atacado. Si está atacado es jaque; si no tiene cómo escapar, es jaque mate y se acaba la partida.'],
    ['🏰', 'El enroque', 'Una vez por partida, el rey se mueve dos casillas hacia una torre y la torre salta al otro lado del rey. Solo si ninguno de los dos se ha movido y no hay piezas en medio.'],
    ['🤝', 'El empate', 'Si un jugador no tiene jugadas pero su rey no está en jaque, es «ahogado» y la partida queda en empate.']
  ];
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">📚 Cómo se mueven las piezas</h2><button class="sec sm" onclick="go('ajedrez')">← Ajedrez</button></div></div>
    ${L.map((x, i) => `<div class="card"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span style="font-size:44px;line-height:1">${x[0]}</span><div style="flex:1"><h3>${x[1]}</h3><p style="margin:0">${x[2]}</p></div><button class="sec sm" data-le="${i}">🔊</button></div></div>`).join('')}
    <div class="card" style="text-align:center"><button onclick="go('ajedrez')">♟️ ¡Ya sé, a jugar!</button></div>`;
  view.querySelectorAll('[data-le]').forEach(b => b.onclick = () => { const x = L[+b.dataset.le]; speak(x[1] + '. ' + x[2]); });
}

// Las secciones nuevas se agregan después de dibujar el inicio: se vuelve a pintar
if ((history.state || 'home') === 'home') R.home();
