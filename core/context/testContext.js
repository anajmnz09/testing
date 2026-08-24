const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const formInputModel = require('./formInputModel');

/**
 * EXECUTION CONTEXT (datos de prueba).
 *
 * Desacopla los DATOS de la LÓGICA de los tests. Un test nunca hardcodea un
 * valor: le pregunta al contexto. Si el usuario definió el dato, se usa; si está
 * vacío, el test mantiene EXACTAMENTE su comportamiento actual (descubrir el
 * dato automáticamente). Ambas formas de trabajo conviven.
 *
 * OJO — no confundir con `utils/executionContext.js`, que es otra cosa que ya
 * existía: aquel arma la metadata del REPORTE (ambiente, SO, navegador). Este
 * maneja DATOS DE PRUEBA. Se dejaron separados a propósito para no tocar código
 * que ya funciona.
 *
 * Archivo: `<proyecto>/data/execution-context.json` — editable a mano por el
 * usuario y versionable. Es por módulo, así cada proyecto (Reclutamiento,
 * Nómina, etc.) define sus propios datos sin pisarse.
 *
 * Estructura:
 *   {
 *     "global":     { "usuario": "", "empresa": "" },     // aplica a todos los casos
 *     "publicar-requisicion": { "nombreRequisicion": "REQ-000125" } // específico del caso
 *   }
 *
 * Resolución de un dato: primero la sección del caso, luego `global`; si en
 * ninguna hay un valor NO VACÍO, se devuelve undefined y el test hace su
 * descubrimiento automático.
 */

const PROJECT_DIR = process.env.REPORTS_ROOT || process.cwd();
const CONTEXT_FILE =
  process.env.EXECUTION_CONTEXT || path.join(PROJECT_DIR, 'data', 'execution-context.json');

const SECCION_GLOBAL = 'global';

let _cache = null;

/**
 * Un valor "vacío" (no definido por el usuario) no dirige la prueba.
 *
 * `false` cuenta como vacío: es el valor semilla que `registrarCasoDesdeFormulario`
 * usa para un control `switch` (para que el Panel lo infiera y lo pinte como
 * checkbox — ver `panel/anfitrion/contexto.js#inferirTipo`), mismo criterio que
 * `''` para texto o `[]` para listas: el DEFAULT sin tocar no dirige nada: solo
 * un `true` explícito (el usuario tildó el checkbox) cuenta como dirigido.
 */
function _vacio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (typeof valor === 'boolean') return valor === false;
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

/**
 * Normaliza un valor de texto del Execution Context ANTES de devolverlo:
 * recorta espacios al inicio/final (`trim`), nunca espacios internos. Un
 * usuario tipeando en el Panel deja fácilmente un espacio de sobra al final
 * ("DEPARTAMENTO QA ") — la app lo recorta al guardar, así que el valor real
 * de la UI nunca lo tiene; sin esta normalización, cualquier assert que
 * compare el valor "tal cual" del contexto contra el valor leído de la UI
 * falla por un espacio invisible, no por una diferencia real. Vive ACÁ (el
 * único punto de lectura del contexto, `get()`) para que TODO el framework
 * lo herede gratis, sin que cada test tenga que acordarse de hacer
 * `.trim()` a mano. Tipos no-string (arrays, etc.) pasan sin tocar.
 */
function _normalizar(valor) {
  return typeof valor === 'string' ? valor.trim() : valor;
}

function _leerArchivo() {
  if (!fs.existsSync(CONTEXT_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8')) || {};
  } catch (err) {
    logger.error(`testContext: no se pudo leer ${CONTEXT_FILE} (se ignora): ${err.message}`);
    return {};
  }
}

function _datos() {
  if (_cache === null) _cache = _leerArchivo();
  return _cache;
}

function _escribir(datos) {
  fs.mkdirSync(path.dirname(CONTEXT_FILE), { recursive: true });
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(datos, null, 2), 'utf8');
  _cache = datos;
}

/** Fuerza releer el archivo del disco. */
function recargar() {
  _cache = null;
  return _datos();
}

/** Todo el contexto (solo lectura). */
function todo() {
  return JSON.parse(JSON.stringify(_datos()));
}

/** Sección de un caso (objeto vacío si no existe). */
function getCaso(caso) {
  return _datos()[caso] || {};
}

/**
 * Devuelve el valor definido para `clave` en el caso, o en `global`, o
 * `undefined` si no hay ninguno NO VACÍO.
 *
 * Este `undefined` es la señal para que el test siga con su descubrimiento
 * automático: es el corazón del "si existe úsalo, si no comportate igual que hoy".
 *
 * El valor devuelto siempre está normalizado (`_normalizar`: trim de
 * extremos, nunca de espacios internos) — ver esa función para el porqué.
 */
