const assert = require('assert');
// authFlow encapsula login/logout (reutilizable por todos los módulos).
// LoginPage/DashboardPage vienen del core para los casos que prueban la pantalla directa.
const { createDriver, LoginPage, authFlow } = require('@triple/core');

// El cierre del driver, la captura de screenshots (según SCREENSHOT_MODE) y el
// logging de inicio/fin de cada test se manejan globalmente en el core
// (@triple/core/utils/mochaRootHooks.js) — no hace falta repetirlo aquí.
describe('Login', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it('debe iniciar sesión correctamente con credenciales válidas', async function () {
    const dashboard = await authFlow.login(driver); // usa credenciales del .env
    const usuario = await dashboard.getLoggedInUserName();
    assert.ok(usuario.length > 0, 'debería mostrar el usuario logueado en el navbar');
  });

  it('debe mostrar un error con credenciales inválidas', async function () {
    const loginPage = new LoginPage(driver);
    await loginPage.open();
    await loginPage.login('usuario_invalido', 'clave_invalida');

    const errorText = await loginPage.getErrorMessage();
    assert.ok(errorText.length > 0);
  });

  it('debe cerrar sesión y volver a la pantalla de login', async function () {
    await authFlow.login(driver);
    await authFlow.logout(driver);

    const loginPage = new LoginPage(driver);
    assert.strictEqual(await loginPage.isDisplayed(), true);
  });
});
