const UiContext = require('../../utils/UiContext');

/**
 * Base de todos los Page Objects (una pantalla = un Page Object).
 * Hereda los helpers de interacción de UiContext y agrega utilidades de página.
 *
 * Los Page Objects concretos (LoginPage, DashboardPage, y los propios de cada
 * módulo) extienden esta clase, definen sus locators en el constructor y
 * exponen métodos con lenguaje de negocio.
 */
class BasePage extends UiContext {
  /** Navega a una URL absoluta. */
  async navigate(url) {
    await this.driver.get(url);
  }

  /** URL actual del navegador. */
  async getCurrentUrl() {
    return this.driver.getCurrentUrl();
  }
}

module.exports = BasePage;
