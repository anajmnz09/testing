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
 * Busca la primera requisición con `estado` cuyo switch "Publicada" esté
 * APAGADO, es decir, publicable.
 *
 * Comportamiento según la política de ejecución del framework:
 *  - Si la requisición abierta ya está publicada, NO reinicia el flujo ni
 *    vuelve a loguearse: regresa al listado por el menú del módulo (flujo normal
 *    del usuario) y sigue con la siguiente.
 *  - El recorrido es ACOTADO por `maxRevisadas` (sin ciclos infinitos).
 *
 * @returns {Promise<{detalle:object|null, indice:number, revisadas:Array, total:number}>}
 *          `detalle` es la RequisicionDetallePage lista para publicar, o null si
 *          no se encontró ninguna publicable dentro del límite.
 */
async function buscarRequisicionPublicable(
  driver,
  { estado = 'Autorizada', maxRevisadas = 5, nombreRequisicion } = {}
) {
  const listado = new RequisicionesPage(driver);

  // --- Modo DIRIGIDO: el Execution Context indicó una requisición concreta ---
  // Se va derecho a esa y NO se busca ninguna otra: el usuario pidió ese dato.
  if (nombreRequisicion) {
    logger.info(`requisicionesFlow: modo dirigido por contexto -> "${nombreRequisicion}"`);
    const detalle = await listado.abrirDetalle(nombreRequisicion); // filtra + doble-click (ya existía)
    await screenInspector.inspeccionarYGuardar(driver, 'requisiciones-detalle');
    const yaPublicada = await detalle.estaPublicada();
    return {
      detalle,
      dirigido: true,
      nombreRequisicion,
      yaPublicada,
      indice: 0,
      revisadas: [{ indice: 0, datos: [nombreRequisicion], yaPublicada }],
      total: 1,
    };
  }

  // --- Modo AUTOMÁTICO: comportamiento actual, sin cambios ---
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

    const publicada = await detalle.estaPublicada();
    revisadas.push({ indice: i, datos, yaPublicada: publicada });

    if (!publicada) {
      logger.info(`requisicionesFlow: requisición publicable encontrada (índice ${i})`);
      return { detalle, indice: i, revisadas, total };
    }

    logger.info(`requisicionesFlow: índice ${i} ya está publicada; volviendo al listado`);
    await listado.volverAlListado(); // menú del módulo: flujo normal, sin re-login
    await listado.esperarFilas();
  }

  return { detalle: null, dirigido: false, indice: -1, revisadas, total };
}

module.exports = { abrirListado, buscarRequisicionPublicable };
