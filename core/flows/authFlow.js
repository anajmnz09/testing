require('../utils/env'); // asegura credenciales/URL cargadas
const LoginPage = require('../pages/LoginPage');
const DashboardPage = require('../pages/DashboardPage');
const SRHHNavBar = require('../components/SRHHNavBar');
const logger = require('../utils/logger');

/**
 * Flujos de autenticación reutilizables por TODOS los módulos.
 *
 * Un flow orquesta pasos que cruzan varias pantallas y se repiten en muchos
 * tests (login, logout). No contiene locators: compone Page Objects y
 * Componentes del core. Si el login cambia, se arregla acá una sola vez y
 * todos los tests de todos los módulos siguen funcionando.
 */

/**
 * Inicia sesión y deja el dashboard cargado.
 * Por defecto usa las credenciales del .env (APP_USERNAME / PASSWORD).
 * @returns {DashboardPage} el dashboard ya cargado.
 */
async function login(
  driver,
  { username = process.env.APP_USERNAME, password = process.env.PASSWORD } = {}
) {
  logger.info(`authFlow: login como "${username}"`);
  const loginPage = new LoginPage(driver);
  await loginPage.open();
  await loginPage.login(username, password);

  const dashboard = new DashboardPage(driver);
  await dashboard.isLoaded();
  return dashboard;
}

/** Cierra la sesión desde el navbar. */
async function logout(driver) {
  logger.info('authFlow: logout');
  const navbar = new SRHHNavBar(driver);
  await navbar.logout();
}

module.exports = { login, logout };
