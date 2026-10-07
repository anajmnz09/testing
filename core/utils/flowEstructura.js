/**
 * Detección ESTRUCTURAL de `requires` (sin ejecutar nada): relaciona las entradas de un test con la
 * entidad que consume a partir de la arquitectura compartida, no de nombres ni labels.
 *
 *   clave del test ──(valor)──► `<listado>.abrirDetalle(x)` ──► Page Object ──► ENTIDAD_FLUJO
 *
 * El contrato se declara UNA vez en el Page Object que implementa el localizador:
 *
 *   static get ENTIDAD_FLUJO() { return { tipo: 'solicitud', referencia: 'codigo' }; }
 *   // metodos (opcional, por defecto ['abrirDetalle']): métodos que reciben la `referencia`
 *   // un array de contratos es válido si la clase localiza varias entidades.
 *
 * Cada eslabón debe ser demostrable en el código (todo literal; si no, no se deduce nada):
 *   1. el test obtiene un listado: `const ctx = <modulo>.<fn>()` (fixture: su cuerpo asigna
 *      `ctx.<prop> = <PageObject…>`), o instancia un Page Object: `const p = new PO(...)` / `PO.<fn>()`;
 *   2. el Page Object importado (ruta relativa, un salto) declara ENTIDAD_FLUJO;
 *   3. el valor de `testContext.get(CASO, 'clave')` llega, directo o por alias simple, al primer
 *      argumento de `<receptor>.<metodo>(…)` (también a través de un helper de ese módulo, un salto:
 *      `<modulo>.<helper>(ctx, CASO)`, analizando el cuerpo del helper).
 *
 * La clave puede ser un string literal o una constante de módulo `const CLAVE = 'literal';`.
 * El flujo de datos se sigue solo por: asignaciones simples, `a || b` / `a ?? b`, paréntesis,
 * `await`, `parsearValoresMultiples(…)`/`String(…)` y `for (const x of …)`. Cualquier otra forma no
 * propaga la clave (queda SUGERIDO/NO DETERMINADO, nunca una dependencia).
 */
const fs = require('fs');
const path = require('path');
const { analizar, bloqueBalanceado, partesDeNivel, literal } = require('./flowScanner');

const ENVOLTORIOS = ['parsearValoresMultiples', 'String'];
const METODOS_POR_DEFECTO = ['abrirDetalle'];
const cache = new Map();

function leer(archivo) {
  if (!cache.has(archivo)) {
    const src = fs.readFileSync(archivo, 'utf8');
    const a = analizar(src);
    cache.set(archivo, { src, sc: a.sinComentarios, em: a.enmascarado });
  }
  return cache.get(archivo);
}

const lineaDe = (src, idx) => src.slice(0, idx).split('\n').length;
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const enCodigo = (f, idx) => f.em[idx] === f.sc[idx]; // false si el índice cae en un string/comentario

