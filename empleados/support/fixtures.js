const { createDriver, authFlow } = require('@triple/core');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const EmpleadosPage = require('../pages/EmpleadosPage');

/**
 * Fixtures compartidos por los casos del módulo (mismo patrón que
 * `reclutamiento/support/fixtures.js` / `configuracion/support/fixtures.js`):
 * el arranque común (crear driver, login, entrar al módulo, dejar el listado
 * en "Modo lista") vive acá una sola vez.
 */

/**
 * Registra el beforeEach estándar y devuelve un contexto que se completa
 * antes de cada test: `{ driver, lista }`, con `lista` = listado de
 * Empleados ya cargado en "Modo lista".
 */
function usarListadoEmpleados() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    await navigationFlow.abrirModulo(ctx.driver, 'Empleados');
    ctx.lista = await new EmpleadosPage(ctx.driver).listo();
  });
  return ctx;
}

module.exports = { usarListadoEmpleados };
