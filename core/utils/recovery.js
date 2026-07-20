const { By } = require('selenium-webdriver');
const logger = require('./logger');
const config = require('./../config');

/**
 * Recuperación del estado de la aplicación usando SUS PROPIOS controles, como
 * lo haría un QA humano: antes de reiniciar todo el flujo (nuevo navegador,
 * nuevo login), se intenta volver a una pantalla limpia con el flujo normal del
 * usuario.
 *
 * Política general del framework (aplica a CUALQUIER pantalla/módulo):
 *  1. Descartar / Cancelar / Cerrar (botones del formulario o modal).
 *  2. X de cierre del modal.
 *  3. Volver al listado (menú del módulo).
 * Solo si nada de esto funciona se considera el estado "no recuperable" y el
 * llamador decide reiniciar el flujo.
 */

// Vías de recuperación, en orden de preferencia (flujo normal del usuario).
const VIAS = [
  { via: 'Descartar', loc: By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Descartar']") },
  { via: 'Cancelar', loc: By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Cancelar']") },
  { via: 'Cerrar', loc: By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Cerrar']") },
  { via: 'X del modal', loc: By.css('.dx-popup-title .dx-closebutton, .dx-closebutton, .dx-overlay-content .dx-closebutton') },
  { via: 'Volver al listado', loc: By.xpath("//*[contains(@class,'navItemLink')]") },
];

// Botones típicos de confirmación cuando la app pregunta "¿descartar cambios?".
const CONFIRMAR = By.xpath(
  "//div[contains(@class,'dx-button')][.//span[contains(@class,'dx-button-text')]" +
    "[normalize-space(.)='Aceptar' or normalize-space(.)='Sí' or normalize-space(.)='Si' or normalize-space(.)='Confirmar' or normalize-space(.)='Descartar']]"
);

async function _clickPrimeroVisible(driver, loc) {
  const els = await driver.findElements(loc);
  for (const el of els) {
    try {
      if (await el.isDisplayed()) {
        // click por JS: el elemento puede estar tapado por barras fijas
        await driver.executeScript('arguments[0].click()', el);
        return true;
      }
    } catch (e) { /* stale: probar el siguiente */ }
  }
  return false;
}

/** Si aparece un diálogo de confirmación, lo acepta. No falla si no aparece. */
async function _confirmarSiAparece(driver) {
  try {
    await driver.wait(() => _clickPrimeroVisible(driver, CONFIRMAR), 2500);
  } catch (e) {
    /* no había diálogo de confirmación */
  }
}

/**
 * Intenta recuperar el estado con los controles normales de la app.
 * @returns {Promise<{recuperado: boolean, via: string|null}>}
 */
async function recuperarEstado(driver) {
  if (!driver) return { recuperado: false, via: null };
  for (const paso of VIAS) {
    try {
      if (await _clickPrimeroVisible(driver, paso.loc)) {
        await _confirmarSiAparece(driver);
        logger.info(`recovery: estado recuperado vía "${paso.via}"`);
        return { recuperado: true, via: paso.via };
      }
    } catch (e) {
      /* probar la siguiente vía */
    }
  }
  logger.error('recovery: no se encontró una vía normal para recuperar el estado (posible estado inconsistente)');
  return { recuperado: false, via: null };
}

module.exports = { recuperarEstado, VIAS };
