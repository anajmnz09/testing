const { waitForElementVisible } = require('./wait');

/**
 * Base compartida por TODOS los Page Objects (BasePage) y Componentes
 * (BaseComponent). Encapsula el "plumbing" repetitivo de interactuar con
 * elementos vía WebDriver + esperas explícitas, para que las páginas y
 * componentes concretos no reescriban `waitForElementVisible(...).click()`
 * una y otra vez.
 *
 * Regla del framework: toda interacción con Selenium pasa por acá (o por los
 * helpers de utils/wait.js), nunca con sleeps ni timeouts fijos.
 */
class UiContext {
  constructor(driver) {
    this.driver = driver;
  }

  /** Espera a que el elemento exista y sea visible, y lo devuelve. */
  async waitVisible(locator, timeout) {
    return waitForElementVisible(this.driver, locator, timeout);
  }

  /** Espera el elemento visible y hace click. Devuelve el elemento. */
  async click(locator, timeout) {
    const el = await this.waitVisible(locator, timeout);
    await el.click();
    return el;
  }

  /**
   * Espera el input visible y escribe `text`. Por defecto limpia el campo antes.
   * Devuelve el elemento.
   */
  async type(locator, text, { clear = true, timeout } = {}) {
    const el = await this.waitVisible(locator, timeout);
    if (clear) {
      await el.clear();
    }
    await el.sendKeys(text);
    return el;
  }

  /**
   * Devuelve el texto del elemento (sin recortar; el llamador decide si aplica
   * .trim(), para no alterar comportamientos que dependen del texto crudo).
   */
  async getText(locator, timeout) {
    const el = await this.waitVisible(locator, timeout);
    return el.getText();
  }
}

module.exports = UiContext;
