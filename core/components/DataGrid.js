const { By, Key, until } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Componente del DataGrid de DevExtreme. Es el widget que MÁS se repite en la
 * app (Reclutamiento, Empleados, Vacantes, Nómina… todos listan datos en este
 * grid), así que encapsularlo una vez evita reescribir buscar/paginar/etc. en
 * cada módulo.
 *
 * Selectores verificados en el grid real de Requisiciones (DevExtreme):
 *  - búsqueda: input[placeholder="Buscar"] (filtra en vivo al tipear)
 *  - filas: tr.dx-data-row (sin duplicación; la tabla es única aunque tenga
 *    la clase -fixed)
 *  - paginación: .dx-page[aria-label="Page N"], .dx-next-button, .dx-prev-button,
 *    tamaño de página .dx-page-size, info en .dx-info
 */
class DataGrid extends BaseComponent {
  constructor(driver) {
    super(driver);

    this.grid = By.css('.dx-datagrid');
    this.searchInput = By.css('input[placeholder="Buscar"]');
    this.dataRow = By.css('.dx-data-row');
    this.info = By.css('.dx-info');
    this.nextPageButton = By.css('.dx-next-button');
    this.prevPageButton = By.css('.dx-prev-button');
    // Botones de la toolbar (DevExtreme no expone id/testid: se ubican por texto)
    this.createButton = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Crear']");
    this.filterButton = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Filtro']");
  }

  /** Espera a que el grid esté visible y devuelve el componente (encadenable). */
  async listo() {
    await this.waitVisible(this.grid);
    return this;
  }

  /** Localizador de una fila que contenga `texto` en alguna celda. */
  _filaLocator(texto) {
    return By.xpath(
      `//tr[contains(@class,'dx-data-row')][.//td[contains(normalize-space(.), '${texto}')]]`
    );
  }

  /** Escribe en el buscador (el grid filtra en vivo). */
  async buscar(texto) {
    logger.info(`DataGrid: buscar "${texto}"`);
    const input = await this.waitVisible(this.searchInput);
    await input.clear();
    await input.sendKeys(texto, Key.ENTER);
  }

  /**
   * True si existe una fila que contenga `texto`. Poll con timeout (maneja el
   * filtrado asíncrono del grid); devuelve false si no aparece en el tiempo dado
   * en vez de lanzar excepción.
   */
  async existeFila(texto, timeout = config.timeouts.explicitWaitMs) {
    try {
      await this.driver.wait(until.elementLocated(this._filaLocator(texto)), timeout);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Hace click en la fila que contenga `texto`. */
  async clickFila(texto) {
    logger.info(`DataGrid: click en fila "${texto}"`);
    await this.click(this._filaLocator(texto));
  }

  /** Cantidad de filas visibles en la página actual del grid. */
  async contarFilas() {
    const filas = await this.driver.findElements(this.dataRow);
    return filas.length;
  }

  /** Abre el formulario de creación (botón Crear). */
  async crear() {
    logger.info('DataGrid: click en Crear');
    await this.click(this.createButton);
  }

  /** Abre el panel de filtros (botón Filtro). */
  async abrirFiltro() {
    logger.info('DataGrid: abrir Filtro');
    await this.click(this.filterButton);
  }

  /** Va a la página N (paginación numerada). */
  async irAPagina(n) {
    logger.info(`DataGrid: ir a página ${n}`);
    await this.click(By.css(`.dx-page[aria-label="Page ${n}"]`));
  }

  async paginaSiguiente() {
    logger.info('DataGrid: página siguiente');
    await this.click(this.nextPageButton);
  }

  async paginaAnterior() {
    logger.info('DataGrid: página anterior');
    await this.click(this.prevPageButton);
  }

  /** Texto del pie de paginación (ej. "Página #1. Cantidad de páginas: 3 (46 Registros)"). */
  async getInfoPaginacion() {
    return (await this.getText(this.info)).trim();
  }
}

module.exports = DataGrid;
