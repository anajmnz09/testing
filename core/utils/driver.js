const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('./env'); // carga jerárquica de .env (módulo + global)
const config = require('../config');

// Referencia al driver activo, para que utilidades globales (ej. los root hooks
// de Mocha en utils/mochaRootHooks.js) puedan capturar screenshots o cerrar la
// sesión sin que cada archivo de test tenga que exponer su propia variable.
// Mocha corre las pruebas de forma serial por defecto, así que un único driver
// "actual" a la vez es una suposición segura (no se soporta --parallel).
let currentDriver = null;

async function createDriver() {
  const options = new chrome.Options();
  if (config.browser.headless) {
    options.addArguments('--headless=new');
  }

  const driver = await new Builder()
    .forBrowser(config.browser.name)
    .setChromeOptions(options)
    .build();

  await driver.manage().window().maximize();
  currentDriver = driver;
  return driver;
}

async function quitDriver(driver) {
  if (driver) {
    await driver.quit();
  }
  if (!driver || currentDriver === driver) {
    currentDriver = null;
  }
}

function getCurrentDriver() {
  return currentDriver;
}

module.exports = { createDriver, quitDriver, getCurrentDriver };
