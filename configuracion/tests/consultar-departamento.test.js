const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-departamento';
// Sin restricción real: en modo automático abre el PRIMER departamento del
// listado. Dirigible con "nombre" desde el Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de un Departamento ya existente, desde
 * Configuración > Administración > Departamentos. Si el listado está VACÍO,
 * el test termina sin fallar: no hay nada que consultar.
 */
describe('Configuración - Consultar Departamento', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoDepartamentos();

  it(`${CASO}: abre el detalle de un Departamento existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Departamentos está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: departamento elegido automáticamente -> "${nombreUsado}"`);
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
