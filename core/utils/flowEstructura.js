/**
 * Detección ESTRUCTURAL (sin ejecutar nada) de lo que un test hace con las entidades de un flujo, a partir de
 * la arquitectura compartida —los contratos `ENTIDAD_FLUJO` de los Page Objects—, nunca de nombres ni labels.
 *
 *   clave del test ──(valor)──► `<receptor>.<localizador>(x)` ──► Page Object ──► ENTIDAD_FLUJO
 *
 * El contrato se declara UNA vez en el Page Object que implementa la operación (ver `flowContratos.js`):
 *
 *   static get ENTIDAD_FLUJO() { return { tipo: 'solicitud', referencia: 'codigo', creadores: ['crear'] }; }
 *   // metodos (por defecto ['abrirDetalle']): localizadores que reciben la `referencia`
 *   // creadores / editores / eliminadores: crean, abren la edición o eliminan un registro de esa entidad
 *
 * Cada eslabón debe ser demostrable en el código (todo literal; si no, no se deduce nada):
 *   1. el test obtiene un receptor: `const ctx = <modulo>.<fn>()` (fixture: su cuerpo asigna `ctx.<prop> = <PO…>`),
 *      `new PO(...)` / `PO.<fn>()`, o la variable asignada con lo que DEVUELVE un método de otro receptor
 *      (`detalle = await ctx.lista.abrirDetalle(x)`; la clase se resuelve por `return new X(...)`, no por nombre);
 *   2. el Page Object (importado con ruta relativa o `@triple/core`, un salto por eslabón) declara ENTIDAD_FLUJO;
 *   3. el test llama a un localizador/creador/editor/eliminador declarado, y/o el valor de
 *      `testContext.get(CASO, 'clave')` llega, directo o por alias simple, a su primer argumento (también a través
 *      de un helper del módulo de fixtures, un salto: `<modulo>.<helper>(ctx, CASO)`).
 *
 * La clave puede ser un string literal o una constante de módulo `const CLAVE = 'literal';`.
 * El flujo de datos se sigue solo por: asignaciones simples, `a || b` / `a ?? b`, paréntesis, `await`,
 * `parsearValoresMultiples(…)`/`String(…)` y `for (const x of …)`. Cualquier otra forma no propaga la clave
 * (queda SUGERIDO/NO DETERMINADO, nunca una dependencia). Un creador que sirve a varias entidades se filtra por
 * `argumento` + `valor` literales (p. ej. `agregarEducacionOExperiencia('Educación', …)`).
 */
const path = require('path');
const { bloqueBalanceado, partesDeNivel } = require('./flowScanner');
const C = require('./flowContratos');

const { leer, lineaDe, escapar, enCodigo, importaciones, contratosDeClase, accionesDeClase, retornoDeMetodo } = C;
const ENVOLTORIOS = ['parsearValoresMultiples', 'String'];

/** Divide por operadores de primer nivel (`||`, `??`), respetando paréntesis y strings. */
function dividirTop(expr) {
  const partes = [];
  let prof = 0;
  let comilla = '';
  let ini = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (comilla) {
      if (ch === '\\') i += 1;
      else if (ch === comilla) comilla = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') comilla = ch;
    else if ('([{'.includes(ch)) prof += 1;
    else if (')]}'.includes(ch)) prof -= 1;
    else if (prof === 0 && (expr.startsWith('||', i) || expr.startsWith('??', i))) {
      partes.push(expr.slice(ini, i));
      i += 1;
      ini = i + 1;
    }
  }
  partes.push(expr.slice(ini));
  return partes.map((p) => p.trim()).filter(Boolean);
}

