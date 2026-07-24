const assert = require('assert');
const { createDriver, authFlow, evidence } = require('@triple/core');
const problemLog = require('@triple/core/utils/problemLog');
const logger = require('@triple/core/utils/logger');
const testContext = require('@triple/core/context/testContext');
const requisicionesFlow = require('../flows/requisicionesFlow');

const CASO = 'compartir-requisicion-no-publicada';
const ESTADO_ORIGEN = 'Autorizada';

testContext.registrarCaso(CASO, ['estado']);

/**
 * compartir-requisicion-no-publicada — Validar que una requisición NO publicada
 * NO puede compartirse.
 *
 * Flujo: login → módulo → listado → primera "Autorizada" cuyo switch "Publicada"
 * esté APAGADO (si la primera ya está publicada, se sigue buscando; NO se publica
 * ninguna) → intentar Compartir.
 *
 * PASS si el sistema bloquea el compartir de CUALQUIERA de estas formas válidas:
 * botón deshabilitado, opción ausente, popup que no abre, o mensaje de que debe
 * estar publicada. FAIL SOLO si logra abrir el popup y copiar un enlace público.
 *
 * Reutiliza `buscarRequisicionPublicable` (que ya encuentra la primera con el
 * switch apagado) — no se duplica esa lógica.
 */
describe('Reclutamiento - Compartir Requisición No Publicada', function () {
  this.timeout(300000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: el sistema NO permite compartir una requisición no publicada`, async function () {
    // 1) Login + módulo + listado.
    await authFlow.login(driver);
    await requisicionesFlow.abrirListado(driver);

    const estado = testContext.get(CASO, 'estado') || ESTADO_ORIGEN;

    // 2) Buscar la primera "Autorizada" NO publicada (switch apagado). El flujo
    //    salta las ya publicadas y NO publica ninguna.
    const { detalle, total, revisadas } = await requisicionesFlow.buscarRequisicionPublicable(driver, {
      estado,
      maxRevisadas: 6,
    });
    if (!detalle) {
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: `encontrar una requisición "${estado}" NO publicada`,
        campo: 'Publicada',
        valor: `revisadas ${revisadas.length} de ${total}`,
      });
      assert.fail(
        `No se encontró ninguna requisición "${estado}" no publicada (revisadas ${revisadas.length} de ${total}).`
      );
    }

    const nombre = await detalle.getNombre();
    assert.ok(
      !(await detalle.estaPublicada()),
      `La requisición "${nombre}" resultó publicada; el caso requiere una NO publicada.`
    );

    // 3) Intentar compartir. El sistema NO debe permitirlo. Se usa una espera
    //    ACOTADA para el popup: no debe abrirse (no tiene sentido esperar el
    //    timeout completo).
    const estadoCompartir = await detalle.estadoCompartir();
    const abierto = await detalle.abrirCompartir(6000);
    const enlace = abierto ? await detalle.getEnlaceCompartido() : null;

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ nombre, estadoCompartir, popupAbierto: abierto, enlace }, null, 2),
      { label: 'compartir-no-publicada', encoding: 'utf8' }
    );

    // 4) FAIL inmediato solo si abrió el popup Y hay un enlace público copiable.
    if (abierto && enlace && /^https?:\/\//.test(enlace)) {
      await evidence.attachScreenshot(driver, this, { label: 'Popup Compartir abierto (NO debía)' });
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'FALLA DE SEGURIDAD: el sistema permitió compartir una requisición NO publicada',
        campo: 'Compartir',
        valor: `${nombre} -> ${enlace}`,
      });
      assert.fail(
        `FALLA DE SEGURIDAD: se pudo compartir/copiar el enlace público de la requisición NO publicada ` +
          `"${nombre}" (${enlace}).`
      );
    }

    // 5) Cualquier otro comportamiento (deshabilitado / popup no abre / mensaje) = PASS.
    logger.info(
      `compartir-no-publicada: bloqueo correcto en "${nombre}" ` +
        `(popupAbierto=${abierto}, habilitado=${estadoCompartir.habilitado}, tooltip="${estadoCompartir.tooltip}")`
    );
    await evidence.attachScreenshot(driver, this, { label: 'Compartir bloqueado (correcto)' });
    assert.ok(true, 'El sistema bloqueó el compartir de una requisición no publicada.');
  });
});
