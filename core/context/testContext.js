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
// Sección reservada (mismo criterio que `SECCION_GLOBAL`: un nombre que
// ningún CASO real usa) donde se registra QUÉ claves de qué casos aceptan
// varios valores separados por "|" — ver `registrarCaso`/
// `registrarCasoDesdeFormulario` (quién escribe) y
// `panel/anfitrion/contexto.js#seccion` (quién lo lee, para que el Panel
// muestre el hint "Opción 1 | Opción 2" automáticamente, sin un mapa
// hardcodeado por label). Es una lista de labels por caso, NO afecta el
// VALOR sembrado de la clave (sigue siendo `''`, un string normal) — separar
// "qué tipo de campo es" de "qué valor tiene ahora mismo" evita que el hint
// desaparezca del Panel apenas el usuario guarda un valor no vacío.
const SECCION_MULTIVALOR = '_camposMultivalor';

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
 * siempre). También acepta `{ clave, vacio, multivalor }`:
 *  - `vacio`: valor semilla distinto de `''` — hoy lo usa
 *    `registrarCasoDesdeFormulario` para los controles `switch` (semilla
 *    `false`, no `''`), así el Panel los infiere como checkbox
 *    (`panel/anfitrion/contexto.js#inferirTipo` detecta `boolean`).
 *  - `multivalor: true`: marca la clave como aceptando VARIOS valores
 *    separados por "|" (mismo separador que `parsearValoresMultiples`,
 *    `core/strategies`) — se registra en `SECCION_MULTIVALOR`, no en el
 *    valor sembrado, para que el Panel muestre el hint automáticamente sin
 *    que cada caso declare su propio placeholder a mano. Usarlo para
 *    cualquier clave que el test vaya a pasar por `parsearValoresMultiples`
 *    (tagbox/multi-select que `registrarCasoDesdeFormulario` no pueda
 *    detectar solo porque el caso no la declaró vía `ESTRATEGIAS`).
 *
 * @returns {boolean} true si el archivo cambió
 */
function registrarCaso(caso, claves = []) {
  const datos = _datos();
  const seccion = datos[caso] || {};
  const yaExistia = !!datos[caso];
  let cambio = false;

  if (!datos[caso]) cambio = true;
  const multivalorNuevas = [];
  const declaradas = new Set();
  claves.forEach((entrada) => {
    const esString = typeof entrada === 'string';
    const clave = esString ? entrada : entrada.clave;
    const vacio = esString ? '' : entrada.vacio;
    declaradas.add(clave);
    if (!esString && entrada.multivalor) multivalorNuevas.push(clave);
    if (!(clave in seccion)) {
      seccion[clave] = vacio !== undefined ? vacio : '';
      cambio = true;
    }
  });

  // Claves HUÉRFANAS: quedaron en el archivo de una versión anterior del caso
  // (ej. una clave renombrada en el código) pero ya no las declara nadie.
  // Solo AVISA — nunca las borra (mismo criterio "nunca pisa/borra lo que ya
  // está" del resto del framework, podría ser un dato real que el usuario
  // todavía necesita) — así el drift entre código y `execution-context.json`
  // se nota en el log en vez de quedar como un campo fantasma indefinido.
  // Ver `GUIDELINES.md §3` / `testing-patterns/SKILL.md` (incidente
  // 2026-09-04: "nombre" huérfano tras el rename a "Nombre de Empleado a
  // editar", nunca detectado porque nada avisaba de la clave sobrante).
  if (yaExistia) {
    const huerfanas = Object.keys(seccion).filter((k) => !declaradas.has(k));
    if (huerfanas.length) {
      logger.warn(
        `testContext: [${caso}] clave(s) en execution-context.json que ya NO declara el ` +
          `código: [${huerfanas.join(', ')}]. Probablemente quedaron de un rename anterior — ` +
          `revisar y, si corresponde, quitarlas a mano (no se borran solas).`
      );
    }
  }

  if (multivalorNuevas.length) {
    const registro = new Set((datos[SECCION_MULTIVALOR] && datos[SECCION_MULTIVALOR][caso]) || []);
    let cambioMultivalor = false;
    for (const clave of multivalorNuevas) {
      if (!registro.has(clave)) {
        registro.add(clave);
        cambioMultivalor = true;
      }
    }
    if (cambioMultivalor) {
      datos[SECCION_MULTIVALOR] = datos[SECCION_MULTIVALOR] || {};
      datos[SECCION_MULTIVALOR][caso] = [...registro];
      cambio = true;
    }
  }

  if (cambio) {
    datos[caso] = seccion;
    _escribir(datos);
    logger.info(`testContext: sección "${caso}" registrada/actualizada en ${CONTEXT_FILE}`);
  }
  return cambio;
}

