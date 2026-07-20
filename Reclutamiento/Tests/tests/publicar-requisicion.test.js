const assert = require('assert');
const { createDriver, authFlow, evidence } = require('@triple/core');
const problemLog = require('@triple/core/utils/problemLog');
const testContext = require('@triple/core/context/testContext');
const requisicionesFlow = require('../flows/requisicionesFlow');

const CASO = 'publicar-requisicion';

// Deja la sección del caso en el Execution Context (vacía) para que el usuario
// pueda dirigir la prueba si quiere. Si queda vacía, el test se comporta igual
// que antes: descubre la requisición automáticamente.
testContext.registrarCaso(CASO, ['nombreRequisicion', 'estado']);

/**
 * publicar-requisicion — Publicar una requisición.
 *
 * El test es DELGADO a propósito: el login y la navegación vienen de los flows
 * del core (authFlow / navigationFlow), la búsqueda y el retorno al listado del
 * flow del módulo (requisicionesFlow), y la mecánica del switch del Page Object
 * (RequisicionDetallePage). Aquí solo quedan los asserts del caso.
 *
 * La recuperación de estado y el registro de bloqueos ante un fallo los aplica
 * automáticamente la política global del framework (mochaRootHooks).
 */
describe('Reclutamiento - Publicar Requisición', function () {
  this.timeout(300000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: publica una requisición autorizada y valida el switch y el notify`, async function () {
    // 1) Login + módulo + listado (flows existentes, sin replicar lógica).
    await authFlow.login(driver);
    await requisicionesFlow.abrirListado(driver);

    // 2) Buscar la primera "Autorizada" con el switch apagado. Si alguna ya está
    //    publicada, el flow vuelve al listado por el menú del módulo (sin
    //    re-login ni reinicio del flujo) y sigue con la siguiente. Búsqueda acotada.
    //    Los datos NO están hardcodeados: salen del Execution Context. Si están
    //    vacíos, `undefined` hace que el flow use su descubrimiento automático.
    const { detalle, dirigido, yaPublicada, indice, revisadas, total } =
      await requisicionesFlow.buscarRequisicionPublicable(driver, {
        estado: testContext.get(CASO, 'estado') || 'Autorizada',
        nombreRequisicion: testContext.get(CASO, 'nombreRequisicion'),
        maxRevisadas: 5,
      });

    // Si el usuario dirigió la prueba a una requisición concreta y esa ya está
    // publicada, NO se busca otra: se falla indicando el dato exacto pedido.
    if (dirigido && yaPublicada) {
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'publicar la requisición indicada en el Execution Context',
        campo: 'Publicada',
        valor: testContext.get(CASO, 'nombreRequisicion'),
      });
      assert.fail(
        `La requisición "${testContext.get(CASO, 'nombreRequisicion')}" indicada en el ` +
          `Execution Context ya está publicada; no se puede ejecutar la publicación.`
      );
    }

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ totalAutorizadas: total, revisadas }, null, 2),
      { label: 'requisiciones-revisadas', encoding: 'utf8' }
    );

    if (!detalle) {
      // No es un fallo de la app: no había ninguna requisición publicable.
      // Se registra con contexto suficiente y se marca el caso como fallido
      // porque no se pudo ejecutar la validación pedida.
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'buscar una requisición Autorizada con el switch "Publicada" apagado',
        campo: 'Publicada',
        valor: `revisadas=${revisadas.length} de ${total} autorizadas`,
      });
      assert.fail(
        `No se encontró ninguna requisición "Autorizada" con el switch apagado ` +
          `(revisadas ${revisadas.length} de ${total}).`
      );
    }

    // 3) Publicar.
    const resultado = await detalle.publicar();
    await evidence.attachScreenshot(driver, this, { label: 'Tras activar Publicada' });

    // 4) Validaciones del caso: el switch queda encendido Y aparece el notify de éxito.
    const switchEncendido = await detalle.publicadaConfirmada();

    assert.ok(
      switchEncendido,
      `El switch "Publicada" no quedó activado tras publicar (índice ${indice}). Notify: "${resultado.notify}"`
    );
    assert.ok(
      resultado.exito,
      `No apareció el Notify de éxito al publicar. Notify recibido: "${resultado.notify}"`
    );
  });
});
