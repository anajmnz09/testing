const assert = require('assert');
const { By } = require('selenium-webdriver');
const { testContext, evidence } = require('@triple/core');
const config = require('@triple/core/config');
const fixtures = require('../support/fixtures');

// "Banco de candidatos" usa una barra de título distinta ("SrhhGenericBar")
// a la de las pantallas de Requisiciones/Solicitudes (donde sí aplica el
// XPath absoluto documentado como evidencia oficial en `SRHHNavBar` — ese
// mecanismo es deliberadamente específico a esas pantallas, no se reutiliza
// acá). Verificado en el DOM real: `[class*="SrhhGenericBar_title"]`.
async function tituloBancoElegibles(driver, timeout = config.timeouts.explicitWaitMs) {
  let texto = null;
  await driver
    .wait(async () => {
      const els = await driver.findElements(By.css('[class*="SrhhGenericBar_title"]'));
      for (const el of els) {
        try {
          if (await el.isDisplayed()) {
            texto = (await el.getText()).trim();
            return true;
          }
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout)
    .catch(() => {});
  return texto;
}

const CASO = 'consultar-banco-elegibles-desde-requisicion';
// Entrada (Execution Context): requisición a consultar. Igual que
// "consultar-solicitudes-desde-requisicion" (mismo fixture compartido, sin
// duplicar esa lógica): sin `codigo`/`nombre`, usa el fallback ya existente
// en `fixtures.abrirRequisicionExistente` (primera requisición en un estado
// editable).
testContext.registrarCaso(CASO, ['codigo', 'nombre', 'estado']);

/**
 * Desde el DETALLE de una requisición, clickea "B. Elegibles" en el header
 * (RequisicionDetallePage.irABancoElegibles) y valida que aterriza en la
 * pantalla "Banco de candidatos" (título REAL de destino, leído de su barra
 * de título). Evidencia del caso: captura de pantalla de la pantalla ya
 * cargada.
 */
describe('Reclutamiento - Consultar Banco de Elegibles desde una Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: abre "Banco de candidatos" desde el header de la requisición`, async function () {
    const { detalle } = await fixtures.abrirRequisicionExistente(ctx, CASO);

    await detalle.irABancoElegibles();

    const titulo = await tituloBancoElegibles(ctx.driver);
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Banco de candidatos' });

    assert.strictEqual(
      titulo,
      'Banco de candidatos',
      `Se esperaba llegar a la pantalla "Banco de candidatos" tras clickear "B. Elegibles" (título leído: "${titulo}").`
    );
  });
});