/**
 * Como `registrarCaso`, pero deriva las claves del FORMULARIO: siembra
 * `clavesExtra` PRIMERO (parámetros que no son campos del formulario, p. ej.
 * un contador o el nombre de una pregunta — en casi todo `editar-*` es la
 * clave de BÚSQUEDA, "Nombre de X a editar": el usuario necesita ver "a qué
 * registro le estoy hablando" antes que los campos que va a cambiarle, no
 * después), y DESPUÉS todos los controles editables (labels REALES) del mapa
 * `control -> estrategia` que declara el Page Object.
 *
 * Así el usuario ve en el Execution Context TODOS los campos del formulario con
 * su nombre real y sólo tiene que completar los que quiera dirigir; nunca inventa
 * ni crea claves. Es puramente ADITIVO: `registrarCaso` queda intacto y los casos
 * que no usan formularios siguen registrando sólo sus parámetros.
 *
 * OJO: el orden acá solo importa para un CASO NUEVO (o una clave nueva
 * dentro de un caso ya existente) — `registrarCaso` nunca reordena claves ya
 * presentes en `execution-context.json` (mismo criterio "nunca pisa lo que
 * ya está" de siempre), así que un caso existente con las claves en el orden
 * viejo necesita que alguien reordene esa sección del archivo a mano una
 * vez; el código nuevo ya deja bien ordenado todo lo que se registre de acá
 * en adelante.
 *
 * Un control declarado con estrategia `'switch'` O `'checkbox'` se siembra
 * con `false` (no `''`): es la única forma de que el Panel lo detecte como
 * boolean y lo pinte como checkbox en vez de un input de texto (ver
 * `_vacio`/`inferirTipo`) — `inferirTipo` (`panel/anfitrion/contexto.js`) ya
 * es agnóstico al nombre de la estrategia (decide por `typeof valor ===
 * 'boolean'`), así que declarar acá alcanza, sin tocar el Panel.
 *
 * Un control declarado con `{ multiple: true }` (tagbox/multi-select, ej.
 * "Compañías permitidas" de Usuario) se marca `multivalor: true` — detectado
 * automáticamente de la MISMA declaración que ya usa `Form.setValor` para
 * operar el control, sin que el caso tenga que repetirlo. El Panel lo lee de
 * `SECCION_MULTIVALOR` y muestra el hint del separador "|" solo — ver
 * `registrarCaso`.
 *
 * @param caso        nombre descriptivo del caso
 * @param controles   mapa `label -> 'estrategia' | { estrategia, ... }` (ESTRATEGIAS del Page Object)
 * @param clavesExtra claves adicionales no derivadas del formulario
 * @returns {boolean} true si el archivo cambió
 */
function registrarCasoDesdeFormulario(caso, controles = {}, clavesExtra = []) {
  const claves = [
    ...clavesExtra,
    ...formInputModel.desdeControles(controles).map(({ label, estrategia, opciones }) => {
      if (estrategia === 'switch' || estrategia === 'checkbox') return { clave: label, vacio: false };
      if (opciones && opciones.multiple) return { clave: label, multivalor: true };
      return label;
    }),
  ];
  return registrarCaso(caso, claves);
}

module.exports = {
  CONTEXT_FILE,
  SECCION_GLOBAL,
  SECCION_MULTIVALOR,
  get,
  tiene,
  getCaso,
  getODescubrir,
  registrarCaso,
  registrarCasoDesdeFormulario,
  todo,
  recargar,
};
