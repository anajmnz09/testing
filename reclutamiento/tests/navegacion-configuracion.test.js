const assert = require('assert');
// Test de FLUJO puro (igual criterio que navegacion.test.js): no registra
// caso en testContext ni entrada en organizacion-tests.js a propósito, así
// que no aparece agrupado en el árbol del Panel de Control.
const { createDriver, authFlow, navigationFlow } = require('@triple/core');

describe('Navegación a Configuraciones', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
    await authFlow.login(driver);
  });

  it('debe entrar a "Configuraciones" desde el ícono de configuración del navbar', async function () {
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    assert.strictEqual((await configuraciones.getTitulo()).trim(), 'Configuraciones');
  });
});
