const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-categoria-actividad';
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de una Categoría de actividad ya
 * existente. Si el Panel dirige "nombre", la busca (`abrirDetalle`); si no,
 * abre la PRIMERA del listado (`abrirPrimero`). Si el listado está VACÍO,
 * el test termina sin fallar.
 */
describe('Configuración - Consultar Categoría de Actividad', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoCategoriaActividades();

  it(`${CASO}: abre el detalle de una Categoría de actividad existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Categoría Actividades está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
    }

    const detalle = nombreDirigido
      ? await ctx.lista.abrirDetalle(nombreDirigido)
      : await ctx.lista.abrirPrimero();
    const nombreReal = await detalle.getNombre();
    assert.ok(
      nombreReal.trim().length > 0,
      'El detalle abierto no muestra ningún nombre de registro.'
    );
    logger.info(`${CASO}: detalle abierto -> "${nombreReal}"`);
  });
});
