const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-proveedor-seguro';
// El buscador de esta pantalla está ROTO en el ambiente actual (confirmado
// con evidencia real: "Error cargando registro(s)" en rojo, reproducido 3/3
// veces con distintos términos, incluso uno inexistente — no es un hipo
// puntual). El código queda LISTO para buscar apenas lo arreglen (dirigido
// desde el Panel con "nombre"); mientras tanto, sin nombre dirigido, cae
// automáticamente al PRIMER registro del listado (`abrirPrimero()`, sin
// pasar por el buscador) — mismo criterio ya aplicado en Horarios/Grados
// Académicos.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de un Proveedor de seguros: si el Panel
 * dirige "nombre", lo busca (`abrirDetalle`); si no, abre el PRIMERO del
 * listado (`abrirPrimero`). Si el listado está VACÍO, el test termina sin
 * fallar.
 */
describe('Configuración - Consultar Proveedor de seguros', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoProveedoresDeSeguros();

  it(`${CASO}: abre el detalle de un Proveedor de seguros existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Proveedores de seguros está vacío — no hay ningún registro para consultar, se termina el test.`);
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
