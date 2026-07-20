const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

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

/** Un valor "vacío" (no definido por el usuario) no dirige la prueba. */
function _vacio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
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
 */
function get(caso, clave) {
  const delCaso = getCaso(caso)[clave];
  if (!_vacio(delCaso)) return delCaso;
  const global = (_datos()[SECCION_GLOBAL] || {})[clave];
  if (!_vacio(global)) return global;
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
 * @returns {boolean} true si el archivo cambió
 */
function registrarCaso(caso, claves = []) {
  const datos = _datos();
  const seccion = datos[caso] || {};
  let cambio = false;

  if (!datos[caso]) cambio = true;
  claves.forEach((clave) => {
    if (!(clave in seccion)) {
      seccion[clave] = '';
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

module.exports = {
  CONTEXT_FILE,
  SECCION_GLOBAL,
  get,
  tiene,
  getCaso,
  getODescubrir,
  registrarCaso,
  todo,
  recargar,
};
