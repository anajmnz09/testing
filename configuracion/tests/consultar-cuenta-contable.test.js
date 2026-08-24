const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-cuenta-contable';
// El buscador rápido del listado de Cuentas Contables SOLO indexa
// "Descripción" (confirmado con evidencia real: buscar por el valor de "No.
// Cuenta Contable" da "no hay datos para mostrar" aunque la fila exista —
// ver `CuentaContableDetallePage`) — mismo efecto práctico que un buscador
// "roto" (Horarios/Grados Académicos/Proveedores de seguros), aunque acá la
// causa es que la columna simplemente no está indexada. Sin nombre dirigido,
// cae automáticamente al PRIMER registro del listado (`abrirPrimero()`, sin
// pasar por el buscador).
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Abre el detalle (modo consulta) de una Cuenta Contable: si el Panel dirige
 * "nombre", lo busca (`abrirDetalle`); si no, abre la PRIMERA del listado
 * (`abrirPrimero`). Si el listado está VACÍO, el test termina sin fallar.
 */
describe('Configuración - Consultar Cuenta Contable', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoCuentasContables();

  it(`${CASO}: abre el detalle de una Cuenta Contable existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');

    if (!nombreDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Cuentas Contables está vacío — no hay ningún registro para consultar, se termina el test.`);
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
