const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('./env'); // carga jerárquica de .env (módulo + global)
const config = require('../config');
const chromeProfiles = require('./chromeProfiles');
const logger = require('./logger');

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
  }
  // Viewport EXPLÍCITO e IDÉNTICO en ambos modos (Headed y Headless): sin esto,
  // cada modo terminaba con un tamaño de ventana distinto (headless quedaba con
  // ~782x439 vía "maximize"; headed dependía de la resolución física de pantalla,
  // ~1536x674 en esta máquina). Los controles que caen debajo del pliegue (p. ej.
  // el botón "Guardar" de un modal alto) quedaban FUERA del viewport en el modo más
  // chico: el click nativo de Selenium apunta a una coordenada sin elemento
  // (elementFromPoint = null) y falla con ElementClickInterceptedError. Con el
  // MISMO tamaño de escritorio en los dos modos, la configuración del driver deja
  // de ser una variable entre corridas Headed/Headless. Aplica a todos los módulos.
  options.addArguments('--window-size=1920,1080');

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

  let driver;
  try {
    driver = await new Builder()
      .forBrowser(config.browser.name)
      .setChromeOptions(options)
      .build();
  } catch (err) {
    // La sesión no llegó a crearse. `currentDriver` NUNCA se asigna en este
    // camino, así que el afterEach global (mochaRootHooks.js) no tiene nada que
    // cerrar: getCurrentDriver() devuelve null y su `if (driver) {...quitDriver}`
    // se salta entero. Sin embargo, chromedriver/Chrome pueden haber arrancado
    // igual (la sesión falló DESPUÉS de eso). selenium-webdriver no expone un
    // handle a ese proceso en el camino de error: el DriverService se crea y
    // arranca DENTRO de la promesa interna de Builder().build() y no se retorna
    // si createSession() falla (verificado en el código fuente de la librería).
    // No hay forma soportada de obtener el PID exacto por API, así que se
    // identifica el proceso por su --user-data-dir ÚNICO de esta sesión (nunca
    // por nombre de imagen, para no afectar otras sesiones de Selenium en la
    // misma máquina) y se cierra solo por PID verificado.
    if (perfilDir) {
      const r = chromeProfiles.matarProcesosPorPerfil(perfilDir);
      if (r.matados) {
        logger.info(`createDriver: cerrado(s) ${r.matados} proceso(s) huérfano(s) de esta sesión tras fallo de build`);
      }
      if (r.advertencia) logger.info(`createDriver: ${r.advertencia}`);
      chromeProfiles.borrar(perfilDir);
    }
    throw err;
  }

  driver.__perfilDir = perfilDir;
  // Ya NO se llama a maximize(): dependía de la resolución física de pantalla y
  // era la fuente de la diferencia de configuración entre Headed y Headless (ver
  // comentario arriba). El --window-size explícito fija el mismo tamaño en ambos
  // modos, sin depender del entorno donde corra la máquina.
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
