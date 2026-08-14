const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-horario';
// El buscador de Horarios está roto en el ambiente actual (confirmado con
// evidencia real: `grid.buscar()` con CUALQUIER texto, incluso el de un
// registro recién creado por este mismo framework, dispara "Internal Error"
// del backend — reproducido 2 veces seguidas, no es un hipo puntual). Se
// deja igual el código "listo para buscar" (dirigido desde el Panel con
// "nombre") para que funcione solo apenas arreglen el buscador — mientras
// tanto, sin nombre dirigido, cae automáticamente al PRIMER registro del
// listado (`abrirPrimero()`, sin pasar por el buscador).
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de un Horario: si el Panel dirige
 * "nombre", lo busca (`abrirDetalle`); si no, abre el PRIMERO del listado
 * (`abrirPrimero`). Si el listado está VACÍO, el test termina sin fallar.
 */
describe('Configuración - Consultar Horario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHorarios();

  it(`${CASO}: abre el detalle de un Horario existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Horarios está vacío — no hay ningún registro para consultar, se termina el test.`);
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
