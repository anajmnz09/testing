const assert = require('assert');
// El test describe el flujo de negocio; la mecánica del grid vive en
// RequisicionesPage (módulo) + DataGrid (core). Sin locators acá.
const { createDriver, authFlow, navigationFlow } = require('@triple/core');
const RequisicionesPage = require('../pages/RequisicionesPage');

describe('Reclutamiento - Requisiciones', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
  });

  it('debe filtrar una requisición por código', async function () {
    const requisiciones = await new RequisicionesPage(driver).listo();
    await requisiciones.buscarRequisicion('1090');

    assert.strictEqual(await requisiciones.existeRequisicion('1090'), true);
    assert.strictEqual(await requisiciones.contarRequisiciones(), 1);
  });

  it('debe reportar el resumen de paginación del listado', async function () {
    const requisiciones = await new RequisicionesPage(driver).listo();

    assert.match(await requisiciones.getResumenPaginacion(), /Registros/);
  });
});
