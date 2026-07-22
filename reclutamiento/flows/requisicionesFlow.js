const { navigationFlow } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const screenInspector = require('@triple/core/utils/screenInspector');
const RequisicionesPage = require('../pages/RequisicionesPage');

/**
 * Flujos de negocio REUTILIZABLES del módulo Reclutamiento / Requisiciones.
 *
 * Mismo criterio que los flows del core (authFlow, navigationFlow): orquestan
 * pasos que cruzan pantallas y se repiten en varios tests, componiendo Page
 * Objects. No contienen locators ni asserts — los asserts quedan en el test.
 *
 * Vive en el módulo (no en el core) porque es lógica de negocio de
 * Reclutamiento; el core solo aloja lo que sirve a TODA la app.
 */

/**
 * Deja el listado de Requisiciones abierto y CON DATOS.
 * Reutiliza navigationFlow del core (no replica navegación) y captura la
 * metadata de la pantalla si aún no estaba cacheada (sin costo si ya existe).
 */
async function abrirListado(driver) {
  await navigationFlow.abrirModulo(driver, 'Reclutamiento');
  const listado = await new RequisicionesPage(driver).listo();
  await listado.esperarFilas();
  await screenInspector.inspeccionarYGuardar(driver, 'requisiciones-listado');
  return listado;
}

/**
 * Vuelve al LISTADO de Requisiciones desde cualquier pantalla del módulo,
 * usando el menú del módulo: es el flujo normal del usuario, sin re-login ni
 * reingreso al módulo. Deja el listado con filas cargadas.
 *
 * Estaba embebido dentro del recorrido de `buscarRequisicionPublicable`; se
 * extrajo para que cualquier caso pueda reutilizarlo (el original lo sigue
 * usando a través de esta misma función).
 */
async function volverAlListado(driver) {
  const listado = new RequisicionesPage(driver);
  await listado.volverAlListado();
  await listado.esperarFilas();
  logger.info('requisicionesFlow: de vuelta en el listado de Requisiciones');
  return listado;
}

/**
 * RECORRIDO GENÉRICO del listado: abre requisiciones con un `estado` dado hasta
 * encontrar una que cumpla el criterio `esApta`, y devuelve su detalle abierto.
 *
 * Es el motor que comparten todos los casos que necesitan "una requisición en
 * tal estado" (publicar, pausar, y los que vengan). Lo que cambia entre casos es
 * SOLO el criterio de aptitud, que se inyecta.
 *
 * Comportamiento según la política de ejecución del framework:
 *  - Si la requisición abierta no sirve, NO reinicia el flujo ni vuelve a
 *    loguearse: regresa al listado por el menú del módulo y sigue con la
 *    siguiente.
 *  - El recorrido es ACOTADO por `maxRevisadas` (sin ciclos infinitos).
 *  - Si el Execution Context indicó una requisición concreta (`nombreRequisicion`,
 *    que puede ser también un id/código), se va derecho a esa y NO se busca otra.
 *
 * @param {object}   opts.esApta  async (detalle) => boolean. Por defecto, la
 *                                primera requisición del estado ya es apta.
 * @returns {Promise<{detalle:object|null, dirigido:boolean, apta:boolean,
 *                    indice:number, revisadas:Array, total:number}>}
 */
async function buscarRequisicionConEstado(
  driver,
  { estado = 'Autorizada', maxRevisadas = 5, nombreRequisicion, esApta } = {}
) {
  const listado = new RequisicionesPage(driver);
  const evaluar = typeof esApta === 'function' ? esApta : async () => true;

  // --- Modo DIRIGIDO: el Execution Context indicó una requisición concreta ---
  if (nombreRequisicion) {
    logger.info(`requisicionesFlow: modo dirigido por contexto -> "${nombreRequisicion}"`);
    const detalle = await listado.abrirDetalle(nombreRequisicion); // filtra + doble-click (ya existía)
    await screenInspector.inspeccionarYGuardar(driver, 'requisiciones-detalle');
    const apta = await evaluar(detalle);
    return {
      detalle,
      dirigido: true,
      nombreRequisicion,
      apta,
      indice: 0,
      revisadas: [{ indice: 0, datos: [nombreRequisicion], apta }],
      total: 1,
    };
  }

  // --- Modo AUTOMÁTICO ---
  const total = await listado.contarConEstado(estado);
  const revisadas = [];
  const limite = Math.min(maxRevisadas, total);

  logger.info(`requisicionesFlow: ${total} requisición(es) con estado "${estado}"; se revisarán hasta ${limite}`);

  for (let i = 0; i < limite; i++) {
    const datos = await listado.datosDeFilaConEstado(estado, i);
    const detalle = await listado.abrirPorEstado(estado, i);
    if (!detalle) break;

    // primera vez que se abre un detalle: cachear su metadata para futuras pruebas
    await screenInspector.inspeccionarYGuardar(driver, 'requisiciones-detalle');

    const apta = await evaluar(detalle);
    revisadas.push({ indice: i, datos, apta });

    if (apta) {
      logger.info(`requisicionesFlow: requisición apta encontrada (índice ${i})`);
      return { detalle, dirigido: false, apta: true, indice: i, datos, revisadas, total };
    }

    logger.info(`requisicionesFlow: índice ${i} no cumple el criterio; volviendo al listado`);
    await volverAlListado(driver); // menú del módulo: flujo normal, sin re-login
  }

  return { detalle: null, dirigido: false, apta: false, indice: -1, revisadas, total };
}

/**
 * Busca la primera requisición con `estado` cuyo switch "Publicada" esté
 * APAGADO, es decir, publicable.
 *
 * Se mantiene con la MISMA firma y el MISMO objeto de retorno de siempre
 * (`yaPublicada`, `revisadas[].yaPublicada`); por dentro delega el recorrido en
 * `buscarRequisicionConEstado` para no duplicar la lógica de navegación.
 *
 * @returns {Promise<{detalle:object|null, yaPublicada:boolean, indice:number, revisadas:Array, total:number}>}
 */
async function buscarRequisicionPublicable(
  driver,
  { estado = 'Autorizada', maxRevisadas = 5, nombreRequisicion } = {}
) {
  const resultado = await buscarRequisicionConEstado(driver, {
    estado,
    maxRevisadas,
    nombreRequisicion,
    esApta: async (detalle) => !(await detalle.estaPublicada()),
  });

  return {
    ...resultado,
    yaPublicada: !resultado.apta,
    revisadas: resultado.revisadas.map(({ indice, datos, apta }) => ({
      indice,
      datos,
      yaPublicada: !apta,
    })),
  };
}

/**
 * Abre la PRIMERA requisición con `estado` (por defecto "Autorizada") y espera a
 * que su detalle termine de cargar. No filtra por ningún criterio adicional: si
 * la primera no sirve para el caso, el test debe fallar con un mensaje claro en
 * vez de disimularlo abriendo otra.
 */
async function abrirPrimeraRequisicionConEstado(driver, opciones = {}) {
  return buscarRequisicionConEstado(driver, {
    ...opciones,
    maxRevisadas: 1,
    esApta: async (detalle) => {
      await detalle.esperarCargaCompleta();
      return true;
    },
  });
}

module.exports = {
  abrirListado,
  volverAlListado,
  buscarRequisicionConEstado,
  buscarRequisicionPublicable,
  abrirPrimeraRequisicionConEstado,
};
