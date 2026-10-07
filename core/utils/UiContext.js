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
    // Publicación común de entidades de flujo según `ENTIDAD_FLUJO` (inerte fuera de un flujo).
    require('./flowInstrumentar').instrumentar(this);
  }

  /** Espera a que el elemento exista y sea visible, y lo devuelve. */
  async waitVisible(locator, timeout) {
    return waitForElementVisible(this.driver, locator, timeout);
  }

  /**
   * Espera el elemento visible y hace click. Reintenta ante
   * `StaleElementReferenceError`: confirmado con evidencia real en varios
   * puntos del framework que el nodo puede re-renderizarse justo en el
   * instante entre `waitVisible` (que YA reintenta su propia carrera
   * interna, ver `waitForElementVisible`) y el click nativo — una carrera
   * distinta, un paso más adelante. Como `click()` es la interacción más
   * usada de todo el framework (heredada por cada Page Object/Componente),
   * endurecerla acá cubre esa carrera en un solo lugar. Devuelve el elemento
   * (del intento que tuvo éxito).
   */
  async click(locator, timeout, intentos = 3) {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const el = await this.waitVisible(locator, timeout);
        await el.click();
        return el;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
      }
    }
  }

  /**
   * Espera el input visible y escribe `text`. Por defecto limpia el campo
   * antes. Mismo reintento ante `StaleElementReferenceError` que `click()`
   * (misma clase de carrera, un paso más adelante que `waitVisible`).
   * Devuelve el elemento.
   */
  async type(locator, text, { clear = true, timeout, intentos = 3 } = {}) {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const el = await this.waitVisible(locator, timeout);
        if (clear) {
          await el.clear();
        }
        await el.sendKeys(text);
        return el;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
      }
    }
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
