const { By } = require('selenium-webdriver');
const BasePage = require('./base/BasePage');
const logger = require('../utils/logger');

/**
 * Pantalla de login. App-global (la comparten todos los módulos), por eso vive
 * en el core. Su API pública (open, login, getErrorMessage) no cambió al
 * migrarla; solo delega el plumbing en BasePage/UiContext.
 */
class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);

    // Selectores verificados por inspección real del DOM en https://test.triple.com.do/
    this.usernameInput = By.name('textUser');
    this.passwordInput = By.name('textPassword');
    this.submitButton = By.id('btnLogin');
    // El notify no tiene id/name/data-testid/aria-label propio; se usa CSS por clase (módulo CSS estable en el prefijo)
    this.errorMessage = By.css('[class*="notify_record_error"] p');
  }

  async open() {
    const baseUrl = process.env.BASE_URL;
    logger.info(`Navegando a ${baseUrl}`);
    await this.navigate(baseUrl);
  }

  /** True cuando la pantalla de login está visible (ej. tras un logout). */
  async isDisplayed() {
    await this.waitVisible(this.usernameInput);
    return true;
  }

  async login(username, password) {
    logger.info('Iniciando Login');

    await this.type(this.usernameInput, username);
    logger.info('Usuario ingresado');

    await this.type(this.passwordInput, password);
    logger.info('Password ingresado');

    await this.click(this.submitButton);
    logger.info('Click Login');
  }

  async getErrorMessage() {
    const text = await this.getText(this.errorMessage);
    logger.info(`Mensaje de error mostrado: ${text}`);
    return text;
  }
}

module.exports = LoginPage;
