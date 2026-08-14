const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-habilidad';
// El buscador de esta pantalla está roto en el ambiente actual (a pedido
// explícito: se codea LISTO para buscar apenas lo arreglen, dirigido desde
// el Panel con "nombre"); mientras tanto, sin nombre dirigido, cae
// automáticamente al PRIMER registro del listado.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el popup de consulta de una Habilidad: si el Panel dirige "nombre",
 * la busca (`consultarPorNombre`); si no, abre la PRIMERA del listado
 * (`consultarPrimero`). Si el listado está VACÍO, el test termina sin fallar.
 */
describe('Configuración - Consultar Habilidad', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHabilidades();

  it(`${CASO}: abre el popup de consulta de una Habilidad existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Habilidades está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
    }

    const modal = nombreDirigido
      ? await ctx.lista.consultarPorNombre(nombreDirigido)
      : await ctx.lista.consultarPrimero();
    const nombreReal = await modal.getValor('Habilidad');
    assert.ok(nombreReal.trim().length > 0, 'El popup de consulta no muestra ninguna "Habilidad".');
    logger.info(`${CASO}: popup de consulta abierto -> "${nombreReal}"`);
  });
});
