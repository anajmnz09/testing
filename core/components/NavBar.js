const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');

/**
 * Barra de navegación superior, presente en todas las pantallas de la app.
 * Componente reutilizable: cualquier módulo lo usa a través de los flows.
 *
 * Todos los ids/selectores fueron verificados por inspección del DOM real.
 */
class NavBar extends BaseComponent {
  constructor(driver) {
    super(driver);

    // ids estables del navbar
    this.syncButton = By.id('SyncCacheButton');
    this.notificationsDropdown = By.id('NotificationDropDown');
    this.configDropdown = By.id('ConfiguracionDropdown');
    this.companyDropdown = By.id('CompanyDropDown');
    this.userDropdown = By.id('userDropDown');
    // el logo (ancla) vuelve al dashboard
    this.logo = By.css('a.navLogoImg');
    // el menú de usuario despliega un overlay con items sin id/testid: se ubica por texto
    this.logoutOption = By.xpath(
      "//*[contains(@class,'UserOptionListItem')][contains(normalize-space(.), 'Cerrar sesión')]"
    );
    // al elegir "Cerrar sesión" aparece un diálogo de confirmación (Aceptar/Cancelar)
    this.confirmLogoutButton = By.xpath(
      "//div[contains(@class,'dx-button')][.//span[contains(@class,'dx-button-text') and normalize-space(.)='Aceptar']]"
    );
  }

  /** Vuelve al dashboard haciendo click en el logo. */
  async irAlDashboard() {
    logger.info('NavBar: volviendo al dashboard (logo)');
    await this.click(this.logo);
  }

  /** Fuerza la actualización/sincronización de caché. */
  async sincronizar() {
    logger.info('NavBar: sincronizar (SyncCacheButton)');
    await this.click(this.syncButton);
  }

  /** Abre el panel de notificaciones. */
  async abrirNotificaciones() {
    logger.info('NavBar: abrir notificaciones');
    await this.click(this.notificationsDropdown);
  }

  /** Abre el menú de configuración. */
  async abrirConfiguracion() {
    logger.info('NavBar: abrir configuración');
    await this.click(this.configDropdown);
  }

  /** Abre el selector de compañía. */
  async abrirMenuCompania() {
    logger.info('NavBar: abrir menú de compañía');
    await this.click(this.companyDropdown);
  }

  /** Texto de la compañía activa mostrada en el navbar. */
  async getCompania() {
    return (await this.getText(this.companyDropdown)).trim();
  }

  /** Abre el menú de usuario. */
  async abrirMenuUsuario() {
    logger.info('NavBar: abrir menú de usuario');
    await this.click(this.userDropdown);
  }

  /** Texto del usuario logueado mostrado en el navbar. */
  async getUsuario() {
    return (await this.getText(this.userDropdown)).trim();
  }

  /** Abre el menú de usuario, elige "Cerrar sesión" y confirma el diálogo. */
  async logout() {
    logger.info('NavBar: abriendo menú de usuario');
    await this.click(this.userDropdown);
    logger.info('NavBar: click en "Cerrar sesión"');
    await this.click(this.logoutOption);
    logger.info('NavBar: confirmando cierre de sesión (Aceptar)');
    await this.click(this.confirmLogoutButton);
  }
}

module.exports = NavBar;
