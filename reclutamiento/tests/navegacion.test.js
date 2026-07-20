const assert = require('assert');
// Archivo de test NUEVO: no requiere ningún cambio en el framework para
// funcionar (logging, screenshots, reporte e historial son automáticos).
// Demuestra la reutilización de los flows globales del core.
const { createDriver, authFlow, navigationFlow } = require('@triple/core');

describe('Navegación entre módulos', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
    await authFlow.login(driver);
  });

  it('debe abrir el módulo Reclutamiento y volver al dashboard', async function () {
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
    const dashboard = await navigationFlow.volverAlDashboard(driver);
    assert.strictEqual(await dashboard.isLoaded(), true);
  });
});
