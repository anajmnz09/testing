const { By } = require('selenium-webdriver');
const { waitForElementVisible } = require('./wait');
const config = require('../config');

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

  /**
   * Espera a que no quede ningún overlay de carga (`loader-manager`) VISIBLE.
   *
   * La app monta el overlay en cualquier pantalla (listado, detalle, formulario)
   * y mientras esté arriba intercepta los clicks. Estaba implementado como
   * método privado de RequisicionesPage; se subió acá para que cualquier página
   * o componente lo reutilice sin duplicarlo (RequisicionesPage lo sigue
   * exponiendo con su nombre anterior, así nada existente cambia).
   *
   * La visibilidad se comprueba con `isDisplayed()` de Selenium y no con
   * dimensiones: un elemento con visibility/opacity oculta conserva su tamaño y
   * daría un falso positivo de "loader visible".
   */
  async esperarSinLoader(timeout = config.timeouts.explicitWaitMs) {
    await this.driver.wait(async () => {
      const loaders = await this.driver.findElements(
        By.css('[class*="loader_manager"], [class*="loader-manager"]')
      );
      for (const l of loaders) {
        try {
          if (await l.isDisplayed()) return false;
        } catch (e) {
          /* stale = el loader ya no está en el DOM */
        }
      }
      return true;
    }, timeout);
    return this;
  }
}

module.exports = UiContext;
