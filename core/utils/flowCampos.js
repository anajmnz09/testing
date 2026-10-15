/**
 * Detección ESTRUCTURAL de `requires` a partir de los CAMPOS SELECCIONABLES de un formulario (sin ejecutar nada).
 *
 *   label del campo  +  coincidencia con una entidad conocida  +  dropdown seleccionable   ⇒   requires { tipo }
 *
 * Lo que NO se hace: descubrir entidades nuevas ni mantener un catálogo propio. Las entidades conocidas son las que ya
 * declaran los contratos `ENTIDAD_FLUJO` de los Page Objects (`flowContratos.js`): su `tipo` (p. ej. 'plan-de-seguro') y los
 * `alias` opcionales del contrato (`alias: ['cargo']`). No se exige demostrar de dónde salen las opciones del dropdown.
 *
 * El formulario de un test es el `<Page>.ESTRATEGIAS` que le pasa a `registrarCasoDesdeFormulario(CASO, <Page>.ESTRATEGIAS)`
 * (un salto, import relativo o `@triple/core`). Cada control se resuelve por separado:
 *   - dropdown seleccionable = su estrategia elige entre opciones (`ESTRATEGIAS_DE_SELECCION`); `text`, `datePicker`, `switch`…
 *     nunca generan requires por esta vía, tenga el label que tenga;
 *   - coincidencia = los TÉRMINOS (tokens completos, sin mayúsculas, tildes, puntuación ni conectores "de/del/la…") de la entidad
 *     aparecen contiguos en el label; nunca por subcadena ("Compuesto" no es "puesto") ni como complemento introducido por
 *     "de/del" ("Razón de solicitud" es una razón, no la entidad solicitud);
 *   - un control puede declarar `sinRequires: true` en su entrada de ESTRATEGIAS (`Beneficio: { estrategia: 'directSelect', sinRequires: true }`):
 *     el label coincide con una entidad, pero ese selector NO es una dependencia de flujo (p. ej. el formulario que crea
 *     `beneficio-empleado` elige un "Beneficio" del catálogo de Configuración sin necesitar que un test lo cree). Es explícito y
 *     por control; no hay otra forma de excluir un campo;
 *   - gana el término más largo (el label "Tipo de nómina" es `tipo-nomina`, no `nomina`); si varias entidades distintas
 *     empatan se reporta una ambigüedad (`invalidas`, error de plan) y NO se asigna ninguna.
 */
const fs = require('fs');
const path = require('path');
const { analizar, bloqueBalanceado, partesDeNivel } = require('./flowScanner');
const C = require('./flowContratos');

const RAIZ_REPO = path.resolve(__dirname, '..', '..');

/**
 * Estrategias (`core/strategies`) que ELIGEN entre opciones de un selector. El resto (`text`, `datePicker`, `switch`,
 * `checkbox`, `tagsLibres`, `treeView`, `custom`) no son dropdowns seleccionables. Un test del repo exige que existan registradas.
 */
const ESTRATEGIAS_DE_SELECCION = ['firstOption', 'directSelect', 'searchAndSelect', 'tagSelect'];

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);

const GENITIVOS = new Set(['de', 'del']);

