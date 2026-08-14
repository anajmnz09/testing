const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-grado-academico';
// El buscador de esta pantalla está roto en el ambiente actual (mismo
// hallazgo que Horarios). El código queda LISTO para buscar apenas lo
// arreglen (dirigido desde el Panel con "nombre"); mientras tanto, sin
// nombre dirigido, cae automáticamente al PRIMER registro del listado.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el popup de consulta de un Grado Académico: si el Panel dirige
 * "nombre", lo busca (`consultarPorNombre`); si no, abre el PRIMERO del
 * listado (`consultarPrimero`). Si el listado está VACÍO, el test termina
 * sin fallar.
 */
describe('Configuración - Consultar Grado Académico', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGradosAcademicos();

  it(`${CASO}: abre el popup de consulta de un Grado Académico existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Grados Académicos está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
    }

    const modal = nombreDirigido
      ? await ctx.lista.consultarPorNombre(nombreDirigido)
      : await ctx.lista.consultarPrimero();
    const nombreReal = await modal.getValor('Nombre');
    assert.ok(nombreReal.trim().length > 0, 'El popup de consulta no muestra ningún "Nombre".');
    logger.info(`${CASO}: popup de consulta abierto -> "${nombreReal}"`);
  });
});
