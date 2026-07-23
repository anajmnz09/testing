// Barrel del framework core. Punto de entrada de conveniencia para los módulos:
//   const { createDriver, logger, wait } = require('@triple/core');
// También se pueden importar submódulos directamente cuando se prefiera:
//   const { waitForElementVisible } = require('@triple/core/utils/wait');
require('./utils/env'); // asegura la carga de .env apenas se importa el core

// Registro de componentes reutilizables (ver components/README.md): es la única
// fuente de verdad de qué componentes existen; este barrel los re-exporta.
const components = require('./components');

module.exports = {
  config: require('./config'),
  driver: require('./utils/driver'),
  wait: require('./utils/wait'),
  logger: require('./utils/logger'),
  evidence: require('./utils/evidence'),
  paths: require('./utils/paths'),
  executionContext: require('./utils/executionContext'),
  // política de ejecución (recuperación de estado, registro de bloqueos, reintentos)
  recovery: require('./utils/recovery'),
  problemLog: require('./utils/problemLog'),
  retry: require('./utils/retry'),
  // caché de metadata de pantallas (inspeccionar una vez, reutilizar siempre)
  screenMetadata: require('./utils/screenMetadata'),
  screenInspector: require('./utils/screenInspector'),
  // Execution Context: DATOS de prueba desacoplados de la lógica del test.
  // (distinto de utils/executionContext.js, que es la metadata del REPORTE)
  testContext: require('./context/testContext'),
  // resolución de archivos para cargas (Execution Context o fixture por defecto)
  testFiles: require('./utils/testFiles'),
  // Selection Strategies: cómo se opera cada tipo de control
  strategies: require('./strategies'),
  // bases de capas
  UiContext: require('./utils/UiContext'),
  BasePage: require('./pages/base/BasePage'),
  BaseComponent: components.BaseComponent,
  // páginas app-global (compartidas por todos los módulos)
  LoginPage: require('./pages/LoginPage'),
  DashboardPage: require('./pages/DashboardPage'),
  // componentes reutilizables (registro en components/index.js)
  NavBar: components.NavBar,
  DataGrid: components.DataGrid,
  Form: components.Form,
  Notify: components.Notify,
  // barra de acciones superior de las pantallas de detalle (`forms-header`)
  FormsHeader: components.FormsHeader,
  // diálogo/modal genérico y carga de archivos sin diálogo del SO
  Popup: components.Popup,
  FileUploader: components.FileUploader,
  // acceso al registro completo: const { components } = require('@triple/core')
  components,
  // flujos de negocio reutilizables
  authFlow: require('./flows/authFlow'),
  navigationFlow: require('./flows/navigationFlow'),
  // atajos de uso frecuente
  createDriver: require('./utils/driver').createDriver,
  quitDriver: require('./utils/driver').quitDriver,
  getCurrentDriver: require('./utils/driver').getCurrentDriver,
};