/** Texto → palabras normalizadas: minúsculas, sin tildes ni puntuación ni "(s)" (los conectores se conservan). */
function palabras(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\((?:s|es)\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Texto → tokens comparables (sin conectores). */
function tokens(texto) {
  return palabras(texto).filter((t) => !CONECTORES.has(t));
}

/** Tokens del label con la marca `complemento`: la palabra viene introducida por "de/del" ("Razón DE solicitud"). */
function tokensDeLabel(texto) {
  const out = [];
  let previa = '';
  for (const w of palabras(texto)) {
    if (!CONECTORES.has(w)) out.push({ t: w, complemento: GENITIVOS.has(previa) });
    previa = w;
  }
  return out;
}

/**
 * ¿`term` aparece como secuencia contigua de tokens completos dentro del label, SIN estar introducido por "de/del"?
 * "Puesto de trabajo" nombra un puesto; "Razón de solicitud" nombra una razón (la solicitud es su complemento).
 */
function contiene(label, term) {
  if (!term.length || term.length > label.length) return false;
  for (let i = 0; i + term.length <= label.length; i += 1) {
    if (!label[i].complemento && term.every((t, j) => label[i + j].t === t)) return true;
  }
  return false;
}

function archivosJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivosJs(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const catalogos = new Map();

/**
 * Entidades conocidas = los `tipo` (y `alias`) de los contratos ENTIDAD_FLUJO de los Page Objects del repo
 * (`<modulo>/pages/**` y `core/pages/**`, con herencia). Se reutiliza `contratosDeClase`: no hay otra fuente.
 * @returns {Array<{ tipo: string, terminos: string[][] }>}
 */
function catalogoDeEntidades(raiz = RAIZ_REPO) {
  if (catalogos.has(raiz)) return catalogos.get(raiz);
  const porTipo = new Map();
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    for (const archivo of archivosJs(path.join(raiz, e.name, 'pages'))) {
      let contratos;
      try {
        contratos = C.contratosDeClase(archivo, archivo).contratos;
      } catch (_) {
        continue; // un Page Object ilegible no aporta entidades (el contrato del repo ya lo reporta)
      }
      for (const c of contratos) {
        if (!c.tipo) continue;
        const entrada = porTipo.get(c.tipo) || { tipo: c.tipo, terminos: [] };
        for (const t of [c.tipo, ...(c.alias || [])]) {
          const tk = tokens(t);
          if (tk.length && !entrada.terminos.some((x) => x.join(' ') === tk.join(' '))) entrada.terminos.push(tk);
        }
        porTipo.set(c.tipo, entrada);
      }
    }
  }
  const lista = [...porTipo.values()];
  catalogos.set(raiz, lista);
  return lista;
}

/**
 * Resuelve el label contra el catálogo. @returns {{ tipo: string } | { ambiguo: string[] } | null}
 */
function entidadDeLabel(label, catalogo) {
  const lb = tokensDeLabel(label);
  let mejor = 0;
  let tipos = [];
  for (const ent of catalogo) {
    const largo = Math.max(0, ...ent.terminos.filter((t) => contiene(lb, t)).map((t) => t.length));
    if (!largo || largo < mejor) continue;
    if (largo > mejor) tipos = [];
    mejor = largo;
    tipos.push(ent.tipo);
  }
  if (!tipos.length) return null;
  return tipos.length === 1 ? { tipo: tipos[0] } : { ambiguo: tipos.sort() };
}

/**
 * Controles `label → estrategia` de los `ESTRATEGIAS = { … }` de un fuente. Admite `Label: 'estrategia'` y
 * `Label: { estrategia: 'x', … }`. Una estrategia que no es literal queda `null` (no se puede demostrar).
 */
function leerControles(src) {
  const { sinComentarios: sc, enmascarado: em } = analizar(src);
  const out = [];
  const re = /\bESTRATEGIAS\s*=\s*\{/g;
  let m;
  while ((m = re.exec(em))) {
    const cuerpo = bloqueBalanceado(sc, m.index + m[0].length - 1);
    if (cuerpo === null) continue;
    for (const parte of partesDeNivel(cuerpo)) {
      const e = /^(?:(['"])([^'"]+)\1|([^\s:'"]+))\s*:\s*([\s\S]+)$/.exec(parte);
      if (!e) continue;
      const valor = e[4].trim();
      const lit = /^(['"`])([\w-]+)\1$/.exec(valor);
      const obj = valor.startsWith('{') ? /(?:^|[\s,{])estrategia\s*:\s*(['"`])([\w-]+)\1/.exec(valor) : null;
      const sinRequires = valor.startsWith('{') && /(?:^|[\s,{])sinRequires\s*:\s*true\b/.test(valor);
      out.push({ label: e[2] || e[3], estrategia: lit ? lit[2] : obj ? obj[2] : null, sinRequires, linea: src.slice(0, m.index).split('\n').length });
    }
  }
  return out;
}

/** Archivos de Page Object cuyo `ESTRATEGIAS` recibe `registrarCasoDesdeFormulario(CASO, <Page>.ESTRATEGIAS)` en el test. */
function formulariosDelTest(archivoTest) {
  const f = C.leer(archivoTest);
  const imports = C.importaciones(f, archivoTest);
  const archivos = new Set();
  const re = /\bregistrarCasoDesdeFormulario\s*\(/g;
  let m;
  while ((m = re.exec(f.sc))) {
    if (!C.enCodigo(f, m.index)) continue;
    const args = bloqueBalanceado(f.sc, m.index + m[0].length - 1);
    if (args === null) continue;
    for (const r of args.matchAll(/(\w+)\s*\.\s*ESTRATEGIAS\b/g)) {
      const a = imports.get(r[1]);
      if (a) archivos.add(a);
    }
  }
  return [...archivos];
}

/**
 * Campos seleccionables de los formularios del test que corresponden a una entidad conocida.
 * @returns {{ campos: Array<{tipo:string, label:string, estrategia:string, via:string, linea:number}>,
 *             invalidas: Array<{linea:number, motivo:string}> }}
 */
function detectarCamposSeleccionables(archivoTest, { raiz = RAIZ_REPO } = {}) {
  const campos = [];
  const invalidas = [];
  const archivos = formulariosDelTest(archivoTest);
  if (!archivos.length) return { campos, invalidas };
  const catalogo = catalogoDeEntidades(raiz);
  for (const archivo of archivos) {
    for (const c of leerControles(C.leer(archivo).src)) {
      if (!ESTRATEGIAS_DE_SELECCION.includes(c.estrategia)) continue;
      if (c.sinRequires) continue; // excluido explícitamente en el Page Object: no es una dependencia de flujo
      const r = entidadDeLabel(c.label, catalogo);
      if (!r) continue;
      const via = `${path.basename(archivo, '.js')}.ESTRATEGIAS["${c.label}"]`;
      if (r.ambiguo) {
        invalidas.push({ linea: c.linea, motivo: `${via} (${c.estrategia}) coincide con varias entidades [${r.ambiguo.join(', ')}]: no se asigna ninguna (declare un alias que desambigüe)` });
      } else if (!campos.some((x) => x.tipo === r.tipo && x.label === c.label)) {
        campos.push({ tipo: r.tipo, label: c.label, estrategia: c.estrategia, via, linea: c.linea });
      }
    }
  }
  return { campos, invalidas };
}

module.exports = { detectarCamposSeleccionables, catalogoDeEntidades, entidadDeLabel, leerControles, tokens, ESTRATEGIAS_DE_SELECCION };
