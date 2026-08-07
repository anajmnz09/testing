const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-solicitudes-desde-requisicion';
// Entrada (Execution Context): requisición a consultar. Si no se indica, usa el
// mismo fallback ya existente en `fixtures.abrirRequisicionExistente` (primera
// requisición en un estado editable) — no se duplica esa lógica acá.
testContext.registrarCaso(CASO, ['codigo', 'nombre', 'estado']);

/**
 * Desde el DETALLE de una requisición, clickea "Solicitudes de Empleo" en el
 * header (RequisicionDetallePage.irASolicitudesDeEmpleo) y valida que aterriza
 * en el listado de Solicitudes de Empleo YA FILTRADO por esa requisición — el
 * filtrado lo aplica la app al navegar, el test solo lo comprueba.
 *
 * Que la requisición no tenga solicitudes NO es un error (nadie aplicó
 * todavía): en ese caso solo se confirma que el listado cargó (0 filas), sin
 * exigir ninguna fila.
 */
describe('Reclutamiento - Consultar Solicitudes de Empleo desde una Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: abre el listado de Solicitudes de Empleo filtrado desde el header de la requisición`, async function () {
    const { detalle, identificador } = await fixtures.abrirRequisicionExistente(ctx, CASO);

    const solicitudes = await detalle.irASolicitudesDeEmpleo();
    const filas = await solicitudes.grid.contarFilas();

    if (filas === 0) {
      logger.info(`${CASO}: "${identificador}" no tiene solicitudes de empleo (nadie aplicó todavía)`);
      return;
    }

    const filtrado = await solicitudes.grid.existeFila(identificador);
    assert.ok(
      filtrado,
      `El listado de Solicitudes de Empleo no aparenta estar filtrado por "${identificador}" ` +
        `(${filas} fila(s), ninguna la menciona).`
    );
  });
});
