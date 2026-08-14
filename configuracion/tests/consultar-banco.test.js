const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-banco';
// Sin restricción real: en modo automático abre el PRIMER banco del
// listado. Dirigible con "nombre" desde el Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de un Banco ya existente, desde
 * Configuración > Empleados > Bancos. Si el listado está VACÍO, el test
 * termina sin fallar.
 */
describe('Configuración - Consultar Banco', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancos();

  it(`${CASO}: abre el detalle de un Banco existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Bancos está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: banco elegido automáticamente -> "${nombreUsado}"`);
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
