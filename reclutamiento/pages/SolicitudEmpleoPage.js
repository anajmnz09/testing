const { By, until } = require('selenium-webdriver');
const { BasePage, DataGrid, SRHHNavBar } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const SolicitudEmpleoFormPage = require('./SolicitudEmpleoFormPage');

/**
 * Listado "Solicitudes de Empleo" (módulo Reclutamiento). Se llega vía
 * `SRHHNavBar.ir('Solicitudes de Empleo')` (navRouteItems tipo `dropdown`,
 * ver core/components/SRHHNavBar.js) — NUNCA con selectores propios del
 * navbar acá.
 */
class SolicitudEmpleoPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
    this.navBar = new SRHHNavBar(driver);
  }

  /** Navega a esta pantalla desde cualquier punto del módulo Reclutamiento. */
  static async ir(driver) {
    const navBar = new SRHHNavBar(driver);
    await navBar.ir('Solicitudes de Empleo');
    return new SolicitudEmpleoPage(driver).listo();
  }

  async listo() {
    await this.grid.listo();
    logger.info('SolicitudEmpleoPage: listado cargado');
    return this;
  }

  /**
   * Abre el formulario de creación (botón "Crear", EXACTO — no "Crear
   * Solicitud": ese texto es el título interno del panel, no el nombre del
   * botón). Devuelve el Page Object del formulario ya cargado.
   *
   * El panel de creación NO es un `dxPopup` de DevExtreme (verificado: sus
   * ancestros no tienen `.dx-popup-wrapper` ni `.dx-overlay-wrapper` — son
   * `<div>` genéricos de la app), por eso NO se usa el componente `Popup` del
   * core acá. La confirmación de que abrió es la misma que usa
   * `RequisicionFormPage`: esperar un control real visible
   * (`SolicitudEmpleoFormPage.estaCargado()`).
   */
  async crear() {
    const timeout = config.timeouts.explicitWaitMs;
    const btnCrear = By.xpath("//*[contains(@class,'dx-button')][normalize-space(.)='Crear']");
    const btn = await this.driver.wait(until.elementLocated(btnCrear), timeout);
    await this.driver.wait(until.elementIsVisible(btn), timeout);
    await btn.click();
    logger.info('SolicitudEmpleoPage: botón "Crear" clickeado');

    return new SolicitudEmpleoFormPage(this.driver).estaCargado();
  }
}

module.exports = SolicitudEmpleoPage;