/** Constantes de módulo `const NOMBRE = 'literal';` (una clave guardada en una constante sigue siendo demostrable). */
function constantes(f) {
  const out = new Map();
  const re = /(?:^|\n)\s*const\s+(\w+)\s*=\s*(['"])([^'"\n]*)\2\s*;/g;
  let m;
  while ((m = re.exec(f.sc))) out.set(m[1], m[3]);
  return out;
}

/** Claves de contexto cuyo valor puede llegar a `expr` (conjunto), según la gramática permitida. */
function clavesDe(expr, tainted, consts = new Map()) {
  const out = new Set();
  for (let t of dividirTop(expr)) {
    t = t.replace(/^await\s+/, '').trim();
    let m = /^testContext\s*\.\s*get\s*\(\s*[\w.]+\s*,\s*(['"])([^'"]+)\1\s*\)$/.exec(t);
    if (m) {
      out.add(m[2]);
      continue;
    }
    m = /^testContext\s*\.\s*get\s*\(\s*[\w.]+\s*,\s*(\w+)\s*\)$/.exec(t);
    if (m && consts.has(m[1])) {
      out.add(consts.get(m[1]));
      continue;
    }
    if (/^\w+$/.test(t)) {
      for (const k of tainted.get(t) || []) out.add(k);
      continue;
    }
    m = /^(\w+)\s*\(([\s\S]*)\)$/.exec(t);
    const interior = m && ENVOLTORIOS.includes(m[1]) && bloqueBalanceado(t, t.indexOf('(')) === m[2] ? m[2] : null;
    const paren = !interior && t.startsWith('(') && bloqueBalanceado(t, 0) === t.slice(1, -1) ? t.slice(1, -1) : null;
    for (const k of clavesDe(interior || paren || '', tainted, consts)) out.add(k);
  }
  return out;
}

/** Variables que (por alias simple) pueden contener el valor de una clave del contexto. */
function propagar(sc, em, consts) {
  const tainted = new Map();
  const unir = (v, claves) => {
    const set = tainted.get(v) || new Set();
    const antes = set.size;
    for (const k of claves) set.add(k);
    tainted.set(v, set);
    return set.size !== antes;
  };
  const reAsign = /(?:^|[;{}\s])(?:(?:const|let|var)\s+)?(\w+)\s*=(?![=>])\s*([^;]+);/g;
  const reForOf = /for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+([^)]+)\)/g;
  for (let pasada = 0; pasada < 5; pasada += 1) {
    let cambio = false;
    let m;
    reAsign.lastIndex = 0;
    while ((m = reAsign.exec(sc))) {
      const idx = m.index + m[0].indexOf('=');
      if (em[idx] !== sc[idx]) continue;
      const ks = clavesDe(m[2], tainted, consts);
      if (ks.size && unir(m[1], ks)) cambio = true;
    }
    reForOf.lastIndex = 0;
    while ((m = reForOf.exec(sc))) {
      if (em[m.index] !== sc[m.index]) continue;
      const ks = clavesDe(m[2], tainted, consts);
      if (ks.size && unir(m[1], ks)) cambio = true;
    }
    if (!cambio) break;
  }
  return tainted;
}

/** Texto de `function nombre(...) {...}` en un módulo: `{ params, sc, em }` o null. */
function funcionDe(archivo, nombre) {
  const f = leer(archivo);
  const m = new RegExp(`function\\s+${escapar(nombre)}\\s*\\(`).exec(f.sc);
  if (!m || !enCodigo(f, m.index)) return null;
  const abreParen = m.index + m[0].length - 1;
  const params = bloqueBalanceado(f.sc, abreParen);
  if (params === null) return null;
  const llave = f.sc.indexOf('{', abreParen + params.length + 1);
  const cuerpo = llave < 0 ? null : bloqueBalanceado(f.sc, llave);
  if (cuerpo === null) return null;
  const ini = llave + 1;
  const fin = ini + cuerpo.length;
  return {
    archivo,
    params: partesDeNivel(params).map((p) => (/^(\w+)/.exec(p) || [])[1] || null),
    sc: f.sc.slice(ini, fin),
    em: f.em.slice(ini, fin),
    src: f.src,
    base: ini,
  };
}

/** Información de un Page Object como receptor: sus contratos efectivos (con herencia). */
function infoDe(archivo, invalidas, concreto = archivo) {
  const r = contratosDeClase(archivo, concreto);
  for (const i of r.invalidas) if (!invalidas.some((x) => x.motivo === i.motivo)) invalidas.push(i);
  return { archivo, concreto, contratos: r.contratos, acciones: accionesDeClase(archivo) };
}

/** ¿El argumento (texto) es el literal `valor` o una constante que lo contiene? */
function esLiteral(texto, valor, consts) {
  const t = String(texto || '').trim();
  const m = /^(['"`])([^'"`]*)\1$/.exec(t);
  if (m) return m[2] === valor;
  return consts.has(t) && consts.get(t) === valor;
}

/**
 * Lo que un texto (cuerpo del test o de un helper) hace con los receptores conocidos:
 *  - consumos   `{ clave, entidad, campo, via }`: la clave del contexto llega al argumento de un localizador
 *               (`metodos`, y también editores/eliminadores, que localizan por referencia);
 *  - creaciones / ediciones / eliminaciones `{ entidad, via }`: llamadas a creadores / editores / eliminadores
 *               declarados (con filtro `argumento`+`valor` cuando el método sirve a varias entidades).
 * @param {Map<string, object[]>} receptores  receptor (texto, p. ej. 'ctx.lista') → [info de Page Object]
 */
function analizarUso(sc, em, receptores, linea, consts) {
  const tainted = propagar(sc, em, consts);
  const out = { consumos: [], creaciones: [], ediciones: [], eliminaciones: [], confirmaciones: [], confirmables: [], exclusiones: [] };
  for (const [receptor, infos] of receptores) {
    for (const info of infos) {
      for (const a of info.acciones || []) {
        const re = new RegExp(`(?<![\\w$.])${escapar(receptor).replace(/\\\./g, '\\s*\\.\\s*')}\\s*\\.\\s*${escapar(a.metodo)}\\s*\\(`);
        const m = re.exec(sc);
        if (m && em[m.index] === sc[m.index]) out.exclusiones.push({ clase: a.clase, via: `${path.basename(a.archivo, '.js')}.${a.metodo}`, linea });
      }
      for (const c of info.contratos) {
        if (!c.tipo) continue;
        const via = (metodo) => `${path.basename(c.archivo, '.js')}.${metodo}`;
        const llamadas = (metodo) => {
          const re = new RegExp(`(?<![\\w$.])${escapar(receptor).replace(/\\\./g, '\\s*\\.\\s*')}\\s*\\.\\s*${escapar(metodo)}\\s*\\(`, 'g');
          const res = [];
          let m;
          while ((m = re.exec(sc))) {
            if (em[m.index] !== sc[m.index]) continue;
            const args = bloqueBalanceado(sc, m.index + m[0].length - 1);
            if (args !== null) res.push(partesDeNivel(args));
          }
          return res;
        };
        const localizadores = [...c.metodos, ...c.editores.map((e) => e.metodo), ...c.eliminadores.map((e) => e.metodo)];
        for (const metodo of [...new Set(localizadores)]) {
          if (!c.referencia) continue;
          for (const args of llamadas(metodo)) {
            if (!args[0]) continue;
            for (const clave of clavesDe(args[0], tainted, consts)) out.consumos.push({ clave, entidad: c.tipo, campo: c.referencia, via: via(metodo), linea });
          }
        }
        for (const e of c.creadores) {
          for (const args of llamadas(e.metodo)) {
            if (e.argumento !== undefined && !esLiteral(args[e.argumento], e.valor, consts)) continue;
            out.creaciones.push({ entidad: c.tipo, via: via(e.metodo), linea, ...(e.persiste ? { persiste: true } : {}) });
          }
        }
        // guardado confirmado de la entidad (un formulario con confirmador): sin él, abrir la edición/creación no persiste nada
        if (c.confirmadores.length) out.confirmables.push(c.tipo);
        for (const e of c.confirmadores) for (const args of llamadas(e.metodo)) out.confirmaciones.push({ entidad: c.tipo, via: via(e.metodo), linea, args: args.length });
        for (const e of c.editores) for (const args of llamadas(e.metodo)) out.ediciones.push({ entidad: c.tipo, via: via(e.metodo), linea, args: args.length });
        for (const e of c.eliminadores) for (const args of llamadas(e.metodo)) out.eliminaciones.push({ entidad: c.tipo, via: via(e.metodo), linea, args: args.length });
      }
    }
  }
  return out;
}

/** Ramas de una expresión condicional / alternativa: `c ? a : b`, `a || b`, `a ?? b` → [a, b] (la condición se descarta). */
function ramasDe(expr) {
  const cortes = [];
  let prof = 0;
  let comilla = '';
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (comilla) {
      if (ch === '\\') i += 1;
      else if (ch === comilla) comilla = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') comilla = ch;
    else if ('([{'.includes(ch)) prof += 1;
    else if (')]}'.includes(ch)) prof -= 1;
    else if (prof === 0) {
      if (expr.startsWith('||', i) || expr.startsWith('??', i)) {
        cortes.push([i, 2]);
        i += 1;
      } else if (ch === '?' && expr[i + 1] !== '.') cortes.push([i, 1, 'q']);
      else if (ch === ':') cortes.push([i, 1]);
    }
  }
  const piezas = [];
  let ini = 0;
  let descartarPrimera = false;
  for (const [pos, largo, tipo] of cortes) {
    piezas.push(expr.slice(ini, pos));
    if (tipo === 'q' && piezas.length === 1) descartarPrimera = true; // lo anterior al `?` es la condición
    ini = pos + largo;
  }
  piezas.push(expr.slice(ini));
  return (descartarPrimera ? piezas.slice(1) : piezas).map((p) => p.trim()).filter(Boolean);
}

/**
 * Variables asignadas con lo que DEVUELVE un método de un receptor conocido (`detalle = await ctx.lista.abrirDetalle(x)`, también
 * en una alternativa `c ? await a.m() : await b.n()` o `a.m() || b.n()`): la clase devuelta se resuelve por
 * `return new X(...)` (un salto o vía `return this.otro()`), nunca por el nombre.
 */
function propagarRetornos(sc, em, receptores, agregar, invalidas) {
  const reAsign = /(?:^|[;{}\s])(?:(?:const|let|var)\s+)?(\w+)\s*=(?![=>])\s*([^;]+);/g;
  for (let pasada = 0; pasada < 4; pasada += 1) {
    let cambio = false;
    reAsign.lastIndex = 0;
    let m;
    while ((m = reAsign.exec(sc))) {
      const idx = m.index + m[0].indexOf('=');
      if (em[idx] !== sc[idx]) continue;
      const variable = m[1];
      for (const rama of ramasDe(m[2])) {
        const r = /^(?:await\s+)?([\w$]+(?:\s*\.\s*[\w$]+)*?)\s*\.\s*(\w+)\s*\(/.exec(rama);
        if (!r) continue;
        const abre = rama.indexOf('(', r[0].length - 1);
        if (bloqueBalanceado(rama, abre) === null || rama.slice(abre).trim().length !== rama.slice(abre).trim().length) continue;
        const clave = r[1].replace(/\s+/g, '');
        for (const info of receptores.get(clave) || []) {
          for (const archivoClase of retornoDeMetodo(info.archivo, r[2], info.concreto)) {
            const devuelta = infoDe(archivoClase, invalidas, archivoClase);
            if ((devuelta.contratos.length || devuelta.acciones.length) && agregar(variable, [devuelta])) cambio = true;
          }
        }
      }
    }
    if (!cambio) break;
  }
}

const unicos = (lista, clave) => {
  const vistos = new Set();
  return lista.filter((x) => {
    const k = clave(x);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
};

/**
 * Detecta, para un test, lo que demuestra la ESTRUCTURA (contratos `ENTIDAD_FLUJO` de los Page Objects):
 * requires por clave (`estructurales`), creaciones (produces), ediciones (transformaciones), eliminaciones y confirmaciones del
 * guardado (`confirmaciones`; `confirmables` = entidades cuyo guardado confirma una capa común: crear/editar solo cuenta si el test lo confirma).
 * @returns {{ estructurales: object[], creaciones: object[], ediciones: object[], eliminaciones: object[], invalidas: Array<{linea:number, motivo:string}> }}
 */
function detectarEstructurales(archivoTest) {
  const f = leer(archivoTest);
  const imports = importaciones(f, archivoTest);
  const invalidas = [];
  const receptores = new Map(); // receptor (texto) → [info]
  const ctxVars = new Map(); // variable → Map(prop → [info])
  const helpers = [];
  const agregar = (clave, infos) => {
    const previo = receptores.get(clave) || [];
    const nuevos = infos.filter((i) => !previo.some((p) => p.archivo === i.archivo));
    if (!nuevos.length) return false;
    receptores.set(clave, [...previo, ...nuevos]);
    return true;
  };

  // 1) Page Object instanciado (`new PO(...)`, `PO.fn()`) o fixture (`const ctx = modulo.fn()` → ctx.<prop> = <PO…>)
  const reAsig = /(?:(?:const|let|var)\s+)?(\w+)\s*=\s*(?:await\s+)?(?:(new)\s+)?(\w+)(?:\s*\.\s*(\w+))?\s*\(/g;
  let m;
  while ((m = reAsig.exec(f.sc))) {
    if (!enCodigo(f, m.index + m[0].indexOf(m[1]))) continue;
    const [, variable, esNew, nombre, miembroLlamado] = m;
    if (imports.has(nombre)) {
      const info = infoDe(imports.get(nombre), invalidas);
      if (info.contratos.length || info.acciones.length) {
        agregar(variable, [info]);
        continue;
      }
    }
    if (esNew || !miembroLlamado || !imports.has(nombre)) continue;
    const fn = funcionDe(imports.get(nombre), miembroLlamado);
    if (!fn) continue;
    const modImports = importaciones(leer(imports.get(nombre)), imports.get(nombre));
    const props = new Map();
    const reProp = /(\w+)\s*\.\s*(\w+)\s*=(?![=>])\s*(?:await\s+)?(?:new\s+)?(\w+)/g;
    let p;
    while ((p = reProp.exec(fn.sc))) {
      if (fn.em[p.index] !== fn.sc[p.index] || !modImports.has(p[3])) continue;
      const info = infoDe(modImports.get(p[3]), invalidas);
      if (info.contratos.length || info.acciones.length) props.set(p[2], [info]);
    }
    if (props.size) {
      ctxVars.set(variable, props);
      for (const [prop, infos] of props) agregar(`${variable}.${prop}`, infos);
    }
  }

  // 2) variable asignada con lo que DEVUELVE un método de un receptor conocido (`detalle = await ctx.lista.abrirDetalle(x)`)
  propagarRetornos(f.sc, f.em, receptores, agregar, invalidas);

  // 3) helpers del módulo de fixtures: `modulo.helper(ctx, CASO, …)` con un ctx conocido
  const reHelper = /(?<![\w$.])(\w+)\s*\.\s*(\w+)\s*\(([^()]*)\)/g;
  while ((m = reHelper.exec(f.sc))) {
    if (!enCodigo(f, m.index) || !imports.has(m[1]) || !ctxVars.size) continue;
    const args = m[3].split(',').map((a) => a.trim());
    if (!args.some((a) => ctxVars.has(a))) continue;
    const fn = funcionDe(imports.get(m[1]), m[2]);
    if (!fn) continue;
    const rec = new Map();
    args.forEach((a, i) => {
      if (!ctxVars.has(a) || !fn.params[i]) return;
      for (const [prop, infos] of ctxVars.get(a)) rec.set(`${fn.params[i]}.${prop}`, infos);
    });
    if (rec.size) {
      // variables locales del helper tipadas por lo que devuelven los métodos de sus receptores
      const local = new Map(rec);
      propagarRetornos(fn.sc, fn.em, local, (clave, infos) => {
        const previo = local.get(clave) || [];
        const nuevos = infos.filter((i) => !previo.some((p) => p.archivo === i.archivo));
        if (nuevos.length) local.set(clave, [...previo, ...nuevos]);
        return nuevos.length > 0;
      }, invalidas);
      helpers.push({ fn, rec: local, linea: lineaDe(f.src, m.index), modulo: m[1], nombre: m[2] });
    }
  }

  // 3b) `const { detalle } = await modulo.helper(ctx, CASO)`: si el helper devuelve `{ detalle }` y esa variable local
  //     tiene un Page Object conocido, la variable del test también.
  const reDestruct = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*(?:await\s+)?(\w+)\s*\.\s*(\w+)\s*\(/g;
  while ((m = reDestruct.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    const h = helpers.find((x) => x.modulo === m[2] && x.nombre === m[3]);
    if (!h) continue;
    const ret = [...h.fn.sc.matchAll(/\breturn\s*\{([^}]*)\}/g)].flatMap((r) => r[1].split(',').map((x) => x.trim()).filter(Boolean));
    const devueltas = new Map(ret.map((x) => { const [k, v] = x.split(':').map((y) => y.trim()); return [k, v || k]; }));
    for (const d of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const [propiedad, alias] = d.split(':').map((y) => y.trim());
      const local = devueltas.get(propiedad);
      if (local && h.rec.has(local)) agregar(alias || propiedad, h.rec.get(local));
    }
  }
  propagarRetornos(f.sc, f.em, receptores, agregar, invalidas);

  const todo = { consumos: [], creaciones: [], ediciones: [], eliminaciones: [], confirmaciones: [], confirmables: [], exclusiones: [] };
  const sumar = (u, linea) => {
    for (const k of Object.keys(todo)) todo[k].push(...u[k].map((x) => (typeof x === 'string' ? x : { ...x, linea })));
  };
  sumar(analizarUso(f.sc, f.em, receptores, 0, constantes(f)), 0);
  for (const h of helpers) sumar(analizarUso(h.fn.sc, h.fn.em, h.rec, h.linea, constantes(leer(h.fn.archivo))), h.linea);

  return {
    estructurales: unicos(todo.consumos, (c) => `${c.clave}|${c.entidad}|${c.campo}`),
    creaciones: unicos(todo.creaciones, (c) => `${c.entidad}|${c.via}`),
    ediciones: unicos(todo.ediciones, (c) => `${c.entidad}|${c.via}`),
    eliminaciones: unicos(todo.eliminaciones, (c) => `${c.entidad}|${c.via}`),
    confirmaciones: unicos(todo.confirmaciones, (c) => `${c.entidad}|${c.via}`),
    confirmables: [...new Set(todo.confirmables)],
    exclusiones: unicos(todo.exclusiones, (c) => `${c.clase}|${c.via}`),
    invalidas,
  };
}

/** Contratos de un Page Object (con herencia). Para el contrato del repo. */
function contratosEnArchivo(archivo) {
  return contratosDeClase(archivo, archivo);
}

module.exports = { detectarEstructurales, contratosEnArchivo };
