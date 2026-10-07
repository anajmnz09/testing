/**
 * Modelo ESTÁTICO de los contratos de entidad `ENTIDAD_FLUJO` de los Page Objects / componentes (sin
 * ejecutar nada): lee el código fuente, resuelve herencia (`extends`), qué clase devuelve un método
 * (`return new X(...)`) y los valores literales de getters estáticos. Lo usan `flowEstructura.js` (detección
 * en los tests) y el contrato del repo (`core/tests/contrato-flujo-metadata.spec.js`).
 *
 * Forma del contrato (el mismo objeto lo lee en runtime `flowInstrumentar.js`; una sola fuente):
 *   static get ENTIDAD_FLUJO() { return { tipo, referencia, metodos?, creadores?, editores?, eliminadores?, confirmadores? }; }
 *   (un array de objetos si la clase opera varias entidades). Cada lista admite strings o
 *   `{ metodo, argumento?, valor?, persiste?, referenciaArg?, leer? }`.
 * `tipo` puede ser un literal o una expresión `this.<getter>.<getter>` que se resuelve contra la subclase
 * concreta (p. ej. el listado base de Configuración: `this.DetallePageClass.NOMBRE_ENTIDAD`).
 */
const fs = require('fs');
const path = require('path');
const { analizar, bloqueBalanceado, partesDeNivel, literal } = require('./flowScanner');

const CORE = path.resolve(__dirname, '..');
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
const enCodigo = (f, idx) => f.em[idx] === f.sc[idx];

