const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-razon-salida';
// Sin restricción real: en modo automático abre la PRIMERA razón de salida
// del listado. Dirigible con "nombre" desde el Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de una Razón de Salida ya existente, desde
 * Configuración > Empleados > Razones de Salidas. Si el listado está VACÍO,
 * el test termina sin fallar.
 */
describe('Configuración - Consultar Razón de Salida', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRazonesDeSalidas();

  it(`${CASO}: abre el detalle de una Razón de Salida existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Razones de Salidas está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Razón'];
      logger.info(`${CASO}: razón de salida elegida automáticamente -> "${nombreUsado}"`);
    }

    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    const nombreReal = await detalle.getNombre();
    assert.ok(
      nombreReal.trim().length > 0,
      `El detalle abierto para "${nombreUsado}" no muestra ningún nombre de registro.`
    );
    logger.info(`${CASO}: detalle abierto -> "${nombreReal}"`);
  });
});