function resolverArchivo(base) {
  return [base, `${base}.js`, path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

/** nombre → ruta, de los `require` con ruta relativa (`const X = require('./x')`, `const { X } = require('./x')`). */
function importaciones(f, archivo) {
  const out = new Map();
  const anadir = (nombre, ruta) => {
    const r = resolverArchivo(path.resolve(path.dirname(archivo), ruta));
    if (r) out.set(nombre, r);
  };
  let m;
  const re1 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(['"])(\.{1,2}\/[^'"]+)\2\s*\)/g;
  while ((m = re1.exec(f.sc))) if (enCodigo(f, m.index)) anadir(m[1], m[3]);
  const re2 = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*(['"])(\.{1,2}\/[^'"]+)\2\s*\)/g;
  while ((m = re2.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    for (const p of m[1].split(',')) {
      const n = p.split(':').pop().trim();
      if (n) anadir(n, m[3]);
    }
  }
  return out;
}

/** Contratos ENTIDAD_FLUJO de un Page Object: `{ contratos: [{tipo, referencia, metodos}], invalidas: [...] }`. */
function leerContratos(archivo) {
  const f = leer(archivo);
  const contratos = [];
  const invalidas = [];
  const re = /static\s+get\s+ENTIDAD_FLUJO\s*\(\s*\)\s*\{\s*return\s*/g;
  let m;
  while ((m = re.exec(f.sc))) {
    const pos = m.index + m[0].length;
    const abre = f.sc[pos];
    const linea = lineaDe(f.src, m.index);
    const cuerpo = abre === '{' || abre === '[' ? bloqueBalanceado(f.sc, pos) : null;
    if (cuerpo === null) {
      invalidas.push({ linea, motivo: `${path.basename(archivo)}: ENTIDAD_FLUJO debe devolver un objeto o un array de objetos literales` });
      continue;
    }
    const objetos = abre === '[' ? partesDeNivel(cuerpo) : [`{${cuerpo}}`];
    for (const o of objetos) {
      const tipo = literal(o, 'tipo');
      const referencia = literal(o, 'referencia');
      const lista = /(?:^|[\s,{])metodos\s*:\s*\[([^\]]*)\]/.exec(o);
      const metodos = lista ? [...lista[1].matchAll(/(['"`])([\w$]+)\1/g)].map((x) => x[2]) : METODOS_POR_DEFECTO;
      if (!tipo || !referencia || !metodos.length) {
        invalidas.push({ linea, motivo: `${path.basename(archivo)}: ENTIDAD_FLUJO exige tipo y referencia como strings literales (y metodos como array literal)` });
      } else contratos.push({ tipo, referencia, metodos, archivo });
    }
  }
  return { contratos, invalidas };
}

/** Contratos del Page Object que una variable/nombre referencia (por `new X`, `X.fn()` o `ctx.prop = X…`). */
function contratosDe(nombre, imports, invalidas) {
  const archivo = imports.get(nombre);
  if (!archivo) return [];
  const r = leerContratos(archivo);
  for (const i of r.invalidas) if (!invalidas.some((x) => x.motivo === i.motivo)) invalidas.push(i);
  return r.contratos;
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

/**
 * Consumos `{ clave, tipo, campo, via }` dentro de un texto, dado un mapa receptor → contratos.
 * @param {Map<string, object[]>} receptores  p. ej. 'ctx.lista' → contratos del Page Object
 */
function consumos(sc, em, receptores, linea, consts) {
  const tainted = propagar(sc, em, consts);
  const out = [];
  for (const [receptor, contratos] of receptores) {
    for (const c of contratos) {
      for (const metodo of c.metodos) {
        const re = new RegExp(`(?<![\\w$.])${escapar(receptor).replace(/\\\./g, '\\s*\\.\\s*')}\\s*\\.\\s*${escapar(metodo)}\\s*\\(`, 'g');
        let m;
        while ((m = re.exec(sc))) {
          if (em[m.index] !== sc[m.index]) continue;
          const args = bloqueBalanceado(sc, m.index + m[0].length - 1);
          if (args === null) continue;
          const primero = partesDeNivel(args)[0];
          if (!primero) continue;
          for (const clave of clavesDe(primero, tainted, consts)) {
            out.push({ clave, entidad: c.tipo, campo: c.referencia, via: `${path.basename(c.archivo, '.js')}.${metodo}`, linea });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Detecta, para un test, los requires que demuestra la estructura.
 * @returns {{ estructurales: Array<{clave:string, entidad:string, campo:string, via:string, linea:number}>, invalidas: Array<{linea:number, motivo:string}> }}
 */
function detectarEstructurales(archivoTest) {
  const f = leer(archivoTest);
  const imports = importaciones(f, archivoTest);
  const invalidas = [];
  const receptores = new Map(); // receptor (texto) → contratos
  const ctxVars = new Map(); // variable → Map(prop → contratos)
  const helpers = [];

  const reAsig = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:(new)\s+)?(\w+)(?:\s*\.\s*(\w+))?\s*\(/g;
  let m;
  while ((m = reAsig.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    const [, variable, esNew, nombre, miembro] = m;
    const propios = contratosDe(nombre, imports, invalidas);
    if (propios.length) {
      receptores.set(variable, propios);
      continue;
    }
    // fixture: `const ctx = modulo.fn(...)` cuyo cuerpo asigna `ctx.prop = <PageObject…>`
    if (esNew || !miembro || !imports.has(nombre)) continue;
    const fn = funcionDe(imports.get(nombre), miembro);
    if (!fn) continue;
    const modImports = importaciones(leer(imports.get(nombre)), imports.get(nombre));
    const props = new Map();
    const reProp = /(\w+)\s*\.\s*(\w+)\s*=(?![=>])\s*(?:await\s+)?(?:new\s+)?(\w+)/g;
    let p;
    while ((p = reProp.exec(fn.sc))) {
      if (fn.em[p.index] !== fn.sc[p.index]) continue;
      const cs = contratosDe(p[3], modImports, invalidas);
      if (cs.length) props.set(p[2], cs);
    }
    if (props.size) {
      ctxVars.set(variable, props);
      for (const [prop, cs] of props) receptores.set(`${variable}.${prop}`, cs);
    }
  }

  // helpers del mismo módulo: `modulo.helper(ctx, CASO, …)` con un ctx conocido
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
      for (const [prop, cs] of ctxVars.get(a)) rec.set(`${fn.params[i]}.${prop}`, cs);
    });
    if (rec.size) helpers.push({ fn, rec, linea: lineaDe(f.src, m.index) });
  }

  const estructurales = [];
  const vistos = new Set();
  const anadir = (lista) => {
    for (const c of lista) {
      const k = `${c.clave}|${c.entidad}|${c.campo}`;
      if (!vistos.has(k)) {
        vistos.add(k);
        estructurales.push(c);
      }
    }
  };
  anadir(consumos(f.sc, f.em, receptores, 0, constantes(f)).map((c) => ({ ...c, linea: 0 })));
  for (const h of helpers) anadir(consumos(h.fn.sc, h.fn.em, h.rec, h.linea, constantes(leer(h.fn.archivo))).map((c) => ({ ...c, linea: h.linea })));
  return { estructurales, invalidas };
}

/** Todos los contratos ENTIDAD_FLUJO de los Page Objects de un directorio (para el contrato del repo). */
function contratosEnArchivo(archivo) {
  return leerContratos(archivo);
}

module.exports = { detectarEstructurales, contratosEnArchivo };
