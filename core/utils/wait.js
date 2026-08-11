const { until } = require('selenium-webdriver');
const config = require('../config');

const DEFAULT_TIMEOUT = config.timeouts.explicitWaitMs;

/**
 * Ubica el elemento y espera a que sea visible. Reintenta ante
 * `StaleElementReferenceError`: el nodo puede re-renderizarse (React/
 * DevExtreme) en el instante entre `elementLocated` y la comprobación de
 * visibilidad sobre ESE MISMO handle — confirmado con evidencia real,
 * reproducido en varios controles distintos tras acciones de
 * Editar/Guardar/cambio de etapa/apertura de popup. Como `waitVisible` es la
 * base de la mayoría de las interacciones del framework (click/type/getText
 * la usan), endurecerla acá cubre la carrera de raíz en un solo lugar en vez
 * de reimplementar el mismo reintento en cada Page Object que la sufra.
 */
async function waitForElementVisible(driver, locator, timeout = DEFAULT_TIMEOUT, intentos = 3) {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const element = await driver.wait(until.elementLocated(locator), timeout);
      await driver.wait(until.elementIsVisible(element), timeout);
      return element;
    } catch (e) {
      if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
    }
  }
}

async function waitForUrlContains(driver, substring, timeout = DEFAULT_TIMEOUT) {
  await driver.wait(until.urlContains(substring), timeout);
}

module.exports = { waitForElementVisible, waitForUrlContains, DEFAULT_TIMEOUT };
