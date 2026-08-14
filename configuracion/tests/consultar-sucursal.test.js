const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-sucursal';
// Sin restricción real: en modo automático abre la PRIMERA sucursal del
// listado. Dirigible con "nombre" desde el Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de una Sucursal ya existente, desde
 * Configuración > Administración > Sucursales. Si el listado está VACÍO
 * (sin sucursales creadas todavía), el test termina sin fallar: no hay nada
 * que consultar.
 */
describe('Configuración - Consultar Sucursal', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSucursales();

  it(`${CASO}: abre el detalle de una Sucursal existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Sucursales está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Sucursal'];
      logger.info(`${CASO}: sucursal elegida automáticamente -> "${nombreUsado}"`);
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
