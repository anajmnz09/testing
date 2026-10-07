const { By, until } = require('selenium-webdriver');
const { BasePage, DataGrid, SRHHNavBar } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const SolicitudEmpleoFormPage = require('./SolicitudEmpleoFormPage');
const SolicitudEmpleoDetallePage = require('./SolicitudEmpleoDetallePage');

/**
 * Listado "Solicitudes de Empleo" (módulo Reclutamiento). Se llega vía
 * `SRHHNavBar.ir('Solicitudes de Empleo')` (navRouteItems tipo `dropdown`,
 * ver core/components/SRHHNavBar.js) — NUNCA con selectores propios del
 * navbar acá.
 */
class SolicitudEmpleoPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12): `abrirDetalle(x)` localiza una solicitud por su `codigo`.
   * Lo lee el escáner estático; en ejecución individual no se usa.
   */
  static get ENTIDAD_FLUJO() {
    return { tipo: 'solicitud', referencia: 'codigo' };
  }

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

  /**
   * Abre el DETALLE de una solicitud por su código (doble-click en la fila
   * tras filtrar por `codigo` — mismo criterio y misma mecánica de reintento
   * que `RequisicionesPage.abrirDetalle`: el doble-click a veces entra en
   * edición inline en vez de abrir el detalle, así que se reintenta hasta
   * que aparece el header del detalle).
   */
  async abrirDetalle(codigo) {
    const timeout = config.timeouts.explicitWaitMs;
    await this.grid.buscar(codigo);
    const filaLoc = this.grid._filaLocator(codigo);
    const headerDetalle = By.css('[class*="forms-header"]');

    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fila = await this.driver.wait(until.elementLocated(filaLoc), timeout);
        await this.driver.wait(until.elementIsVisible(fila), timeout);
        await this.driver.actions().doubleClick(fila).perform();
        await this.esperarSinLoader(timeout);
        await this.driver.wait(until.elementLocated(headerDetalle), 6000);
        logger.info(`SolicitudEmpleoPage: detalle abierto para "${codigo}"`);
        return new SolicitudEmpleoDetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`SolicitudEmpleoPage: reintentando abrir detalle (intento ${intento + 1})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Fila del listado de una solicitud YA creada, ubicada por su Identificación
   * (columna real "Identificación", comparada solo por dígitos: el grid la
   * muestra sin máscara). Poll con `esperarFila` (la solicitud recién creada
   * puede tardar en reflejarse). Devuelve la fila completa (incluye "Código").
   */
  async leerFilaPorIdentificacion(identificacion) {
    const solo = String(identificacion).replace(/\D/g, '');
    const fila = await this.grid.esperarFila(
      solo,
      (f) => String(f['Identificación'] || '').replace(/\D/g, '') === solo
    );
    if (!fila || !String(fila['Código'] || '').trim()) {
      throw new Error(`SolicitudEmpleoPage: no se encontró en el listado la solicitud con Identificación "${identificacion}".`);
    }
    return fila;
  }

  /**
   * Abre el detalle de una solicitud CUALQUIERA (fila elegida al azar del
   * listado actual, sin filtrar) — para casos donde el Panel no dirige un
   * código puntual. Devuelve también el código elegido (primera columna del
   * grid), para poder identificar la solicitud en el reporte/log.
   */
  async abrirAleatoria() {
    await this.grid.listo();
    const total = await this.grid.contarFilas();
    if (!total) {
      throw new Error('SolicitudEmpleoPage: no hay solicitudes en el listado para elegir una al azar');
    }
    const indice = Math.floor(Math.random() * total);
    const filas = await this.driver.findElements(By.css('.dx-datagrid .dx-data-row'));
    // Primera celda con texto real (no vacía): evita depender de que la
    // columna "Código" sea literalmente `td:first-child` (verificado que a
    // veces hay celdas iniciales sin texto -p. ej. de selección- antes de la
    // primera columna de datos).
    const celdas = await filas[indice].findElements(By.css('td'));
    let codigo = '';
    for (const celda of celdas) {
      const texto = (await celda.getText()).trim();
      if (texto) {
        codigo = texto;
        break;
      }
    }
    if (!codigo) {
      throw new Error(`SolicitudEmpleoPage: no se pudo leer el código de la fila ${indice + 1}/${total} elegida al azar`);
    }
    logger.info(`SolicitudEmpleoPage: elegida al azar la solicitud "${codigo}" (fila ${indice + 1}/${total})`);
    const detalle = await this.abrirDetalle(codigo);
    return { detalle, codigo };
  }
}

module.exports = SolicitudEmpleoPage;
