const { By } = require('selenium-webdriver');
const BasePage = require('./base/BasePage');
const logger = require('../utils/logger');

/**
 * Pantalla principal posterior al login (tarjetas de módulos: Reclutamiento,
 * Empleados, Nómina, Vacantes, etc.). App-global → vive en el core.
 *
 * (Antes se llamaba HomePage; se renombró a DashboardPage al promoverla al core
 * porque describe mejor la pantalla. Su API pública se mantiene.)
 */
class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);

    // Selectores verificados por inspección real del DOM tras un login exitoso
    this.userDropdown = By.id('userDropDown');
    this.companyDropdown = By.id('CompanyDropDown');
  }

  async isLoaded() {
    await this.waitVisible(this.userDropdown);
    logger.info('Dashboard cargado');
    return true;
  }

  async getLoggedInUserName() {
    return (await this.getText(this.userDropdown)).trim();
  }

  /**
   * Abre un módulo desde el dashboard haciendo click en su tarjeta.
   * @param nombre Texto visible de la tarjeta (ej. 'Reclutamiento', 'Empleados').
   */
  async abrirModulo(nombre) {
    logger.info(`Abriendo módulo: ${nombre}`);
    const card = By.xpath(
      `//a[contains(@class,'ModuleCard')][contains(normalize-space(.), '${nombre}')]`
    );
    await this.click(card);
  }
}

module.exports = DashboardPage;
