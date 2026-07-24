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

  /**
   * Filtra el listado por ESTADO usando el dropdown de la columna "Estado"
   * (fila de filtros del grid). Tras aplicarlo, todas las filas visibles son del
   * estado pedido, así que la selección deja de depender de coincidencias de
   * texto en toda la fila. Genérico: 'Autorizada', 'Cerrada', 'Pausada', etc.
   */
  async filtrarPorEstado(estado) {
    await this.grid.filtrarPorColumna('Estado', estado);
    await this.esperarFilas().catch(() => {}); // puede quedar sin filas si no hay de ese estado
    return this;
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

  /**
   * Espera a que el grid tenga FILAS con datos (no solo el contenedor visible) y
   * sin overlay de carga. El listado renderiza el grid antes de traer los datos,
   * así que esperar solo el contenedor lleva a leer 0 filas.
   */
  async esperarFilas(timeout = config.timeouts.explicitWaitMs * 2) {
    // El loader se comprueba con isDisplayed() de Selenium (no con offsetWidth:
    // un elemento con visibility/opacity oculta conserva dimensiones y daría un
    // falso positivo de "loader visible").
    await this._esperarSinLoader(timeout);
    await this.driver.wait(async () => {
      const filas = await this.driver.findElements(this.grid.dataRow);
      return filas.length > 0;
    }, timeout);
    logger.info('RequisicionesPage: listado con filas cargadas');
    return this;
  }

  /**
   * Cantidad de filas visibles cuyo texto contiene `estado` (ej. 'Autorizada').
   * Se busca por texto de fila (no por índice de columna) para no acoplarse al
   * orden de columnas, que es configurable por el usuario en el grid.
   */
  async contarConEstado(estado) {
    return this.driver.executeScript((est) => {
      return Array.from(document.querySelectorAll('.dx-data-row')).filter((f) =>
        new RegExp(est, 'i').test(f.textContent || '')
      ).length;
    }, estado);
  }

  /** Celdas de la n-ésima fila (0-based) que contiene `estado`, o null. */
  async datosDeFilaConEstado(estado, indice = 0) {
    return this.driver.executeScript(
      (est, i) => {
        const filas = Array.from(document.querySelectorAll('.dx-data-row')).filter((f) =>
          new RegExp(est, 'i').test(f.textContent || '')
        );
        const f = filas[i];
        return f ? Array.from(f.querySelectorAll('td')).map((c) => c.textContent.trim()).filter(Boolean) : null;
      },
      estado,
      indice
    );
  }

  /**
   * Celdas de la fila que contiene `texto` (o null si no está en la página).
   * Complementa a `datosDeFilaConEstado`: allí se busca por estado, acá por el
   * identificador de la requisición.
   */
  async datosDeFila(texto) {
    return this.driver.executeScript((t) => {
      const fila = Array.from(document.querySelectorAll('.dx-data-row')).find((f) =>
        (f.textContent || '').includes(t)
      );
      return fila
        ? Array.from(fila.querySelectorAll('td')).map((c) => c.textContent.trim()).filter(Boolean)
        : null;
    }, texto);
  }

  /**
   * Filtra el listado por `texto` y espera a que la fila correspondiente muestre
   * el `estado` indicado. El estado del listado se actualiza de forma asíncrona
   * tras operar sobre la requisición, por eso se poll-ea con espera explícita en
   * vez de leerlo una sola vez.
   *
   * Se busca el estado por TEXTO DE FILA (no por índice de columna) igual que
   * `contarConEstado`: el orden de columnas es configurable por el usuario.
   *
   * @returns {Promise<{coincide:boolean, celdas:string[]|null}>} `celdas` sirve
   *          para mostrar en el reporte qué se leyó realmente cuando falla.
   */
  async esperarEstadoDeRequisicion(texto, estado, timeout = config.timeouts.explicitWaitMs) {
    await this.buscarRequisicion(texto);
    await this._esperarSinLoader(timeout);

    let coincide = false;
    await this.driver
      .wait(async () => {
        coincide = await this.driver.executeScript(
          (t, est) => {
            const fila = Array.from(document.querySelectorAll('.dx-data-row')).find((f) =>
              (f.textContent || '').includes(t)
            );
            return !!fila && new RegExp(est, 'i').test(fila.textContent || '');
          },
          texto,
          estado
        );
        return coincide;
      }, timeout)
      .catch(() => {});

    const celdas = await this.datosDeFila(texto);
    logger.info(
      `RequisicionesPage: estado de "${texto}" ${coincide ? 'coincide' : 'NO coincide'} con "${estado}" -> ${JSON.stringify(celdas)}`
    );
    return { coincide, celdas };
  }

  /**
   * Abre el DETALLE de la n-ésima requisición cuyo estado sea `estado`
   * (doble-click: el Nombre no es un link). Devuelve una RequisicionDetallePage
   * o null si no hay una fila en ese índice.
   *
   * El doble-click a veces entra en edición inline en lugar de abrir el detalle:
   * se reintenta un número ACOTADO de veces (política de ejecución del framework).
   */
  async abrirPorEstado(estado, indice = 0, intentos = 3) {
    const timeout = config.timeouts.explicitWaitMs;
    const labelDetalle = By.xpath("//label[contains(normalize-space(.),'Nombre de requisición')]");
    let ultimoError;

    for (let intento = 0; intento < intentos; intento++) {
      // marcar la fila objetivo en cada intento (el grid puede re-renderizar)
      const marcada = await this.driver.executeScript(
        (est, i) => {
          const prev = document.querySelector('tr[data-qa="fila-objetivo"]');
          if (prev) prev.removeAttribute('data-qa');
          const filas = Array.from(document.querySelectorAll('.dx-data-row')).filter((f) =>
            new RegExp(est, 'i').test(f.textContent || '')
          );
          if (!filas[i]) return false;
          filas[i].setAttribute('data-qa', 'fila-objetivo');
          return true;
        },
        estado,
        indice
      );
      if (!marcada) return null;

      try {
        const fila = await this.driver.findElement(By.css('tr[data-qa="fila-objetivo"]'));
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', fila);
        await this.driver.actions().doubleClick(fila).perform();
        await this._esperarSinLoader(timeout);
        await this.driver.wait(until.elementLocated(labelDetalle), timeout);
        logger.info(`RequisicionesPage: detalle abierto (estado="${estado}", índice ${indice})`);
        return new RequisicionDetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`RequisicionesPage: reintentando abrir por estado (intento ${intento + 1}/${intentos})`);
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

  /**
   * Espera a que no haya overlay de carga (loader-manager) visible.
   * La implementación se subió a UiContext (`esperarSinLoader`) para que la
   * reutilicen todas las páginas y componentes; este método se mantiene como
   * alias interno para no cambiar el código que ya lo usaba.
   */
  async _esperarSinLoader(timeout) {
    await this.esperarSinLoader(timeout);
  }

  /** Texto del pie de paginación del listado. */
  async getResumenPaginacion() {
    return this.grid.getInfoPaginacion();
  }
}

module.exports = RequisicionesPage;
