// Barrel del framework core. Punto de entrada de conveniencia para los módulos:
//   const { createDriver, logger, wait } = require('@triple/core');
// También se pueden importar submódulos directamente cuando se prefiera:
//   const { waitForElementVisible } = require('@triple/core/utils/wait');
require('./utils/env'); // asegura la carga de .env apenas se importa el core

module.exports = {
  config: require('./config'),
  driver: require('./utils/driver'),
  wait: require('./utils/wait'),
  logger: require('./utils/logger'),
  evidence: require('./utils/evidence'),
  paths: require('./utils/paths'),
  executionContext: require('./utils/executionContext'),
  // bases de capas
  UiContext: require('./utils/UiContext'),
  BasePage: require('./pages/base/BasePage'),
  BaseComponent: require('./components/BaseComponent'),
  // páginas app-global (compartidas por todos los módulos)
  LoginPage: require('./pages/LoginPage'),
  DashboardPage: require('./pages/DashboardPage'),
  // componentes reutilizables
  NavBar: require('./components/NavBar'),
  DataGrid: require('./components/DataGrid'),
  // flujos de negocio reutilizables
  authFlow: require('./flows/authFlow'),
  navigationFlow: require('./flows/navigationFlow'),
  // atajos de uso frecuente
  createDriver: require('./utils/driver').createDriver,
  quitDriver: require('./utils/driver').quitDriver,
  getCurrentDriver: require('./utils/driver').getCurrentDriver,
};
