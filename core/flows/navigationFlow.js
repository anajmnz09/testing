const DashboardPage = require('../pages/DashboardPage');
const ConfiguracionesPage = require('../pages/ConfiguracionesPage');
const SRHHNavBar = require('../components/SRHHNavBar');
const logger = require('../utils/logger');

/**
 * Flujos de navegación reutilizables: moverse entre el dashboard y los módulos.
 * Como authFlow, no contiene locators; compone Page Objects y Componentes.
 */

/**
 * Abre un módulo desde el dashboard.
 * @param nombre Texto de la tarjeta (ej. 'Reclutamiento', 'Empleados', 'Vacantes').
 */
async function abrirModulo(driver, nombre) {
  logger.info(`navigationFlow: abrir módulo "${nombre}"`);
  const dashboard = new DashboardPage(driver);
  await dashboard.abrirModulo(nombre);
}

/**
 * Vuelve al dashboard (logo del navbar) y lo deja cargado.
 * @returns {DashboardPage} el dashboard ya cargado.
 */
async function volverAlDashboard(driver) {
  logger.info('navigationFlow: volver al dashboard');
  const navbar = new SRHHNavBar(driver);
  await navbar.irAlDashboard();

  const dashboard = new DashboardPage(driver);
  await dashboard.isLoaded();
  return dashboard;
}

/**
 * Entra a "Configuraciones" desde CUALQUIER pantalla (el ícono de
 * configuración está siempre presente en el navbar, `navConfigItems`): abre
 * su dropdown y elige la opción "Configuraciones" (distinta de "Acerca de",
 * la otra opción del mismo dropdown — se reutiliza
 * `SRHHNavBar.abrirOpcionConfiguracion`, sin lógica propia acá).
 * @returns {ConfiguracionesPage} la pantalla ya cargada.
 */
async function abrirConfiguracion(driver) {
  logger.info('navigationFlow: entrar a Configuraciones');
  const navbar = new SRHHNavBar(driver);
  await navbar.abrirOpcionConfiguracion('Configuraciones');

  const configuraciones = new ConfiguracionesPage(driver);
  await configuraciones.estaCargado();
  return configuraciones;
}

module.exports = { abrirModulo, volverAlDashboard, abrirConfiguracion };
