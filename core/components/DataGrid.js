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

  /**
   * Filtra el grid por el VALOR de una columna usando el dropdown de la FILA DE
   * FILTROS de DevExtreme (la que aparece bajo los encabezados). Es genérico:
   * sirve para `Estado` = `Autorizada` | `Cerrada` | `Pausada`… o cualquier
   * columna cuyo filtro sea un selectbox.
   *
   * Verificado en el grid real de Requisiciones: la celda de filtro de la
   * columna es un `.dx-selectbox` que, al abrirse, lista todos los valores; al
   * elegir uno, el grid filtra en vivo. Se localiza por el TEXTO del encabezado
   * (no por índice fijo), así no se acopla al orden de columnas —configurable por
   * el usuario— ni a clases específicas de una pantalla.
   */
  async filtrarPorColumna(nombreColumna, valor, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`DataGrid: filtrar por columna "${nombreColumna}" = "${valor}"`);

    // 1) Marcar el selectbox de filtro de esa columna (por índice del encabezado).
    const encontrada = await this.driver.executeScript((col) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const grid = document.querySelector('.dx-datagrid');
      if (!grid) return false;
      const headers = Array.from(grid.querySelectorAll('.dx-header-row > td'));
      const idx = headers.findIndex((td) => norm(td.textContent) === norm(col));
      if (idx < 0) return false;
      const filterRow = grid.querySelector('.dx-datagrid-filter-row');
      if (!filterRow) return false;
      const cell = filterRow.querySelectorAll('td')[idx];
      const sb = cell && cell.querySelector('.dx-selectbox, .dx-dropdowneditor');
      if (!sb) return false;
      const prev = document.querySelector('[data-qa="filtro-col"]');
      if (prev) prev.removeAttribute('data-qa');
      sb.setAttribute('data-qa', 'filtro-col');
      return true;
    }, nombreColumna);

    if (!encontrada) {
      throw new Error(`DataGrid: no se encontró el filtro de la columna "${nombreColumna}"`);
    }

    // 2) Abrir el dropdown (click por JS: la fila de filtros es sticky en el header).
    const sb = await this.driver.findElement(By.css('[data-qa="filtro-col"]'));
    const boton = await sb.findElement(By.css('.dx-dropdowneditor-button, .dx-texteditor-input'));
    await this.driver.executeScript('arguments[0].click()', boton);

    // 3) Esperar la lista y clickear el item cuyo texto es EXACTAMENTE `valor`
    //    (exacto para no confundir estados que se contienen entre sí).
    //    Se usa la API de ACCIONES (mover + click) y no un click nativo/JS:
    //    verificado en el grid real, el selectbox de la fila de filtros solo
    //    commitea el valor —y dispara el filtrado del grid— ante eventos de
    //    puntero reales; un element.click()/JS click deja el dropdown abierto.
    const item = await this.driver.wait(async () => {
      const items = await this.driver.findElements(By.css('.dx-list-item, .dx-overlay-content .dx-item'));
      for (const it of items) {
        try {
          if ((await it.isDisplayed()) && (await it.getText()).trim() === valor) return it;
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout);
    await this.driver.actions({ bridge: true }).move({ origin: item }).click().perform();

    // 4) Esperar a que el grid re-filtre (overlay de carga fuera).
    await this.esperarSinLoader(timeout);
    logger.info(`DataGrid: filtro aplicado "${nombreColumna}" = "${valor}"`);
    return this;
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
