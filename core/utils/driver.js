const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('./env'); // carga jerárquica de .env (módulo + global)
const config = require('../config');
const chromeProfiles = require('./chromeProfiles');

// Referencia al driver activo, para que utilidades globales (ej. los root hooks
// de Mocha en utils/mochaRootHooks.js) puedan capturar screenshots o cerrar la
// sesión sin que cada archivo de test tenga que exponer su propia variable.
// Mocha corre las pruebas de forma serial por defecto, así que un único driver
// "actual" a la vez es una suposición segura (no se soporta --parallel).
let currentDriver = null;

async function createDriver() {
  // Barre perfiles temporales huérfanos de corridas anteriores (best-effort):
  // así la basura no se acumula aunque un proceso previo se haya matado.
  try { chromeProfiles.barrerViejos(); } catch (e) { /* best-effort */ }

  const options = new chrome.Options();
  if (config.browser.headless) {
    options.addArguments('--headless=new');
    // Viewport realista en headless. Sin esto, el "maximize" headless deja una
    // ventana diminuta (~782x439) y los controles que caen debajo del pliegue
    // (p. ej. el botón "Guardar" de un modal alto) quedan FUERA del viewport: el
    // click nativo de Selenium apunta a una coordenada sin elemento
    // (elementFromPoint = null) y falla con ElementClickInterceptedError. Con un
    // tamaño de escritorio, el control queda a la vista y el click nativo funciona
    // —igual que en headed—. Aplica a todos los módulos.
    options.addArguments('--window-size=1920,1080');
  }

  // Perfil temporal propio y rastreable, para poder limpiarlo al cerrar (en vez
  // del `scoped_dir*` aleatorio que Chrome no siempre borra). Comportamiento de
  // las pruebas idéntico: sigue siendo un perfil limpio por sesión.
  let perfilDir = null;
  try {
    perfilDir = chromeProfiles.nuevoPerfil();
    options.addArguments(`--user-data-dir=${perfilDir}`);
  } catch (e) {
    perfilDir = null; // si no se pudo crear, Chrome usa su perfil por defecto (como antes)
  }

  const driver = await new Builder()
    .forBrowser(config.browser.name)
    .setChromeOptions(options)
    .build();

  driver.__perfilDir = perfilDir;
  // En headed se maximiza a la pantalla real (comportamiento de siempre). En
  // headless NO se maximiza: el "maximize" headless reduce la ventana al tamaño
  // diminuto por defecto; el --window-size de arriba ya fija un viewport realista.
  if (!config.browser.headless) {
    await driver.manage().window().maximize();
  }
  currentDriver = driver;
  return driver;
}

async function quitDriver(driver) {
  const perfilDir = driver && driver.__perfilDir;
  if (driver) {
    await driver.quit();
  }
  if (!driver || currentDriver === driver) {
    currentDriver = null;
  }
  // Limpia el perfil temporal de ESTA sesión (best-effort; si Windows aún lo
  // tiene bloqueado, el barrido de la próxima corrida lo eliminará).
  if (perfilDir) chromeProfiles.borrar(perfilDir);
}

function getCurrentDriver() {
  return currentDriver;
}

module.exports = { createDriver, quitDriver, getCurrentDriver };