function get(caso, clave) {
  const delCaso = getCaso(caso)[clave];
  if (!_vacio(delCaso)) return _normalizar(delCaso);
  const global = (_datos()[SECCION_GLOBAL] || {})[clave];
  if (!_vacio(global)) return _normalizar(global);
  return undefined;
}

/** True si el usuario definió ese dato (no vacío). */
function tiene(caso, clave) {
  return get(caso, clave) !== undefined;
}

/**
 * Devuelve el valor del contexto o, si no está definido, el resultado de
 * `descubrir()` — la función que implementa el comportamiento automático actual.
 * Azúcar para el patrón que repiten todos los tests.
 *
 * @param caso      nombre descriptivo del caso (ej. 'publicar-requisicion')
 * @param clave     nombre del dato (ej. 'nombreRequisicion')
 * @param descubrir async () => valor  (comportamiento actual si no hay dato)
 */
async function getODescubrir(caso, clave, descubrir) {
  const valor = get(caso, clave);
  if (valor !== undefined) {
    logger.info(`testContext: [${caso}] "${clave}" tomado del Execution Context -> "${valor}"`);
    return valor;
  }
  logger.info(`testContext: [${caso}] "${clave}" no definido; descubrimiento automático`);
  return descubrir();
}

/**
 * Asegura que exista la sección del caso con las claves indicadas (vacías).
 * Se llama al implementar un caso nuevo: deja el hueco listo para que el usuario
 * lo complete si quiere dirigir la prueba. NO pisa valores ya cargados ni borra
 * claves que el usuario haya agregado.
 *
 * Cada entrada de `claves` es normalmente un string (semilla `''`, el caso de
 * siempre). También acepta `{ clave, vacio }` para sembrar un valor semilla
 * distinto de `''` — hoy lo usa `registrarCasoDesdeFormulario` para los
 * controles `switch` (semilla `false`, no `''`), así el Panel los infiere como
 * checkbox (`panel/anfitrion/contexto.js#inferirTipo` detecta `boolean`).
 *
 * @returns {boolean} true si el archivo cambió
 */
function registrarCaso(caso, claves = []) {
  const datos = _datos();
  const seccion = datos[caso] || {};
  let cambio = false;

  if (!datos[caso]) cambio = true;
  claves.forEach((entrada) => {
    const clave = typeof entrada === 'string' ? entrada : entrada.clave;
    const vacio = typeof entrada === 'string' ? '' : entrada.vacio;
    if (!(clave in seccion)) {
      seccion[clave] = vacio !== undefined ? vacio : '';
      cambio = true;
    }
  });

  if (cambio) {
    datos[caso] = seccion;
    _escribir(datos);
    logger.info(`testContext: sección "${caso}" registrada/actualizada en ${CONTEXT_FILE}`);
  }
  return cambio;
}

/**
 * Como `registrarCaso`, pero deriva las claves del FORMULARIO: siembra todos los
 * controles editables (labels REALES) del mapa `control -> estrategia` que declara
 * el Page Object, más las `clavesExtra` que el caso necesite (parámetros que no
 * son campos del formulario, p. ej. un contador o el nombre de una pregunta).
 *
 * Así el usuario ve en el Execution Context TODOS los campos del formulario con
 * su nombre real y sólo tiene que completar los que quiera dirigir; nunca inventa
 * ni crea claves. Es puramente ADITIVO: `registrarCaso` queda intacto y los casos
 * que no usan formularios siguen registrando sólo sus parámetros.
 *
 * Un control declarado con estrategia `'switch'` se siembra con `false` (no
 * `''`): es la única forma de que el Panel lo detecte como boolean y lo pinte
 * como checkbox en vez de un input de texto (ver `_vacio`/`inferirTipo`).
 *
 * @param caso        nombre descriptivo del caso
 * @param controles   mapa `label -> 'estrategia' | { estrategia, ... }` (ESTRATEGIAS del Page Object)
 * @param clavesExtra claves adicionales no derivadas del formulario
 * @returns {boolean} true si el archivo cambió
 */
function registrarCasoDesdeFormulario(caso, controles = {}, clavesExtra = []) {
  const claves = [
    ...formInputModel
      .desdeControles(controles)
      .map(({ label, estrategia }) => (estrategia === 'switch' ? { clave: label, vacio: false } : label)),
    ...clavesExtra,
  ];
  return registrarCaso(caso, claves);
}

module.exports = {
  CONTEXT_FILE,
  SECCION_GLOBAL,
  get,
  tiene,
  getCaso,
  getODescubrir,
  registrarCaso,
  registrarCasoDesdeFormulario,
  todo,
  recargar,
};
