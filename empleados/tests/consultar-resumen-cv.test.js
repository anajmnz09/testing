const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-resumen-cv';
// En modo automático (sin "nombre" dirigido desde el Panel) abre el PRIMER
// empleado del listado, en "Modo lista" (columna "Nombre") — mismo criterio
// que `consultar-empleado`.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle de un Empleado ya existente y navega a la sección
 * "Resumen/CV" del sidemenu (ver `EmpleadoDetallePage.SECCIONES`/
 * `abrirSeccion`) — sin entrar a "Editar", modo SOLO CONSULTA. Confirma que
 * la sección quedó marcada como activa (`is_current`) y adjunta una
 * captura de pantalla justo en ese momento — evidencia visual real de qué
 * había en pantalla al validar, no solo el resultado del assert (incidente
 * 2026-09-02: un listado vacío hacía que el test terminara antes de este
 * punto sin ninguna captura que lo delatara). Si el listado está VACÍO, el test falla
 * explícitamente (Empleados es un catálogo persistente — ver el mensaje de
 * `assert.fail` más abajo para el detalle).
 */
describe('Empleados - Consultar Resumen/CV', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: abre la sección "Resumen/CV" del detalle de un Empleado existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let detalle;

    if (nombreDirigido) {
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro. Puede deberse a una compañía ` +
            `nueva sin datos semilla (seed) o a un problema del API/entorno — no se trata como ` +
            `"sin datos, se omite": es una precondición del escenario que no se cumplió.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
    }

    const res = await detalle.abrirSeccion('Resumen/CV');
    await evidence.attachScreenshot(ctx.driver, this, { label: `Sección "Resumen/CV" tras navegar` });
    assert.ok(res.activada, `La sección "Resumen/CV" no quedó activa tras navegar (empleado: "${nombreDirigido || '(automático)'}").`);
    logger.info(`${CASO}: sección "Resumen/CV" abierta y confirmada activa`);
  });
});
