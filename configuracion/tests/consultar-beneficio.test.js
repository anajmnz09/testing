const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-beneficio';
// Sin restricción real: en modo automático abre el PRIMER beneficio del
// listado. Dirigible con "nombre" desde el Panel (el buscador de este
// listado FUNCIONA).
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de un Beneficio ya existente, desde
 * Configuración > Administración > Beneficios. Si el listado está VACÍO, el
 * test termina sin fallar: no hay nada que consultar.
 */
describe('Configuración - Consultar Beneficio', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBeneficios();

  it(`${CASO}: abre el detalle de un Beneficio existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Beneficios está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: beneficio elegido automáticamente -> "${nombreUsado}"`);
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
