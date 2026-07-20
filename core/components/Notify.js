const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const config = require('../config');

/**
 * Toast de notificación de la app (clase `notify_record`). Aparece en TODAS las
 * pantallas (guardar, validar, publicar, errores), así que vive en el core como
 * componente reutilizable en vez de repetirse en cada Page Object.
 *
 * Textos observados en la app: "Operación Exitosa", "Formulario Inválido",
 * "Error en el sistema".
 */
class Notify extends BaseComponent {
  constructor(driver) {
    super(driver);
    this.locator = By.css('[class*="notify_record"]');
  }

  /** Texto del notify visible ahora mismo ('' si no hay). No espera. */
  async getTexto() {
    return this.driver.executeScript(() => {
      const n = document.querySelector('[class*="notify_record"]');
      return n ? (n.textContent || '').trim() : '';
    });
  }

  /** Espera a que aparezca un notify y devuelve su texto ('' si no aparece). */
  async esperarTexto(timeoutMs = config.timeouts.explicitWaitMs) {
    let texto = '';
    await this.driver
      .wait(async () => {
        texto = await this.getTexto();
        return !!texto;
      }, timeoutMs)
      .catch(() => {});
    return texto;
  }

  /** Clasifica un texto de notify según los patrones reales de la app. */
  static clasificar(texto = '') {
    return {
      notify: texto,
      exito: /exitosa|exitosamente|success/i.test(texto),
      invalido: /inv[aá]lido/i.test(texto),
      errorSistema: /error en el sistema/i.test(texto),
    };
  }

  /** Espera un notify y lo devuelve ya clasificado. */
  async esperarResultado(timeoutMs = config.timeouts.explicitWaitMs) {
    return Notify.clasificar(await this.esperarTexto(timeoutMs));
  }
}

module.exports = Notify;