function resolverArchivo(base) {
  return [base, `${base}.js`, path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

let _exportsCore;
/** nombre → archivo de lo que `core/index.js` exporta (`Nombre: require('./ruta')`). */
function exportsDelNucleo() {
  if (!_exportsCore) {
    _exportsCore = new Map();
    const idx = path.join(CORE, 'index.js');
    if (fs.existsSync(idx)) {
      const f = leer(idx);
      for (const m of f.sc.matchAll(/(\w+)\s*:\s*require\(\s*(['"])(\.\/[^'"]+)\2\s*\)/g)) {
        const r = resolverArchivo(path.resolve(CORE, m[3]));
        if (r) _exportsCore.set(m[1], r);
      }
    }
  }
  return _exportsCore;
}

/** nombre → ruta de los `require` relativos, de `@triple/core/<ruta>` y de `{ X } = require('@triple/core')`. */
function importaciones(f, archivo) {
  const out = new Map();
  const destino = (ruta) => {
    if (/^\.{1,2}\//.test(ruta)) return resolverArchivo(path.resolve(path.dirname(archivo), ruta));
    const m = /^@triple\/core\/(.+)$/.exec(ruta);
    return m ? resolverArchivo(path.join(CORE, m[1])) : null;
  };
  let m;
  const re1 = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)/g;
  while ((m = re1.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    const r = destino(m[3]);
    if (r) out.set(m[1], r);
  }
  const re2 = /(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)/g;
  while ((m = re2.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    for (const p of m[1].split(',')) {
      const [orig, alias] = p.split(':').map((x) => x.trim());
      if (!orig) continue;
      const nombre = alias || orig;
      if (m[3] === '@triple/core') {
        const r = exportsDelNucleo().get(orig);
        if (r) out.set(nombre, r);
      } else {
        const r = destino(m[3]);
        if (r) out.set(nombre, r);
      }
    }
  }
  return out;
}

/** `{ nombre, extiende }` de la primera clase del archivo. */
function claseDe(archivo) {
  const f = leer(archivo);
  const m = /\bclass\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/.exec(f.sc);
  return m ? { nombre: m[1], extiende: m[2] || null, indice: m.index + m[0].length - 1 } : null;
}

/** Archivo de la clase padre (resuelto con las importaciones del archivo), o null. */
function padreDe(archivo) {
  const c = claseDe(archivo);
  if (!c || !c.extiende) return null;
  return importaciones(leer(archivo), archivo).get(c.extiende) || null;
}

/** Cadena de herencia: [archivo, padre, abuelo…]. */
function cadena(archivo) {
  const out = [];
  for (let a = archivo, n = 0; a && n < 8; a = padreDe(a), n += 1) out.push(a);
  return out;
}

/** Cuerpo `{…}` (como `{sc, em}`) del miembro `nombre` declarado en el archivo (método, getter), o null. */
function miembroPropio(archivo, nombre) {
  const f = leer(archivo);
  const c = claseDe(archivo);
  if (!c) return null;
  const cuerpoClase = bloqueBalanceado(f.sc, c.indice);
  if (cuerpoClase === null) return null;
  const base = c.indice + 1;
  const re = new RegExp(`\\n[ \\t]*(?:static\\s+)?(?:async\\s+)?(?:get\\s+)?${escapar(nombre)}\\s*\\(`, 'g');
  const texto = cuerpoClase;
  let m;
  while ((m = re.exec(texto))) {
    const abreParen = base + m.index + m[0].length - 1;
    if (f.em[abreParen] !== f.sc[abreParen]) continue;
    const params = bloqueBalanceado(f.sc, abreParen);
    if (params === null) continue;
    const llave = f.sc.indexOf('{', abreParen + params.length + 1);
    if (llave < 0) continue;
    const cuerpo = bloqueBalanceado(f.sc, llave);
    if (cuerpo === null) continue;
    return { archivo, sc: f.sc.slice(llave + 1, llave + 1 + cuerpo.length), indice: base + m.index };
  }
  return null;
}

/** ¿El método existe en la clase o en alguno de sus ancestros? */
function metodoExiste(archivo, metodo) {
  return cadena(archivo).some((a) => miembroPropio(a, metodo));
}

/** Miembro buscado en la clase y sus ancestros (el más específico). */
function miembro(archivo, nombre) {
  for (const a of cadena(archivo)) {
    const m = miembroPropio(a, nombre);
    if (m) return m;
  }
  return null;
}

/** Valor de un getter estático sin argumentos: `{ literal }`, `{ ident }` o null. */
function valorDeGetter(archivo, nombre) {
  const m = miembro(archivo, nombre);
  if (!m) return null;
  const r = /^\s*return\s+(?:(['"`])([^'"`]*)\1|(\w+))\s*;?\s*$/.exec(m.sc);
  if (!r) return null;
  return r[2] !== undefined ? { literal: r[2] } : { ident: r[3], archivo: m.archivo };
}

/** Resuelve `this.A` (getter literal) o `this.A.B` contra la clase concreta: A devuelve una clase importada y B es un getter literal. */
function resolverExpresion(expr, concreto) {
  const simple = /^this\.(\w+)$/.exec(String(expr).trim());
  if (simple) {
    const g = valorDeGetter(concreto, simple[1]);
    return g && g.literal !== undefined ? g.literal : null;
  }
  const partes = /^this\.(\w+)\.(\w+)$/.exec(String(expr).trim());
  if (!partes) return null;
  const g1 = valorDeGetter(concreto, partes[1]);
  if (!g1 || !g1.ident) return null;
  const destino = importaciones(leer(g1.archivo), g1.archivo).get(g1.ident);
  if (!destino) return null;
  const g2 = valorDeGetter(destino, partes[2]);
  return g2 && g2.literal !== undefined ? g2.literal : null;
}

function parseEntradas(objeto, clave) {
  const re = new RegExp(`(?:^|[\\s,{])${clave}\\s*:\\s*\\[`);
  const m = re.exec(objeto);
  if (!m) return null;
  const cuerpo = bloqueBalanceado(objeto, m.index + m[0].length - 1);
  if (cuerpo === null) return null;
  return partesDeNivel(cuerpo).map((p) => {
    const s = /^(['"`])([\w$]+)\1$/.exec(p);
    if (s) return { metodo: s[2] };
    if (!p.startsWith('{')) return null;
    const metodo = literal(p, 'metodo');
    if (!metodo) return null;
    const arg = /(?:^|[\s,{])argumento\s*:\s*(\d+)/.exec(p);
    return {
      metodo,
      ...(arg ? { argumento: Number(arg[1]) } : {}),
      ...(literal(p, 'valor') !== undefined ? { valor: literal(p, 'valor') } : {}),
      ...(/(?:^|[\s,{])persiste\s*:\s*true/.test(p) ? { persiste: true } : {}),
      ...(literal(p, 'referenciaArg') !== undefined ? { referenciaArg: literal(p, 'referenciaArg') } : {}),
      ...(literal(p, 'leer') !== undefined ? { leer: literal(p, 'leer') } : {}),
      ...(literal(p, 'clase') !== undefined ? { clase: literal(p, 'clase') } : {}),
      ...(/(?:^|[\s,{])capturar\s*:\s*true/.test(p) ? { capturar: true } : {}),
      ...(/(?:^|[\s,{])datos\s*:\s*null/.test(p) ? { datos: null } : literal(p, 'datos') !== undefined ? { datos: literal(p, 'datos') } : {}),
    };
  });
}

/** Objetos de contrato de UN archivo (sin herencia): `{ objetos: [...], invalidas, linea }`. */
function objetosPropios(archivo) {
  const f = leer(archivo);
  const objetos = [];
  const invalidas = [];
  const re = /static\s+get\s+ENTIDAD_FLUJO\s*\(\s*\)\s*\{\s*return\s*/g;
  let m;
  while ((m = re.exec(f.sc))) {
    if (!enCodigo(f, m.index)) continue;
    const pos = m.index + m[0].length;
    const abre = f.sc[pos];
    const linea = lineaDe(f.src, m.index);
    const cuerpo = abre === '{' || abre === '[' ? bloqueBalanceado(f.sc, pos) : null;
    if (cuerpo === null) {
      invalidas.push({ linea, motivo: `${path.basename(archivo)}: ENTIDAD_FLUJO debe devolver un objeto o un array de objetos literales` });
      continue;
    }
    for (const o of abre === '[' ? partesDeNivel(cuerpo) : [`{${cuerpo}}`]) objetos.push({ texto: o, linea });
  }
  return { objetos, invalidas };
}

/**
 * Contratos efectivos de una clase (con herencia). `concreto` = la subclase real, para resolver `tipo` cuando
 * es una expresión (`this.DetallePageClass.NOMBRE_ENTIDAD`).
 * @returns {{ contratos: Array<{tipo?:string, referencia?:string, metodos:string[], creadores:object[], editores:object[], eliminadores:object[], confirmadores:object[], archivo:string}>, invalidas: Array<{linea:number, motivo:string}> }}
 */
function contratosDeClase(archivo, concreto = archivo) {
  const contratos = [];
  const invalidas = [];
  for (const a of cadena(archivo)) {
    const { objetos, invalidas: inv } = objetosPropios(a);
    invalidas.push(...inv);
    if (!objetos.length) continue;
    for (const { texto, linea } of objetos) {
      const lit = literal(texto, 'tipo');
      let tipo = lit;
      if (tipo === undefined) {
        const e = /(?:^|[\s,{])tipo\s*:\s*([^,}]+)/.exec(texto);
        tipo = e ? resolverExpresion(e[1], concreto) : undefined;
        if (e && !tipo) invalidas.push({ linea, motivo: `${path.basename(a)}: no se pudo resolver estáticamente tipo: ${e[1].trim()} para ${path.basename(concreto)}` });
      }
      const referencia = literal(texto, 'referencia');
      const metodos = (parseEntradas(texto, 'metodos') || (/(?:^|[\s,{])metodos\s*:/.test(texto) ? [] : METODOS_POR_DEFECTO.map((metodo) => ({ metodo })))).map((x) => x.metodo);
      const creadores = parseEntradas(texto, 'creadores') || [];
      const editores = parseEntradas(texto, 'editores') || [];
      const eliminadores = parseEntradas(texto, 'eliminadores') || [];
      const confirmadores = parseEntradas(texto, 'confirmadores') || [];
      const sinTipo = tipo === undefined;
      if (sinTipo && !confirmadores.length) {
        invalidas.push({ linea, motivo: `${path.basename(a)}: ENTIDAD_FLUJO exige tipo (string literal o this.<getter>.<getter>)` });
        continue;
      }
      if (!sinTipo && !referencia) {
        invalidas.push({ linea, motivo: `${path.basename(a)}: ENTIDAD_FLUJO de "${tipo}" exige referencia como string literal` });
        continue;
      }
      contratos.push({ tipo, referencia, metodos: sinTipo ? [] : metodos, creadores, editores, eliminadores, confirmadores, archivo: a });
    }
    break; // el contrato más específico (el de la clase o el primer ancestro que lo declara) manda
  }
  return { contratos, invalidas };
}

/**
 * Acciones de un Page Object que, por decisión de negocio, NO crean ni transforman una entidad de flujo:
 *   static get ACCIONES_FLUJO() { return [{ metodo: 'subirFoto', clase: 'atributo' }]; }
 * `clase`: 'atributo' (modifica una propiedad del registro: foto, valoración…), 'relacion' (fila de relación de un registro: miembro,
 * permiso…) o 'traslado' (mueve datos de un lugar a otro sin crear una entidad). Se acumulan a lo largo de la herencia.
 */
function accionesDeClase(archivo) {
  const acciones = [];
  for (const a of cadena(archivo)) {
    const f = leer(a);
    const re = /static\s+get\s+ACCIONES_FLUJO\s*\(\s*\)\s*\{\s*return\s*\[/g;
    let m;
    while ((m = re.exec(f.sc))) {
      if (!enCodigo(f, m.index)) continue;
      const cuerpo = bloqueBalanceado(f.sc, m.index + m[0].length - 1);
      if (cuerpo === null) continue;
      const entradas = parseEntradas(`{ acciones: [${cuerpo}] }`, 'acciones') || [];
      for (const e of entradas) if (e && e.metodo) acciones.push({ metodo: e.metodo, clase: e.clase || 'atributo', archivo: a });
    }
  }
  return acciones;
}

/** Clases que devuelve un método (`return new X(...)`, directo o vía `return this.otro(...)`), o []. */
function retornoDeMetodo(archivo, metodo, concreto = archivo, prof = 0) {
  if (prof > 3) return [];
  const m = miembro(archivo, metodo);
  if (!m) return [];
  const imps = importaciones(leer(m.archivo), m.archivo);
  const salida = new Set();
  for (const r of m.sc.matchAll(/\breturn\s+(?:await\s+)?new\s+(\w+)\s*\(/g)) {
    let nombre = r[1];
    const archivoClase = imps.get(nombre);
    if (archivoClase) {
      salida.add(archivoClase);
      continue;
    }
    // `const DetallePage = this.constructor.DetallePageClass; … return new DetallePage(...)`
    const alias = new RegExp(`(?:const|let|var)\\s+${escapar(nombre)}\\s*=\\s*this\\.constructor\\.(\\w+)\\s*;`).exec(m.sc);
    if (alias) {
      const g = valorDeGetter(concreto, alias[1]);
      const destino = g && g.ident ? importaciones(leer(g.archivo), g.archivo).get(g.ident) : null;
      if (destino) salida.add(destino);
    }
  }
  // `return this;` → el propio Page Object (listado-modal que se devuelve a sí mismo)
  if (/\breturn\s+(?:await\s+)?this\s*;/.test(m.sc)) salida.add(concreto);
  for (const r of m.sc.matchAll(/\breturn\s+(?:await\s+)?this\.(\w+)\s*\(/g)) {
    for (const x of retornoDeMetodo(archivo, r[1], concreto, prof + 1)) salida.add(x);
  }
  return [...salida];
}

module.exports = {
  leer, lineaDe, escapar, enCodigo, importaciones, claseDe, cadena, metodoExiste, contratosDeClase, accionesDeClase, retornoDeMetodo, resolverArchivo,
};
