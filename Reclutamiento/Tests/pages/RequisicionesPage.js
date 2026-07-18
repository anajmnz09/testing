const { By, until } = require('selenium-webdriver');
const { BasePage, DataGrid } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const RequisicionDetallePage = require('./RequisicionDetallePage');

/**
 * Page Object PROPIO del módulo Reclutamiento (pantalla de Requisiciones).
 *
 * Es la plantilla de cómo se construye una página de módulo:
 *  - Extiende BasePage del core (hereda los helpers de interacción).
 *  - COMPONE los componentes reutilizables del core (aquí, DataGrid). No
 *    reimplementa buscar/paginar/contar: los delega en el componente.
 *  - Expone métodos con LENGUAJE DE NEGOCIO (buscarRequisicion, existeRequisicion…)
 *    para que los tests describan el flujo, no la mecánica del grid.
 *
 * Los locators específicos del módulo (secciones del menú superior, campos del
 * formulario de creación, columnas particulares, etc.) se irán agregando acá a
 * medida que crezcan las pruebas de Reclutamiento.
 */
class RequisicionesPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
  }

  /** Espera a que el listado de requisiciones esté cargado. Encadenable. */
  async listo() {
    await this.grid.listo();
    logger.info('RequisicionesPage: listado cargado');
    return this;
  }

  /** Filtra el listado por un texto (código, nombre, departamento, etc.). */
  async buscarRequisicion(texto) {
    await this.grid.buscar(texto);
  }

  /** True si existe una requisición que contenga `texto` en el listado. */
  async existeRequisicion(texto) {
    return this.grid.existeFila(texto);
  }

  /** Cantidad de requisiciones visibles en la página actual. */
  async contarRequisiciones() {
    return this.grid.contarFilas();
  }

  /** Abre una requisición haciendo click en su fila. */
  async abrirRequisicion(texto) {
    await this.grid.clickFila(texto);
  }

  /**
   * Vuelve al listado de Requisiciones (ítem del menú superior del módulo).
   * Útil tras crear una requisición para reabrirla.
   */
  async volverAlListado() {
    const nav = By.xpath("//*[contains(@class,'navItemLink')][contains(normalize-space(.),'Requisiciones')]");
    await (await this.waitVisible(nav)).click();
    await this.listo();
    return this;
  }

  /**
   * Abre el DETALLE de una requisición (doble-click en su fila; el Nombre no es
   * un link). Filtra por `texto` primero. Devuelve una RequisicionDetallePage.
   */
  async abrirDetalle(texto) {
    const timeout = config.timeouts.explicitWaitMs;
    await this.buscarRequisicion(texto);
    const filaLoc = By.xpath(
      `//tr[contains(@class,'dx-data-row')][.//td[contains(normalize-space(.), '${texto}')]]`
    );
    const labelDetalle = By.xpath("//label[contains(normalize-space(.),'Nombre de requisición')]");

    // El doble-click a veces entra en edición inline en vez de abrir el detalle:
    // se reintenta hasta que aparece el formulario de detalle.
    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fila = await this.driver.wait(until.elementLocated(filaLoc), timeout);
        await this.driver.wait(until.elementIsVisible(fila), timeout);
        await this.driver.actions().doubleClick(fila).perform();
        await this._esperarSinLoader(timeout);
        await this.driver.wait(until.elementLocated(labelDetalle), 6000);
        logger.info(`RequisicionesPage: detalle abierto para "${texto}"`);
        return new RequisicionDetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`RequisicionesPage: reintentando abrir detalle (intento ${intento + 1})`);
      }
    }
    throw ultimoError;
  }

  /** Abre el formulario para crear una nueva requisición. */
  async crearRequisicion() {
    await this.grid.crear();
  }

  /**
   * Abre el formulario "Crear Requisición" de forma robusta: tras cargar el
   * grid, el botón "Crear" arranca deshabilitado y hay un overlay de carga
   * (loader-manager) que intercepta el click. Se espera a que el loader
   * desaparezca y el botón se habilite antes de clickear. Espera explícita,
   * sin sleeps. (Método agregado para soportar la automatización de Requisiciones.)
   */
  async abrirFormularioCrear() {
    const timeout = config.timeouts.explicitWaitMs;
    await this._esperarSinLoader(timeout);
    const crearHabilitado = By.xpath(
      "//div[contains(@class,'dx-button')][normalize-space(.)='Crear'][not(contains(@class,'dx-state-disabled'))]"
    );
    const btn = await this.driver.wait(until.elementLocated(crearHabilitado), timeout);
    await this.driver.wait(until.elementIsVisible(btn), timeout);
    await btn.click();
    // el formulario está listo cuando aparecen sus editores y no hay loader
    await this.waitVisible(By.css('.dx-selectbox'));
    await this._esperarSinLoader(timeout);
    logger.info('RequisicionesPage: formulario "Crear Requisición" abierto');
  }

  /** Espera a que no haya overlay de carga (loader-manager) visible. */
  async _esperarSinLoader(timeout) {
    await this.driver.wait(async () => {
      const loaders = await this.driver.findElements(
        By.css('[class*="loader_manager"], [class*="loader-manager"]')
      );
      for (const l of loaders) {
        try { if (await l.isDisplayed()) return false; } catch (e) { /* stale = ya no está */ }
      }
      return true;
    }, timeout);
  }

  /** Texto del pie de paginación del listado. */
  async getResumenPaginacion() {
    return this.grid.getInfoPaginacion();
  }
}

module.exports = RequisicionesPage;
