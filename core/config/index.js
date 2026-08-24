require('../utils/env'); // carga jerárquica de .env (módulo + global)

const VALID_SCREENSHOT_MODES = ['none', 'fail', 'all', 'steps'];

function parseBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

function parseIntEnv(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseScreenshotMode(value) {
  return VALID_SCREENSHOT_MODES.includes(value) ? value : 'fail';
}

// Configuración del FRAMEWORK (comportamiento). Credenciales, URLs y datos
// sensibles NO viven aquí: permanecen únicamente en process.env / .env y se
// leen directamente donde se necesiten (ver README, sección "Configuración").
const config = {
  browser: {
    name: process.env.BROWSER || 'chrome',
    headless: parseBool(process.env.HEADLESS, false),
  },
  timeouts: {
    explicitWaitMs: parseIntEnv(process.env.DEFAULT_TIMEOUT, 10000),
    testTimeoutMs: parseIntEnv(process.env.TEST_TIMEOUT, 30000),
  },
  screenshot: {
    mode: parseScreenshotMode(process.env.SCREENSHOT_MODE),
  },
  reports: {
    keep: parseIntEnv(process.env.KEEP_REPORTS, 20),
  },
  reporter: process.env.REPORTER || 'mochawesome',
  retries: parseIntEnv(process.env.TEST_RETRIES, 0),
  // Ruido AMBIENTAL conocido del ambiente QA compartido: el toast "Generación
  // de nómina" (proceso de OTRO usuario/sesión, ver `Notify.js#getTexto`) usa
  // la MISMA clase `notify_record` que el toast real de la app y se ignora
  // por defecto para que nunca se confunda con el resultado de una acción.
  // Excepción GENERAL (no hardcodeada por test): `IGNORAR_TOAST_NOMINA=false`
  // en `.env` desactiva el filtro — usarlo solo cuando se esté probando la
  // propia feature de "Generación de Nómina" y haga falta leer ESE toast
  // como notify real.
  ruido: {
    ignorarToastNomina: parseBool(process.env.IGNORAR_TOAST_NOMINA, true),
  },
  // Panel: si está encendido, el navegador NO se cierra al terminar una
  // prueba (`mochaRootHooks.js#afterEach`) — para inspeccionar el estado
  // final a mano. Administrado desde la pantalla "Configuración" del Panel.
  panel: {
    mantenerNavegadorAbierto: parseBool(process.env.KEEP_BROWSER_OPEN, false),
  },
};

module.exports = Object.freeze({
  browser: Object.freeze(config.browser),
  timeouts: Object.freeze(config.timeouts),
  screenshot: Object.freeze(config.screenshot),
  reports: Object.freeze(config.reports),
  reporter: config.reporter,
  retries: config.retries,
  ruido: Object.freeze(config.ruido),
  panel: Object.freeze(config.panel),
});
