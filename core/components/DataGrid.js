const { By, Key, until } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');
const { containsTextoIgnoreCase } = require('../utils/xpath');

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

  /**
   * Como `waitVisible`, pero tolerante a que `locator` matchee VARIOS
   * elementos a la vez en el DOM y solo uno esté visible — confirmado con
   * evidencia real: pantallas con más de un `.dx-datagrid`/buscador montado
   * simultáneamente (ej. "Banco de candidatos", un grid POR TAB, uno oculto).
   * `waitVisible` normal ubica el PRIMERO en orden de DOM y espera a que ESE
   * puntual sea visible — si el primero no es el visible, cuelga el timeout
   * completo aunque otro match sí lo esté. Acá se hace poll sobre TODOS los
   * matches hasta que alguno esté visible.
   */
  async _primerVisible(locator, timeout = config.timeouts.explicitWaitMs) {
    let encontrado = null;
    await this.driver.wait(async () => {
      const els = await this.driver.findElements(locator);
      for (const el of els) {
        try {
          if (await el.isDisplayed()) {
            encontrado = el;
            return true;
          }
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout);
    return encontrado;
  }

  /**
   * Espera a que el grid esté visible Y que termine de cargar sus datos
   * (devuelve el componente, encadenable). El contenedor `.dx-datagrid` se
   * monta ANTES de poblarse — sin esperar el loader, una lectura inmediata de
   * `filasPorColumnas()` podía devolver 0 filas aunque el grid sí tuviera
   * datos (confirmado: listado de Empleados recién abierto vía navbar).
   */
  async listo() {
    await this._primerVisible(this.grid);
    await this.esperarSinLoader();
    return this;
  }

  /**
   * Algunos listados (verificado: Empleados) alternan entre "Modo tarjeta"
   * (vista por defecto, tarjetas — este componente NO la puede leer) y "Modo
   * lista" (un `.dx-datagrid` real, sí legible con `filasPorColumnas`/
   * `buscar`/`existeFila`) mediante 2 íconos junto al buscador,
   * identificables por su atributo `title` exacto. Tolerante: si el listado
   * no tiene ese toggle (la mayoría no lo tiene, ya están en modo lista/tabla
   * de por sí), no hace nada y no falla.
   */
  async asegurarModoLista() {
    const botones = await this.driver.findElements(By.css('[title="Modo lista"]'));
    for (const b of botones) {
      if (await b.isDisplayed().catch(() => false)) {
        logger.info('DataGrid: cambiar a "Modo lista"');
        await this.driver.executeScript('arguments[0].click()', b);
        await this.listo();
        return true;
      }
    }
    return false;
  }

  /** Localizador de una fila que contenga `texto` en alguna celda. */
  _filaLocator(texto) {
    return By.xpath(
      `//tr[contains(@class,'dx-data-row')][.//td[${containsTextoIgnoreCase(texto)}]]`
    );
  }

  /**
   * Escribe en el buscador (el grid filtra en vivo). Usa `_primerVisible`
   * (no `waitVisible`): mismo motivo que en `listo()` — puede haber más de
   * un `input[placeholder="Buscar"]` montado a la vez (uno por tab).
   */
  async buscar(texto) {
    logger.info(`DataGrid: buscar "${texto}"`);
    const input = await this._primerVisible(this.searchInput);
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

  /**
   * Selecciona (checkbox) la fila que contiene `texto`, o la PRIMERA fila real
   * del grid si no se pasa `texto`. El checkbox de selección (columna
   * `dx-command-select`) está oculto por CSS hasta que se interactúa con la
   * fila — confirmado con evidencia real: el ícono `.dx-checkbox` en sí tiene
   * `display:none`, pero su CELDA contenedora (`td.dx-command-select`,
   * `aria-label="Seleccionar fila"`) sí es interactiva y dispara la selección
   * al clickearla (un click nativo sobre el ícono oculto tira
   * `element not interactable`). Mismo criterio de grid VISIBLE que
   * `filasPorColumnas` (puede haber más de un `.dx-datagrid` montado, uno por
   * tab, ej. "Banco de candidatos").
   * @returns {Promise<boolean>} true si encontró y clickeó la fila.
   */
  async seleccionarFila(texto) {
    logger.info(`DataGrid: seleccionar fila ${texto ? `"${texto}"` : '(primera)'}`);
    const marcado = await this.driver.executeScript((buscado) => {
      const esVisible = (el) => {
        const estilo = window.getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || parseFloat(estilo.opacity) === 0) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const grid = Array.from(document.querySelectorAll('.dx-datagrid')).find(esVisible);
      if (!grid) return false;
      const filas = Array.from(grid.querySelectorAll('.dx-data-row'));
      const fila = buscado ? filas.find((f) => (f.textContent || '').includes(buscado)) : filas[0];
      if (!fila) return false;
      const celda = fila.querySelector('.dx-command-select');
      if (!celda) return false;
      const prev = document.querySelector('[data-qa="seleccionar-fila"]');
      if (prev) prev.removeAttribute('data-qa');
      celda.setAttribute('data-qa', 'seleccionar-fila');
      return true;
    }, texto || null);

    if (!marcado) return false;
    const celda = await this.driver.findElement(By.css('[data-qa="seleccionar-fila"]'));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', celda);
    await celda.click();
    return true;
  }

  /** Cantidad de filas visibles en la página actual del grid. */
  async contarFilas() {
    const filas = await this.driver.findElements(this.dataRow);
    return filas.length;
  }

  /**
   * Lee TODAS las filas visibles del grid, indexadas por el nombre REAL de
   * cada columna del header (ej. `{Código:"1815", Etapa:"...", Estado:"..."}`).
   * Reutilizable por cualquier caso que necesite verificar/filtrar datos de
   * una fila SIN abrir el detalle (muchos listados del módulo ya exponen
   * columnas de estado/etapa/etc. directamente en el grid).
   *
   * Encabezados y filas se leen DENTRO del `.dx-datagrid` VISIBLE (no de
   * `document` entero): confirmado con evidencia real que una pantalla puede
   * tener MÁS DE UN `.dx-datagrid` montado a la vez aunque solo uno esté
   * visible (ej. "Banco de candidatos", un grid por tab "Elegibles"/
   * "Descartados") — sin este scope, los headers de ambos grids se
   * mezclaban y el mapeo header->celda quedaba desalineado (una columna
   * real, ej. "Nombre", terminaba `undefined`).
   *
   * La visibilidad se determina con estilo computado (`display`/`visibility`/
   * `opacity` + tamaño real), NO con `offsetParent !== null`: confirmado con
   * evidencia real que ese chequeo detecta `display:none` pero NO
   * `visibility:hidden` — un tab inactivo del TabPanel oculto así seguía
   * "encontrado" como si fuera el visible (la búsqueda en pantalla filtraba
   * bien, en el tab correcto, pero esta función seguía leyendo el grid
   * equivocado y nunca encontraba la fila ya filtrada).
   */
  async filasPorColumnas() {
    return this.driver.executeScript(() => {
      const norm = (e) => (e && e.textContent || '').replace(/\s+/g, ' ').trim();
      const esVisible = (el) => {
        const estilo = window.getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || parseFloat(estilo.opacity) === 0) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const grid = Array.from(document.querySelectorAll('.dx-datagrid')).find(esVisible);
      if (!grid) return [];
      const headers = Array.from(
        grid.querySelectorAll('.dx-datagrid-headers .dx-header-row td, .dx-datagrid-headers .dx-header-row th')
      ).map(norm);
      return Array.from(grid.querySelectorAll('.dx-data-row')).map((fila) => {
        const celdas = Array.from(fila.querySelectorAll('td')).map(norm);
        const resultado = {};
        headers.forEach((h, i) => {
          if (h) resultado[h] = celdas[i];
        });
        return resultado;
      });
    });
  }

  /**
   * Repite `buscar(textoBuscar)` + `filasPorColumnas()` hasta que alguna fila
   * cumpla `predicado`, o se agote `timeout`. Pensado para datos que tardan
   * en propagarse ENTRE módulos (confirmado con evidencia real: un empleado
   * recién creado desde una Solicitud de Empleo no aparece de inmediato en el
   * listado de Empleados — ni el registro ni el filtro lo reflejan al toque).
   * Sin este poll, una sola lectura inmediata podía dar falso negativo.
   * Devuelve la fila encontrada o `null` si nunca apareció.
   */
  async esperarFila(textoBuscar, predicado, timeout = 60000, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      await this.buscar(textoBuscar);
      const filas = await this.filasPorColumnas();
      const encontrada = filas.find(predicado);
      if (encontrada) return encontrada;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return null;
  }

  /**
   * Como `esperarFila`, pero SIN pasar por el buscador global (`buscar()`):
   * escanea directamente las filas de la página actual (`filasPorColumnas()`)
   * contra `predicado`, sin filtrar nada en la UI.
   *
   * Usar cuando el buscador global de DevExtreme NO indexa la columna que hace
   * falta consultar — confirmado con evidencia real en al menos 2 grids: la
   * columna "Concepto" de Comportamiento concepto Nómina (tipo catálogo/lookup;
   * `buscar()` devuelve 0 filas aunque el registro exista y sea visible sin
   * filtrar — `aria-rowcount="0"` real, no un problema de lectura de Selenium)
   * y "No. Cuenta Contable" de Cuentas Contables (el buscador global solo
   * indexa "Descripción"). El síntoma es idéntico en ambos casos: `esperarFila`
   * da un falso negativo ("no existe") sobre un registro que SÍ está, lo que
   * hace que un caso "crear" idempotente reintente crear un duplicado y la app
   * lo rechace.
   *
   * Solo confiable en grids ACOTADOS (fixtures QA, no todo el dataset de
   * producción): lee la página actual tal cual está, no pagina para buscar en
   * todo el listado ni cambia el tamaño de página.
   */
  async esperarFilaSinFiltro(predicado, timeout = 60000, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      const filas = await this.filasPorColumnas();
      const encontrada = filas.find(predicado);
      if (encontrada) return encontrada;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return null;
  }

  /**
   * Como `filasPorColumnas`, pero devuelve solo la fila que contiene `texto`
   * en alguna celda (o `null` si no hay ninguna).
   */
  async leerFilaPorColumnas(texto) {
    const filas = await this.filasPorColumnas();
    return filas.find((f) => Object.values(f).some((v) => v && v.includes(texto))) || null;
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
