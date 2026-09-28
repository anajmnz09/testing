const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-empleado';
// En modo automático (sin "nombre" dirigido desde el Panel) abre el PRIMER
// empleado del listado, en "Modo lista" (columna "Nombre").
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (panel lateral) de un Empleado ya existente, desde el
 * módulo Empleados > listado en "Modo lista". Si el listado está VACÍO, el test falla
 * explícitamente (Empleados es un catálogo persistente — ver el mensaje de
 * `assert.fail` más abajo para el detalle).
 */
describe('Empleados - Consultar Empleado', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: abre el detalle de un Empleado existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let detalle;

    if (nombreDirigido) {
      // El buscador global del grid reordena (pone el match primero), no
      // filtra ocultando el resto — ver `EmpleadosPage.abrirDetalle`.
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else {
      // Modo automático: SIEMPRE el primero que el listado muestre en ese
      // momento — nunca un nombre fijo/memorizado (los registros cambian
      // según la compañía activa, ver `EmpleadosPage.abrirPrimero`).
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

    const nombreReal = await detalle.getNombre();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Detalle abierto - "${nombreReal}"` });
    assert.ok(nombreReal.trim().length > 0, 'El detalle abierto no muestra ningún nombre de empleado.');
    logger.info(`${CASO}: detalle abierto -> "${nombreReal}"`);
  });
});
