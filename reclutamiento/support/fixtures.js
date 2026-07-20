const { createDriver, authFlow, navigationFlow } = require('@triple/core');
const RequisicionesPage = require('../pages/RequisicionesPage');

/**
 * Fixtures compartidos por los casos del módulo.
 *
 * Al pasar a "un caso = un archivo", el arranque común (crear driver, login,
 * entrar al módulo, dejar el listado cargado) se repetiría en cada archivo. Vive
 * acá una sola vez: cada test lo invoca y recibe un contexto vivo.
 */

/**
 * Registra el beforeEach estándar y devuelve un contexto que se completa antes
 * de cada test: `{ driver, lista }`.
 *
 * Se usa dentro de un describe():
 *   const ctx = fixtures.usarListadoRequisiciones();
 *   it('...', async function () { await ctx.lista.abrirFormularioCrear(); });
 */
function usarListadoRequisiciones() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    await navigationFlow.abrirModulo(ctx.driver, 'Reclutamiento');
    ctx.lista = await new RequisicionesPage(ctx.driver).listo();
  });
  return ctx;
}

/**
 * Colector de errores JS de la página. Útil en cualquier caso que necesite
 * detectar que la aplicación se rompió del lado del cliente.
 */
async function iniciarColectorErroresJs(driver) {
  await driver.executeScript(
    'window.__qaErrors=[];window.addEventListener("error",function(e){window.__qaErrors.push(String(e.message))});'
  );
}

async function erroresJs(driver) {
  return driver.executeScript('return window.__qaErrors || []');
}

module.exports = { usarListadoRequisiciones, iniciarColectorErroresJs, erroresJs };
